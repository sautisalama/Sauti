import { jsPDF } from "jspdf";
import { summarise } from "@/lib/forms/analytics";
import type { Answer, Question } from "@/lib/forms/schema";

interface Row { answers: Record<string, Answer | undefined>; created_at: string }

const hexToRgb = (hex: string): [number, number, number] => {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!m) return [6, 130, 151];
	const n = parseInt(m[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Replace characters the built-in PDF fonts cannot draw. */
const plain = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\x20-\x7E -ÿ\n]/g, "");

/**
 * A printable report of a form's responses with a bar chart for every choice, scale and checkbox question,
 * figures for numbers, and the newest open answers. The written summary (from the AI report) goes first when
 * there is one. Drawn straight onto the page, so it needs nothing but the data.
 */
export function formReportPdf(opts: { title: string; questions: Question[]; responses: Row[]; narrative?: string | null; accent?: string }): Blob {
	const doc = new jsPDF({ unit: "pt", format: "a4" });
	const W = doc.internal.pageSize.getWidth();
	const H = doc.internal.pageSize.getHeight();
	const M = 48;
	const accent = hexToRgb(opts.accent || "#068297");
	let y = M;

	const ensure = (h: number) => { if (y + h > H - M) { doc.addPage(); y = M; } };
	const text = (t: string, size: number, opt: { bold?: boolean; color?: [number, number, number]; gap?: number; width?: number } = {}) => {
		doc.setFont("helvetica", opt.bold ? "bold" : "normal");
		doc.setFontSize(size);
		doc.setTextColor(...(opt.color ?? [24, 24, 27]));
		const lines = doc.splitTextToSize(plain(t), opt.width ?? W - M * 2) as string[];
		for (const line of lines) {
			ensure(size * 1.35);
			doc.text(line, M, y + size);
			y += size * 1.35;
		}
		y += opt.gap ?? 4;
	};

	// Title band
	doc.setFillColor(...accent);
	doc.rect(0, 0, W, 86, "F");
	doc.setTextColor(255, 255, 255);
	doc.setFont("helvetica", "bold");
	doc.setFontSize(20);
	doc.text(plain(opts.title).slice(0, 70), M, 48);
	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	const dates = opts.responses.map((r) => r.created_at).sort();
	doc.text(`${opts.responses.length} responses${dates.length ? `  |  ${dates[0].slice(0, 10)} to ${dates[dates.length - 1].slice(0, 10)}` : ""}`, M, 68);
	y = 112;

	if (opts.narrative?.trim()) {
		for (const block of opts.narrative.split(/\n{1,}/)) {
			const b = block.trim();
			if (!b) continue;
			if (b.startsWith("## ")) { y += 6; text(b.slice(3), 13, { bold: true, color: accent, gap: 3 }); }
			else text(b.replace(/^[-*]\s+/, "- ").replace(/\*\*([^*]+)\*\*/g, "$1"), 10.5, { gap: 3 });
		}
		y += 10;
	}

	text("Question by question", 15, { bold: true, color: accent, gap: 8 });
	const sums = summarise(opts.questions, opts.responses);
	sums.forEach((s, i) => {
		ensure(70);
		text(`${i + 1}. ${s.question.label || "Question"}`, 11.5, { bold: true, gap: 1 });
		text(`${s.answered} answered, ${s.skipped} skipped`, 9, { color: [113, 113, 122], gap: 6 });

		if (s.tallies?.length) {
			const max = Math.max(1, ...s.tallies.map((t) => t.count));
			const labelW = 150;
			const barX = M + labelW + 8;
			const barW = W - M - barX - 56;
			for (const t of s.tallies.slice(0, 14)) {
				ensure(20);
				doc.setFont("helvetica", "normal");
				doc.setFontSize(9);
				doc.setTextColor(63, 63, 70);
				const lab = doc.splitTextToSize(plain(t.label), labelW)[0] as string;
				doc.text(lab, M, y + 11);
				doc.setFillColor(238, 240, 242);
				doc.roundedRect(barX, y + 3, barW, 11, 3, 3, "F");
				if (t.count > 0) {
					doc.setFillColor(...accent);
					doc.roundedRect(barX, y + 3, Math.max(4, (t.count / max) * barW), 11, 3, 3, "F");
				}
				doc.setTextColor(24, 24, 27);
				doc.text(`${t.count} (${t.pct}%)`, barX + barW + 6, y + 11);
				y += 19;
			}
			if (s.stats) text(`Average ${s.stats.avg.toFixed(1)}, from ${s.stats.min} to ${s.stats.max}`, 9.5, { color: [63, 63, 70], gap: 4 });
		} else if (s.stats) {
			text(`Average ${s.stats.avg.toFixed(1)}   |   lowest ${s.stats.min}   |   highest ${s.stats.max}`, 10, { gap: 4 });
		} else if (s.samples?.length) {
			for (const sample of s.samples.slice(0, 6)) text(`"${sample.slice(0, 280)}"`, 9.5, { color: [63, 63, 70], gap: 2 });
		}
		y += 12;
	});

	// Footer with page numbers
	const pages = doc.getNumberOfPages();
	for (let p = 1; p <= pages; p++) {
		doc.setPage(p);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8);
		doc.setTextColor(150, 150, 155);
		doc.text(`Sauti Salama  |  ${plain(opts.title).slice(0, 60)}`, M, H - 24);
		doc.text(`Page ${p} of ${pages}`, W - M, H - 24, { align: "right" });
	}
	return doc.output("blob");
}
