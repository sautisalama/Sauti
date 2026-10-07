"use client";

import { createClient } from "@/utils/supabase/client";

const BUCKET = "publications";

const safeName = (n: string) => n.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(-80) || "file";

/**
 * Upload straight from the browser to the `publications` bucket (RLS limits
 * writes to admins). This skips the serverless request-body limit, so large
 * Word/PDF files and images work.
 */
export async function uploadToPublications(file: File, folder: "covers" | "images" | "imports"): Promise<{ path: string; url: string }> {
	const supabase = createClient();
	const id = crypto.randomUUID();
	const path = folder === "imports" ? `imports/${id}/${safeName(file.name)}` : `${folder}/${id}-${safeName(file.name)}`;
	const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
		contentType: file.type || undefined,
		cacheControl: "31536000",
		upsert: false,
	});
	if (error) throw new Error(error.message.includes("row-level security") ? "Only administrators can upload files." : error.message);
	return { path, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}
