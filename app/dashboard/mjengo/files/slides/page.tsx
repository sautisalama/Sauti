"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MjengoLoader } from "../../_components/MjengoLoader";
import { getFileUrl } from "../../vault/api";

/** Reads a PowerPoint file and shows its slides in the app: one slide at a time, or the whole deck as a list. */
function Viewer() {
	const { toast } = useToast();
	const fileId = useSearchParams().get("file");
	const host = useRef<HTMLDivElement>(null);
	const stage = useRef<HTMLDivElement>(null);
	const previewer = useRef<{ renderNextSlide: () => void; renderPreSlide: () => void; destroy: () => void; slideCount?: number } | null>(null);
	const [name, setName] = useState("Presentation.pptx");
	const [url, setUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [mode, setMode] = useState<"slide" | "list">("slide");
	const [width, setWidth] = useState(960);
	const [error, setError] = useState<string | null>(null);

	// Keep the slide as large as the space allows (16:9).
	useEffect(() => {
		const el = stage.current;
		if (!el) return;
		const ro = new ResizeObserver(() => setWidth(Math.max(320, Math.min(1280, Math.floor(el.clientWidth - 32)))));
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				if (!fileId) throw new Error("Open a presentation from Files.");
				const info = await getFileUrl(fileId);
				setName(info.name);
				setUrl(info.url);
				const res = await fetch(info.url);
				if (!res.ok) throw new Error("Could not download the file.");
				const buf = await res.arrayBuffer();
				if (cancelled || !host.current) return;
				const { init } = await import("pptx-preview");
				previewer.current?.destroy();
				host.current.innerHTML = "";
				const p = init(host.current, { width, height: Math.round((width * 9) / 16), mode });
				previewer.current = p as unknown as typeof previewer.current;
				await p.preview(buf);
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Could not show this presentation.");
					toast({ title: "Could not open the presentation", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => { cancelled = true; previewer.current?.destroy(); previewer.current = null; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileId, width, mode]);

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#f4f4f2]">
			<div className="flex shrink-0 items-center gap-1 border-b border-black/[0.07] bg-white px-3 py-1.5">
				<Button asChild variant="ghost" size="icon" aria-label="Back to Files"><Link href="/dashboard/mjengo/vault"><ArrowLeft className="h-[18px] w-[18px]" /></Link></Button>
				<span className="min-w-0 flex-1 truncate px-1 text-[15px] font-medium text-[#37352f]">{name}</span>
				<div className="inline-flex rounded-lg border border-black/10 p-0.5">
					<button onClick={() => setMode("slide")} aria-pressed={mode === "slide"} className={mode === "slide" ? "rounded-md bg-sauti-teal px-2.5 py-1 text-xs font-semibold text-white" : "rounded-md px-2.5 py-1 text-xs text-[#787774]"}>Slides</button>
					<button onClick={() => setMode("list")} aria-pressed={mode === "list"} className={mode === "list" ? "rounded-md bg-sauti-teal px-2.5 py-1 text-xs font-semibold text-white" : "rounded-md px-2.5 py-1 text-xs text-[#787774]"}>All slides</button>
				</div>
				{mode === "slide" && (
					<>
						<Button variant="ghost" size="icon" aria-label="Previous slide" onClick={() => previewer.current?.renderPreSlide()}><ChevronLeft className="h-[18px] w-[18px]" /></Button>
						<Button variant="ghost" size="icon" aria-label="Next slide" onClick={() => previewer.current?.renderNextSlide()}><ChevronRight className="h-[18px] w-[18px]" /></Button>
					</>
				)}
				<Button variant="ghost" size="icon" aria-label="Full screen" onClick={() => stage.current?.requestFullscreen?.().catch(() => undefined)}><Maximize2 className="h-[18px] w-[18px]" /></Button>
				{url && <Button asChild variant="outline" size="sm" className="gap-1.5"><a href={url} download={name}><Download className="h-4 w-4" /> Download</a></Button>}
			</div>
			<div ref={stage} onKeyDown={(e) => { if (e.key === "ArrowRight") previewer.current?.renderNextSlide(); if (e.key === "ArrowLeft") previewer.current?.renderPreSlide(); }} tabIndex={0} className="min-h-0 flex-1 overflow-auto bg-[#f4f4f2] p-4 outline-none">
				{loading && <MjengoLoader label="Opening the presentation" />}
				{error && !loading && <p className="py-16 text-center text-sm text-red-700">{error}</p>}
				<div ref={host} className="mx-auto flex w-fit flex-col items-center gap-4" />
			</div>
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
