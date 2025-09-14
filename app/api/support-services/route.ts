import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { Database } from "@/types/db-schema";
import { serviceValidationService } from "@/lib/service-validation";

export async function POST(request: Request) {
	const supabase = await createClient();

	try {
		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser();

		if (userError || !user) {
			return NextResponse.json(
				{ error: "Unauthorized - No valid session" },
				{ status: 401 }
			);
		}

		const data = await request.json();

		// Get user profile to check user type
		const { data: profile } = await supabase
			.from("profiles")
			.select("user_type")
			.eq("id", user.id)
			.single();

		if (!profile) {
			return NextResponse.json(
				{ error: "User profile not found" },
				{ status: 404 }
			);
		}

		// Get existing services for validation
		const { data: existingServices } = await supabase
			.from("support_services")
			.select("service_types")
			.eq("user_id", user.id);

		const existingServiceTypes =
			existingServices?.map((s) => s.service_types) || [];

		// Validate service creation
		const validation = serviceValidationService.validateServiceCreation(
			existingServiceTypes,
			data.service_types,
			profile.user_type
		);

		if (!validation.valid) {
			return NextResponse.json(
				{
					error: validation.reason,
					suggestions: validation.suggestions,
				},
				{ status: 400 }
			);
		}

		// Transform the data to match the database schema
		const serviceData: Database["public"]["Tables"]["support_services"]["Insert"] =
			{
				name: data.name,
				service_types: data.service_types,
				phone_number: data.phone_number,
				email: data.email || user.email,
				website: data.website || null,
				availability: data.availability,
				latitude: data.latitude,
				longitude: data.longitude,
				coverage_area_radius: data.coverage_area_radius,
				user_id: user.id,
				// Optional fields from schema
				helpline: null,
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
			data: { user },
			error: userError,
		} = await supabase.auth.getUser();

		if (userError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { data: services, error } = await supabase
			.from("support_services")
			.select("*")
			.eq("user_id", user.id);

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
