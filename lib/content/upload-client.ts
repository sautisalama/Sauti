"use client";

import { createClient } from "@/utils/supabase/client";

const BUCKET = "publications";

const safeName = (n: string) => n.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(-80) || "file";

/**
 * Upload straight from the browser to the `publications` bucket (RLS limits
 * writes to admins and professional/NGO authors). This skips the serverless request-body limit, so large
 * Word/PDF files and images work.
 */
export async function uploadToPublications(file: File, folder: "covers" | "images" | "imports", onProgress?: (pct: number) => void): Promise<{ path: string; url: string }> {
	const supabase = createClient();
	const id = crypto.randomUUID();
	const path = folder === "imports" ? `imports/${id}/${safeName(file.name)}` : `${folder}/${id}-${safeName(file.name)}`;
	// With a progress callback, send the file ourselves so a large PDF shows a real progress bar.
	if (onProgress) {
		const signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
		if (!signed.error && signed.data) {
			const ok = await new Promise<boolean>((resolve) => {
				const xhr = new XMLHttpRequest();
				xhr.open("PUT", signed.data.signedUrl);
				xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
				xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
				xhr.onerror = () => resolve(false);
				const form = new FormData();
				form.append("cacheControl", "31536000");
				form.append("", file);
				xhr.send(form);
			});
			if (ok) {
				onProgress(100);
				return { path, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
			}
		}
	}
	const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
		contentType: file.type || undefined,
		cacheControl: "31536000",
		upsert: false,
	});
	if (error) throw new Error(error.message.includes("row-level security") ? "You don't have permission to upload files." : error.message);
	return { path, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}
