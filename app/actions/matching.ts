'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { MatchStatusType, TimeSlot } from '@/types/chat'
import { Json } from '@/types/db-schema'

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
    user_id: match.survivor_id,
    title: 'Match Accepted',
    message: 'A professional has accepted your case and proposed meeting times.',
    type: 'match_accepted',
    link: '/dashboard/matches',
    metadata: { match_id: matchId }
  })
  
  revalidatePath('/dashboard/matches')
  revalidatePath('/dashboard/cases')
  return { success: true }
}

/**
 * Professional rejects a match request
 * Transitions match from 'proposed' -> 'declined'
 * Triggers the matching engine to find the next best professional
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

  // TODO: Trigger matching engine again for this report to find next candidate
  // This would be handled by a separate function or edge function
  // await findNextMatch(match.report_id) 

  revalidatePath('/dashboard/matches')
  revalidatePath('/dashboard/cases')
  return { success: true, reportId: match.report_id }
}

/**
 * Survivor confirms the match and selected time
 * Transitions match from 'pending_survivor' -> 'accepted'
 * Creates the Chat room and Appointment
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
      survivor:profiles!matched_services_survivor_id_fkey(id, first_name, last_name, avatar_url, anon_username, is_anonymous)
    `)
    .single()

  if (error || !match) {
    throw new Error('Failed to confirm match')
  }

  // 2. Create Chat Room
  const survivorData = match.survivor as unknown as { first_name: string | null, last_name: string | null, anon_username: string | null, is_anonymous: boolean | null };
  const survivorName = survivorData?.is_anonymous 
    ? (survivorData?.anon_username ?? 'Anonymous') 
    : (survivorData?.first_name ?? 'Survivor');

  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .insert({
      type: 'support_match',
      created_by: match.survivor_id,
      match_id: match.id,
      metadata: {
        match_id: match.id,
        service_name: (match as any).support_services?.name || 'Service',
        survivor_name: survivorName,
        case_id: match.id
      } as any
    })
    .select()
    .single()
  
  if (chatError) {
    console.error('Failed to create chat:', chatError)
    throw new Error('Failed to initialize chat')
  }

  // 3. Add Participants
  const participants = [
    { chat_id: chat.id, user_id: match.survivor_id, status: { role: 'member' } as any },
    { chat_id: chat.id, user_id: (match as any).support_services?.user_id, status: { role: 'admin' } as any }
  ]
  
  const { error: partError } = await supabase
    .from('chat_participants')
    .insert(participants)

  if (partError) {
    console.error('Failed to add participants:', partError)
  }

  // 4. Update match with chat_id
  await supabase
    .from('matched_services')
    .update({ chat_id: chat.id })
    .eq('id', matchId)

  // 5. Create appointment if time was selected
  if (selectedTime) {
    const { error: apptError } = await supabase
      .from('appointments')
      .insert({
        survivor_id: match.survivor_id,
        professional_id: (match as any).support_services?.user_id,
        matched_services: matchId,
        appointment_date: selectedTime.slot_start,
        duration_minutes: 60,
        status: 'confirmed',
        appointment_type: 'Initial Consultation',
        created_via: 'match_confirmation'
      })

    if (apptError) {
      console.error('Failed to create appointment:', apptError)
    }
  }

  // 6. Notify professional
  await supabase.from('notifications').insert({
    user_id: (match as any).support_services?.user_id,
    title: 'Match Confirmed',
    message: 'A survivor has confirmed the match. You can now start chatting.',
    type: 'match_confirmed',
    link: `/dashboard/chat/${chat.id}`,
    metadata: { match_id: matchId, chat_id: chat.id }
  })

  // 7. Send system message to chat
  await supabase.from('messages').insert({
    chat_id: chat.id,
    sender_id: null,
    content: 'This secure chat has been created for your case. All messages are confidential.',
    type: 'system',
    metadata: {}
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/chat')
  return { success: true, chatId: chat.id }
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
    // Can't accommodate - keep as reschedule_requested or handle differently
    // For now, we'll just update the notes
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
