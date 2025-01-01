// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// console.log("Hello from Functions!")

// Deno.serve(async (req) => {
//   const { name } = await req.json()
//   const data = {
//     message: `Hello ${name}!`,
//   }

//   return new Response(
//     JSON.stringify(data),
//     { headers: { "Content-Type": "application/json" } },
//   )
// })

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/helloEmail' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

import { serve } from "https://deno.land/std@0.204.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as postgres from "https://deno.land/x/postgres@v0.17.0/mod.ts";

// Simplified database types for the Edge Function
type Database = {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					first_name: string | null;
					user_type: "survivor" | "professional" | "ngo";
					created_at: string;
					updated_at: string;
				};
			};
			reports: {
				Row: {
					report_id: string;
					user_id: string;
					type_of_incident: string;
					incident_description: string | null;
					submission_timestamp: string;
					created_at: string;
					updated_at: string;
				};
			};
			email_logs: {
				Row: {
					id: string;
					user_id: string;
					email_type: string;
					sent_at: string;
					status: string;
					error_message: string | null;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					email_type: string;
					sent_at?: string;
					status?: string;
					error_message?: string | null;
					updated_at?: string;
				};
				Update: {
					status?: string;
					error_message?: string | null;
				};
			};
		};
	};
	auth: {
		Tables: {
			users: {
				Row: {
					id: string;
					email: string;
				};
			};
		};
	};
};

// Environment variables
const SUPABASE_URL = Deno.env.get("URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const MAILTRAP_TOKEN = Deno.env.get("MAILTRAP_TOKEN")!;
const MAILTRAP_ENDPOINT = "https://send.api.mailtrap.io/api/send";
const SENDER_EMAIL = "noreply@sautisalama.com";
const SENDER_NAME = "Sauti Salama";

// Initialize Supabase client
const supabase = createClient<Database>(
	SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY,
	{
		auth: {
			persistSession: false,
		},
	}
);

serve(async (req: Request) => {
	try {
		// Verify request is authorized
		const authHeader = req.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			throw new Error("Missing or invalid authorization header");
		}

		// Find survivors who haven't reported in the last 10 minutes
		const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

		const { data: inactiveSurvivors, error: queryError } = await supabase
			.from("profiles")
			.select(
				`
        id,
        first_name,
        auth.users!inner(
          email
        ),
        reports!left(
          submission_timestamp
        ),
        email_logs!left(
          sent_at,
          status
        )
      `
			)
			.eq("user_type", "survivor")
			.not("reports.submission_timestamp", "gt", tenMinutesAgo)
			.not(
				"email_logs.sent_at",
				"gt",
				new Date(Date.now() - 60 * 60 * 1000).toISOString()
			)
			.not("email_logs.status", "eq", "success");

		if (queryError) throw queryError;
		if (!inactiveSurvivors?.length) {
			return new Response(
				JSON.stringify({ message: "No inactive survivors found" }),
				{ headers: { "Content-Type": "application/json" } }
			);
		}

		// Process each inactive survivor
		const results = await Promise.all(
			inactiveSurvivors.map(async (survivor) => {
				const email = survivor.auth?.users?.email;
				if (!email) return null;

				// Create email log entry
				const { data: logEntry, error: logError } = await supabase
					.from("email_logs")
					.insert({
						user_id: survivor.id,
						email_type: "report_reminder",
						status: "pending",
					})
					.select()
					.single();

				if (logError) throw logError;

				try {
					// Send email via Mailtrap
					const response = await fetch(MAILTRAP_ENDPOINT, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${MAILTRAP_TOKEN}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							from: {
								email: SENDER_EMAIL,
								name: SENDER_NAME,
							},
							to: [{ email }],
							subject: "We Miss You at Sauti Salama",
							html: `
                <html>
                  <body>
                    <h1>Hello ${survivor.first_name || "Friend"},</h1>
                    <p>We noticed you haven't submitted a report recently. Your safety and well-being are important to us.</p>
                    <p>If you need support or would like to report an incident, we're here to help 24/7.</p>
                    <p>Best regards,<br>The Sauti Salama Team</p>
                  </body>
                </html>
              `,
							text: `
                Hello ${survivor.first_name || "Friend"},

                We noticed you haven't submitted a report recently. Your safety and well-being are important to us.
                
                If you need support or would like to report an incident, we're here to help 24/7.

                Best regards,
                The Sauti Salama Team
              `.trim(),
						}),
					});

					if (!response.ok) {
						throw new Error(`Mailtrap API error: ${response.statusText}`);
					}

					// Update log status to success
					await supabase
						.from("email_logs")
						.update({ status: "success" })
						.eq("id", logEntry.id);

					return {
						userId: survivor.id,
						status: "success",
					};
				} catch (error) {
					// Update log status to failed
					await supabase
						.from("email_logs")
						.update({
							status: "failed",
							error_message: error.message,
						})
						.eq("id", logEntry.id);

					return {
						userId: survivor.id,
						status: "failed",
						error: error.message,
					};
				}
			})
		);

		return new Response(
			JSON.stringify({
				success: true,
				results: results.filter(Boolean),
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	} catch (error) {
		console.error("Error processing reminder emails:", error);
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
});
