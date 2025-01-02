import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	try {
		const requestUrl = new URL(request.url);
		const code = requestUrl.searchParams.get("code");
		const next = requestUrl.searchParams.get("next") ?? "/dashboard";

		if (!code) {
			console.error("No code provided in the callback");
			return NextResponse.redirect(new URL("/error", request.url));
		}

		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (error) {
			console.error("Session exchange error:", error);
			return NextResponse.redirect(new URL("/error", request.url));
		}

		// If successful, redirect to the dashboard
		return NextResponse.redirect(new URL(next, process.env.NEXT_PUBLIC_APP_URL));
	} catch (error) {
		console.error("Unexpected error in auth confirm:", error);
		return NextResponse.redirect(new URL("/error", request.url));
	}
}
