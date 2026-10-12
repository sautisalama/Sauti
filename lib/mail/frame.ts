/**
 * Helpers for the frame a message is shown in.
 *
 * Height: a frame is sized to its content. Some emails say "min-height: 100vh", and inside a frame 100vh is the
 * frame's own height, so every measure made it taller and the message scrolled forever with nothing to read.
 * The frame is shrunk to 1px while it is measured, so only real content counts, and the frame never scrolls itself.
 *
 * Links: blue and underlined, and a long web address is clipped with an ellipsis (the full address is the tooltip).
 */

export const LINK_BLUE = "#1a56db";

/** Appended to a message's own CSS. */
export const FRAME_CSS = `html{height:auto!important;min-height:0!important;overflow-y:hidden!important;overflow-x:auto}
body{height:auto!important;min-height:0!important;overflow-wrap:anywhere}
a{color:${LINK_BLUE};text-decoration:underline;text-underline-offset:2px}
a.ss-clip{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}`;

const transparent = (c: string) => c === "transparent" || /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c);

/** Blue links, unless the link is a coloured button; long plain-text links are clipped. */
export function polishLinks(d: Document) {
	const win = d.defaultView;
	if (!win) return;
	for (const a of Array.from(d.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
		if (a.dataset.ssDone) continue;
		a.dataset.ssDone = "1";
		const hasMedia = !!a.querySelector("img, table, svg");
		const cs = win.getComputedStyle(a);
		let coloured = !transparent(cs.backgroundColor) || cs.backgroundImage !== "none";
		// A button is often a coloured table cell that holds nothing but the link.
		const mine = (a.textContent ?? "").trim();
		for (let p: HTMLElement | null = a.parentElement, i = 0; p && i < 3 && !coloured; p = p.parentElement, i++) {
			if (p.tagName === "BODY" || (p.textContent ?? "").trim() !== mine) break;
			if (!transparent(win.getComputedStyle(p).backgroundColor)) coloured = true;
		}
		if (!hasMedia && !coloured) a.style.setProperty("color", LINK_BLUE, "important");
		const text = (a.textContent ?? "").trim();
		if (!hasMedia && text.length > 48 && !/\s/.test(text.slice(0, 40))) {
			a.classList.add("ss-clip");
			if (!a.title) a.title = a.href;
		}
	}
}

/**
 * Size the frame to its content and keep it right as images load or the layout shifts.
 * Returns a cleanup. `set` receives the height in pixels.
 */
export function fitFrame(frame: HTMLIFrameElement, set: (h: number) => void, opts: { min?: number; max?: number } = {}): () => void {
	const d = frame.contentDocument;
	if (!d?.documentElement) return () => undefined;
	const min = opts.min ?? 40;
	const max = opts.max ?? 30000;
	let last = -1;
	let raf = 0;
	const run = () => {
		raf = 0;
		polishLinks(d);
		const prev = frame.style.height;
		frame.style.height = "1px";
		const h = Math.max(d.body?.scrollHeight ?? 0, d.documentElement.scrollHeight);
		frame.style.height = prev;
		const next = Math.min(max, Math.max(min, Math.ceil(h) + 2));
		if (Math.abs(next - last) > 1) { last = next; set(next); }
	};
	const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
	run();
	const ro = typeof ResizeObserver !== "undefined" && d.body ? new ResizeObserver(schedule) : null;
	ro?.observe(d.body);
	d.addEventListener("load", schedule, true);
	d.addEventListener("toggle", schedule, true);
	return () => { ro?.disconnect(); d.removeEventListener("load", schedule, true); d.removeEventListener("toggle", schedule, true); if (raf) cancelAnimationFrame(raf); };
}
