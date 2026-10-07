import mammoth from "mammoth";
import { getDocumentProxy, extractText } from "unpdf";
import { htmlToText, sanitizeContent } from "./sanitize";

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

export type ImportKind = "docx" | "pdf";

export interface ImportedDocument {
	kind: ImportKind;
	title: string;
	html: string;
	warnings: string[];
}

/** Detect by magic bytes (browsers report wrong/empty MIME types), then by extension. */
export function detectImportKind(buf: Buffer, filename: string): ImportKind | null {
	if (buf.length > 4 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
	// .docx is a zip container: "PK\x03\x04"
	const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
	if (isZip && /\.docx$/i.test(filename)) return "docx";
	return null;
}

export type ImageUploader = (img: { buffer: Buffer; contentType: string }) => Promise<string | null>;

export async function importDocument(
	buf: Buffer,
	filename: string,
	opts: { uploadImage?: ImageUploader } = {}
): Promise<ImportedDocument> {
	if (buf.length === 0) throw new Error("The file is empty.");
	if (buf.length > MAX_IMPORT_BYTES) throw new Error("The file is larger than 15 MB.");
	const kind = detectImportKind(buf, filename);
	if (!kind) {
		throw new Error(
			/\.doc$/i.test(filename)
				? "Legacy .doc files are not supported. Save the document as .docx and try again."
				: "Unsupported file. Upload a Word (.docx) or PDF document."
		);
	}
	return kind === "docx" ? importDocx(buf, filename, opts.uploadImage) : importPdf(buf, filename);
}

async function importDocx(buf: Buffer, filename: string, upload?: ImageUploader): Promise<ImportedDocument> {
	const warnings: string[] = [];
	let skippedImages = 0;

	const result = await mammoth.convertToHtml(
		{ buffer: buf },
		{
			styleMap: [
				"p[style-name='Title'] => h1:fresh",
				"p[style-name='Quote'] => blockquote > p:fresh",
				"p[style-name='Intense Quote'] => blockquote > p:fresh",
			],
			convertImage: mammoth.images.imgElement(async (image) => {
				if (!upload) {
					skippedImages++;
					return { src: "" };
				}
				const data = await image.readAsBuffer();
				const url = await upload({ buffer: data, contentType: image.contentType });
				if (!url) skippedImages++;
				return { src: url ?? "", alt: "" };
			}),
		}
	);

	for (const m of result.messages) {
		if (m.type === "error") warnings.push(m.message);
	}
	if (skippedImages) warnings.push(`${skippedImages} image(s) could not be imported — re-add them in the editor.`);

	const withoutBrokenImages = result.value.replace(/<img[^>]*\ssrc=""[^>]*>/g, "");
	const { title, html } = pullTitle(withoutBrokenImages, filename);

	const clean = sanitizeContent(html);
	if (!htmlToText(clean) && !/<img/i.test(clean)) {
		throw new Error("No readable text was found in this Word document.");
	}
	return { kind: "docx", title, html: clean, warnings };
}

async function importPdf(buf: Buffer, filename: string): Promise<ImportedDocument> {
	const warnings: string[] = [];
	let pages: string[];
	try {
		const pdf = await getDocumentProxy(new Uint8Array(buf));
		const { text } = await extractText(pdf, { mergePages: false });
		pages = Array.isArray(text) ? text : [String(text)];
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (/password/i.test(msg)) throw new Error("This PDF is password-protected. Remove the password and try again.");
		throw new Error("This PDF could not be read. It may be corrupted.");
	}

	const full = pages.join("\n\n").replace(/\r/g, "").trim();
	if (full.replace(/\s/g, "").length < 20) {
		throw new Error(
			"No text was found in this PDF. It looks like a scanned document — upload a text-based PDF or a Word file instead."
		);
	}
	warnings.push(
		"PDF layout can't be reproduced exactly: headings and paragraphs were detected automatically. Please review before publishing."
	);

	const html = blocksToHtml(pdfTextToBlocks(stripRepeatedHeadersFooters(pages)));
	const { title, html: rest } = pullTitle(html, filename);
	return { kind: "pdf", title, html: sanitizeContent(rest), warnings };
}

const normaliseEdge = (l: string) => l.replace(/\d+/g, "#").toLowerCase();
const stripPageNumber = (p: string) => p.replace(/^\s*(page\s*)?\d+(\s*(of|\/)\s*\d+)?\s*$/gim, "");

/** Remove lines that repeat on most pages (running headers, footers, page numbers). */
export function stripRepeatedHeadersFooters(pages: string[]): string[] {
	if (pages.length < 3) return pages.map(stripPageNumber);
	const counts = new Map<string, number>();
	for (const p of pages) {
		const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
		const edge = new Set([...lines.slice(0, 2), ...lines.slice(-2)].map(normaliseEdge));
		for (const l of edge) if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
	}
	const threshold = Math.max(3, Math.ceil(pages.length * 0.6));
	const repeated = new Set([...counts].filter(([, n]) => n >= threshold).map(([l]) => l));
	return pages.map((p) =>
		stripPageNumber(
			p
				.split("\n")
				.filter((l) => !repeated.has(normaliseEdge(l.trim())))
				.join("\n")
		)
	);
}

export type Block = { type: "h2" | "h3" | "p" | "li"; text: string };

/** Turn flat PDF text into headings / paragraphs / bullet items. */
export function pdfTextToBlocks(pages: string[]): Block[] {
	const blocks: Block[] = [];
	let para: string[] = [];

	const flush = () => {
		if (!para.length) return;
		const text = para.join(" ").replace(/\s+/g, " ").trim();
		if (text) blocks.push({ type: "p", text });
		para = [];
	};

	for (const page of pages) {
		const lines = page.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) {
				flush();
				continue;
			}
			const bullet = line.match(/^([•●▪◦\-–*]|\d{1,2}[.)])\s+(.*)$/);
			if (bullet) {
				flush();
				blocks.push({ type: "li", text: bullet[2] });
				continue;
			}
			if (looksLikeHeading(line, lines[i - 1], lines[i + 1])) {
				flush();
				blocks.push({ type: isMajorHeading(line) ? "h2" : "h3", text: line });
				continue;
			}
			// Join hyphenated line wraps: "respon-" + "ders" -> "responders"
			if (para.length && /[a-z]-$/.test(para[para.length - 1])) {
				para[para.length - 1] = para[para.length - 1].slice(0, -1) + line;
			} else {
				para.push(line);
			}
		}
		// A page break usually ends a paragraph only if the sentence is finished.
		const last = para[para.length - 1] ?? "";
		if (/[.!?:"”)]$/.test(last)) flush();
	}
	flush();
	return blocks;
}

