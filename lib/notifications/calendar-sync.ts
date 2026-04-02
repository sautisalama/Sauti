import { createClient } from "@/utils/supabase/server";
import { 
    createOAuth2ClientFromTokens, 
    createGoogleCalendarEvent, 
    updateGoogleCalendarEvent, 
    refreshGoogleAccessToken,
    GoogleCalendarTokens,
    GoogleCalendarEvent
} from "@/lib/google-calendar-oauth";
import { format } from "date-fns";

/**
 * Syncs a Sauti appointment to the user's linked Google Calendar.
 * Handles token refresh and atomic updates.
 */
export async function syncAppointmentToGoogleCalendar(appointmentId: string, userId: string) {
    const supabase = await createClient();

    // 1. Fetch user tokens and sync status
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('google_calendar_token, google_calendar_refresh_token, google_calendar_token_expiry, calendar_sync_enabled')
        .eq('id', userId)
        .single();

    if (profileError || !profile?.calendar_sync_enabled || !profile?.google_calendar_token) {
        console.log(`Sync skipped for user ${userId}: Calendar not linked or enabled.`);
        return { success: false, reason: 'unlinked' };
    }

    // 2. Fetch appointment details
    const { data: appt, error: apptError } = await supabase
        .from('appointments')
        .select(`
            *,
            professional:profiles!appointments_professional_id_fkey(first_name, last_name, email),
            survivor:profiles!appointments_survivor_id_fkey(first_name, last_name, email, anon_username, is_anonymous)
        `)
        .eq('appointment_id', appointmentId)
        .single();

    if (apptError || !appt) {
        console.error('Failed to fetch appointment for sync:', apptError);
        return { success: false, reason: 'appointment_not_found' };
    }

    // 3. Prepare Tokens (Refresh if needed)
    let tokens: GoogleCalendarTokens = {
        access_token: profile.google_calendar_token,
        refresh_token: profile.google_calendar_refresh_token || undefined,
        expiry_date: profile.google_calendar_token_expiry || undefined
    };

    if (tokens.expiry_date && tokens.expiry_date < Date.now() && tokens.refresh_token) {
        try {
            const newTokens = await refreshGoogleAccessToken(tokens.refresh_token);
            tokens = newTokens;
            // Update DB with new tokens
            await supabase.from('profiles').update({
                google_calendar_token: tokens.access_token,
                google_calendar_token_expiry: tokens.expiry_date
            }).eq('id', userId);
        } catch (refreshErr) {
            console.error('Failed to refresh Google token:', refreshErr);
            return { success: false, reason: 'refresh_failed' };
        }
    }

    // 4. Map to Google Calendar Event
    const isProfessional = userId === appt.professional_id;
    const otherPartyName = isProfessional 
        ? (appt.survivor?.is_anonymous ? (appt.survivor?.anon_username || 'Survivor') : `${appt.survivor?.first_name} ${appt.survivor?.last_name}`)
        : `${appt.professional?.first_name} ${appt.professional?.last_name}`;

    const startDate = new Date(appt.appointment_date!);
    const endDate = new Date(startDate.getTime() + (appt.duration_minutes || 60) * 60000);

    const event: GoogleCalendarEvent = {
        summary: `Sauti Support Session: ${otherPartyName}`,
        description: `Your secure support session organized via Sauti Salama.\n\nType: ${appt.appointment_type}\nNotes: ${appt.notes || 'No additional notes.'}\n\nJoin via Sauti Dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        location: appt.notes?.includes('http') ? appt.notes : 'Sauti Secure Virtual Room',
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'popup', minutes: 30 },
                { method: 'email', minutes: 60 }
            ]
        }
    };

    // 5. Create or Update in Google
    try {
        if (appt.google_calendar_event_id) {
            await updateGoogleCalendarEvent(tokens, appt.google_calendar_event_id, event);
            console.log(`Updated existing Google event ${appt.google_calendar_event_id}`);
        } else {
            const googleEvent = await createGoogleCalendarEvent(tokens, event);
            if (googleEvent.id) {
                await supabase.from('appointments').update({
                    google_calendar_event_id: googleEvent.id,
                    calendar_sync_status: 'synced'
                }).eq('appointment_id', appointmentId);
                console.log(`Created new Google event ${googleEvent.id}`);
            }
        }
        return { success: true };
    } catch (googleErr: any) {
        console.error('Google Calendar API Error:', googleErr);
        await supabase.from('appointments').update({
            calendar_sync_status: 'failed'
        }).eq('appointment_id', appointmentId);
        return { success: false, error: googleErr.message };
    }
}
