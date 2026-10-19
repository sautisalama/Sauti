/**
 * A presentation is a list of slides, each a list of boxes (text, shape, picture) on a 960 x 540 page. Colours are
 * written as theme words ("@accent") so changing the theme recolours every slide. New decks are built from a small
 * fixed set of layouts (title, bullets, two columns, picture and text, quote, numbers, steps, closing), the same way
 * Canva's templates and the open source AI deck makers do: the AI, or a template, only fills in words.
 */

export const W = 960;
export const H = 540;

export interface Theme { id: string; name: string; bg: string; surface: string; text: string; muted: string; accent: string; accent2: string; heading: string; body: string; dark: boolean }
export type ElType = "text" | "shape" | "image";
export interface El {
	id: string; type: ElType;
	x: number; y: number; w: number; h: number;
	text?: string; size?: number; bold?: boolean; italic?: boolean; align?: "left" | "center" | "right"; color?: string; font?: "heading" | "body"; valign?: "top" | "middle" | "bottom";
	fill?: string; shape?: "rect" | "round" | "ellipse"; opacity?: number;
	src?: string; fit?: "cover" | "contain"; alt?: string;
	/** Stacking order, lowest at the back. */
	z?: number;
}
export interface Slide { id: string; bg?: string; notes?: string; els: El[] }
export interface Deck { v: 1; title: string; theme: Theme; slides: Slide[] }

export const uid = () => Math.random().toString(36).slice(2, 10);

export const THEMES: Theme[] = [
	{ id: "sauti", name: "Sauti", bg: "#FFFFFF", surface: "#E6F4F6", text: "#0F3B44", muted: "#5B7A80", accent: "#068297", accent2: "#7D2AE8", heading: "Poppins", body: "Inter", dark: false },
	{ id: "ink", name: "Ink", bg: "#0E1318", surface: "#1B232B", text: "#F4F7F8", muted: "#9AA7AF", accent: "#00C4CC", accent2: "#FFDE59", heading: "Poppins", body: "Inter", dark: true },
	{ id: "sunrise", name: "Sunrise", bg: "#FFF8F1", surface: "#FFEDD5", text: "#431407", muted: "#9A5B3C", accent: "#EA580C", accent2: "#BE123C", heading: "Poppins", body: "Inter", dark: false },
	{ id: "forest", name: "Forest", bg: "#F4F8F3", surface: "#DCEBD8", text: "#14301C", muted: "#587A5F", accent: "#2F7D3B", accent2: "#B7791F", heading: "Poppins", body: "Inter", dark: false },
	{ id: "royal", name: "Royal", bg: "#FAF7FF", surface: "#EBE0FC", text: "#2A1052", muted: "#76609E", accent: "#7D2AE8", accent2: "#E8A92A", heading: "Poppins", body: "Inter", dark: false },
	{ id: "paper", name: "Paper", bg: "#FBFAF7", surface: "#EFEDE6", text: "#1F1F1B", muted: "#76736A", accent: "#1F1F1B", accent2: "#C2410C", heading: "Georgia", body: "Inter", dark: false },
	{ id: "midnight", name: "Midnight", bg: "#0B1B3A", surface: "#14305F", text: "#F2F6FF", muted: "#9DB2D8", accent: "#5AA9FF", accent2: "#FFD166", heading: "Poppins", body: "Inter", dark: true },
	{ id: "coral", name: "Coral", bg: "#FFF5F5", surface: "#FFE0E0", text: "#4A1218", muted: "#A15A60", accent: "#E5484D", accent2: "#0F766E", heading: "Poppins", body: "Inter", dark: false },
];

/** A colour word ("@accent") or a hex, as a hex for the theme. */
export function resolve(t: Theme, c: string | undefined, fallback = "@text"): string {
	const v = c || fallback;
	if (!v.startsWith("@")) return v;
	const k = v.slice(1) as keyof Theme;
	const hit = t[k];
	return typeof hit === "string" ? hit : t.text;
}

/** The fixed layouts, filled in with words. */
export type LayoutKind = "title" | "section" | "bullets" | "two" | "imageRight" | "imageLeft" | "quote" | "stats" | "steps" | "closing" | "photo";
export interface LayoutSpec {
	kind: LayoutKind;
	title?: string; subtitle?: string; bullets?: string[];
	columns?: { heading: string; bullets: string[] }[];
	quote?: string; by?: string;
	stats?: { n: string; label: string }[];
	steps?: { heading: string; text: string }[];
	image?: string; imageAlt?: string; notes?: string;
}

