import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	// Add more detailed logging
	console.log("Full request URL:", request.url);
	console.log("Search params:", Object.fromEntries(searchParams.entries()));
	console.log("Headers:", Object.fromEntries(request.headers.entries()));

	const next = searchParams.get("next") ?? "/dashboard";

	if (code) {
		const supabase = await createClient();
		const { data, error } = await supabase.auth.exchangeCodeForSession(code);
		console.log("Exchange response:", { data, error });

		if (!error) {
			const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
			const isLocalEnv = process.env.NODE_ENV === "development";

			// Construct redirect URL
			let redirectUrl;
			if (isLocalEnv) {
				redirectUrl = `${origin}${next}`;
			} else {
				redirectUrl = `https://${forwardedHost || new URL(origin).host}${next}`;
			}

			console.log("Redirecting to:", redirectUrl);
			return NextResponse.redirect(redirectUrl);
		} else {
			console.error("Auth exchange error:", error);
			return NextResponse.redirect(`${origin}/error?message=auth_exchange_failed`);
		}
	}

	console.error("No code provided in callback");
	return NextResponse.redirect(`${origin}/error?message=no_code_provided`);
}
