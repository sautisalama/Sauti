import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/utils/supabase/server";
import { cookies, headers } from "next/headers";
import { registerDevice, parseSettings, TrackedDevice } from "@/lib/user-settings";
import { revalidatePath } from "next/cache";
import { Json } from "@/types/db-schema";
import { landingFor } from "@/lib/auth/landing";
import { createAdminClient } from "@/utils/supabase/admin-client";

export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");

	let next = searchParams.get("next") ?? "";

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

			// Device registration logic
			const cookieStore = await cookies();
			const deviceId = cookieStore.get("ss_device_id")?.value;
			const userAgent = (await headers()).get("user-agent") || "";

			const { data: profile } = await supabase
				.from("profiles")
				.select("settings, devices")
				.eq("id", user.id)
				.single();

			const settings = parseSettings(profile?.settings);
			if (deviceId && settings.device_tracking_enabled !== false) {
				const updatedDevices = registerDevice(profile?.devices as TrackedDevice[] | null, deviceId, userAgent);
				await supabase
					.from("profiles")
					.update({ devices: updatedDevices as unknown as Json })
					.eq("id", user.id);
			}
			
			// Revalidate before dashboard redirect
			revalidatePath("/dashboard", "layout");
			// No page asked for: resume the suite they were last in.
			next = await landingFor(supabase, user.id, next.startsWith("/") && !next.startsWith("//") ? next : null);
			// Signed in with Google as an administrator and nothing of theirs is connected yet: one more tap on
			// Google's own consent screen (their account is already chosen) connects mail, calendar and files.
			try {
				if (user.app_metadata.provider === "google" && user.email && !(await cookies()).get("ss_google_offered")) {
					const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
					if (prof?.is_admin) {
						const { data: have } = await createAdminClient().from("mail_accounts" as never).select("id").eq("owner_id", user.id).eq("auth_type", "google").limit(1);
						if (!have?.length) next = `/api/mjengo/mail/oauth/google/start?choice=done&email=${encodeURIComponent(user.email)}`;
					}
				}
			} catch { /* the suite offers the connection later */ }
		}

		if (!error) {
			const forwardedHost = request.headers.get("x-forwarded-host");
			const host = request.headers.get("host");
			const resolvedHost = forwardedHost || host;
			const protocol = resolvedHost?.includes("localhost") || resolvedHost?.includes("192.168") ? "http" : "https";
			
			const redirectOrigin = resolvedHost ? `${protocol}://${resolvedHost}` : origin;
			const redirectUrl = `${redirectOrigin}${next}`;
			
			const res = NextResponse.redirect(redirectUrl);
			// Offered once a month at most, so a person who declines is not sent round again at every sign-in.
			if (next.startsWith("/api/mjengo/mail/oauth/google/start")) res.cookies.set("ss_google_offered", "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
			return res;
		} else {
			console.error("Auth exchange error:", error);
			const forwardedHost = request.headers.get("x-forwarded-host");
			const host = request.headers.get("host");
			const resolvedHost = forwardedHost || host;
			const protocol = resolvedHost?.includes("localhost") || resolvedHost?.includes("192.168") ? "http" : "https";
			const redirectOrigin = resolvedHost ? `${protocol}://${resolvedHost}` : origin;
			
			return NextResponse.redirect(
				`${redirectOrigin}/error?message=${encodeURIComponent(error.message || 'auth_exchange_failed')}`
			);
		}
	}

	console.error("No code provided in callback");
	const forwardedHost = request.headers.get("x-forwarded-host");
	const host = request.headers.get("host");
	const resolvedHost = forwardedHost || host;
	const protocol = resolvedHost?.includes("localhost") || resolvedHost?.includes("192.168") ? "http" : "https";
	const redirectOrigin = resolvedHost ? `${protocol}://${resolvedHost}` : origin;
	
	return NextResponse.redirect(`${redirectOrigin}/error?message=no_code_provided`);
}