const text = (x: number, y: number, w: number, h: number, t: string, o: Partial<El> = {}): El => ({ id: uid(), type: "text", x, y, w, h, text: t, size: 24, color: "@text", font: "body", align: "left", valign: "top", ...o });
const box = (x: number, y: number, w: number, h: number, fill: string, o: Partial<El> = {}): El => ({ id: uid(), type: "shape", x, y, w, h, fill, shape: "rect", ...o });
const pic = (x: number, y: number, w: number, h: number, src: string | undefined, alt?: string): El => (src
	? { id: uid(), type: "image", x, y, w, h, src, fit: "cover", alt }
	: box(x, y, w, h, "@surface", { shape: "round" }));

const list = (b: string[] | undefined) => (b ?? []).map((x) => `• ${x}`).join("\n");

/** The boxes of one slide for a layout. */
export function layoutEls(s: LayoutSpec): El[] {
	const title = s.title ?? "";
	switch (s.kind) {
		case "title": return [
			box(0, 0, 18, H, "@accent"),
			text(70, 150, 780, 150, title, { size: 52, bold: true, font: "heading", valign: "bottom" }),
			box(70, 318, 90, 6, "@accent2"),
			text(70, 340, 780, 90, s.subtitle ?? "", { size: 24, color: "@muted" }),
		];
		case "section": return [
			box(0, 0, W, H, "@accent"),
			text(80, 190, 800, 120, title, { size: 48, bold: true, font: "heading", color: "#FFFFFF", valign: "middle" }),
			text(80, 320, 800, 80, s.subtitle ?? "", { size: 22, color: "#FFFFFF", opacity: 0.85 }),
		];
		case "bullets": return [
			text(60, 40, 840, 80, title, { size: 36, bold: true, font: "heading", valign: "middle" }),
			box(60, 124, 80, 5, "@accent"),
			text(60, 156, 840, 340, list(s.bullets), { size: 24 }),
		];
		case "two": {
			const [a, b] = s.columns ?? [];
			return [
				text(60, 40, 840, 80, title, { size: 36, bold: true, font: "heading", valign: "middle" }),
				box(60, 124, 80, 5, "@accent"),
				box(60, 156, 410, 340, "@surface", { shape: "round" }),
				text(80, 172, 370, 44, a?.heading ?? "", { size: 24, bold: true, font: "heading", color: "@accent" }),
				text(80, 224, 370, 260, list(a?.bullets), { size: 20 }),
				box(490, 156, 410, 340, "@surface", { shape: "round" }),
				text(510, 172, 370, 44, b?.heading ?? "", { size: 24, bold: true, font: "heading", color: "@accent" }),
				text(510, 224, 370, 260, list(b?.bullets), { size: 20 }),
			];
		}
		case "imageRight": return [
			text(60, 50, 440, 90, title, { size: 34, bold: true, font: "heading", valign: "middle" }),
			box(60, 146, 80, 5, "@accent"),
			text(60, 176, 440, 320, list(s.bullets), { size: 22 }),
			pic(540, 0, 420, H, s.image, s.imageAlt),
		];
		case "imageLeft": return [
			pic(0, 0, 420, H, s.image, s.imageAlt),
			text(460, 50, 440, 90, title, { size: 34, bold: true, font: "heading", valign: "middle" }),
			box(460, 146, 80, 5, "@accent"),
			text(460, 176, 440, 320, list(s.bullets), { size: 22 }),
		];
		case "quote": return [
			text(70, 60, 120, 140, "“", { size: 160, bold: true, font: "heading", color: "@accent" }),
			text(120, 170, 720, 200, s.quote ?? title, { size: 34, italic: true, font: "heading", valign: "middle" }),
			text(120, 392, 720, 50, s.by ? `— ${s.by}` : "", { size: 20, color: "@muted" }),
		];
		case "stats": {
			const st = (s.stats ?? []).slice(0, 4);
			const n = Math.max(st.length, 1);
			const gap = 24, cw = (840 - gap * (n - 1)) / n;
			return [
				text(60, 40, 840, 80, title, { size: 36, bold: true, font: "heading", valign: "middle" }),
				box(60, 124, 80, 5, "@accent"),
				...st.flatMap((x, i) => [
					box(60 + i * (cw + gap), 170, cw, 280, "@surface", { shape: "round" }),
					text(60 + i * (cw + gap) + 12, 210, cw - 24, 110, x.n, { size: 60, bold: true, font: "heading", color: "@accent", align: "center", valign: "middle" }),
					text(60 + i * (cw + gap) + 16, 330, cw - 32, 100, x.label, { size: 20, align: "center", color: "@muted" }),
				]),
			];
		}
		case "steps": {
			const st = (s.steps ?? []).slice(0, 5);
			const n = Math.max(st.length, 1);
			const gap = 16, cw = (840 - gap * (n - 1)) / n;
			return [
				text(60, 40, 840, 80, title, { size: 36, bold: true, font: "heading", valign: "middle" }),
				box(60, 124, 80, 5, "@accent"),
				box(60, 232, 840, 4, "@surface"),
				...st.flatMap((x, i) => [
					box(60 + i * (cw + gap), 214, 40, 40, "@accent", { shape: "ellipse" }),
					text(60 + i * (cw + gap), 214, 40, 40, String(i + 1), { size: 20, bold: true, color: "#FFFFFF", align: "center", valign: "middle" }),
					text(60 + i * (cw + gap), 274, cw, 50, x.heading, { size: 22, bold: true, font: "heading" }),
					text(60 + i * (cw + gap), 330, cw, 160, x.text, { size: 17, color: "@muted" }),
				]),
			];
		}
		case "closing": return [
			box(0, 0, W, H, "@surface"),
			box(0, H - 14, W, 14, "@accent"),
			text(80, 150, 800, 120, title || "Thank you", { size: 56, bold: true, font: "heading", align: "center", valign: "middle" }),
			text(80, 290, 800, 100, s.subtitle ?? "", { size: 24, color: "@muted", align: "center" }),
		];
		case "photo": return [
			pic(0, 0, W, H, s.image, s.imageAlt),
			box(0, H - 130, W, 130, "#000000", { opacity: 0.5 }),
			text(50, H - 118, 860, 100, title, { size: 34, bold: true, font: "heading", color: "#FFFFFF", valign: "middle" }),
		];
	}
}

