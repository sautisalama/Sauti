"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Database } from "@/types/db-schema";

export async function signUp(formData: FormData) {
	const supabase = await createClient();
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	const firstName = formData.get("firstName") as string;
	const lastName = formData.get("lastName") as string;
	const redirectUrl = process.env.NEXT_PUBLIC_APP_URL;
	const userType = formData.get(
		"userType"
	) as Database["public"]["Enums"]["user_type"];

	// First create the auth user
	const { data: authData, error: authError } = await supabase.auth.signUp({
		email,
		password,
		options: {
			emailRedirectTo: `${redirectUrl}/api/auth/confirm`,
			data: {
				email,
				first_name: firstName,
				last_name: lastName,
				user_type: userType,
			},
		},
	});

	if (authError) {
		console.log(authError);
		console.error("Sign up error:", authError);
		redirect("/error");
	}

	// Then handle the profile
	if (authData.user) {
		const now = new Date().toISOString();
		const { error: profileError } = await supabase.from("profiles").upsert(
			{
				id: authData.user.id,
				first_name: firstName,
				last_name: lastName,
				user_type: userType,
				created_at: now,
				updated_at: now,
			},
			{
				onConflict: "id",
				ignoreDuplicates: false, // This will update the record if it exists
			}
		);

		if (profileError) {
			console.error("Profile creation error:", profileError);
			redirect("/error");
		}
	}

	revalidatePath("/", "layout");
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
		console.error("Sign in error:", error);
		console.log(error);
		redirect("/error");
	}

	redirect("/dashboard");
}

export async function signInWithGoogle() {
	const supabase = await createClient();
	const redirectUrl = process.env.NEXT_PUBLIC_APP_URL;
	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: "google",
		options: {
			redirectTo: `${redirectUrl}/api/auth/confirm`,
			queryParams: {
				access_type: "offline",
				prompt: "consent",
			},
		},
	});

	if (error) {
		console.log(error);
		console.error("Google sign in error:", error);
		redirect("/error");
	}

	console.log("There is a success", data);

	if (data.url) {
		console.log(data.url);
		redirect(data.url);
	}
}

export async function signOut() {
	const supabase = await createClient();
	const { error } = await supabase.auth.signOut();

	if (error) {
		return { error: error.message };
	}
}
