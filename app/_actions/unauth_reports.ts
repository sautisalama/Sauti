"use client";

import { createClient } from "@/utils/supabase/client";
import { TablesInsert } from "@/types/db-schema";

export async function submitReport(data: TablesInsert<"reports">) {
	const supabase = createClient();

	const { error } = await supabase.from("reports").insert([data]);

	if (error) {
		console.error("Error submitting report:", error);
		throw new Error("Failed to submit report");
	}

	return { success: true };
}
