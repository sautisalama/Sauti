import { Parser } from "htmlparser2";
import {
	Document,
	HeadingLevel,
	Packer,
	Paragraph,
	TextRun,
	ExternalHyperlink,
	AlignmentType,
} from "docx";
import { jsPDF } from "jspdf";
import { htmlToText } from "./sanitize";

/**
 * Flatten sanitised HTML into simple blocks that both the PDF and DOCX
 * renderers understand. Tables are rendered as tab-separated rows; images are
 * skipped (the email attaches a text copy for review, the site keeps the
 * rich version).
 */
export type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; href?: string };
export type ExportBlock =
	| { type: "heading"; level: 1 | 2 | 3; runs: Run[] }
	| { type: "paragraph"; runs: Run[] }
	| { type: "quote"; runs: Run[] }
	| { type: "list-item"; runs: Run[]; ordered: boolean; index: number; depth: number }
	| { type: "rule" };

export function htmlToBlocks(html: string): ExportBlock[] {
	const blocks: ExportBlock[] = [];
	let runs: Run[] = [];
	let current: "heading1" | "heading2" | "heading3" | "paragraph" | "quote" | "li" | null = null;
	const fmt = { bold: 0, italic: 0, underline: 0 };
	const hrefs: string[] = [];
	const lists: { ordered: boolean; n: number }[] = [];
	let quoteDepth = 0;
	let cellCount = 0;

	const flush = () => {
		const trimmed = trimRuns(runs);
		if (trimmed.length && current) {
			if (current.startsWith("heading")) {
				blocks.push({ type: "heading", level: Number(current.slice(-1)) as 1 | 2 | 3, runs: trimmed });
			} else if (current === "li") {
				const l = lists[lists.length - 1] ?? { ordered: false, n: 0 };
				l.n++;
				blocks.push({ type: "list-item", runs: trimmed, ordered: l.ordered, index: l.n, depth: lists.length - 1 });
			} else if (current === "quote") {
				blocks.push({ type: "quote", runs: trimmed });
			} else {
				blocks.push({ type: "paragraph", runs: trimmed });
			}
		}
		runs = [];
		current = null;
	};
	const start = (kind: NonNullable<typeof current>) => {
		flush();
		current = kind;
	};

	const parser = new Parser(
		{
			onopentag(name, attrs) {
				switch (name) {
					case "h1": case "h2": case "h3": case "h4":
						start(`heading${Math.min(Number(name[1]), 3)}` as "heading1");
						break;
					case "p":
						start(quoteDepth ? "quote" : lists.length ? "li" : "paragraph");
						break;
					case "blockquote": quoteDepth++; break;
					case "ul": flush(); lists.push({ ordered: false, n: 0 }); break;
					case "ol": flush(); lists.push({ ordered: true, n: 0 }); break;
					case "li": start("li"); break;
					case "tr": cellCount = 0; start("paragraph"); break;
					case "td": case "th":
						if (cellCount++ > 0) runs.push({ text: "\t" });
						break;
					case "br": runs.push({ text: "\n" }); break;
					case "hr": flush(); blocks.push({ type: "rule" }); break;
					case "strong": case "b": fmt.bold++; break;
					case "em": case "i": fmt.italic++; break;
					case "u": fmt.underline++; break;
					case "a": hrefs.push(attrs.href ?? ""); break;
				}
			},
			ontext(text) {
				if (!text) return;
				if (!current) current = quoteDepth ? "quote" : "paragraph";
				runs.push({
					text,
					bold: fmt.bold > 0 || undefined,
					italic: fmt.italic > 0 || undefined,
					underline: fmt.underline > 0 || undefined,
					href: hrefs[hrefs.length - 1] || undefined,
				});
			},
			onclosetag(name) {
				switch (name) {
					case "h1": case "h2": case "h3": case "h4": case "p": case "li": case "tr":
						flush();
						break;
					case "blockquote": flush(); quoteDepth = Math.max(0, quoteDepth - 1); break;
					case "ul": case "ol": flush(); lists.pop(); break;
					case "strong": case "b": fmt.bold--; break;
					case "em": case "i": fmt.italic--; break;
					case "u": fmt.underline--; break;
					case "a": hrefs.pop(); break;
				}
			},
		},
		{ decodeEntities: true }
	);
	parser.write(html);
	parser.end();
	flush();
	return blocks;
}

