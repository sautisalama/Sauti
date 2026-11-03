"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Download, GalleryVertical, Loader2, Maximize2, X } from "lucide-react";

type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;
type Mode = "scroll" | "pages";

/** Renders one page crisply at `width` (capped to `maxHeight`), with selectable text and live links. */
function PdfPage({ doc, index, width, maxHeight, eager, onVisible }: { doc: PdfDoc; index: number; width: number; maxHeight?: number; eager?: boolean; onVisible?: (i: number) => void }) {
	const holder = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const textRef = useRef<HTMLDivElement>(null);
	const [ratio, setRatio] = useState(1.414);
	const [visible, setVisible] = useState(eager || index < 2);
	const w = Math.max(0, maxHeight ? Math.min(width, Math.floor(maxHeight / ratio)) : width);

	useEffect(() => {
		const el = holder.current;
		if (!el || (visible && !onVisible)) return;
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) setVisible(true);
					if (e.intersectionRatio >= 0.5) onVisible?.(index);
				}
			},
			{ rootMargin: "1200px 0px", threshold: [0, 0.5] }
		);
		io.observe(el);
		return () => io.disconnect();
	}, [visible, onVisible, index]);

	useEffect(() => {
		if (!visible || !w) return;
		let cancelled = false;
		let task: { cancel: () => void } | null = null;
		(async () => {
			const page = await doc.getPage(index + 1);
			const base = page.getViewport({ scale: 1 });
			if (cancelled) return;
			setRatio(base.height / base.width);
			const scale = w / base.width;
			const viewport = page.getViewport({ scale });
			const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
			const canvas = canvasRef.current;
			if (!canvas) return;
			canvas.width = Math.floor(viewport.width * dpr);
			canvas.height = Math.floor(viewport.height * dpr);
			canvas.style.width = `${viewport.width}px`;
			canvas.style.height = `${viewport.height}px`;
			const r = page.render({ canvas, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
			task = r;
			await r.promise;
			if (cancelled || !textRef.current) return;
			textRef.current.replaceChildren();
			textRef.current.style.setProperty("--total-scale-factor", String(scale));
			const { TextLayer } = await import("pdfjs-dist");
			await new TextLayer({ textContentSource: page.streamTextContent(), container: textRef.current, viewport }).render();
		})().catch(() => undefined);
		return () => {
			cancelled = true;
			task?.cancel();
		};
	}, [doc, index, w, visible]);

	return (
		<div
			id={`pdf-page-${index}`}
			ref={holder}
			className="relative mx-auto overflow-hidden bg-white shadow-[0_1px_3px_rgba(26,54,93,0.12),0_8px_28px_rgba(26,54,93,0.08)] ring-1 ring-black/5 sm:rounded-lg"
			style={{ width: w || "100%", height: w ? Math.round(w * ratio) : undefined, aspectRatio: w ? undefined : `1 / ${ratio}` }}
		>
			<canvas ref={canvasRef} className="block" aria-label={`Page ${index + 1}`} role="img" />
			<div ref={textRef} className="pdf-text-layer" />
		</div>
	);
}

/** A small lazily-drawn page preview for the full-page side rail. */
function Thumb({ doc, index, active, onPick }: { doc: PdfDoc; index: number; active: boolean; onPick: (i: number) => void }) {
	const ref = useRef<HTMLButtonElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [seen, setSeen] = useState(index < 6);
	useEffect(() => {
		const el = ref.current;
		if (!el || seen) return;
		const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setSeen(true), { rootMargin: "400px 0px" });
		io.observe(el);
		return () => io.disconnect();
	}, [seen]);
	useEffect(() => {
		if (!seen) return;
		let cancelled = false;
		(async () => {
			const page = await doc.getPage(index + 1);
			const base = page.getViewport({ scale: 1 });
			const viewport = page.getViewport({ scale: 110 / base.width });
			const canvas = canvasRef.current;
			if (!canvas || cancelled) return;
			canvas.width = viewport.width;
			canvas.height = viewport.height;
			await page.render({ canvas, viewport }).promise;
		})().catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [doc, index, seen]);
	useEffect(() => {
		if (active) ref.current?.scrollIntoView({ block: "nearest" });
	}, [active]);
	return (
		<button ref={ref} type="button" onClick={() => onPick(index)} aria-label={`Go to page ${index + 1}`} aria-current={active} className={`block w-full rounded-md p-1 text-center transition ${active ? "bg-white/20 ring-2 ring-[#2cb5b5]" : "hover:bg-white/10"}`}>
			<canvas ref={canvasRef} className="mx-auto block w-full rounded-sm bg-white" style={{ aspectRatio: "1 / 1.414" }} />
			<span className="mt-1 block text-[10px] font-bold text-white/70">{index + 1}</span>
		</button>
	);
}

/**
 * The PDF shown as the post itself. Click it to read full page, like an e-book: scroll the pages,
 * or flip them one at a time (swipe, arrow keys, edge buttons). An Exit button always leaves.
 */
export function PdfReader({ url, title, coverUrl, coverAlt }: { url: string; title: string; coverUrl?: string | null; coverAlt?: string | null }) {
	const root = useRef<HTMLElement>(null);
	const measure = useRef<HTMLDivElement>(null);
	const [doc, setDoc] = useState<PdfDoc | null>(null);
	const [width, setWidth] = useState(0);
	const [vh, setVh] = useState(800);
	const [failed, setFailed] = useState(false);
	const [full, setFull] = useState(false);
	const [mode, setMode] = useState<Mode>("pages");
	const [current, setCurrent] = useState(0);
	const [pct, setPct] = useState(0);
	const [resume, setResume] = useState<number | null>(null);
	const remembered = useRef(false);
	const touch = useRef<{ x: number; y: number; t: number } | null>(null);
	const total = doc?.numPages ?? 0;

	useEffect(() => {
		const el = measure.current;
		if (!el) return;
		setWidth(Math.floor(el.clientWidth));
		const ro = new ResizeObserver(() => {
			const w = Math.floor(el.clientWidth);
			setWidth((p) => (Math.abs(p - w) > 24 ? w : p));
		});
		ro.observe(el);
		const onResize = () => setVh(window.innerHeight);
		onResize();
		window.addEventListener("resize", onResize);
		return () => {
			ro.disconnect();
			window.removeEventListener("resize", onResize);
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		let task: { destroy: () => Promise<void> } | null = null;
		(async () => {
			const pdfjs = await import("pdfjs-dist");
			pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
			const t = pdfjs.getDocument({ url });
			t.onProgress = ({ loaded, total }: { loaded: number; total: number }) => total && !cancelled && setPct(Math.min(99, Math.round((loaded / total) * 100)));
			task = t;
			const d = await t.promise;
			if (cancelled) return;
			setDoc(d);
			// Offer to pick up where this reader left off.
			try {
				const saved = Number(localStorage.getItem(`pdf-page:${url}`));
				if (saved > 0 && saved < d.numPages) setResume(saved);
			} catch {}
			remembered.current = true;
		})().catch(() => !cancelled && setFailed(true));
		return () => {
			cancelled = true;
			void task?.destroy();
		};
	}, [url]);

	useEffect(() => {
		if (!remembered.current || !total) return;
		try {
			localStorage.setItem(`pdf-page:${url}`, String(current));
		} catch {}
	}, [current, total, url]);

	const go = useCallback(
		(to: number) => {
			if (!total) return;
			const next = Math.min(Math.max(to, 0), total - 1);
			setCurrent(next);
			if (mode === "scroll") document.getElementById(`pdf-page-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
		},
		[mode, total]
	);

	const setReadingMode = (m: Mode) => {
		setMode(m);
		if (m === "scroll") requestAnimationFrame(() => document.getElementById(`pdf-page-${current}`)?.scrollIntoView({ block: "start" }));
	};

	const enter = () => {
		setFull(true);
		root.current?.requestFullscreen?.().catch(() => undefined);
	};
	const exit = useCallback(() => {
		setFull(false);
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
	}, []);

	// Clicking the document opens it full page, unless the click was a link or the end of a text selection.
	const openFromClick = (e: React.MouseEvent) => {
		if (full || !doc) return;
		if ((e.target as HTMLElement).closest("a, button")) return;
		if (window.getSelection()?.toString()) return;
		enter();
	};

	// Full page: lock the page behind, follow the browser's own Esc, and take the keyboard.
	useEffect(() => {
		if (!full) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		root.current?.focus();
		const onFs = () => !document.fullscreenElement && setFull(false);
		document.addEventListener("fullscreenchange", onFs);
		return () => {
			document.body.style.overflow = prev;
			document.removeEventListener("fullscreenchange", onFs);
		};
	}, [full]);

	// Pages mode: the wheel turns pages. One flip per gesture (trackpad inertia is ignored), and at the
	// first or last page the wheel is handed back to the article so the reader never traps the scroll.
	const stage = useRef<HTMLDivElement>(null);
	const wheelState = useRef({ last: 0, locked: false });
	const live = useRef({ current: 0, total: 0, go: (_: number) => {} });
	live.current = { current, total, go };
	useEffect(() => {
		const el = stage.current;
		if (!el || mode !== "pages") return;
		const onWheel = (e: WheelEvent) => {
			if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
			const { current: c, total: t, go: flip } = live.current;
			const dir = e.deltaY > 0 ? 1 : -1;
			if ((dir > 0 && c >= t - 1) || (dir < 0 && c <= 0)) return;
			e.preventDefault();
			const now = performance.now();
			const w = wheelState.current;
			if (w.locked && now - w.last < 140) {
				w.last = now;
				return;
			}
			w.locked = false;
			if (Math.abs(e.deltaY) < 8) return;
			w.locked = true;
			w.last = now;
			flip(c + dir);
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [mode, doc]);

	// Scrolling the article settles on the reader once it comes near, instead of passing through it.
	useEffect(() => {
		if (full || mode !== "pages") return;
		const html = document.documentElement;
		const prev = html.style.scrollSnapType;
		html.style.scrollSnapType = "y proximity";
		return () => {
			html.style.scrollSnapType = prev;
		};
	}, [full, mode]);

	// Hide the site header while the pages fill the screen, so the document gets the room. This watches the
	// page area itself (the whole reader can be taller than the screen, which would never look "mostly visible").
	useEffect(() => {
		const el = stage.current;
		if (!el || full || mode !== "pages") return;
		const html = document.documentElement;
		const io = new IntersectionObserver(
			([e]) => {
				if (e.intersectionRatio >= 0.55) html.setAttribute("data-reading", "");
				else if (e.intersectionRatio < 0.3) html.removeAttribute("data-reading");
			},
			{ threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
		);
		io.observe(el);
		return () => {
			io.disconnect();
			html.removeAttribute("data-reading");
		};
	}, [full, mode, doc]);

	const onKey = (e: React.KeyboardEvent) => {
		if (e.key === "Escape" && full) return exit();
		if (mode !== "pages") return;
		if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
			e.preventDefault();
			go(current + 1);
		} else if (e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
			e.preventDefault();
			go(current - 1);
		} else if (e.key === "Home") go(0);
		else if (e.key === "End") go(total - 1);
	};

	const onTouchStart = (e: React.TouchEvent) => {
		if (mode !== "pages" || e.touches.length !== 1) {
			touch.current = null;
			return;
		}
		touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
	};
	const onTouchEnd = (e: React.TouchEvent) => {
		const s = touch.current;
		touch.current = null;
		if (!s || mode !== "pages") return;
		const dx = e.changedTouches[0].clientX - s.x;
		const dy = e.changedTouches[0].clientY - s.y;
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - s.t < 900) go(current + (dx < 0 ? 1 : -1));
	};

	// Pages are 20% larger than a plain fit so the text is comfortable to read, not just to see.
	const fitHeight = mode === "pages" ? (full ? Math.min(Math.round((vh - 120) * 1.2), vh - 64) : Math.round(vh * 0.96)) : undefined;
	const btn = full ? "text-white/90 hover:bg-white/10" : "text-[#1a365d] hover:bg-[#1a365d]/5";

	return (
		<section
			ref={root}
			tabIndex={-1}
			onKeyDown={onKey}
			aria-label={title ? `${title} (document)` : "Document"}
			className={full ? "fixed inset-0 z-[100] flex flex-col bg-[#0f1d33] outline-none" : "-mx-4 outline-none sm:mx-0"}
			style={full ? undefined : { scrollSnapAlign: "center", scrollMarginTop: "1rem" }}
		>
			<style>{`
				.pdf-text-layer{position:absolute;inset:0;overflow:hidden;line-height:1;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0}
				.pdf-text-layer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%}
				.pdf-text-layer ::selection{background:rgba(0,128,128,.3)}
				@keyframes pdfflip{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
				.pdf-flip{animation:pdfflip .22s ease}
				@media (prefers-reduced-motion:reduce){.pdf-flip{animation:none}}
			`}</style>

			{coverUrl && !full && (
				<button type="button" onClick={enter} className="group relative mx-4 mb-6 block w-[calc(100%-2rem)] overflow-hidden rounded-2xl text-left sm:mx-0 sm:mb-8 sm:w-full" aria-label="Read the document full page">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={coverUrl} alt={coverAlt ?? ""} className="aspect-video w-full object-cover shadow-xl transition-transform duration-500 group-hover:scale-[1.02]" />
					<span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-[#0f1d33]/80 to-transparent px-4 pb-4 pt-12 text-sm font-bold text-white">
						<Maximize2 className="h-4 w-4" aria-hidden /> Read the document
					</span>
				</button>
			)}

			<div className={`flex items-center justify-between gap-2 px-4 py-2 ${full ? "text-white sm:px-6" : "mb-3 text-[#1a365d] sm:px-0"}`}>
				<div className="flex items-center gap-1" role="group" aria-label="Reading mode">
					{(["pages", "scroll"] as const).map((m) => (
						<button key={m} type="button" onClick={() => setReadingMode(m)} aria-pressed={mode === m} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${mode === m ? (full ? "bg-white/15" : "bg-[#008080] text-white") : btn}`}>
							{m === "scroll" ? <GalleryVertical className="h-4 w-4" aria-hidden /> : <BookOpen className="h-4 w-4" aria-hidden />}
							<span className="hidden sm:inline">{m === "scroll" ? "Scroll" : "Pages"}</span>
						</button>
					))}
				</div>
				<p className="text-xs font-bold tabular-nums" aria-live="polite">{total ? `Page ${current + 1} of ${total}` : ""}</p>
				<div className="flex items-center gap-1">
					<a href={url} download target="_blank" rel="noopener noreferrer" className={`inline-flex rounded-lg p-2 ${btn}`} aria-label="Download the PDF" title="Download the PDF">
						<Download className="h-4 w-4" aria-hidden />
					</a>
					{full ? (
						<button type="button" onClick={exit} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25" aria-label="Exit full page">
							<X className="h-4 w-4" aria-hidden /> Exit
						</button>
					) : (
						<button type="button" onClick={enter} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${btn}`} aria-label="Read full page">
							<Maximize2 className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Full page</span>
						</button>
					)}
				</div>
			</div>

			{resume !== null && doc && (
				<div className={`mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold sm:mx-0 ${full ? "bg-white/10 text-white" : "bg-[#008080]/10 text-[#1a365d]"}`} role="status">
					<span>Continue from page {resume + 1}?</span>
					<span className="flex gap-2">
						<button type="button" onClick={() => (go(resume), setResume(null))} className="rounded-lg bg-[#008080] px-3 py-1 text-xs font-bold text-white">Continue</button>
						<button type="button" onClick={() => setResume(null)} className={`rounded-lg px-3 py-1 text-xs font-bold ${btn}`}>Start over</button>
					</span>
				</div>
			)}

			<div className={full ? "flex min-h-0 flex-1" : ""}>
			{full && doc && (
				<nav aria-label="Pages" className="hidden w-32 shrink-0 space-y-2 overflow-y-auto overscroll-contain px-2 pb-4 md:block">
					{Array.from({ length: doc.numPages }, (_, i) => <Thumb key={i} doc={doc} index={i} active={i === current} onPick={go} />)}
				</nav>
			)}
			<div
				className={full ? `relative min-h-0 flex-1 px-2 pb-4 sm:px-6 ${mode === "scroll" ? "overflow-y-auto overscroll-contain" : "flex items-center justify-center overflow-hidden"}` : "relative cursor-zoom-in"}
				ref={stage}
				onClick={openFromClick}
				onTouchStart={onTouchStart}
				onTouchEnd={onTouchEnd}
				style={{ touchAction: mode === "pages" ? "pan-y pinch-zoom" : undefined }}
				title={full ? undefined : "Click to read full page"}
			>
				<div ref={measure} className={`mx-auto ${full ? "w-full" : "w-[calc(100%-1.5rem)] sm:w-full"} ${full ? (mode === "pages" ? "max-w-[76.8rem]" : "max-w-5xl") : mode === "pages" ? "sm:relative sm:left-1/2 sm:w-[120%] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2" : ""}`}>
					{failed ? (
						<p className="rounded-xl border border-gray-200 bg-[#f8f9fb] p-6 text-gray-600">
							The document couldn’t be shown here. <a className="font-semibold text-sauti-teal underline" href={url} target="_blank" rel="noopener noreferrer">Open the PDF</a> to read it.
						</p>
					) : !doc ? (
						<div className={`flex items-center justify-center gap-2 py-24 text-sm font-semibold ${full ? "text-white/70" : "text-gray-500"}`} role="status">
							<div className="w-full max-w-xs text-center">
								<div className="mb-3 flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading document…</div>
								<div className="h-1.5 overflow-hidden rounded-full bg-gray-200/70" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
									<div className="h-full rounded-full bg-[#008080] transition-all" style={{ width: `${Math.max(pct, 6)}%` }} />
								</div>
							</div>
						</div>
					) : mode === "scroll" ? (
						<div className="space-y-4 sm:space-y-6">
							{Array.from({ length: doc.numPages }, (_, i) => (
								<PdfPage key={i} doc={doc} index={i} width={width} onVisible={setCurrent} />
							))}
						</div>
					) : (
						<div key={current} className="pdf-flip flex justify-center">
							<PdfPage doc={doc} index={current} width={width} maxHeight={fitHeight} eager />
						</div>
					)}
				</div>

				{doc && mode === "pages" && (
					<>
						<button type="button" onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous page" className="absolute inset-y-0 left-0 hidden w-14 items-center justify-center disabled:opacity-0 sm:flex">
							<span className={`rounded-full p-2 shadow ${full ? "bg-white/15 text-white" : "bg-white text-[#1a365d]"}`}><ChevronLeft className="h-5 w-5" aria-hidden /></span>
						</button>
						<button type="button" onClick={() => go(current + 1)} disabled={current >= total - 1} aria-label="Next page" className="absolute inset-y-0 right-0 hidden w-14 items-center justify-center disabled:opacity-0 sm:flex">
							<span className={`rounded-full p-2 shadow ${full ? "bg-white/15 text-white" : "bg-white text-[#1a365d]"}`}><ChevronRight className="h-5 w-5" aria-hidden /></span>
						</button>
					</>
				)}
			</div>

			</div>

			{doc && mode === "pages" && (
				<div className={`flex items-center justify-center gap-3 px-4 py-3 ${full ? "text-white" : "text-[#1a365d]"}`}>
					<button type="button" onClick={() => go(current - 1)} disabled={current === 0} className={`rounded-lg p-2 disabled:opacity-30 sm:hidden ${btn}`} aria-label="Previous page"><ChevronLeft className="h-5 w-5" aria-hidden /></button>
					<input type="range" min={1} max={total} value={current + 1} onChange={(e) => go(Number(e.target.value) - 1)} aria-label="Go to page" className="h-1 w-full max-w-md accent-[#008080]" />
					<button type="button" onClick={() => go(current + 1)} disabled={current >= total - 1} className={`rounded-lg p-2 disabled:opacity-30 sm:hidden ${btn}`} aria-label="Next page"><ChevronRight className="h-5 w-5" aria-hidden /></button>
				</div>
			)}
		</section>
	);
}
