import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
// import { getUser } from "@/lib/user";

export async function GET(request: Request) {
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get("code");

	const supabase = await createClient();
	if (code) {
		await supabase.auth.exchangeCodeForSession(code);
		// const userData = await getUser();
		// console.log("User data:", userData);
	}

	return NextResponse.redirect(new URL("/dashboard", request.url));
}
