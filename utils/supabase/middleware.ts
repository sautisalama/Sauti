import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseAnonKey) {
		console.error(
			"Supabase env vars are missing in middleware. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL and SUPABASE_ANON_KEY)."
		);
		return supabaseResponse;
	}

	const supabase = createServerClient(
		supabaseUrl,
		supabaseAnonKey,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value, options }) =>
						request.cookies.set(name, value)
					);
					supabaseResponse = NextResponse.next({
						request,
					});
					cookiesToSet.forEach(({ name, value, options }) =>
						supabaseResponse.cookies.set(name, value, options)
					);
				},
			},
		}
	);

	// Do not run code between createServerClient and
	// supabase.auth.getUser(). A simple mistake could make it very hard to debug
	// issues with users being randomly logged out.

	// IMPORTANT: DO NOT REMOVE auth.getUser()

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (
		!user &&
		!request.nextUrl.pathname.startsWith("/signin") &&
		!request.nextUrl.pathname.startsWith("/signup") &&
		!request.nextUrl.pathname.startsWith("/error") &&
		!request.nextUrl.pathname.startsWith("/api/auth/callback") &&
		!request.nextUrl.pathname.startsWith("/api/auth/confirm") &&
		!request.nextUrl.pathname.startsWith("/privacy-policy") &&
		!request.nextUrl.pathname.startsWith("/terms-conditions") &&
		!request.nextUrl.pathname.startsWith("/data-privacy") &&
		!request.nextUrl.pathname.startsWith("/faq") &&
		!request.nextUrl.pathname.startsWith("/about") &&
		!request.nextUrl.pathname.startsWith("/programs") &&
		!request.nextUrl.pathname.startsWith("/impact") &&
		!request.nextUrl.pathname.startsWith("/volunteer") &&
		!request.nextUrl.pathname.startsWith("/learn") &&
		!request.nextUrl.pathname.startsWith("/api") &&
		request.nextUrl.pathname !== "/"
	) {
		const url = request.nextUrl.clone();
		url.pathname = "/";
		return NextResponse.redirect(url);
	}

	// Handle authentication and device authorization
	if (user) {
		// Verify device authorization
		const { data: profile } = await supabase
			.from("profiles")
			.select("settings, devices")
			.eq("id", user.id)
			.single();

		const settings = profile?.settings as any;
		const deviceId = request.cookies.get("ss_device_id")?.value;
		const activeDevices = (profile?.devices || []) as any[];
		
		// Registration happens in sign-in actions/callbacks.
		// If tracking is enabled, the device MUST be in the activeDevices list IF deviceId is present.
		// If deviceId is missing, we don't nuke the session here to avoid logout loops on cookie desync,
		// but we still deny if deviceId is present and NOT in the list.
		const isAuthorized =
			!settings?.device_tracking_enabled ||
			!deviceId || // Lenient if cookie is missing (client-side heartbeat will re-sync)
			activeDevices.some((d) => d.id === deviceId);

		// 1. Block dashboard access for unauthorized devices
		if (!isAuthorized && request.nextUrl.pathname.startsWith("/dashboard")) {
			console.warn(
				`[Middleware] Unauthorized device ${deviceId} for user ${user.id}. Revoking session local to this device.`
			);
			
			// Destructive but LOCAL sign out - prevent global nuke of all devices
			await supabase.auth.signOut({ scope: 'local' });
			
			const url = request.nextUrl.clone();
			url.pathname = "/signin";
			url.searchParams.set("error", "unauthorized_device");
			
			// Create redirect response
			const redirectResponse = NextResponse.redirect(url);
			
			// IMPORTANT: Copy Supabase response cookies to the redirect
			// This ensures session state (like the signout result) is preserved
			supabaseResponse.cookies.getAll().forEach(cookie => {
				const { name, value, ...options } = cookie;
				redirectResponse.cookies.set(name, value, options);
			});
			
			return redirectResponse;
		}

		// 2. Redirect authorized users away from auth pages
		if (
			isAuthorized &&
			(request.nextUrl.pathname.startsWith("/signin") ||
				request.nextUrl.pathname.startsWith("/signup"))
		) {
			const url = request.nextUrl.clone();
			url.pathname = "/dashboard";
			const redirectResponse = NextResponse.redirect(url);
			
			// Sync cookies here too
			supabaseResponse.cookies.getAll().forEach(cookie => {
				const { name, value, ...options } = cookie;
				redirectResponse.cookies.set(name, value, options);
			});
			
			return redirectResponse;
		}
	}

	// IMPORTANT: You *must* return the supabaseResponse object as it is.
	// If you're creating a new response object with NextResponse.next() make sure to:
	// 1. Pass the request in it, like so:
	//    const myNewResponse = NextResponse.next({ request })
	// 2. Copy over the cookies, like so:
	//    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
	// 3. Change the myNewResponse object to fit your needs, but avoid changing
	//    the cookies!
	// 4. Finally:
	//    return myNewResponse
	// If this is not done, you may be causing the browser and server to go out
	// of sync and terminate the user's session prematurely!

	return supabaseResponse;
}
