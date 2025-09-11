import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.redirect('/dashboard?error=calendar_auth_failed');
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    // Store the tokens in the user's profile or session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase
        .from('profiles')
        .update({
          google_calendar_token: tokens.access_token,
          google_calendar_refresh_token: tokens.refresh_token,
        })
        .eq('id', user.id);
    }

    return NextResponse.redirect('/dashboard?calendar_connected=true');
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    return NextResponse.redirect('/dashboard?error=calendar_auth_failed');
  }
}