export function buildDeck(title: string, theme: Theme, specs: LayoutSpec[]): Deck {
	return { v: 1, title, theme, slides: specs.map((s) => ({ id: uid(), notes: s.notes ?? "", els: layoutEls(s) })) };
}

/** A new slide for a layout, with prompts in place of the words. */
export const BLANK_SPEC: Record<LayoutKind, LayoutSpec> = {
	title: { kind: "title", title: "Presentation title", subtitle: "A line about it, and who is presenting" },
	section: { kind: "section", title: "Section title", subtitle: "What this part covers" },
	bullets: { kind: "bullets", title: "Slide title", bullets: ["First point", "Second point", "Third point"] },
	two: { kind: "two", title: "Two sides", columns: [{ heading: "Left", bullets: ["A point", "Another point"] }, { heading: "Right", bullets: ["A point", "Another point"] }] },
	imageRight: { kind: "imageRight", title: "Title with a picture", bullets: ["A point", "Another point"] },
	imageLeft: { kind: "imageLeft", title: "Title with a picture", bullets: ["A point", "Another point"] },
	quote: { kind: "quote", quote: "A line worth remembering.", by: "Who said it" },
	stats: { kind: "stats", title: "In numbers", stats: [{ n: "120", label: "People reached" }, { n: "8", label: "Counties" }, { n: "95%", label: "Said it helped" }] },
	steps: { kind: "steps", title: "How it works", steps: [{ heading: "Start", text: "What happens first" }, { heading: "Build", text: "What happens next" }, { heading: "Deliver", text: "What people get" }] },
	closing: { kind: "closing", title: "Thank you", subtitle: "Contact details or the next step" },
	photo: { kind: "photo", title: "A caption for the photo" },
};

export const LAYOUT_NAMES: Record<LayoutKind, string> = {
	title: "Title", section: "Section", bullets: "Bullets", two: "Two columns", imageRight: "Picture right", imageLeft: "Picture left", quote: "Quote", stats: "Numbers", steps: "Steps", closing: "Closing", photo: "Full photo",
};

export interface Template { id: string; name: string; blurb: string; group: "Start" | "Work" | "Funding" | "Learning" | "Communication"; theme: string; slides: LayoutSpec[] }

