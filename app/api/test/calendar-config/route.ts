import { NextResponse } from "next/server";

export async function GET() {
	const config = {
		googleClientId: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
		googleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
		appUrl: process.env.NEXT_PUBLIC_APP_URL,
		supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
		supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
	};

	return NextResponse.json({
		message: "Calendar configuration check",
		config,
		allConfigured:
			config.googleClientId && config.googleClientSecret && config.appUrl,
	});
}
