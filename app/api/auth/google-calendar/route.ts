import { NextResponse } from "next/server";

export async function GET() {
	// Calendar integration is now optional - redirect to dashboard with info message
	return NextResponse.redirect("/dashboard?message=calendar-optional");
}
