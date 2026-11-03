"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db-schema";
import { requirePublisher } from "@/lib/auth/require-publisher";
import { requireAdmin } from "@/lib/auth/require-admin";
import { sendNotification } from "@/lib/notifications";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { importDocument, type ImportedDocument } from "@/lib/content/import";
import { makeSummary, normalizeLinks, readingStats, sanitizeContent, htmlToText, slugify } from "@/lib/content/sanitize";
import { describePdf } from "@/lib/content/pdf-preview";
import { emailPublicationCopy } from "@/lib/content/publication-email";
import {
	PUBLICATION_KINDS,
	PUBLICATION_STATUSES,
	type PublicationDisplayMode,
	type PublicationKind,
	type PublicationRow,
	type PublicationStatus,
} from "@/types/publishing";

export type ActionResult<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export interface PublicationInput {
	/** A background save of a draft: nothing public changes, so no page is refreshed and no history entry is added. */
	autosave?: boolean;
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
	display_mode?: PublicationDisplayMode;
}

const BUCKET = "publications";

function revalidateAll(slug?: string) {
	for (const p of ["/", "/publications", "/learn", "/resources", "/sitemap.xml", "/dashboard/admin/publications", "/dashboard/blogs"]) {
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
	const auth = await requirePublisher();
	if (!auth.ok) return auth;
	const { supabase, user, isAdmin } = auth;

	if (input.id && !isAdmin) {
		const { data: own } = await supabase.from("publications").select("author_id, status").eq("id", input.id).maybeSingle();
		if (!own || own.author_id !== user.id) return { ok: false, error: "You can only edit your own posts." };
		if (own.status !== "draft" && own.status !== "in_review") {
			return { ok: false, error: "This post is already published. Ask an administrator to change it." };
		}
	}
	const displayMode: PublicationDisplayMode = input.display_mode === "pdf" ? "pdf" : "content";
	if (displayMode === "pdf" && (!input.source_file_url || input.source_file_type !== "pdf")) {
		return { ok: false, error: "Upload a PDF to show the post as a PDF." };
	}

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
		featured: isAdmin && !!input.featured,
		display_mode: displayMode,
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
		if (!input.autosave) {
			await logEvent(data.id, user.id, "edited");
			revalidateAll(data.slug);
		}
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
		if (!input.autosave) revalidateAll();
		return { ok: true, id: data.id, slug: data.slug, status: data.status as PublicationStatus };
	}
	return { ok: false, error: "Could not create a unique link for this title. Try a slightly different title." };
}

/** Tell every administrator that a post is waiting for approval. */
async function notifyAdminsOfSubmission(pub: Pick<PublicationRow, "id" | "title">, author: string) {
	const { data: admins } = await createAdminClient().from("profiles").select("id").eq("is_admin", true);
	await Promise.all(
		(admins ?? []).map((a) =>
			sendNotification({
				userId: a.id,
				type: "new_blog_submission",
				title: "A post is waiting for approval",
				message: `${author} submitted “${pub.title}” for review.`,
				link: `/dashboard/admin/publications/${pub.id}`,
				metadata: { publication_id: pub.id },
			}).catch(() => undefined)
		)
	);
}

function readyToPublish(pub: PublicationRow, verb: string): string | null {
	if (pub.title.trim().length < 3) return `Add a title before ${verb}.`;
	if (pub.display_mode === "pdf") return pub.source_file_url ? null : `Upload the PDF before ${verb}.`;
	if (htmlToText(pub.body).length < 30) return `Add some content before ${verb}.`;
	return null;
}

/**
 * Move an item between draft / in review / published / archived.
 * Admins publish directly (this is also how they approve a submission).
 * Everyone else can only submit their own post for approval, or withdraw it.
 */
