import { sendEmailWithAttachments } from "@/lib/notifications/email";
import { renderDocx, renderPdf } from "./export";
import { slugify } from "./sanitize";
import { ORGANIZATION } from "@/lib/organization";
import type { PublicationRow } from "@/types/publishing";

export const PUBLICATIONS_INBOX = process.env.PUBLICATIONS_EMAIL || "publications@sautisalama.org";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Email a PDF and a Word copy of a publication to the publications inbox. */
export async function emailPublicationCopy(
	pub: Pick<PublicationRow, "title" | "summary" | "body" | "slug" | "status" | "kind" | "category" | "published_at" | "external_links">,
	opts: { author?: string; event: "published" | "resent" | "draft" }
) {
	const url = `${ORGANIZATION.url}/publications/${pub.slug}`;
	const meta = {
		title: pub.title,
		summary: pub.summary,
		author: opts.author ?? null,
		publishedAt: pub.published_at,
		category: pub.category,
		url: pub.status === "published" ? url : null,
		links: pub.external_links,
		status: pub.status,
	};
	const base = slugify(pub.title);
	try {
		const [docx, pdf] = [await renderDocx(pub.body, meta), renderPdf(pub.body, meta)];
		const verb = opts.event === "published" ? "Published" : opts.event === "draft" ? "Draft saved" : "Copy";
		return await sendEmailWithAttachments(
			PUBLICATIONS_INBOX,
			`[${verb}] ${pub.title}`,
			`<div style="font-family:Arial,sans-serif;max-width:560px;color:#1a365d">
				<h2 style="margin:0 0 8px">${esc(pub.title)}</h2>
				<p style="color:#666;margin:0 0 16px">${esc(pub.kind)} · ${esc(pub.status)}${opts.author ? ` · by ${esc(opts.author)}` : ""}</p>
				${pub.summary ? `<p>${esc(pub.summary)}</p>` : ""}
				<p>A PDF and a Word copy are attached.${pub.status === "published" ? ` <a href="${url}">View online</a>.` : ""}</p>
			</div>`,
			[
				{ filename: `${base}.pdf`, content: pdf, type: "application/pdf" },
				{
					filename: `${base}.docx`,
					content: docx,
					type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				},
			]
		);
	} catch (e) {
		return { success: false as const, error: e instanceof Error ? e.message : String(e) };
	}
}
