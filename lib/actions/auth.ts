"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const redirectUrl =
	process.env.NEXT_PUBLIC_NODE_ENV === "production"
		? process.env.NEXT_PUBLIC_APP_URL
		: process.env.NEXT_PUBLIC_APP_URL_DEV;

export async function signUp(formData: FormData) {
	const supabase = await createClient();
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;

	const { error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			emailRedirectTo: `${redirectUrl}/auth/callback`,
		},
	});

	if (error) {
		// return { error: error.message };
		console.log("Sign up error ::", error);
	}

	redirect("/signin");
}

export async function signIn(formData: FormData) {
	const supabase = await createClient();
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	console.log("Sign in details::", email, password);
	const { error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		// return { error: error.message };
		console.log("Sign in error:", error);
	}

	redirect("/dashboard");
}

export async function signInWithGoogle() {
	const supabase = await createClient();

	const { error } = await supabase.auth.signInWithOAuth({
		provider: "google",
		options: {
			redirectTo: `${redirectUrl}/auth/callback`,
		},
	});

	if (error) {
		return { error: error.message };
	}
}

export async function signOut() {
	const supabase = await createClient();
	const { error } = await supabase.auth.signOut()

	if (error) {
		return {error: error.message}
	}
}
