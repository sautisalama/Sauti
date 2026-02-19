import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { TablesInsert } from "@/types/db-schema";
import { matchReportWithServices } from "@/app/actions/match-services";
import { cookies, headers } from "next/headers";
import { registerDevice, parseSettings, TrackedDevice } from "@/lib/user-settings";

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

function generateAnonymousUsername(): string {
	const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
	const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
	const suffix = Math.random().toString(36).substring(2, 6);
	return `${adj}-${noun}-${suffix}`;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	try {
		console.log("Starting anonymous report submission...");
		let formData;
		try {
			formData = await request.json();
		} catch (e) {
			console.error("JSON parse error:", e);
			return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		if (!formData) {
			return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
		}

		// Initialize Supabase Admin Client directly
		// This bypasses cookies() and auth context issues, running as a privileged backend process
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
		// Try multiple env var names for the service key
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY;

		if (!supabaseUrl || !supabaseServiceKey) {
			console.error("Missing Supabase credentials in env");
			return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
		}

		const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
		});

		let userId: string | null = null;
		let anonUsername: string | null = null;
		let anonEmail: string | null = null;

		// 1. Account Creation (if password provided)
		if (formData.password && formData.password.length >= 6) {
			try {
				let username = generateAnonymousUsername();
				// Ensure uniqueness
				let attempts = 0;
				let isUnique = false;
				
				while (!isUnique && attempts < 5) {
					const { data: existing } = await supabaseAdmin
						.from("profiles")
						.select("anon_username")
						.eq("anon_username", username)
						.single();
					
					if (!existing) {
						isUnique = true;
					} else {
						username = generateAnonymousUsername();
						attempts++;
					}
				}

				const email = `${username}@anon.sautisalama.org`;
				console.log(`Creating anonymous user: ${username}`);

				const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
					email,
					password: formData.password,
					email_confirm: true,
					user_metadata: {
						first_name: formData.first_name || "Anonymous",
						user_type: "survivor",
						is_anonymous: true,
						anon_username: username,
					},
				});

				if (authError || !authData.user) {
					console.error("Auth creation failed:", authError);
					// Continue without account rather than failing the whole report? 
					// User expects account, so maybe we should fail? 
					// Let's log and continue as "guest" submission for safety of the report data.
				} else {
					userId = authData.user.id;
					anonUsername = username;
					anonEmail = email;

					// Register device for the new user to prevent middleware redirection
					const cookieStore = await cookies();
					const deviceId = cookieStore.get("ss_device_id")?.value;
					const userAgent = (await headers()).get("user-agent") || "";
					
					let updatedDevices: TrackedDevice[] = [];
					if (deviceId) {
						// Pass screen dimensions if provided in formData
						const screenHint = formData.screen ? { 
							width: formData.screen.width, 
							height: formData.screen.height 
						} : undefined;
						
						updatedDevices = registerDevice([], deviceId, userAgent, screenHint);
					}

					// Create profile
					await supabaseAdmin.from("profiles").insert({
						id: userId,
						email,
						first_name: "Anonymous",
						last_name: "",
						user_type: "survivor",
						is_anonymous: true,
						anon_username: username,
						verification_status: "pending",
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
						devices: updatedDevices,
					});
				}
			} catch (accountError) {
				console.error("Account creation process failed:", accountError);
			}
		}

		// 2. Report Insertion
		const reportData: TablesInsert<"reports"> = {
			first_name: formData.first_name || "Anonymous",
			last_name: formData.last_name || null,
			email: formData.email,
			phone: formData.phone || null,
			type_of_incident: formData.type_of_incident,
			incident_description: formData.incident_description,
			urgency: formData.urgency,
			consent: formData.consent,
			contact_preference: formData.contact_preference,
			required_services: formData.required_services || [],
			latitude: formData.latitude || null,
			longitude: formData.longitude || null,
			submission_timestamp: formData.submission_timestamp,
			ismatched: false,
			match_status: "pending",
			user_id: userId,
			media: formData.media || null,
			is_onBehalf: !!formData.is_onBehalf,
			// Ensure additional_info is a JSON string as per schema
			additional_info: formData.additional_info ? JSON.stringify(formData.additional_info) : null,
		};

		console.log("Inserting report...");
		const { error: insertError, data: insertedReport } = await supabaseAdmin
			.from("reports")
			.insert([reportData])
			.select()
			.single();

		if (insertError) {
			console.error("Report insert failed:", insertError);
			throw insertError;
		}

		// 3. Post-Submission Actions (Matching & Linking)
		try {
			// Trigger matching (async, don't block response too long)
			matchReportWithServices(insertedReport.report_id, supabaseAdmin).catch(err => 
				console.error("Background matching failed:", err)
			);
			
			// Auto-link by phone if needed
			if (!userId && insertedReport.phone) {
				const { data: profile } = await supabaseAdmin
					.from("profiles")
					.select("id")
					.eq("phone", insertedReport.phone)
					.single();
				
				if (profile?.id) {
					await supabaseAdmin
						.from("reports")
						.update({ user_id: profile.id })
						.eq("report_id", insertedReport.report_id);
				}
			}
		} catch (postError) {
			console.warn("Post-submission actions warning:", postError);
		}

		console.log("Report submitted successfully:", insertedReport.report_id);

		// 4. Response
		return NextResponse.json({
			message: "Report submitted successfully",
			reportId: insertedReport.report_id,
			...(anonUsername && {
				anonymous: true,
				username: anonUsername,
				email: anonEmail,
				userId,
			}),
		});

	} catch (error) {
		console.error("Unhandled error in anonymous report route:", error);
		return NextResponse.json({
			error: "Failed to submit anonymous report",
			details: error instanceof Error ? error.message : String(error),
		}, { status: 500 });
	}
}
