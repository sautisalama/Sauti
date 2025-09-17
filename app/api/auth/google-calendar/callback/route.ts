import { NextResponse } from "next/server";

export async function GET(request: Request) {
	// Calendar integration is now optional - redirect to dashboard with info message
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sautisalama.com";
	const redirectUrl = `${baseUrl}/dashboard?message=calendar-optional`;
	return NextResponse.redirect(redirectUrl);
}
