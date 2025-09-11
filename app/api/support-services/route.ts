import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { Database } from "@/types/db-schema";

export async function POST(request: Request) {
	const supabase = await createClient();

	try {
		const {
			data: { session },
			error: sessionError,
		} = await supabase.auth.getUser();

		if (sessionError || !session) {
			return NextResponse.json(
				{ error: "Unauthorized - No valid session" },
				{ status: 401 }
			);
		}

		const data = await request.json();

		// Transform the data to match the database schema
		const serviceData: Database["public"]["Tables"]["support_services"]["Insert"] =
			{
				name: data.name,
				service_types: data.service_types,
				phone_number: data.phone_number,
				availability: data.availability,
				latitude: data.latitude,
				longitude: data.longitude,
				email: session.user.email,
				user_id: session.user.id,
				// Optional fields from schema
				helpline: null,
				website: null,
				coverage_area_radius: null,
				priority: null,
				created_at: new Date().toISOString(),
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

// Optional: Add GET method to fetch services
export async function GET(request: Request) {
	const supabase = await createClient();

	try {
		const {
			data: { session },
			error: sessionError,
		} = await supabase.auth.getUser();

		if (sessionError || !session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { data: services, error } = await supabase
			.from("support_services")
			.select("*")
			.eq("user_id", session.user.id);

		if (error) throw error;

		return NextResponse.json(services);
	} catch (error) {
		console.error("Error fetching support services:", error);
		return NextResponse.json(
			{ error: "Failed to fetch support services" },
			{ status: 500 }
		);
	}
}
