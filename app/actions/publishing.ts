"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db-schema";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { importDocument, type ImportedDocument } from "@/lib/content/import";
import { makeSummary, normalizeLinks, readingStats, sanitizeContent, htmlToText, slugify } from "@/lib/content/sanitize";
import { emailPublicationCopy } from "@/lib/content/publication-email";
import {
	PUBLICATION_KINDS,
	PUBLICATION_STATUSES,
	type PublicationKind,
	type PublicationRow,
	type PublicationStatus,
} from "@/types/publishing";

export type ActionResult<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export interface PublicationInput {
	id?: string;
	kind: PublicationKind;
	title: string;
	summary?: string | null;
	body: string;
	cover_image_url?: string | null;
	cover_image_alt?: string | null;
	category?: string | null;
	tags?: string[];
	featured?: boolean;
	external_links?: { label?: string; url?: string }[];
	source_file_url?: string | null;
	source_file_name?: string | null;
	source_file_type?: string | null;
}

const BUCKET = "publications";

function revalidateAll(slug?: string) {
	for (const p of ["/", "/publications", "/learn", "/resources", "/sitemap.xml", "/dashboard/admin/publications"]) {
		revalidatePath(p);
	}
	if (slug) revalidatePath(`/publications/${slug}`);
}

function validUrl(u: string | null | undefined): boolean {
	if (!u) return true;
	return u.startsWith("/") || /^https?:\/\//i.test(u);
}

async function uniqueSlug(supabase: SupabaseClient<Database>, title: string, ignoreId?: string) {
	const base = slugify(title);
	const { data } = await supabase.from("publications").select("id, slug").like("slug", `${base}%`);
	const taken = new Set((data ?? []).filter((r) => r.id !== ignoreId).map((r) => r.slug));
	if (!taken.has(base)) return base;
	for (let i = 2; i < 200; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
	return `${base}-${randomUUID().slice(0, 6)}`;
}

async function logEvent(publicationId: string, actorId: string, action: string, detail?: string) {
	const admin = createAdminClient();
	await admin.from("publication_events").insert({ publication_id: publicationId, actor_id: actorId, action, detail: detail ?? null });
}

/** Create or update a publication. New items always start as drafts. */
export async function savePublication(input: PublicationInput): Promise<ActionResult<{ id: string; slug: string; status: PublicationStatus }>> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const { supabase, user } = auth;

	const title = input.title?.trim() ?? "";
	if (title.length < 3) return { ok: false, error: "Give it a title (at least 3 characters)." };
	if (!PUBLICATION_KINDS.includes(input.kind)) return { ok: false, error: "Choose what you are publishing." };
	if (!validUrl(input.cover_image_url)) return { ok: false, error: "The cover image link must start with http:// or https://" };
	const links = normalizeLinks(input.external_links);
	if (links.error) return { ok: false, error: links.error };

	const body = sanitizeContent(input.body ?? "");
	const stats = readingStats(body);
	const fields = {
		kind: input.kind,
		title,
		summary: input.summary?.trim() || (htmlToText(body) ? makeSummary(body) : null),
		body,
		cover_image_url: input.cover_image_url?.trim() || null,
		cover_image_alt: input.cover_image_alt?.trim() || null,
		category: input.category?.trim() || null,
		tags: Array.from(new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))).slice(0, 12),
		featured: !!input.featured,
		read_minutes: stats.words ? stats.minutes : null,
		external_links: links.links,
		...(input.source_file_url !== undefined && {
			source_file_url: input.source_file_url,
			source_file_name: input.source_file_name ?? null,
			source_file_type: input.source_file_type ?? null,
		}),
	};

	if (input.id) {
		const { data, error } = await supabase
			.from("publications")
			.update(fields)
			.eq("id", input.id)
			.select("id, slug, status")
			.maybeSingle();
		if (error) return { ok: false, error: error.message };
		if (!data) return { ok: false, error: "That item no longer exists." };
		await logEvent(data.id, user.id, "edited");
		revalidateAll(data.slug);
		return { ok: true, id: data.id, slug: data.slug, status: data.status as PublicationStatus };
	}

	for (let attempt = 0; attempt < 3; attempt++) {
		const slug = await uniqueSlug(supabase, title);
		const { data, error } = await supabase
			.from("publications")
			.insert({ ...fields, slug, status: "draft", author_id: user.id })
			.select("id, slug, status")
			.single();
		if (error?.code === "23505") continue; // slug raced with another insert
		if (error) return { ok: false, error: error.message };
		await logEvent(data.id, user.id, "created");
		revalidateAll();
		return { ok: true, id: data.id, slug: data.slug, status: data.status as PublicationStatus };
	}
	return { ok: false, error: "Could not create a unique link for this title. Try a slightly different title." };
}

