import type { TablesUpdate } from "@/types/db-schema";
import { createClient } from "@/utils/supabase/server";
import { NextResponse, after } from "next/server";
import { flushVerificationAlerts } from "@/lib/notifications/verification-alerts";

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const supabase = await createClient();

	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Verify ownership before update
		const { data: service } = await supabase
			.from("support_services")
			.select("user_id")
			.eq("id", id)
			.single();

		if (!service || service.user_id !== user.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
		}

		const body = await request.json();
		const { accreditation_files_metadata, ...otherUpdates } = body;

		const updateData: Record<string, unknown> = {
			...otherUpdates,
		};


		if (accreditation_files_metadata !== undefined) {
			updateData.accreditation_files_metadata = accreditation_files_metadata;
		}

		const { data, error } = await supabase
			.from("support_services")
			.update(updateData as TablesUpdate<"support_services">)
			.eq("id", id)
			.select()
			.single();

		if (error) throw error;

		// New documents are recorded by a database trigger; tell the team right away (after responding).
		if (accreditation_files_metadata !== undefined) {
			const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://sautisalama.org").replace(/\/$/, "");
			after(() => flushVerificationAlerts(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`).catch((e) => console.error("[verification-alerts]", e)));
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error updating service:", error);
		return NextResponse.json(
			{ error: "Failed to update service" },
			{ status: 500 }
		);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const supabase = await createClient();

	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Verify ownership before deletion
		const { data: service } = await supabase
			.from("support_services")
			.select("user_id")
			.eq("id", id)
			.single();

		if (!service || service.user_id !== user.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
		}

		const { error } = await supabase
			.from("support_services")
			.delete()
			.eq("id", id);

		if (error) throw error;

		return NextResponse.json({ message: "Service deleted successfully" });
	} catch (error) {
		console.error("Error deleting service:", error);
		return NextResponse.json(
			{ error: "Failed to delete service" },
			{ status: 500 }
		);
	}
}
