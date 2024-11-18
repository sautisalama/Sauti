import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const supabase = createClient();

	try {
		const {
			data: { session },
			error: sessionError,
		} = await supabase.auth.getSession();

		if (sessionError) {
			console.error("Session error:", sessionError);
			return NextResponse.json({ error: "Authentication error" }, { status: 401 });
		}

		if (!session) {
			console.error("No session found");
			return NextResponse.json(
				{ error: "Unauthorized - No valid session" },
				{ status: 401 }
			);
		}

		const data = await request.json();

		// Verify that the professional_id matches the authenticated user
		if (data.professional_id !== session.user.id) {
			return NextResponse.json(
				{ error: "Unauthorized - User ID mismatch" },
				{ status: 403 }
			);
		}

		// Transform the data to match the database schema
		const serviceData = {
			name: data.name,
			service_types: data.service_types,
			phone_number: data.phone_number,
			availability: data.availability,
			latitude: data.latitude,
			longitude: data.longitude,
			email: session.user.email,
			user_id: session.user.id,
		};

		const { error: insertError } = await supabase
			.from("support_services")
			.insert([serviceData]);

		if (insertError) {
			console.error("Insert error:", insertError);
			throw insertError;
		}

		return NextResponse.json(
			{ message: "Support service added successfully" },
			{ status: 200 }
		);
	} catch (error) {
		console.error("Error adding support service:", error);
		return NextResponse.json(
			{ error: "Failed to add support service" },
			{ status: 500 }
		);
	}
}
