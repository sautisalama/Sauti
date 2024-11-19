import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get("code");
	const next = requestUrl.searchParams.get("next") ?? "/dashboard";

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (error) {
			console.error("Auth callback error:", error);
			const errorUrl = new URL(
				"/error",
				process.env.NEXT_PUBLIC_APP_URL || request.url
			);
			return NextResponse.redirect(errorUrl);
		}
	}

	const redirectUrl = new URL(
		next,
		process.env.NEXT_PUBLIC_APP_URL || request.url
	);
	return NextResponse.redirect(redirectUrl);
}
