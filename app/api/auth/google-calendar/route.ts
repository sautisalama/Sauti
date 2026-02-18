import { NextResponse } from "next/server";

export async function GET() {
	// Calendar integration is now optional - redirect to calendar settings
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sautisalama.com";
	const redirectUrl = `${baseUrl}/dashboard/profile?section=calendar&message=calendar-optional`;
	return NextResponse.redirect(redirectUrl);
}
