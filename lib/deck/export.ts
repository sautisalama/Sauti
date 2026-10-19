import { H, W, resolve, type Deck } from "./model";

/**
 * The presentation as a PowerPoint file, which Canva, PowerPoint, Keynote and Google Slides all open. The page is
 * 960 x 540 and the file's page 13.33 x 7.5 inches, so a pixel is a point and positions carry straight across.
 */
export async function deckToPptx(deck: Deck, urls: Record<string, string> = {}): Promise<Blob> {
	const PptxGenJS = (await import("pptxgenjs")).default;
	const pptx = new PptxGenJS();
	pptx.layout = "LAYOUT_WIDE";
	pptx.title = deck.title;
	const k = 13.333 / W;
	const hex = (c: string | undefined, fb?: string) => resolve(deck.theme, c, fb).replace("#", "").toUpperCase();
	const t = deck.theme;
	for (const s of deck.slides) {
		const slide = pptx.addSlide();
		slide.background = { color: hex(s.bg, "@bg") };
		for (const e of s.els) {
			const pos = { x: e.x * k, y: e.y * k, w: e.w * k, h: e.h * k };
			if (e.type === "text") {
				slide.addText(e.text ?? "", {
					...pos,
					fontFace: e.font === "heading" ? t.heading : t.body,
					fontSize: e.size ?? 24,
					bold: !!e.bold,
					italic: !!e.italic,
					align: e.align ?? "left",
					valign: e.valign ?? "top",
					color: hex(e.color),
					margin: 0,
					fit: "shrink",
					transparency: e.opacity != null ? Math.round((1 - e.opacity) * 100) : 0,
				});
			} else if (e.type === "image") {
				const src = e.src?.startsWith("asset:") ? urls[e.src.slice(6)] : e.src;
				if (!src) continue;
				try { slide.addImage({ path: src, ...pos, sizing: { type: e.fit === "contain" ? "contain" : "cover", w: pos.w, h: pos.h }, altText: e.alt }); } catch { /* a picture that cannot be fetched is left out */ }
			} else {
				slide.addShape(e.shape === "ellipse" ? pptx.ShapeType.ellipse : e.shape === "round" ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
					...pos,
					fill: { color: hex(e.fill, "@surface"), transparency: e.opacity != null ? Math.round((1 - e.opacity) * 100) : 0 },
					line: { color: hex(e.fill, "@surface"), width: 0 },
					...(e.shape === "round" ? { rectRadius: 0.2 } : {}),
				});
			}
		}
		if (s.notes) slide.addNotes(s.notes);
	}
	void H;
	return (await pptx.write({ outputType: "blob" })) as Blob;
}
