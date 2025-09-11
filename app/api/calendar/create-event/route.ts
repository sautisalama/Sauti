import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { CalendarEvent } from '@/lib/google-calendar';
import { google } from 'googleapis';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { appointmentId, event } = body as { appointmentId: string; event: CalendarEvent };

    // Get user's Google Calendar token
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_calendar_token, google_calendar_refresh_token')
      .eq('id', user.id)
      .single();

    if (!profile?.google_calendar_token) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
    }

    // Prepare Google OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_APP_URL
    );
    oauth2Client.setCredentials({
      access_token: profile.google_calendar_token,
      refresh_token: profile.google_calendar_refresh_token || undefined,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Normalize event dates
    const startISO = new Date((event as any).start).toISOString();
    const endISO = new Date((event as any).end).toISOString();

    // Insert event
    const insertResp = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: { dateTime: startISO },
        end: { dateTime: endISO },
        attendees: event.attendees?.map((email) => ({ email })),
        reminders: { useDefault: true },
      },
    });

    const googleEventId = insertResp.data.id;

    // Store the Google Calendar event ID in the appointment
    await supabase
      .from('appointments')
      .update({ google_calendar_event_id: googleEventId })
      .eq('appointment_id', appointmentId);

    return NextResponse.json({ success: true, eventId: googleEventId });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}
