import { paletteFromImage } from "@/lib/client/palette";

/** The five colours a generated presentation is drawn with, as hex without the #. */
export interface DeckLook { bg: string; title: string; text: string; accent: string; band: string }

const hexToRgb = (h: string): [number, number, number] => {
	const v = h.replace(/^#/, "");
	return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const toHex = (r: number, g: number, b: number) => [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("").toUpperCase();
const mix = (a: string, b: string, t: number) => {
	const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b);
	return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
};
const luminance = (h: string) => {
	const [r, g, b] = hexToRgb(h).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const saturation = (h: string) => { const [r, g, b] = hexToRgb(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
export const contrast = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/** The colour that carries a deck: the most colourful one that is still readable on white and on a dark ground. */
export function pickAccent(colours: string[]): string {
	const clean = colours.map((c) => c.replace(/^#/, "").toUpperCase()).filter((c) => /^[0-9A-F]{6}$/.test(c));
	if (!clean.length) return "068297";
	const scored = clean.map((c, i) => ({ c, s: saturation(c) * 2 + (1 - i / clean.length) - (luminance(c) > 0.7 || luminance(c) < 0.03 ? 1 : 0) }));
	return scored.sort((a, b) => b.s - a.s)[0].c;
}

/** A full look from one accent colour: light (white page, coloured band) or dark (night page). */
export function lookFromAccent(accentHex: string, dark = false): DeckLook {
	let accent = accentHex.replace(/^#/, "").toUpperCase();
	if (!dark) {
		// The accent is used for text-sized things (page numbers, the brand line), so it must read on white.
		for (let i = 0; i < 6 && contrast(accent, "FFFFFF") < 3; i++) accent = mix(accent, "000000", 0.15);
		return { bg: "FFFFFF", title: mix(accent, "000000", 0.65), text: "374151", accent, band: mix(accent, "FFFFFF", 0.9) };
	}
	const bg = mix(accent, "000000", 0.92);
	for (let i = 0; i < 6 && contrast(accent, bg) < 4; i++) accent = mix(accent, "FFFFFF", 0.15);
	return { bg, title: "FFFFFF", text: "D1D5DB", accent, band: mix(accent, bg, 0.82) };
}

/** Colours from several pictures (logos, photos), merged: the most common distinct colours across all of them. */
export async function coloursFromPictures(sources: (string | Blob)[]): Promise<string[]> {
	const each = await Promise.all(sources.map((s) => paletteFromImage(s, 6).catch(() => [] as string[])));
	const out: string[] = [];
	const far = (c: string) => out.every((o) => { const a = hexToRgb(o), b = hexToRgb(c); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 48; });
	// Round-robin, so a logo's few colours are not drowned by a busy photo.
	for (let i = 0; i < 6; i++) for (const list of each) { const c = list[i]; if (c && far(c)) out.push(c); }
	return out.slice(0, 8);
}

/** A picture, shrunk to a size that keeps the deck small, as a JPEG (or PNG when it has transparency). */
export async function shrinkPicture(file: File, maxSide = 1400): Promise<{ dataUrl: string; width: number; height: number }> {
	const url = URL.createObjectURL(file);
	try {
		const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file is not a picture.")); i.src = url; });
		const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
		const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
		const c = document.createElement("canvas");
		c.width = w; c.height = h;
		c.getContext("2d")!.drawImage(img, 0, 0, w, h);
		const png = file.type === "image/png" || file.type === "image/svg+xml" || file.type === "image/webp";
		return { dataUrl: c.toDataURL(png ? "image/png" : "image/jpeg", 0.85), width: w, height: h };
	} finally {
		URL.revokeObjectURL(url);
	}
}
