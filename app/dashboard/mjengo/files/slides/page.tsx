"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, Play, Share2, X } from "lucide-react";
import { ShareDialog } from "../../_components/ShareDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MjengoLoader } from "../../_components/MjengoLoader";
import { getFileUrl } from "../../vault/api";

type Previewer = {
	renderNextSlide: () => void;
	renderPreSlide: () => void;
	renderSingleSlide: (i: number) => void;
	destroy: () => void;
	preview: (b: ArrayBuffer) => Promise<unknown>;
	slideCount: number;
	currentIndex: number;
};

/**
 * Reads a PowerPoint file and shows it in the app: a rail of slide numbers, the slide, and Present, which fills
 * the screen and moves on with the arrow keys, space or a tap on either half of the slide. The file is
 * downloaded once and redrawn from memory when the window changes size.
 */
function Viewer() {
	const { toast } = useToast();
	const fileId = useSearchParams().get("file");
	const [shareOpen, setShareOpen] = useState(false);
	const host = useRef<HTMLDivElement>(null);
	const stage = useRef<HTMLDivElement>(null);
	const previewer = useRef<Previewer | null>(null);
	const bytes = useRef<ArrayBuffer | null>(null);
	const [name, setName] = useState("Presentation.pptx");
	const [url, setUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [mode, setMode] = useState<"slide" | "list">("slide");
	const [width, setWidth] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [count, setCount] = useState(0);
	const [index, setIndex] = useState(0);
	const [presenting, setPresenting] = useState(false);
	const [chrome, setChrome] = useState(true);
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// The slide is as large as the space allows (16:9), measured on the stage and redrawn without downloading again.
	useEffect(() => {
		const el = stage.current;
		if (!el) return;
		let t: ReturnType<typeof setTimeout> | null = null;
		const measure = () => {
			const pad = presenting ? 0 : 32;
			const byWidth = el.clientWidth - pad;
			const byHeight = ((el.clientHeight - pad) * 16) / 9;
			const w = Math.floor(presenting ? Math.min(byWidth, byHeight) : Math.min(byWidth, 1280));
			setWidth((cur) => (Math.abs(cur - w) > 6 ? Math.max(320, w) : cur));
		};
		measure();
		const ro = new ResizeObserver(() => { if (t) clearTimeout(t); t = setTimeout(measure, 150); });
		ro.observe(el);
		return () => { ro.disconnect(); if (t) clearTimeout(t); };
	}, [presenting]);

	// Download once.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				if (!fileId) throw new Error("Open a presentation from Files.");
				const info = await getFileUrl(fileId);
				setName(info.name);
				setUrl(info.url);
				if (/\.ppt$/i.test(info.name)) throw new Error("This is an older PowerPoint file (.ppt). Download it and save it as .pptx to view it here.");
				const res = await fetch(info.url);
				if (!res.ok) throw new Error("Could not download the file.");
				const buf = await res.arrayBuffer();
				if (cancelled) return;
				bytes.current = buf;
				setError(null);
				setLoading(false);
				// Trigger the first draw.
				setWidth((w) => w || 960);
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Could not show this presentation.");
					setLoading(false);
					toast({ title: "Could not open the presentation", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
				}
			}
		})();
		return () => { cancelled = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileId]);

	// Draw from memory whenever the size or the layout changes.
	useEffect(() => {
		const buf = bytes.current;
		if (!buf || !host.current || !width || error) return;
		let cancelled = false;
		(async () => {
			try {
				const { init } = await import("pptx-preview");
				if (cancelled || !host.current) return;
				const keep = previewer.current?.currentIndex ?? 0;
				previewer.current?.destroy();
				host.current.innerHTML = "";
				const p = init(host.current, { width, height: Math.round((width * 9) / 16), mode }) as unknown as Previewer;
				previewer.current = p;
				await p.preview(buf);
				if (cancelled) return;
				setCount(p.slideCount);
				if (mode === "slide" && keep > 0 && keep < p.slideCount) p.renderSingleSlide(keep);
				setIndex(mode === "slide" ? Math.max(0, p.currentIndex) : 0);
			} catch (e) {
				if (!cancelled) setError(e instanceof Error ? e.message : "This presentation could not be drawn.");
			}
		})();
		return () => { cancelled = true; };
	}, [width, mode, loading, error]);
	useEffect(() => () => { previewer.current?.destroy(); previewer.current = null; }, []);

	const go = useCallback((to: number | "next" | "prev" | "first" | "last") => {
		const p = previewer.current;
		if (!p || mode !== "slide") return;
		const n = p.slideCount;
		const cur = p.currentIndex;
		const target = to === "next" ? Math.min(n - 1, cur + 1) : to === "prev" ? Math.max(0, cur - 1) : to === "first" ? 0 : to === "last" ? n - 1 : Math.max(0, Math.min(n - 1, to));
		if (target === cur) return;
		p.renderSingleSlide(target);
		setIndex(target);
	}, [mode]);

	// Present: the stage goes full screen; keys and taps move through the slides.
	const present = async () => {
		setMode("slide");
		try { await stage.current?.requestFullscreen?.(); } catch { /* the stage still fills the window below */ }
		setPresenting(true);
		stage.current?.focus();
	};
	const stop = () => { setPresenting(false); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
	useEffect(() => {
		const onFs = () => { if (!document.fullscreenElement) setPresenting(false); };
		document.addEventListener("fullscreenchange", onFs);
		return () => document.removeEventListener("fullscreenchange", onFs);
	}, []);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null;
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
			if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go("next"); }
			else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go("prev"); }
			else if (e.key === "Home") go("first");
			else if (e.key === "End") go("last");
			else if (e.key === "Escape" && presenting) stop();
			else if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey) void present();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [go, presenting]);

	// While presenting the bar fades after a moment without the pointer moving.
	const wake = () => {
		setChrome(true);
		if (hideTimer.current) clearTimeout(hideTimer.current);
		if (presenting) hideTimer.current = setTimeout(() => setChrome(false), 2200);
	};
	useEffect(() => { wake(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [presenting]);

	return (
		<div className={cn("flex h-full min-h-0 flex-col bg-[#f4f4f2]")}>
			<ShareDialog item={shareOpen && fileId ? ({ type: "file", id: fileId, name } as never) : null} onClose={() => setShareOpen(false)} />
			{!presenting && (
				<div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-black/[0.07] bg-white px-3 py-1.5">
					<Button asChild variant="ghost" size="icon" aria-label="Back to Files"><Link href="/dashboard/mjengo/vault"><ArrowLeft className="h-[18px] w-[18px]" /></Link></Button>
					<span className="min-w-0 flex-1 truncate px-1 text-[15px] font-medium text-[#37352f]">{name}</span>
					<div className="inline-flex rounded-lg border border-black/10 p-0.5">
						<button onClick={() => setMode("slide")} aria-pressed={mode === "slide"} className={mode === "slide" ? "rounded-md bg-sauti-teal px-2.5 py-1 text-xs font-semibold text-white" : "rounded-md px-2.5 py-1 text-xs text-[#787774]"}>Slide</button>
						<button onClick={() => setMode("list")} aria-pressed={mode === "list"} className={mode === "list" ? "rounded-md bg-sauti-teal px-2.5 py-1 text-xs font-semibold text-white" : "rounded-md px-2.5 py-1 text-xs text-[#787774]"}>All slides</button>
					</div>
					{mode === "slide" && count > 0 && (
						<>
							<Button variant="ghost" size="icon" aria-label="Previous slide" disabled={index <= 0} onClick={() => go("prev")}><ChevronLeft className="h-[18px] w-[18px]" /></Button>
							<span className="min-w-[3.5rem] text-center text-sm tabular-nums text-[#5f5e5b]">{index + 1} / {count}</span>
							<Button variant="ghost" size="icon" aria-label="Next slide" disabled={index >= count - 1} onClick={() => go("next")}><ChevronRight className="h-[18px] w-[18px]" /></Button>
						</>
					)}
					<Button size="sm" className="h-9 gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => void present()} disabled={loading || !!error || count === 0}><Play className="h-4 w-4" /> Present</Button>
					{fileId && <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5" onClick={() => setShareOpen(true)} aria-label="Share"><Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span></Button>}
					{url && <Button asChild variant="outline" size="sm" className="h-9 gap-1.5"><a href={url} download={name}><Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span></a></Button>}
				</div>
			)}
			<div className="flex min-h-0 flex-1">
				{!presenting && mode === "slide" && count > 1 && (
					<nav aria-label="Slides" className="hidden w-16 shrink-0 gap-1 overflow-y-auto border-r border-black/[0.07] bg-white p-2 sm:flex sm:flex-col">
						{Array.from({ length: count }, (_, i) => (
							<button key={i} onClick={() => go(i)} aria-current={i === index} className={cn("flex aspect-video w-full items-center justify-center rounded-md border text-xs font-semibold", i === index ? "border-sauti-teal bg-sauti-teal-light text-sauti-dark" : "border-black/10 text-[#787774] hover:border-sauti-teal/50")}>{i + 1}</button>
						))}
					</nav>
				)}
				<div
					ref={stage}
					tabIndex={0}
					onPointerMove={wake}
					className={cn("relative min-h-0 min-w-0 flex-1 outline-none", presenting ? "flex items-center justify-center overflow-hidden bg-black" : "overflow-auto bg-[#f4f4f2] p-4")}
				>
					{loading && <MjengoLoader label="Opening the presentation" />}
					{error && !loading && (
						<div className="mx-auto max-w-md py-16 text-center">
							<p className="text-sm text-red-700">{error}</p>
							{url && <Button asChild className="mt-4 gap-1.5"><a href={url} download={name}><Download className="h-4 w-4" /> Download the file</a></Button>}
						</div>
					)}
					<div ref={host} className={cn("mx-auto flex w-fit flex-col items-center gap-4", error && "hidden")} />
					{presenting && (
						<>
							{/* Tap the left or right half to move. */}
							<button aria-label="Previous slide" onClick={() => go("prev")} className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize opacity-0" />
							<button aria-label="Next slide" onClick={() => go("next")} className="absolute inset-y-0 right-0 w-2/3 cursor-e-resize opacity-0" />
							<div className={cn("pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10 text-white transition-opacity", chrome ? "opacity-100" : "opacity-0")}>
								<span className="pointer-events-auto rounded-full bg-black/50 px-3 py-1 text-sm tabular-nums">{index + 1} / {count}</span>
								<button onClick={stop} className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25"><Minimize2 className="h-4 w-4" /> Exit</button>
							</div>
							<div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-white/10"><div className="h-full bg-sauti-teal transition-all" style={{ width: `${count ? ((index + 1) / count) * 100 : 0}%` }} /></div>
							<button onClick={stop} aria-label="Exit presentation" className={cn("absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white transition-opacity", chrome ? "opacity-100" : "opacity-0")}><X className="h-4 w-4" /></button>
						</>
					)}
				</div>
			</div>
			{!presenting && <span className="sr-only"><Maximize2 /></span>}
		</div>
	);
}

export default function SlidesPage() {
	return (
		<Suspense fallback={<MjengoLoader label="Opening the presentation" className="h-full min-h-0" />}>
			<Viewer />
		</Suspense>
	);
}
