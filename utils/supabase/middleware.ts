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
		request.nextUrl.pathname !== "/"
	) {
		const url = request.nextUrl.clone();
		url.pathname = "/";
		return NextResponse.redirect(url);
	}

	// Add a new check for authenticated users trying to access auth pages
	if (
		user &&
		(request.nextUrl.pathname.startsWith("/signin") ||
			request.nextUrl.pathname.startsWith("/signup") ||
			request.nextUrl.pathname === "/")
	) {
		const url = request.nextUrl.clone();
		url.pathname = "/dashboard";
		return NextResponse.redirect(url);
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
