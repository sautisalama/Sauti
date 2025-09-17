import { NextResponse } from "next/server";

export async function GET(request: Request) {
	// Calendar integration is now optional - redirect to dashboard with info message
	const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?message=calendar-optional`;
	return NextResponse.redirect(redirectUrl);
}