const b = (...x: string[]) => x;
export const TEMPLATES: Template[] = [
	{ id: "blank", name: "Blank", blurb: "One empty title slide.", group: "Start", theme: "sauti", slides: [BLANK_SPEC.title] },
	{ id: "pitch", name: "Pitch deck", blurb: "Problem, solution, proof, ask.", group: "Funding", theme: "sauti", slides: [
		{ kind: "title", title: "Organisation name", subtitle: "One sentence on what you do and for whom" },
		{ kind: "bullets", title: "The problem", bullets: b("Who is affected, and how many", "What it costs them today", "Why existing help falls short") },
		{ kind: "imageRight", title: "Our answer", bullets: b("What we do", "How it is different", "Who delivers it") },
		{ kind: "stats", title: "What we have achieved", stats: [{ n: "000", label: "People served" }, { n: "00", label: "Partners" }, { n: "00%", label: "Outcome you measure" }] },
		{ kind: "steps", title: "How it works", steps: [{ heading: "Reach", text: "How people find us" }, { heading: "Support", text: "What they receive" }, { heading: "Follow up", text: "How we check it worked" }] },
		{ kind: "quote", quote: "A line from someone we helped, with their permission.", by: "Name or role" },
		{ kind: "two", title: "The ask", columns: [{ heading: "What we need", bullets: b("Amount and period", "What it buys") }, { heading: "What you get", bullets: b("Results you can see", "How we report") }] },
		{ kind: "closing", title: "Thank you", subtitle: "name@organisation.org" },
	] },
	{ id: "grant", name: "Grant proposal", blurb: "Need, plan, budget, results.", group: "Funding", theme: "forest", slides: [
		{ kind: "title", title: "Proposal title", subtitle: "Submitted to the funder, date" },
		{ kind: "bullets", title: "The need", bullets: b("The situation, with a source", "Who is affected", "Why now") },
		{ kind: "bullets", title: "Goals and outcomes", bullets: b("Goal", "Outcome 1", "Outcome 2") },
		{ kind: "steps", title: "Plan and timeline", steps: [{ heading: "Months 1 to 3", text: "Set up" }, { heading: "Months 4 to 9", text: "Deliver" }, { heading: "Months 10 to 12", text: "Review and report" }] },
		{ kind: "stats", title: "Budget at a glance", stats: [{ n: "KES 0", label: "Total request" }, { n: "0%", label: "Direct to programmes" }, { n: "0", label: "Months" }] },
		{ kind: "two", title: "Results and risks", columns: [{ heading: "How we will measure", bullets: b("Indicator", "Indicator") }, { heading: "Risks and how we handle them", bullets: b("Risk and response", "Risk and response") }] },
		{ kind: "closing", title: "Thank you", subtitle: "Contact for questions" },
	] },
	{ id: "update", name: "Project update", blurb: "Progress, numbers, next steps.", group: "Work", theme: "sauti", slides: [
		{ kind: "title", title: "Project update", subtitle: "Reporting period" },
		{ kind: "stats", title: "Progress", stats: [{ n: "0%", label: "Of plan done" }, { n: "0", label: "Activities completed" }, { n: "0", label: "People reached" }] },
		{ kind: "two", title: "Going well, and watch", columns: [{ heading: "Going well", bullets: b("Win", "Win") }, { heading: "Needs attention", bullets: b("Issue and owner", "Issue and owner") }] },
		{ kind: "steps", title: "Next steps", steps: [{ heading: "This week", text: "Action" }, { heading: "This month", text: "Action" }, { heading: "This quarter", text: "Action" }] },
		{ kind: "closing", title: "Questions?", subtitle: "" },
	] },
	{ id: "impact", name: "Impact report", blurb: "Numbers, a story and thanks.", group: "Communication", theme: "sunrise", slides: [
		{ kind: "title", title: "Impact report", subtitle: "Year or programme name" },
		{ kind: "stats", title: "The year in numbers", stats: [{ n: "0", label: "People supported" }, { n: "0", label: "Sessions held" }, { n: "0", label: "Partners" }, { n: "0%", label: "Satisfaction" }] },
		{ kind: "photo", title: "A moment from the field" },
		{ kind: "quote", quote: "A short, real quote shared with permission.", by: "Name or role" },
		{ kind: "bullets", title: "What we learned", bullets: b("Lesson", "Lesson", "Lesson") },
		{ kind: "closing", title: "Thank you to everyone who made this possible", subtitle: "" },
	] },
	{ id: "workshop", name: "Workshop or training", blurb: "Aims, agenda, activities, takeaways.", group: "Learning", theme: "royal", slides: [
		{ kind: "title", title: "Workshop title", subtitle: "Date, place, facilitator" },
		{ kind: "bullets", title: "By the end you will", bullets: b("Know", "Be able to", "Have") },
		{ kind: "steps", title: "Agenda", steps: [{ heading: "Welcome", text: "10 min" }, { heading: "Learn", text: "30 min" }, { heading: "Practise", text: "40 min" }, { heading: "Plan", text: "20 min" }] },
		{ kind: "section", title: "Part one", subtitle: "The idea" },
		{ kind: "two", title: "Do and do not", columns: [{ heading: "Do", bullets: b("Practice", "Practice") }, { heading: "Do not", bullets: b("Pitfall", "Pitfall") }] },
		{ kind: "bullets", title: "Activity", bullets: b("Instructions", "Time", "What to share back") },
		{ kind: "bullets", title: "Takeaways", bullets: b("Remember this", "Try this", "Ask us") },
		{ kind: "closing", title: "Thank you", subtitle: "Resources and contacts" },
	] },
	{ id: "meeting", name: "Meeting", blurb: "Agenda, decisions, actions.", group: "Work", theme: "paper", slides: [
		{ kind: "title", title: "Meeting title", subtitle: "Date and attendees" },
		{ kind: "bullets", title: "Agenda", bullets: b("Item and time", "Item and time", "Item and time") },
		{ kind: "two", title: "Decisions and actions", columns: [{ heading: "Decided", bullets: b("Decision", "Decision") }, { heading: "Actions", bullets: b("Who, what, by when", "Who, what, by when") }] },
		{ kind: "closing", title: "Next meeting", subtitle: "Date and time" },
	] },
	{ id: "campaign", name: "Campaign plan", blurb: "Audience, message, channels, calendar.", group: "Communication", theme: "coral", slides: [
		{ kind: "title", title: "Campaign name", subtitle: "Dates and goal" },
		{ kind: "bullets", title: "Audience and message", bullets: b("Who we want to reach", "What they should think, feel and do", "The one line to remember") },
		{ kind: "stats", title: "Channels", stats: [{ n: "IG", label: "Photos and short video" }, { n: "X", label: "Updates and replies" }, { n: "in", label: "Partners and funders" }] },
		{ kind: "steps", title: "Calendar", steps: [{ heading: "Week 1", text: "Launch" }, { heading: "Week 2", text: "Stories" }, { heading: "Week 3", text: "Call to action" }, { heading: "Week 4", text: "Thank and report" }] },
		{ kind: "closing", title: "Let us begin", subtitle: "" },
	] },
	{ id: "event", name: "Event proposal", blurb: "Purpose, programme, budget.", group: "Work", theme: "midnight", slides: [
		{ kind: "title", title: "Event name", subtitle: "Date, venue" },
		{ kind: "imageRight", title: "Why this event", bullets: b("Purpose", "Who will come", "What changes afterwards") },
		{ kind: "steps", title: "Programme", steps: [{ heading: "Arrival", text: "Time" }, { heading: "Sessions", text: "Time" }, { heading: "Break", text: "Time" }, { heading: "Close", text: "Time" }] },
		{ kind: "stats", title: "Budget", stats: [{ n: "KES 0", label: "Total" }, { n: "0", label: "Guests" }, { n: "KES 0", label: "Per guest" }] },
		{ kind: "closing", title: "See you there", subtitle: "" },
	] },
];

export const templateDeck = (t: Template, themeId?: string): Deck => buildDeck(t.name === "Blank" ? "Untitled presentation" : t.name, THEMES.find((x) => x.id === (themeId ?? t.theme)) ?? THEMES[0], t.slides);

/** Reading a saved file back, tolerating anything missing. */
export function parseDeck(raw: string): Deck | null {
	try {
		const j = JSON.parse(raw) as Partial<Deck>;
		if (!j || !Array.isArray(j.slides)) return null;
		return { v: 1, title: String(j.title ?? "Untitled presentation"), theme: { ...THEMES[0], ...(j.theme ?? {}) }, slides: j.slides.map((s) => ({ id: s.id || uid(), bg: s.bg, notes: s.notes ?? "", els: (s.els ?? []).map((e) => ({ ...e, id: e.id || uid() })) })) };
	} catch { return null; }
}