function trimRuns(runs: Run[]): Run[] {
	const out = runs.map((r) => ({ ...r, text: r.text.replace(/[ \f\r ]+/g, " ").replace(/\n+/g, "\n") }));
	while (out.length && !out[0].text.trim() && out[0].text !== "\t") out.shift();
	while (out.length && !out[out.length - 1].text.trim() && out[out.length - 1].text !== "\t") out.pop();
	if (out.length) {
		out[0].text = out[0].text.replace(/^\s+/, "");
		out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, "");
	}
	return out;
}

export interface ExportMeta {
	title: string;
	summary?: string | null;
	author?: string | null;
	publishedAt?: string | null;
	category?: string | null;
	url?: string | null;
	links?: { label: string; url: string }[];
	status?: string;
}

const runsText = (runs: Run[]) => runs.map((r) => r.text).join("");

// ───────────────────────────── DOCX ─────────────────────────────

export async function renderDocx(html: string, meta: ExportMeta): Promise<Buffer> {
	const blocks = htmlToBlocks(html);
	const toRuns = (runs: Run[]) =>
		runs.map((r) =>
			r.href && /^https?:\/\//i.test(r.href)
				? new ExternalHyperlink({
						link: r.href,
						children: [new TextRun({ text: r.text, style: "Hyperlink", bold: r.bold, italics: r.italic })],
					})
				: new TextRun({ text: r.text, bold: r.bold, italics: r.italic, underline: r.underline ? {} : undefined })
		);
	const children: Paragraph[] = [
		new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: meta.title, bold: true })] }),
	];
	const byline = [meta.category, meta.author && `By ${meta.author}`, meta.publishedAt && fmtDate(meta.publishedAt), meta.status && meta.status !== "published" ? `(${meta.status})` : null]
		.filter(Boolean)
		.join("  ·  ");
	if (byline) children.push(new Paragraph({ children: [new TextRun({ text: byline, color: "666666", size: 20 })], spacing: { after: 200 } }));
	if (meta.summary) children.push(new Paragraph({ children: [new TextRun({ text: meta.summary, italics: true })], spacing: { after: 240 } }));

	for (const b of blocks) {
		if (b.type === "heading") {
			children.push(
				new Paragraph({
					heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][b.level - 1],
					children: toRuns(b.runs),
					spacing: { before: 240, after: 120 },
				})
			);
		} else if (b.type === "list-item") {
			children.push(
				new Paragraph({
					children: b.ordered ? [new TextRun({ text: `${b.index}. ` }), ...toRuns(b.runs)] : toRuns(b.runs),
					bullet: b.ordered ? undefined : { level: Math.min(b.depth, 4) },
					indent: b.ordered ? { left: 720 + b.depth * 360 } : undefined,
				})
			);
		} else if (b.type === "quote") {
			children.push(
				new Paragraph({
					children: toRuns(b.runs),
					indent: { left: 720 },
					border: { left: { style: "single", size: 12, color: "008080", space: 8 } },
					spacing: { before: 120, after: 120 },
				})
			);
		} else if (b.type === "rule") {
			children.push(new Paragraph({ border: { bottom: { style: "single", size: 6, color: "999999", space: 1 } }, spacing: { after: 120 } }));
		} else {
			children.push(new Paragraph({ children: toRuns(b.runs), spacing: { after: 140 }, alignment: AlignmentType.LEFT }));
		}
	}

	if (meta.links?.length) {
		children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Other sources")], spacing: { before: 360 } }));
		for (const l of meta.links) {
			children.push(
				new Paragraph({
					bullet: { level: 0 },
					children: [new ExternalHyperlink({ link: l.url, children: [new TextRun({ text: l.label, style: "Hyperlink" }), new TextRun({ text: ` — ${l.url}`, color: "666666" })] })],
				})
			);
		}
	}
	if (meta.url) {
		children.push(new Paragraph({ children: [new TextRun({ text: `Online: ${meta.url}`, color: "666666", size: 18 })], spacing: { before: 360 } }));
	}

	const doc = new Document({
		creator: "Sauti Salama",
		title: meta.title,
		description: meta.summary ?? undefined,
		sections: [{ children }],
	});
	return Buffer.from(await Packer.toBuffer(doc));
}

