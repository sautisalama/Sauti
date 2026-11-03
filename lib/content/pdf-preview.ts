import { getDocumentProxy, renderPageAsImage } from "unpdf";

type Doc = Awaited<ReturnType<typeof getDocumentProxy>>;
const canvasImport = () => import("@napi-rs/canvas");

async function load(url: string): Promise<Doc | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		return await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
	} catch {
		return null;
	}
}

/** Page text as paragraphs: a gap taller than normal line spacing starts a new one. */
async function pageParagraphs(doc: Doc, n: number): Promise<{ paragraphs: string[]; lines: string[] }> {
	const page = await doc.getPage(n);
	const content = await page.getTextContent();
	type Line = { y: number; h: number; text: string };
	const lines: Line[] = [];
	for (const it of content.items) {
		if (!("str" in it) || !it.str.trim()) continue;
		const y = it.transform[5];
		const last = lines[lines.length - 1];
		if (last && Math.abs(last.y - y) < 2) last.text += (/\s$/.test(last.text) ? "" : " ") + it.str.trim();
		else lines.push({ y, h: it.height || Math.abs(it.transform[3]) || 10, text: it.str.trim() });
	}
	const paragraphs: string[] = [];
	let cur: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		const gap = i > 0 ? Math.abs(lines[i - 1].y - lines[i].y) : 0;
		if (i > 0 && gap > lines[i].h * 1.9) {
			paragraphs.push(cur.join(" "));
			cur = [];
		}
		cur.push(lines[i].text);
	}
	if (cur.length) paragraphs.push(cur.join(" "));
	return { paragraphs: paragraphs.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean), lines: lines.map((l) => l.text) };
}

/** A contents page: headed "Contents", or mostly lines that end in a page number / dot leaders. */
function looksLikeContents(lines: string[]): boolean {
	if (!lines.length) return false;
	if (/^(table of )?contents\b/i.test(lines.slice(0, 3).join(" ").trim())) return true;
	const numbered = lines.filter((l) => /(\.{3,}|\s)\d{1,3}$/.test(l) && l.length < 110).length;
	return lines.length >= 6 && numbered / lines.length > 0.4;
}

const BOILERPLATE_PAGE = /(document control|revision|version history|how to read|glossary|abbreviations|definitions|list of (figures|tables)|acknowledg|disclaimer|copyright|about this (document|guide|manual)|table of)/i;
const OPENING_PAGE = /^\s*(\d+\.?\s*)?(executive summary|summary|abstract|introduction|overview|foreword|background|purpose|preface)/i;
const META_PARAGRAPH = /^(these terms|this (document|guide|manual|report) (is|was|has|describes|explains|covers)|table|figure|page|note[: ]|see |all rights)/i;

const isProse = (p: string) => p.length >= 90 && /[a-z]{3,} [a-z]{2,} [a-z]{2,}/i.test(p) && !/(\.{4,}|^\d+$)/.test(p) && (p.match(/[.!?]/g)?.length ?? 0) >= 1;

function toDescription(text: string, max = 160): string {
	const t = text.replace(/\s+/g, " ").trim();
	if (t.length <= max) return t;
	const cut = t.slice(0, max);
	const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
	if (sentence >= 90) return cut.slice(0, sentence + 1);
	return cut.slice(0, Math.max(cut.lastIndexOf(" "), 60)).replace(/[,;:\-–]$/, "").trimEnd() + "…";
}

/**
 * A search/share description for a PDF: the first real paragraph after the cover and the contents
 * page, trimmed to ~160 characters on a sentence boundary where possible. Null when nothing
 * readable is found (scanned PDFs, image-only pages).
 */
export async function describePdf(url: string): Promise<string | null> {
	const doc = await load(url);
	if (!doc) return null;
	try {
		const last = Math.min(doc.numPages, 14);
		let fallback: string | null = null;
		// Page 1 is a cover unless it carries a real amount of text (a paper or letter that opens on its abstract).
		const first = await pageParagraphs(doc, 1);
		const firstIsCover = doc.numPages > 1 && first.lines.join(" ").length < 900;
		for (let n = firstIsCover ? 2 : 1; n <= last; n++) {
			const { paragraphs, lines } = await pageParagraphs(doc, n);
			const head = lines.slice(0, 4).join(" ");
			if (looksLikeContents(lines) || BOILERPLATE_PAGE.test(head)) continue;
			const para = paragraphs.findIndex((p) => isProse(p) && !META_PARAGRAPH.test(p));
			if (para === -1) continue;
			let text = paragraphs[para];
			// A short opening paragraph reads better with the one after it.
			for (let k = para + 1; text.length < 140 && k < paragraphs.length && isProse(paragraphs[k]); k++) text += " " + paragraphs[k];
			// The page that opens the document proper (introduction, summary...) wins over earlier front matter.
			if (OPENING_PAGE.test(head)) return toDescription(text);
			fallback ??= toDescription(text);
		}
		return fallback;
	} catch {
		return null;
	}
}

/** First page as a PNG. */
export async function renderCover(url: string, width = 900): Promise<ArrayBuffer | null> {
	const doc = await load(url);
	if (!doc) return null;
	try {
		return await renderPageAsImage(doc, 1, { width, canvasImport });
	} catch {
		return null;
	}
}

/**
 * 1200×630 link-preview card: the first page on the site's navy-to-teal gradient. Link scrapers
 * want a landscape image; a bare portrait page gets cropped. No text is drawn (servers may have
 * no fonts), the title and description travel in the page's metadata.
 */
export async function renderSocialCard(url: string): Promise<Buffer | null> {
	const page = await renderCover(url, 900);
	if (!page) return null;
	const { createCanvas, loadImage } = await canvasImport();
	const W = 1200;
	const H = 630;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	const g = ctx.createLinearGradient(0, 0, W, H);
	g.addColorStop(0, "#1a365d");
	g.addColorStop(1, "#008080");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, H);
	const img = await loadImage(Buffer.from(page));
	const h = H - 90;
	const w = Math.min(Math.round((img.width / img.height) * h), W - 120);
	const x = Math.round((W - w) / 2);
	const y = 45;
	ctx.shadowColor = "rgba(0,0,0,0.45)";
	ctx.shadowBlur = 40;
	ctx.shadowOffsetY = 12;
	ctx.fillStyle = "#fff";
	ctx.fillRect(x, y, w, h);
	ctx.shadowColor = "transparent";
	ctx.drawImage(img, x, y, w, h);
	return canvas.encode("jpeg", 88);
}

/**
 * For a PDF post, replace an empty or machine-made summary (the old text extraction, which starts
 * with the cover) by the first real paragraph, and keep it. A summary an author wrote is left alone.
 */
export async function ensurePdfSummary<T extends { id: string; display_mode: string; source_file_url: string | null; summary: string | null; body: string; status: string }>(
	pub: T,
	persist: (id: string, summary: string) => Promise<unknown>
): Promise<T> {
	if (pub.display_mode !== "pdf" || !pub.source_file_url) return pub;
	const { makeSummary } = await import("./sanitize");
	const auto = !pub.summary?.trim() || pub.summary === makeSummary(pub.body);
	if (!auto) return pub;
	const found = await describePdf(pub.source_file_url);
	if (!found) return pub;
	if (pub.status === "published") await persist(pub.id, found).catch(() => undefined);
	return { ...pub, summary: found };
}
