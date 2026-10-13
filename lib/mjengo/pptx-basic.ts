import JSZip from "jszip";
import * as CFB from "cfb";

/** A simplified reading of a presentation: its text, notes and pictures, slide by slide, with no layout. */
export interface BasicSlide { title: string; lines: string[]; notes: string; images: string[] }

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const paragraphs = (xml: string): string[] =>
	(xml.match(/<a:p[ >][\s\S]*?<\/a:p>/g) ?? [])
		.map((p) => decode((p.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("")).trim())
		.filter(Boolean);

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };

/** Reads the text and pictures of a .pptx directly from the package. Works on files the full viewer cannot draw. */
export async function readPptxBasic(buf: ArrayBuffer): Promise<BasicSlide[]> {
	const zip = await JSZip.loadAsync(buf);
	const nums = Object.keys(zip.files).map((f) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(f)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
	const out: BasicSlide[] = [];
	for (const n of nums) {
		const xml = await zip.file(`ppt/slides/slide${n}.xml`)!.async("string");
		const lines = paragraphs(xml);
		const rels = (await zip.file(`ppt/slides/_rels/slide${n}.xml.rels`)?.async("string")) ?? "";
		const images: string[] = [];
		for (const m of rels.matchAll(/<Relationship [^>]*Target="([^"]+)"[^>]*\/>/g)) {
			const target = m[1];
			if (!/\/media\//.test(target)) continue;
			const path = target.startsWith("/") ? target.slice(1) : `ppt/${target.replace(/^\.\.\//, "")}`;
			const ext = path.split(".").pop()?.toLowerCase() ?? "";
			const f = zip.file(path);
			if (f && MIME[ext]) images.push(`data:${MIME[ext]};base64,${await f.async("base64")}`);
			if (images.length >= 4) break;
		}
		let notes = "";
		const noteRel = /Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/.exec(rels)?.[1];
		if (noteRel) notes = paragraphs((await zip.file(`ppt/notesSlides/${noteRel}`)?.async("string")) ?? "").filter((t) => !/^\d+$/.test(t)).join("\n");
		out.push({ title: lines[0] ?? `Slide ${n}`, lines: lines.slice(1), notes, images });
	}
	return out;
}

/**
 * The text of an older binary .ppt (PowerPoint 97 to 2003), slide by slide. The file is an OLE container with a
 * "PowerPoint Document" stream of records; the text of each slide sits in the slide list, after its slide marker.
 */
export function readPptText(buf: ArrayBuffer): BasicSlide[] {
	const cfb = CFB.read(new Uint8Array(buf), { type: "array" });
	const entry = CFB.find(cfb, "/PowerPoint Document");
	if (!entry?.content) throw new Error("This is not a PowerPoint file.");
	const data = new Uint8Array(entry.content as ArrayLike<number>);
	const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const slides: string[][] = [];
	let current: string[] | null = null;

	const walk = (start: number, end: number, inSlideList: boolean) => {
		let p = start;
		while (p + 8 <= end) {
			const verInst = dv.getUint16(p, true);
			const type = dv.getUint16(p + 2, true);
			const len = dv.getUint32(p + 4, true);
			const body = p + 8;
			if (len > end - body) break;
			const ver = verInst & 0xf;
			const inst = verInst >> 4;
			if (ver === 0xf) {
				// 4080 is the slide list; instance 0 holds the slides (1 is masters, 2 is notes).
				walk(body, body + len, type === 4080 && inst === 0);
			} else if (inSlideList) {
				if (type === 1011) { current = []; slides.push(current); }
				else if ((type === 4000 || type === 4008) && current) {
					const raw = data.subarray(body, body + len);
					const text = type === 4000 ? new TextDecoder("utf-16le").decode(raw) : new TextDecoder("windows-1252").decode(raw);
					for (const line of text.split(/[\r\n\u000b]+/)) if (line.trim()) current.push(line.trim());
				}
			}
			p = body + len;
		}
	};
	walk(0, data.length, false);
	return slides.map((lines, i) => ({ title: lines[0] ?? `Slide ${i + 1}`, lines: lines.slice(1), notes: "", images: [] }));
}

/**
 * Whether the full viewer can be trusted with this file. A package with a part that is not well-formed XML, or
 * with no master or theme, can make the viewer loop and freeze the page, so such a file goes to the simple view.
 */
export async function pptxProblem(buf: ArrayBuffer): Promise<string | null> {
	try {
		const zip = await JSZip.loadAsync(buf);
		const names = Object.keys(zip.files);
		for (const required of ["ppt/presentation.xml"]) if (!zip.file(required)) return `missing ${required}`;
		if (!names.some((n) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(n))) return "no slide master";
		if (!names.some((n) => /^ppt\/theme\/theme\d+\.xml$/.test(n))) return "no theme";
		const parts = names.filter((n) => /^ppt\/(slides|slideMasters|slideLayouts|theme)\/[^/]+\.xml$/.test(n) || n === "ppt/presentation.xml");
		for (const n of parts) {
			const xml = await zip.file(n)!.async("string");
			const doc = new DOMParser().parseFromString(xml, "application/xml");
			if (doc.getElementsByTagName("parsererror").length) return `${n} is damaged`;
		}
		return null;
	} catch {
		return "the file is not a presentation package";
	}
}