/** Move an item between draft / in review / published / archived. */
export async function setPublicationStatus(id: string, status: PublicationStatus): Promise<ActionResult<{ emailed?: boolean }>> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const { supabase, user, name } = auth;
	if (!PUBLICATION_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };

	const { data: current, error: readErr } = await supabase.from("publications").select("*").eq("id", id).maybeSingle();
	if (readErr) return { ok: false, error: readErr.message };
	if (!current) return { ok: false, error: "That item no longer exists." };
	const pub = current as unknown as PublicationRow;

	if (status === "published") {
		if (htmlToText(pub.body).length < 30) return { ok: false, error: "Add some content before publishing." };
		if (pub.title.trim().length < 3) return { ok: false, error: "Add a title before publishing." };
	}

	const patch: Database["public"]["Tables"]["publications"]["Update"] = { status };
	if (status === "published") {
		patch.published_by = user.id;
		// Keep the original date on re-publish so the feed order does not jump.
		patch.published_at = pub.published_at ?? new Date().toISOString();
	}
	const { data: updated, error } = await supabase.from("publications").update(patch).eq("id", id).select("*").single();
	if (error) return { ok: false, error: error.message };

	await logEvent(id, user.id, status === "published" ? "published" : `status:${status}`);
	revalidateAll(pub.slug);

	// Email a copy once, on the first publish. Runs after the response so the
	// editor is never blocked on PDF/DOCX rendering or the mail API.
	const firstPublish = status === "published" && !pub.emailed_at;
	if (firstPublish) {
		const row = updated as unknown as PublicationRow;
		after(async () => {
			const res = await emailPublicationCopy(row, { author: name, event: "published" });
			await createAdminClient()
				.from("publications")
				.update(res.success ? { emailed_at: new Date().toISOString(), email_status: "sent" } : { email_status: `failed: ${res.error}`.slice(0, 300) })
				.eq("id", id);
		});
	}
	return { ok: true, emailed: firstPublish };
}

/** Manually (re)send the PDF + Word copy to the publications inbox. */
export async function resendPublicationEmail(id: string): Promise<ActionResult> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const { data } = await auth.supabase.from("publications").select("*").eq("id", id).maybeSingle();
	if (!data) return { ok: false, error: "That item no longer exists." };
	const row = data as unknown as PublicationRow;
	const res = await emailPublicationCopy(row, { author: auth.name, event: "resent" });
	await auth.supabase
		.from("publications")
		.update(res.success ? { emailed_at: new Date().toISOString(), email_status: "sent" } : { email_status: `failed: ${res.error}`.slice(0, 300) })
		.eq("id", id);
	await logEvent(id, auth.user.id, res.success ? "emailed" : "email_failed", res.success ? undefined : res.error);
	revalidatePath("/dashboard/admin/publications");
	return res.success ? { ok: true } : { ok: false, error: `Email failed: ${res.error}` };
}

export async function deletePublication(id: string): Promise<ActionResult> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const { data } = await auth.supabase.from("publications").select("slug, source_file_url").eq("id", id).maybeSingle();
	const { error } = await auth.supabase.from("publications").delete().eq("id", id);
	if (error) return { ok: false, error: error.message };
	const path = storagePathOf(data?.source_file_url);
	if (path) await createAdminClient().storage.from(BUCKET).remove([path]);
	revalidateAll(data?.slug);
	return { ok: true };
}

function storagePathOf(url: string | null | undefined): string | null {
	const m = url?.match(new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)$`));
	return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Parse a Word/PDF file the browser has already uploaded to storage
 * (`imports/...`), and return clean HTML for the editor to load. Uploading
 * straight to storage avoids the serverless request-body limit.
 */
export async function importFromStorage(path: string): Promise<ActionResult<{ doc: ImportedDocument; sourceUrl: string; fileName: string }>> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	if (!/^imports\/[\w-]+\/[^/]+$/.test(path)) return { ok: false, error: "Invalid file location." };

	const admin = createAdminClient();
	const { data: blob, error } = await admin.storage.from(BUCKET).download(path);
	if (error || !blob) return { ok: false, error: "Could not read the uploaded file. Please try again." };
	const fileName = decodeURIComponent(path.split("/").pop() ?? "document");

	try {
		const buf = Buffer.from(await blob.arrayBuffer());
		const doc = await importDocument(buf, fileName, {
			uploadImage: async ({ buffer, contentType }) => {
				const ext = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[contentType];
				if (!ext) return null;
				const p = `imports/images/${randomUUID()}.${ext}`;
				const { error: upErr } = await admin.storage.from(BUCKET).upload(p, buffer, { contentType, upsert: false });
				return upErr ? null : admin.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
			},
		});
		const sourceUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
		return { ok: true, doc, sourceUrl, fileName };
	} catch (e) {
		// Don't leave unparseable uploads lying around.
		await admin.storage.from(BUCKET).remove([path]);
		return { ok: false, error: e instanceof Error ? e.message : "Could not read that document." };
	}
}

/** Import an uploaded document straight into a new draft. */
export async function importAsDraft(path: string, kind: PublicationKind): Promise<ActionResult<{ id: string; warnings: string[] }>> {
	const res = await importFromStorage(path);
	if (!res.ok) return res;
	const saved = await savePublication({
		kind,
		title: res.doc.title,
		body: res.doc.html,
		source_file_url: res.sourceUrl,
		source_file_name: res.fileName,
		source_file_type: res.doc.kind,
	});
	if (!saved.ok) return saved;
	return { ok: true, id: saved.id, warnings: res.doc.warnings };
}
