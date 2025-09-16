import { NextResponse } from "next/server";

export async function GET() {
	const config = {
		// Environment variables check
		googleClientId: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
		googleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
		appUrl: process.env.NEXT_PUBLIC_APP_URL,

		// Supabase check
		supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
		supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
	};

	const allConfigured =
		config.googleClientId &&
		config.googleClientSecret &&
		config.appUrl &&
		config.supabaseUrl &&
		config.supabaseAnonKey;

	return NextResponse.json({
		message: "Calendar setup configuration check",
		config,
		allConfigured,
		nextSteps: allConfigured
			? [
					"1. Test calendar connection at /api/auth/google-calendar",
					"2. Check calendar sync at /api/test/supabase-calendar",
					"3. Add CalendarConnection component to your dashboard",
			  ]
			: [
					"1. Add missing environment variables to .env.local",
					"2. Restart your development server",
					"3. Re-run this test",
			  ],
	});
}
