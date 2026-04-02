'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { MatchStatusType, TimeSlot } from '@/types/chat'
import { matchReportWithServices } from './match-services'
import { createAppointment } from '../dashboard/_views/actions/appointments'
import { getCaseChat, sendMessage } from './chat'
import { format } from 'date-fns'
import { sendEmail } from '@/lib/notifications/email'
import { getAppointmentScheduledTemplate, getAppointmentConfirmedTemplate } from '@/lib/notifications/templates'
import { syncAppointmentToGoogleCalendar } from '@/lib/notifications/calendar-sync'

/**
 * Professional accepts a match request
 * Transitions match from 'proposed' -> 'pending_survivor'
 * Prompts professional to propose meeting times
 */
export async function acceptMatchRequest(matchId: string, proposedTimes?: TimeSlot[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Verify the professional owns the service associated with this match
  const { data: match, error: fetchError } = await supabase
    .from('matched_services')
    .select(`
      *,
      support_services:service_id(user_id)
    `)
    .eq('id', matchId)
    .single()

  if (fetchError || !match) {
    throw new Error('Match not found')
  }

  const supportService = match.support_services as unknown as { user_id: string } | null;
  if (supportService?.user_id !== user.id) {
    throw new Error('Unauthorized - not the service owner')
  }
  
  const { error } = await supabase
    .from('matched_services')
    .update({ 
      match_status_type: 'pending_survivor',
      professional_accepted_at: new Date().toISOString(),
      proposed_meeting_times: (proposedTimes || []) as any,
      updated_at: new Date().toISOString()
    })
    .eq('id', matchId)
    .eq('match_status_type', 'proposed')

  if (error) {
    console.error('Failed to accept match:', error)
    throw new Error('Failed to accept match request')
  }

  // Create notification for survivor
  await supabase.from('notifications').insert({
    user_id: match.survivor_id!,
    title: 'Match Accepted',
    message: 'A professional has accepted your case and proposed meeting times.',
    type: 'match_accepted',
    link: `/dashboard/reports/${match.report_id}`,
    metadata: { 
      match_id: matchId,
      actions: [
        { label: 'View Times', link: `/dashboard/reports/${match.report_id}` }
      ]
    }
  })

  // Send Email to Survivor
  try {
    const { data: survivor } = await supabase.from('profiles').select('email, first_name, anon_username, is_anonymous').eq('id', match.survivor_id!).single();
    if (survivor?.email) {
      const firstTime = proposedTimes?.[0];
      await sendEmail(
        survivor.email,
        'Support Connection: New Times Proposed',
        getAppointmentScheduledTemplate({
          userName: survivor.is_anonymous ? (survivor.anon_username || 'Survivor') : (survivor.first_name || 'Survivor'),
          professionalName: 'Your Sauti Specialist',
          date: firstTime ? format(new Date(firstTime.slot_start), 'PPPP') : 'Flexible',
          time: firstTime ? format(new Date(firstTime.slot_start), 'p') : 'Discuss in chat',
          type: 'Virtual Consultation',
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/reports/${match.report_id}`
        })
      );
    }
  } catch (emailErr) {
    console.error('Email notification failed:', emailErr);
  }
  
  revalidatePath('/dashboard/matches')
  revalidatePath('/dashboard/cases')
  return { success: true }
}

/**
 * Professional rejects a match request
 * Transitions match from 'proposed' -> 'declined'
 * Automatically triggers re-matching to find the next best professional
 */
export async function rejectMatchRequest(matchId: string, reason?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }
  
  const { data: match, error: fetchError } = await supabase
    .from('matched_services')
    .select('report_id, survivor_id')
    .eq('id', matchId)
    .single()

  if (fetchError || !match) {
    throw new Error('Match not found')
  }

  const { error } = await supabase
    .from('matched_services')
    .update({ 
      match_status_type: 'declined',
      decline_reason: reason || 'Declined by professional',
      notes: reason ? `Declined by professional: ${reason}` : 'Declined by professional',
      updated_at: new Date().toISOString()
    })
    .eq('id', matchId)

  if (error) {
    throw new Error('Failed to reject match')
  }

  // Trigger re-matching for this report at cascade level 1
  // This ensures the next best candidate is found immediately
  try {
    if (match.report_id) {
      await matchReportWithServices(match.report_id)
    }
  } catch (reMatchError) {
    console.error(`Re-matching after decline failed for report ${match.report_id}:`, reMatchError)
    // Don't throw — the decline itself succeeded
  }

  revalidatePath('/dashboard/matches')
  revalidatePath('/dashboard/cases')
  return { success: true, reportId: match.report_id }
}

/**
 * Survivor confirms the match and selected time.
 * Transitions match from 'pending_survivor' -> 'accepted'.
 * Creates the Chat room, adds participants, and optionally creates an Appointment.
 */
export async function confirmMatch(matchId: string, selectedTime?: TimeSlot) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }
  
  // 1. Update match status
  const { data: match, error } = await supabase
    .from('matched_services')
    .update({ 
      match_status_type: 'accepted',
      survivor_accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', matchId)
    .eq('survivor_id', user.id)
    .select(`
      *,
      report:reports(report_id, type_of_incident),
      survivor:profiles!matched_services_survivor_id_fkey(id, first_name, last_name, avatar_url, anon_username, is_anonymous),
      support_services:service_id!matched_services_service_id_fkey(id, name, user_id)
    `)
    .single()

  if (error) {
    console.error('Failed to confirm match:', error);
    throw new Error('Match confirmation failed');
  }

  if (!match) {
    throw new Error('Match not found');
  }

  const professionalId = (match.support_services as any)?.user_id;
  const survivorData = match.survivor as any;
  const survivorName = survivorData?.is_anonymous 
    ? (survivorData?.anon_username ?? 'Anonymous') 
    : (survivorData?.first_name ?? 'Survivor');

  // 2. Ensure Consolidated Chat Room
  const chat = await getCaseChat(match.id, match.survivor_id!);
  const chatId = chat.id;
  
  if (!chatId) {
    throw new Error('Failed to initialize chat');
  }

  // 4. Update match with chat_id
  await supabase
    .from('matched_services')
    .update({ chat_id: chat.id })
    .eq('id', matchId)

  // 5. Create appointment if time was selected
  if (selectedTime && professionalId) {
    const { error: apptError } = await supabase
      .from('appointments')
      .insert({
        survivor_id: match.survivor_id!,
        professional_id: professionalId,
        matched_services: matchId,
        appointment_date: selectedTime.slot_start,
        duration_minutes: 60,
        status: 'confirmed',
        appointment_type: 'Initial Consultation',
        created_via: 'match_confirmation'
      })

    if (apptError) {
      console.error('Failed to create appointment:', apptError)
    } else {
        // Sync to Google Calendar for both parties
        const { data: appt } = await supabase.from('appointments').select('appointment_id').eq('matched_services', matchId).single();
        if (appt) {
            syncAppointmentToGoogleCalendar(appt.appointment_id, match.survivor_id!).catch(e => console.error('Survivor calendar sync failed:', e));
            syncAppointmentToGoogleCalendar(appt.appointment_id, professionalId!).catch(e => console.error('Professional calendar sync failed:', e));
        }
    }
  }

  // 4. Notify Survivor
  const survivorId = match.survivor_id || (match.report as any)?.user_id;
  if (survivorId) {
    await supabase.from('notifications').insert({
      user_id: survivorId,
      title: 'Match Accepted & Scheduled',
      message: `A professional has accepted your case and scheduled a session.`,
      type: 'match_confirmed',
      link: `/dashboard/reports/${match.report_id}`,
      metadata: { 
        match_id: matchId,
        actions: [
          { label: 'View Schedule', link: `/dashboard/reports/${match.report_id}` },
          { label: 'Reschedule', variant: 'outline', action: 'reschedule', match_id: matchId }
        ]
      }
    });

    // Send Email to Survivor
    try {
      const { data: survivor } = await supabase.from('profiles').select('email, first_name, anon_username, is_anonymous').eq('id', survivorId).single();
      if (survivor?.email) {
        await sendEmail(
          survivor.email,
          'Support Session Scheduled',
          getAppointmentConfirmedTemplate({
            userName: survivor.is_anonymous ? (survivor.anon_username || 'Survivor') : (survivor.first_name || 'Survivor'),
            professionalName: (match.support_services as any)?.name || 'Sauti Specialist',
            date: selectedTime ? format(new Date(selectedTime.slot_start), 'PPPP') : 'TBD',
            time: selectedTime ? format(new Date(selectedTime.slot_start), 'p') : 'TBD',
            type: 'Virtual Consultation',
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/reports/${match.report_id}`
          })
        );
      }
    } catch (emailErr) {
      console.error('Survivor email failed:', emailErr);
    }
  }

  // 6. Notify professional
  if (professionalId) {
    await supabase.from('notifications').insert({
      user_id: professionalId!,
      title: 'Match Confirmed',
      message: 'A survivor has confirmed the match. You can now start chatting.',
      type: 'match_confirmed',
      link: `/dashboard/chat/${chat.id}`,
      metadata: { 
        match_id: matchId, 
        chat_id: chat.id,
        actions: [
          { label: 'Open Chat', link: `/dashboard/chat/${chat.id}` },
          { label: 'View Case', link: `/dashboard/cases/${matchId}` }
        ]
      }
    })

    // Send Email to Professional
    try {
      const { data: prof } = await supabase.from('profiles').select('email, first_name').eq('id', professionalId).single();
      if (prof?.email) {
        await sendEmail(
          prof.email,
          'Case Confirmed: New Support Session',
          getAppointmentConfirmedTemplate({
            userName: prof.first_name || 'Professional',
            professionalName: survivorName,
            date: selectedTime ? format(new Date(selectedTime.slot_start), 'PPPP') : 'TBD',
            time: selectedTime ? format(new Date(selectedTime.slot_start), 'p') : 'TBD',
            type: 'Initial Session',
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/cases/${matchId}`
          })
        );
      }
    } catch (emailErr) {
      console.error('Professional email failed:', emailErr);
    }
  }

  // 7. Send automated match summary message
  const matchMessage = `🗓️ **Match Confirmed**
**Incident:** ${(match?.report as any)?.type_of_incident || 'Support Case'}
**Scheduled for:** ${selectedTime ? format(new Date(selectedTime.slot_start), 'PPP p') : 'To be scheduled'}
**Connection:** ${survivorName} & ${(match?.support_services as any)?.name || 'Professional'}`;

  await sendMessage(chatId, matchMessage, 'system', { 
    type: 'match_start', 
    match_id: matchId,
    report_id: match?.report_id
  });

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/chat')
  return { success: true, chatId: chat.id }
}

/**
 * Consolidates the entire Professional "Accept & Schedule" flow.
 * Ensures atomicity and avoids "Match not found" errors by performing all ops on the server.
 */
export async function acceptAndScheduleCase(
  matchId: string, 
  appointmentData?: { 
    date: Date; 
    duration: number; 
    type: string; 
    notes?: string; 
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // 1. Fetch match and verify ownership
  const { data: match, error: fetchError } = await supabase
    .from('matched_services')
    .select(`
      *,
      support_services:service_id(id, name, user_id),
      report:reports(report_id, user_id)
    `)
    .eq('id', matchId)
    .single()

  if (fetchError || !match) {
    console.error(`acceptAndScheduleCase: Match fetch failed [${matchId}]:`, fetchError)
    throw new Error('Match record not found')
  }

  const serviceData = match.support_services as unknown as { id: string, name: string | null, user_id: string | null } | null;
  if (serviceData?.user_id !== user.id) {
    throw new Error('Unauthorized - you do not own the service for this case')
  }

  // 2. Update Match Status
  const { error: matchUpdateError } = await supabase
    .from('matched_services')
    .update({ 
      match_status_type: 'accepted',
      professional_accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', matchId)

  if (matchUpdateError) throw new Error(`Failed to update match status: ${matchUpdateError.message}`)

  // 3. Create Appointment if provided
  const survivorId = match.survivor_id || (match.report as any)?.user_id;
  if (appointmentData) {
    const { data: newAppt, error: apptError } = await supabase
      .from('appointments')
      .insert({
        survivor_id: survivorId!,
        professional_id: user.id,
        matched_services: matchId,
        appointment_date: appointmentData.date.toISOString(),
        duration_minutes: appointmentData.duration || 60,
        status: 'confirmed',
        appointment_type: appointmentData.type || 'consultation',
        notes: appointmentData.notes || 'Initial consultation'
      })
      .select('appointment_id')
      .single()

    if (apptError) {
      console.error('acceptAndScheduleCase: Appointment creation failed:', apptError)
    } else if (newAppt) {
        // Sync to Google Calendar for both
        syncAppointmentToGoogleCalendar(newAppt.appointment_id, survivorId!).catch(e => console.error('Survivor calendar sync failed:', e));
        syncAppointmentToGoogleCalendar(newAppt.appointment_id, user.id).catch(e => console.error('Professional calendar sync failed:', e));
    }
  }

  // 4. Ensure Chat Room
  let chatId = match.chat_id;
  if (!chatId) {
    try {
      const chatResult = await ensureChatForMatch(matchId)
      chatId = chatResult.chatId || null;
    } catch (chatErr) {
      console.error('acceptAndScheduleCase: Chat creation failed:', chatErr)
    }
  }

  // 5. Case Exclusivity (Decline others)
  const reportId = match.report_id || (match.report as any)?.report_id;
  if (reportId) {
    await markCaseAsExclusive(reportId, matchId)
    
    // 6. Sync Report Status
    await supabase
      .from('reports')
      .update({ 
        match_status: 'accepted',
        ismatched: true,
        updated_at: new Date().toISOString()
      })
      .eq('report_id', reportId)
  }

  revalidatePath('/dashboard/cases')
  revalidatePath('/dashboard/reports')
  revalidatePath('/dashboard/chat')
  
  return { success: true, chatId }
}

/**
 * Creates a chat room for a match that was accepted via scheduling
 * but didn't have a chat created yet.
 * Called when professional accepts and schedules — enables chat immediately.
 */
export async function ensureChatForMatch(matchId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Check if chat already exists
  const { data: match, error: fetchError } = await supabase
    .from('matched_services')
    .select('id, chat_id, survivor_id, service_id')
    .eq('id', matchId)
    .single()

  if (fetchError || !match) {
    console.error(`ensureChatForMatch: Match fetch failed for ID [${matchId}]:`, fetchError)
    throw new Error(`Match not found: ${matchId}`)
  }
  
  if (match.chat_id) return { success: true, chatId: match.chat_id }

  if (!match.service_id) {
    throw new Error('Match record is missing a service ID')
  }

  // Fetch service details for professional ID
  const { data: service, error: serviceError } = await supabase
    .from('support_services')
    .select('id, name, user_id')
    .eq('id', match.service_id)
    .single()

  if (serviceError || !service) {
    console.error(`ensureChatForMatch: Service fetch failed for ID [${match.service_id}]:`, serviceError)
    throw new Error('No professional service linked to this match')
  }

  const professionalId = service.user_id;

  if (!professionalId) throw new Error('No professional user linked to this service')

  if (!match.survivor_id) throw new Error('No survivor linked to this match')

  // 2. Use Consolidated Chat Logic
  const { id: chatId } = await getCaseChat(matchId, match.survivor_id!);

  // 3. Update match with chat_id
  await supabase
    .from('matched_services')
    .update({ chat_id: chatId })
    .eq('id', matchId)

  // 4. Send automated match summary message
  const matchMessage = `🗓️ **Match Confirmed**
**Incident:** Support connection established.
**Status:** Ready to coordinate care.`;

  await sendMessage(chatId, matchMessage, 'system', { 
    type: 'match_start', 
    match_id: matchId 
  });

  // Notify both parties
  await supabase.from('notifications').insert([
    {
      user_id: match.survivor_id,
      title: 'Chat Available',
      message: 'A secure chat has been set up with your matched professional.',
      type: 'chat_created',
      link: `/dashboard/chat/${chatId}`,
      metadata: { match_id: matchId, chat_id: chatId }
    },
    {
      user_id: professionalId,
      title: 'Chat Available',
      message: 'A secure chat has been set up with the matched survivor.',
      type: 'chat_created',
      link: `/dashboard/chat/${chatId}`,
      metadata: { match_id: matchId, chat_id: chatId }
    }
  ])

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/chat')
  return { success: true, chatId }
}

/**
 * Survivor requests a reschedule with alternative times
 * Transitions match -> 'reschedule_requested'
 */
export async function requestReschedule(matchId: string, preferredTimes: TimeSlot[], reason?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }
    
  const { data: match, error } = await supabase
    .from('matched_services')
    .update({
      match_status_type: 'reschedule_requested',
      proposed_meeting_times: preferredTimes as any,
      description: reason ? `Reschedule requested: ${reason}` : 'Reschedule requested by survivor',
      updated_at: new Date().toISOString()
    })
    .eq('id', matchId)
    .eq('survivor_id', user.id)
    .select(`
      id,
      support_services:service_id!matched_services_service_id_fkey(user_id)
    `)
    .single()

  if (error) {
    throw new Error('Failed to request reschedule')
  }

  // Notify professional
  const professionalId = (match?.support_services as any)?.user_id
  if (professionalId) {
    await supabase.from('notifications').insert({
      user_id: professionalId,
      title: 'Reschedule Requested',
      message: 'A survivor has requested to reschedule the meeting.',
      type: 'reschedule_requested',
      link: '/dashboard/cases',
      metadata: { match_id: matchId }
    })
  }
    
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/matches')
  return { success: true }
}

/**
 * Professional responds to reschedule request
 */
export async function respondToReschedule(matchId: string, accept: boolean, newTime?: TimeSlot) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  if (accept && newTime) {
    // Accept with new time - go back to pending_survivor
    const { error } = await supabase
      .from('matched_services')
      .update({
        match_status_type: 'pending_survivor',
        proposed_meeting_times: [newTime] as any,
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId)

    if (error) throw new Error('Failed to respond to reschedule')

    // Get survivor to notify
    const { data: match } = await supabase
      .from('matched_services')
      .select('survivor_id')
      .eq('id', matchId)
      .single()

    if (match?.survivor_id) {
      await supabase.from('notifications').insert({
        user_id: match.survivor_id,
        title: 'New Time Proposed',
        message: 'The professional has proposed a new meeting time.',
        type: 'new_time_proposed',
        link: '/dashboard/matches',
        metadata: { match_id: matchId }
      })
    }
  } else {
    await supabase
      .from('matched_services')
      .update({
        notes: 'Professional unable to accommodate reschedule request',
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId)
  }

  revalidatePath('/dashboard/cases')
  return { success: true }
}

/**
 * Get match details with all related data
 */
export async function getMatchDetails(matchId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('matched_services')
    .select(`
      *,
      survivor:profiles!matched_services_survivor_id_fkey(id, first_name, last_name, avatar_url, anon_username, is_anonymous),
      report:reports!matched_services_report_id_fkey(report_id, type_of_incident, urgency, first_name),
      support_services:service_id!matched_services_service_id_fkey(
        id, 
        name, 
        service_types, 
        user_id,
        email,
        phone_number,
        professional:profiles!support_services_user_id_fkey(id, first_name, last_name, avatar_url, professional_title)
      ),
      chat:chats!matched_services_chat_id_fkey(id, type, last_message_at),
      appointments(appointment_id, appointment_date, status, duration_minutes)
    `)
    .eq('id', matchId)
    .single()

  if (error) {
    console.error('Failed to get match details:', error)
    throw new Error('Match not found')
  }

  return data
}

/**
 * Get all matches for the current user (works for both survivor and professional)
 */
export async function getUserMatches(status?: MatchStatusType) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  let query = supabase
    .from('matched_services')
    .select(`
      *,
      survivor:profiles!matched_services_survivor_id_fkey(id, first_name, last_name, avatar_url, anon_username, is_anonymous),
      support_services:service_id!matched_services_service_id_fkey(id, name, service_types, user_id),
      report:reports!matched_services_report_id_fkey(type_of_incident, urgency)
    `)
    .or(`survivor_id.eq.${user.id},support_services.user_id.eq.${user.id}`)
    .order('match_date', { ascending: false })

  if (status) {
    query = query.eq('match_status_type', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to get matches:', error)
    throw new Error('Failed to fetch matches')
  }

  return data
}

/**
 * Marks a case as exclusive by setting all other matches for the same report to declined
 * Called when a professional accepts and schedules a case.
 */
export async function markCaseAsExclusive(reportId: string, acceptedMatchId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('matched_services')
    .update({
      match_status_type: 'declined', // Use 'declined' so it drops out of pending lists
      decline_reason: 'Taken by another professional',
      notes: 'Another professional has accepted and scheduled this case.',
      updated_at: new Date().toISOString()
    })
    .eq('report_id', reportId)
    .neq('id', acceptedMatchId)
    .neq('match_status_type', 'accepted')
    .neq('match_status_type', 'completed')

  if (error) {
    console.error('Failed to make case exclusive:', error)
  }

  revalidatePath('/dashboard/cases')
  revalidatePath('/dashboard/reports') // Ensure survivor view also updates
  return { success: true }
}

/**
 * Consolidated function to ensure a report and its active match are perfectly synchronized.
 * Used when a survivor accepts a match or when a professional schedules.
 */
export async function syncReportStatus(reportId: string, matchId: string, status: MatchStatusType = 'accepted') {
  const supabase = await createClient()
  
  // 1. Update the report table
  await supabase
    .from('reports')
    .update({ 
      match_status: status,
      ismatched: status === 'accepted' || status === 'completed',
      updated_at: new Date().toISOString()
    })
    .eq('report_id', reportId)

  // 2. Update the winning match
  await supabase
    .from('matched_services')
    .update({ 
      match_status_type: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', matchId)

  // 3. Mark case as exclusive (decline others)
  if (status === 'accepted') {
    await markCaseAsExclusive(reportId, matchId)
  }

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/reports/${reportId}`)
  return { success: true }
}
