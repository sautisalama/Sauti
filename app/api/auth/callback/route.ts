import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get("code");

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		console.error("Session exchange error:", error);
	}

	// URL to redirect to after sign in process completes
	return NextResponse.redirect(requestUrl.origin);
	//return NextResponse.redirect('https://testing.d1n70pub9ihfwm.amplifyapp.com');
}