function looksLikeHeading(line: string, prev?: string, next?: string): boolean {
	if (line.length > 90 || line.length < 3) return false;
	if (/[.,;]$/.test(line)) return false;
	const words = line.split(/\s+/);
	if (words.length > 12) return false;
	if (prev?.trim() && next?.trim()) return false;
	const letters = line.replace(/[^A-Za-z]/g, "");
	if (letters.length < 3) return false;
	const allCaps = letters === letters.toUpperCase();
	const titleCase = words.filter((w) => /^[A-Z0-9]/.test(w) || w.length <= 3).length / words.length >= 0.7;
	const numbered = /^(\d+(\.\d+)*|[IVX]+)[.)]?\s+\S/.test(line);
	return allCaps || numbered || (titleCase && words.length <= 8);
}

function isMajorHeading(line: string): boolean {
	const letters = line.replace(/[^A-Za-z]/g, "");
	return letters === letters.toUpperCase() || /^\d+[.)]?\s/.test(line);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function blocksToHtml(blocks: Block[]): string {
	let html = "";
	let inList = false;
	for (const b of blocks) {
		if (b.type === "li") {
			if (!inList) {
				html += "<ul>";
				inList = true;
			}
			html += `<li>${esc(b.text)}</li>`;
			continue;
		}
		if (inList) {
			html += "</ul>";
			inList = false;
		}
		html += `<${b.type}>${esc(b.text)}</${b.type}>`;
	}
	if (inList) html += "</ul>";
	return html;
}

/** Use the first heading (or short first paragraph) as the title and remove it from the body. */
function pullTitle(html: string, filename: string): { title: string; html: string } {
	const fallback = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled";
	const m = html.match(/^\s*<(h1|h2|h3|p)>(?:<strong>)?([^<]{3,140})(?:<\/strong>)?<\/\1>/i);
	if (m) {
		const text = m[2].replace(/&amp;/g, "&").trim();
		const isHeading = m[1].toLowerCase() !== "p";
		if (isHeading || (text.length <= 100 && !/[.!?]$/.test(text))) {
			return { title: text, html: html.slice(m[0].length) };
		}
	}
	return { title: fallback.replace(/\b\w/g, (c) => c.toUpperCase()), html };
}
