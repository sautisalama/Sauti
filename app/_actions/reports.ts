"use server";

import { cookies } from "next/headers";
import { TablesInsert } from "@/types/db-schema";
import { createClient } from "@/utils/supabase/server";

export async function submitReport(data: TablesInsert<"reports">) {
	const supabase = await createClient();

	const { error } = await supabase.from("reports").insert([data]);

	if (error) {
		console.error("Error submitting report:", error);
		throw new Error("Failed to submit report");
	}

	return { success: true };
}