export async function setPublicationStatus(id: string, status: PublicationStatus): Promise<ActionResult<{ emailed?: boolean; submitted?: boolean }>> {
	const auth = await requirePublisher();
	if (!auth.ok) return auth;
	const { supabase, user, name, isAdmin } = auth;
	if (!PUBLICATION_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };

	const { data: current, error: readErr } = await supabase.from("publications").select("*").eq("id", id).maybeSingle();
	if (readErr) return { ok: false, error: readErr.message };
	if (!current) return { ok: false, error: "That item no longer exists." };
	const pub = current as unknown as PublicationRow;

	if (!isAdmin) {
		if (pub.author_id !== user.id) return { ok: false, error: "You can only change your own posts." };
		if (status !== "in_review" && status !== "draft") return { ok: false, error: "Only an administrator can publish. Submit it for approval instead." };
		if (pub.status !== "draft" && pub.status !== "in_review") return { ok: false, error: "This post is already published. Ask an administrator to change it." };
		if (status === "in_review") {
			const problem = readyToPublish(pub, "submitting");
			if (problem) return { ok: false, error: problem };
		}
		const patch: Database["public"]["Tables"]["publications"]["Update"] =
			status === "in_review" ? { status, submitted_at: new Date().toISOString(), rejection_reason: null } : { status };
		const { error } = await supabase.from("publications").update(patch).eq("id", id);
		if (error) return { ok: false, error: error.message };
		await logEvent(id, user.id, status === "in_review" ? "submitted" : "withdrawn");
		if (status === "in_review" && pub.status !== "in_review") after(() => notifyAdminsOfSubmission(pub, name));
		revalidateAll(pub.slug);
		return { ok: true, submitted: status === "in_review" };
	}

	if (status === "published") {
		const problem = readyToPublish(pub, "publishing");
		if (problem) return { ok: false, error: problem };
	}

	const patch: Database["public"]["Tables"]["publications"]["Update"] = { status };
	if (status === "published") {
		patch.published_by = user.id;
		// Keep the original date on re-publish so the feed order does not jump.
		patch.published_at = pub.published_at ?? new Date().toISOString();
		patch.rejection_reason = null;
		if (pub.status === "in_review") {
			patch.reviewed_by = user.id;
			patch.reviewed_at = new Date().toISOString();
		}
	}
	if (status === "in_review") patch.submitted_at = new Date().toISOString();
	const { data: updated, error } = await supabase.from("publications").update(patch).eq("id", id).select("*").single();
	if (error) return { ok: false, error: error.message };

	await logEvent(id, user.id, status === "published" ? (pub.status === "in_review" ? "approved" : "published") : `status:${status}`);
	revalidateAll(pub.slug);

	// Tell the author their submission went live.
	if (status === "published" && pub.status === "in_review" && pub.author_id && pub.author_id !== user.id) {
		after(async () => {
			await sendNotification({
				userId: pub.author_id!,
				type: "blog_approved",
				title: "Your post is live",
				message: `“${pub.title}” was approved and is now published.`,
				link: `/publications/${pub.slug}`,
				metadata: { publication_id: pub.id },
			}).catch(() => undefined);
		});
	}

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

/** Admin: send a submission back to its author with a note on what to change. */
export async function returnPublication(id: string, reason: string): Promise<ActionResult> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const note = reason.trim();
	if (note.length < 3) return { ok: false, error: "Tell the author what to change." };
	const { data: pub } = await auth.supabase.from("publications").select("id, slug, title, author_id").eq("id", id).maybeSingle();
	if (!pub) return { ok: false, error: "That item no longer exists." };
	const { error } = await auth.supabase
		.from("publications")
		.update({ status: "draft", rejection_reason: note.slice(0, 1000), reviewed_by: auth.user.id, reviewed_at: new Date().toISOString() })
		.eq("id", id);
	if (error) return { ok: false, error: error.message };
	await logEvent(id, auth.user.id, "returned", note.slice(0, 300));
	if (pub.author_id && pub.author_id !== auth.user.id) {
		after(async () => {
			await sendNotification({
				userId: pub.author_id!,
				type: "blog_rejected",
				title: "Your post needs changes",
				message: `“${pub.title}”: ${note.slice(0, 200)}`,
				link: `/dashboard/blogs/${pub.id}`,
				metadata: { publication_id: pub.id },
			}).catch(() => undefined);
		});
	}
	revalidateAll(pub.slug);
	return { ok: true };
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
	const auth = await requirePublisher();
	if (!auth.ok) return auth;
	const { data } = await auth.supabase.from("publications").select("slug, source_file_url, author_id, status").eq("id", id).maybeSingle();
	if (!data) return { ok: false, error: "That item no longer exists." };
	if (!auth.isAdmin && (data.author_id !== auth.user.id || data.status !== "draft")) {
		return { ok: false, error: "You can only delete your own drafts." };
	}
	const { error } = await auth.supabase.from("publications").delete().eq("id", id);
	if (error) return { ok: false, error: error.message };
	const path = storagePathOf(data.source_file_url);
	if (path) await createAdminClient().storage.from(BUCKET).remove([path]);
	revalidateAll(data.slug);
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
	const auth = await requirePublisher();
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

/**
 * Keep an uploaded PDF as the post itself. No text is extracted: readers see the PDF
 * natively. Use `extractPdfText` only if the author later chooses "Show the text instead".
 */
export async function attachPdfFromStorage(path: string): Promise<ActionResult<{ sourceUrl: string; fileName: string }>> {
	const auth = await requirePublisher();
	if (!auth.ok) return auth;
	if (!/^imports\/[\w-]+\/[^/]+$/.test(path)) return { ok: false, error: "Invalid file location." };
	const admin = createAdminClient();
	const { data: head, error } = await admin.storage.from(BUCKET).download(path);
	if (error || !head) return { ok: false, error: "Could not read the uploaded file. Please try again." };
	const magic = Buffer.from(await head.slice(0, 5).arrayBuffer()).toString("latin1");
	if (magic !== "%PDF-") {
		await admin.storage.from(BUCKET).remove([path]);
		return { ok: false, error: "That file is not a PDF." };
	}
	const fileName = decodeURIComponent(path.split("/").pop() ?? "document.pdf");
	const sourceUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
	return { ok: true, sourceUrl, fileName };
}

/** On demand only: pull the text out of an already-attached PDF so it can be edited as an article. */
export async function extractPdfText(sourceUrl: string): Promise<ActionResult<{ doc: ImportedDocument }>> {
	const auth = await requirePublisher();
	if (!auth.ok) return auth;
	const path = storagePathOf(sourceUrl);
	if (!path) return { ok: false, error: "Invalid file location." };
	const { data: blob, error } = await createAdminClient().storage.from(BUCKET).download(path);
	if (error || !blob) return { ok: false, error: "Could not read the PDF." };
	try {
		const doc = await importDocument(Buffer.from(await blob.arrayBuffer()), path.split("/").pop() ?? "document.pdf", { uploadImage: async () => null });
		return { ok: true, doc };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : "No text could be extracted from this PDF." };
	}
}

/** A suggested description for a PDF post: its first real paragraph after the cover and contents. */
export async function suggestPdfSummary(sourceUrl: string): Promise<ActionResult<{ summary: string }>> {
	const auth = await requirePublisher();
	if (!auth.ok) return auth;
	if (!storagePathOf(sourceUrl)) return { ok: false, error: "Invalid file location." };
	const summary = await describePdf(sourceUrl);
	return summary ? { ok: true, summary } : { ok: false, error: "No readable text was found to suggest a description from." };
}