// ───────────────────────────── PDF ──────────────────────────────

export function renderPdf(html: string, meta: ExportMeta): Buffer {
	const blocks = htmlToBlocks(html);
	const doc = new jsPDF({ unit: "pt", format: "a4" });
	doc.setProperties({ title: meta.title, author: meta.author ?? "Sauti Salama", creator: "Sauti Salama" });
	const W = doc.internal.pageSize.getWidth();
	const H = doc.internal.pageSize.getHeight();
	const M = 56;
	const maxW = W - M * 2;
	let y = M;

	const ensure = (h: number) => {
		if (y + h > H - M) {
			doc.addPage();
			y = M;
		}
	};
	const write = (text: string, size: number, style: "normal" | "bold" | "italic", opts: { indent?: number; gap?: number; color?: [number, number, number] } = {}) => {
		doc.setFont("helvetica", style);
		doc.setFontSize(size);
		doc.setTextColor(...(opts.color ?? [30, 30, 30]));
		const lines = doc.splitTextToSize(sanitizePdfText(text), maxW - (opts.indent ?? 0)) as string[];
		const lh = size * 1.4;
		for (const line of lines) {
			ensure(lh);
			doc.text(line, M + (opts.indent ?? 0), y + size);
			y += lh;
		}
		y += opts.gap ?? 6;
	};
	const styleOf = (runs: Run[]): "normal" | "bold" | "italic" =>
		runs.length && runs.every((r) => r.bold) ? "bold" : runs.length && runs.every((r) => r.italic) ? "italic" : "normal";

	write(meta.title, 22, "bold", { gap: 8 });
	const byline = [meta.category, meta.author && `By ${meta.author}`, meta.publishedAt && fmtDate(meta.publishedAt), meta.status && meta.status !== "published" ? `(${meta.status})` : null]
		.filter(Boolean)
		.join("  |  ");
	if (byline) write(byline, 9, "normal", { color: [110, 110, 110], gap: 10 });
	if (meta.summary) write(meta.summary, 12, "italic", { gap: 12 });

	for (const b of blocks) {
		if (b.type === "heading") {
			y += 6;
			write(runsText(b.runs), [18, 15, 13][b.level - 1], "bold", { gap: 6 });
		} else if (b.type === "list-item") {
			write(`${b.ordered ? `${b.index}.` : "•"} ${runsText(b.runs)}`, 11, styleOf(b.runs), { indent: 14 + b.depth * 14, gap: 3 });
		} else if (b.type === "quote") {
			write(runsText(b.runs), 11, "italic", { indent: 18, color: [70, 70, 70], gap: 8 });
		} else if (b.type === "rule") {
			ensure(10);
			doc.setDrawColor(180);
			doc.line(M, y + 4, W - M, y + 4);
			y += 14;
		} else {
			write(runsText(b.runs), 11, styleOf(b.runs), { gap: 8 });
		}
	}

	if (meta.links?.length) {
		y += 10;
		write("Other sources", 14, "bold", { gap: 6 });
		for (const l of meta.links) write(`• ${l.label} — ${l.url}`, 10, "normal", { indent: 10, gap: 3 });
	}
	if (meta.url) {
		y += 8;
		write(`Online: ${meta.url}`, 9, "normal", { color: [110, 110, 110] });
	}

	const pages = doc.getNumberOfPages();
	for (let i = 1; i <= pages; i++) {
		doc.setPage(i);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8);
		doc.setTextColor(140);
		doc.text(`Sauti Salama · ${i}/${pages}`, W / 2, H - 28, { align: "center" });
	}
	return Buffer.from(doc.output("arraybuffer"));
}

/** jsPDF's built-in fonts are WinAnsi only; swap characters outside it for safe ones. */
function sanitizePdfText(s: string): string {
	return s
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/[–—]/g, "-")
		.replace(/…/g, "...")
		.replace(/ /g, " ")
		.replace(/[^\x09\x0a\x20-\x7e¡-ÿ•]/g, "?");
}

function fmtDate(iso: string): string {
	const d = new Date(iso);
	return isNaN(+d) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export { htmlToText };
