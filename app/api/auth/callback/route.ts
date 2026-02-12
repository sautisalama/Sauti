import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");

	const next = searchParams.get("next") ?? "/dashboard";

	if (code) {
		const supabase = await createClient();
		const { data, error } = await supabase.auth.exchangeCodeForSession(code);

		if (!error && data?.user) {
			const { user } = data;
			
			// Auto-sync Google Profile Data if available and profile is incomplete
			if (user.app_metadata.provider === "google" || user.user_metadata.full_name) {
				const { data: profile } = await supabase
					.from("profiles")
					.select("first_name, last_name")
					.eq("id", user.id)
					.single();

				// Update if profile is missing name or set to default "Anonymous"
				if (profile && (!profile.first_name || profile.first_name === "Anonymous")) {
					const fullName = user.user_metadata.full_name || user.user_metadata.name || "";
					const [firstName, ...lastNameParts] = fullName.split(" ");
					const lastName = lastNameParts.join(" ");

					if (firstName) {
						await supabase
							.from("profiles")
							.update({
								first_name: firstName,
								last_name: lastName || "",
								// avatar_url: user.user_metadata.avatar_url // Optional: sync avatar too
							})
							.eq("id", user.id);
					}
				}
			}
		}

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
			return NextResponse.redirect(redirectUrl);
		} else {
			console.error("Auth exchange error:", error);
			return NextResponse.redirect(
				`${origin}/error?message=${encodeURIComponent(error.message || 'auth_exchange_failed')}`
			);
		}
	}

	console.error("No code provided in callback");
	return NextResponse.redirect(`${origin}/error?message=no_code_provided`);
}
