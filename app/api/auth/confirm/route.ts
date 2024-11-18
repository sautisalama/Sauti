import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
	let requestUrl = new URL(request.url);
	let code = requestUrl.searchParams.get("code");

	if (code) {
		let supabase = createClient();
		await supabase.auth.exchangeCodeForSession(code);
	}

	// URL to redirect to after sign in process completes
	return NextResponse.redirect(requestUrl.origin);
	//return NextResponse.redirect('https://testing.d1n70pub9ihfwm.amplifyapp.com');
}
