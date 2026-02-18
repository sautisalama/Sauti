"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signUp(formData: FormData) {
	const supabase = await createClient();
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	const firstName = formData.get("firstName") as string;
	const lastName = formData.get("lastName") as string;
	const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

	const { data: authData, error: authError } = await supabase.auth.signUp({
		email,
		password,
		options: {
			emailRedirectTo: `${redirectUrl}/api/auth/confirm`,
			data: {
				first_name: firstName,
				last_name: lastName,
			},
		},
	});

	if (authError) {
		console.error("Sign up error:", authError);
		return redirect("/?message=signup_failed");
	}

	if (authData.user) {
		const now = new Date().toISOString();
		const { error: profileError } = await supabase.from("profiles").upsert(
			{
				id: authData.user.id,
				first_name: firstName,
				last_name: lastName,
				created_at: now,
				updated_at: now,
			},
			{ onConflict: "id" }
		);

		if (profileError) {
			console.error("Profile creation error:", profileError);
			return redirect("/?message=profile_creation_failed");
		}
	}

	revalidatePath("/", "layout");
	return redirect("/dashboard?message=signup_success");
}

export async function signIn(formData: FormData) {
	const supabase = await createClient();
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	
	const { error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		console.error("Sign in error:", error);
		return redirect("/?message=account_not_found");
	}
// Add revalidation before redirect
	revalidatePath("/", "layout");
	return redirect("/dashboard");
}

export async function signInWithGoogle() {
	const supabase = await createClient();
	const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: "google",
		options: {
			redirectTo: `${redirectUrl}/api/auth/callback`,
			queryParams: {
				access_type: "offline",
				scope: "openid email profile",
				prompt: "select_account",
			},
		},
	});

	if (error) {
		console.error("Google sign in error:", error);
		return redirect("/?message=google_signin_failed");
	}

	if (data.url) {
		return redirect(data.url);
	}
}

export async function signOut() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	// Revalidate all pages before redirect
	revalidatePath("/", "layout");
	return redirect("/");
}
