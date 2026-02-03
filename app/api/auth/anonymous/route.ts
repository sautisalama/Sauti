import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Word lists for generating human-readable usernames
const ADJECTIVES = [
	"safe",
	"brave",
	"strong",
	"calm",
	"kind",
	"bold",
	"free",
	"wise",
	"warm",
	"true",
	"pure",
	"sure",
	"good",
	"hope",
	"peace",
	"light",
];

const NOUNS = [
	"haven",
	"heart",
	"voice",
	"path",
	"hope",
	"star",
	"dawn",
	"rise",
	"calm",
	"home",
	"care",
	"soul",
	"life",
	"way",
	"day",
	"sun",
];

/**
 * Generate a unique anonymous username like "safe-haven-7k3x"
 */
function generateAnonymousUsername(): string {
	const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
	const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
	const suffix = Math.random().toString(36).substring(2, 6);
	return `${adj}-${noun}-${suffix}`;
}

/**
 * POST /api/auth/anonymous
 * Creates an anonymous user account with user-provided password
 */
export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { password, firstName } = body;

		if (!password || password.length < 6) {
			return NextResponse.json(
				{ error: "Password must be at least 6 characters" },
				{ status: 400 },
			);
		}

		// Create Supabase admin client for user creation
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

		if (!supabaseServiceKey) {
			console.error("SUPABASE_SERVICE_ROLE_KEY is not configured");
			return NextResponse.json(
				{ error: "Server configuration error" },
				{ status: 500 },
			);
		}

		const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
		});

		// Generate unique username
		let username = generateAnonymousUsername();
		let attempts = 0;
		const maxAttempts = 5;

		// Ensure username is unique
		while (attempts < maxAttempts) {
			const { data: existing } = await supabaseAdmin
				.from("anonymous_accounts")
				.select("id")
				.eq("anon_username", username)
				.single();

			if (!existing) break;
			username = generateAnonymousUsername();
			attempts++;
		}

		if (attempts >= maxAttempts) {
			return NextResponse.json(
				{ error: "Failed to generate unique username" },
				{ status: 500 },
			);
		}

		// Create email for the anonymous user
		const email = `${username}@anon.sautisalama.org`;

		// Create auth user
		const { data: authData, error: authError } =
			await supabaseAdmin.auth.admin.createUser({
				email,
				password,
				email_confirm: true, // Auto-confirm since it's anonymous
				user_metadata: {
					first_name: firstName || "Anonymous",
					last_name: "",
					user_type: "survivor",
					is_anonymous: true,
				},
			});

		if (authError) {
			console.error("Failed to create auth user:", authError);
			return NextResponse.json(
				{ error: "Failed to create account", details: authError.message },
				{ status: 500 },
			);
		}

		const userId = authData.user.id;

		// Create profile
		const { error: profileError } = await supabaseAdmin.from("profiles").insert({
			id: userId,
			email,
			first_name: firstName || "Anonymous",
			last_name: "",
			user_type: "survivor",
			is_anonymous: true,
			verification_status: "pending",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});

		if (profileError) {
			console.error("Failed to create profile:", profileError);
			// Clean up auth user if profile creation fails
			await supabaseAdmin.auth.admin.deleteUser(userId);
			return NextResponse.json(
				{ error: "Failed to create profile", details: profileError.message },
				{ status: 500 },
			);
		}

		// Create anonymous account record
		const { error: anonError } = await supabaseAdmin
			.from("anonymous_accounts")
			.insert({
				anon_username: username,
				user_id: userId,
				created_at: new Date().toISOString(),
				expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
			});

		if (anonError) {
			console.error("Failed to create anonymous account record:", anonError);
			// Continue anyway - the user and profile are created
		}

		return NextResponse.json({
			success: true,
			username,
			email,
			userId,
		});
	} catch (error) {
		console.error("Error creating anonymous account:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
