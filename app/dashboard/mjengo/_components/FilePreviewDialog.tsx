"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fmtBytes } from "./shared";

/** What the window needs to show one file. `url` is shown in place; `embed` is another site's own viewer. */
export interface PreviewSource {
	name: string;
	mime: string | null;
	size?: number | null;
	url?: string | null;
	downloadUrl?: string | null;
	embed?: string | null;
	link?: string | null;
}

type Shown = "image" | "pdf" | "text" | "video" | "audio" | "embed" | "none";
const shownAs = (s: PreviewSource): Shown => {
	if (s.embed) return "embed";
	const m = (s.mime ?? "").toLowerCase();
	if (!s.url) return "none";
	if (m.startsWith("image/") && !m.includes("svg")) return "image";
	if (m === "application/pdf") return "pdf";
	if (m.startsWith("video/")) return "video";
	if (m.startsWith("audio/")) return "audio";
	if (m === "text/plain" || m === "text/csv" || m === "text/markdown") return "text";
	return "none";
};

/**
 * A file shown in a window over the page, the way Gmail shows an attachment: the file fills the window, with
 * download and open actions on top, and arrows to move to the next file of the same list.
 */
export function FilePreviewDialog({ open, onClose, load, label, onPrev, onNext, position }: {
	open: boolean;
	onClose: () => void;
	/** Fetches the file's details each time the window opens (links to private files expire). */
	load: () => Promise<PreviewSource>;
	label?: string;
	onPrev?: () => void;
	onNext?: () => void;
	position?: string;
}) {
	const [src, setSrc] = useState<PreviewSource | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [text, setText] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		let live = true;
		setSrc(null); setError(null); setText(null);
		load()
			.then((s) => { if (live) setSrc(s); })
			.catch((e) => { if (live) setError(e instanceof Error ? e.message : "Could not open the file."); });
		return () => { live = false; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, load]);

	const kind = src ? shownAs(src) : "none";
	useEffect(() => {
		if (!src?.url || kind !== "text") return;
		let live = true;
		fetch(src.url).then((r) => r.text()).then((t) => live && setText(t.slice(0, 200_000))).catch(() => live && setText(null));
		return () => { live = false; };
	}, [src, kind]);

	useEffect(() => {
		if (!open) return;
		const h = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft" && onPrev) onPrev();
			if (e.key === "ArrowRight" && onNext) onNext();
		};
		window.addEventListener("keydown", h);
		return () => window.removeEventListener("keydown", h);
	}, [open, onPrev, onNext]);

	const name = src?.name ?? label ?? "File";
	const openHref = src?.link ?? src?.url ?? null;
	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="flex h-[92vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden p-0">
				<div className="flex items-center gap-2 border-b border-serene-neutral-100 px-4 py-2.5 pr-12">
					<FileText className="h-4 w-4 shrink-0 text-serene-neutral-500" aria-hidden />
					<div className="min-w-0 flex-1">
						<DialogTitle className="truncate text-sm font-semibold">{name}</DialogTitle>
						<DialogDescription className="truncate text-xs">{[src?.size ? fmtBytes(src.size) : null, position].filter(Boolean).join(" · ") || "Preview"}</DialogDescription>
					</div>
					{onPrev && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onPrev} aria-label="Previous file"><ChevronLeft className="h-4 w-4" /></Button>}
					{onNext && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onNext} aria-label="Next file"><ChevronRight className="h-4 w-4" /></Button>}
					{src?.downloadUrl && <Button asChild size="sm" variant="outline" className="h-8 gap-1.5"><a href={src.downloadUrl}><Download className="h-4 w-4" /> Download</a></Button>}
					{openHref && <Button asChild size="icon" variant="ghost" className="h-8 w-8" aria-label="Open in a new tab" title="Open in a new tab"><a href={openHref} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
				</div>
				<div className="relative flex min-h-0 flex-1 items-center justify-center bg-serene-neutral-100/70">
					{error ? (
						<p className="max-w-sm px-6 text-center text-sm text-serene-neutral-700" role="alert">{error}</p>
					) : !src ? (
						<span className="flex items-center gap-2 text-sm text-serene-neutral-600" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Opening</span>
					) : kind === "image" ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={src.url!} alt={src.name} className="max-h-full max-w-full object-contain" />
					) : kind === "pdf" ? (
						<iframe src={src.url!} title={src.name} className="h-full w-full border-0 bg-white" />
					) : kind === "embed" ? (
						<iframe src={src.embed!} title={src.name} className="h-full w-full border-0 bg-white" allow="autoplay" />
					) : kind === "video" ? (
						<video src={src.url!} controls className="max-h-full max-w-full" />
					) : kind === "audio" ? (
						<audio src={src.url!} controls className="w-[min(480px,90%)]" />
					) : kind === "text" ? (
						<pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words bg-white p-5 text-sm text-serene-neutral-900">{text ?? "Loading…"}</pre>
					) : (
						<div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
							<FileText className="h-10 w-10 text-serene-neutral-400" aria-hidden />
							<p className="text-sm font-medium text-serene-neutral-900">No preview for this kind of file</p>
							<p className="text-xs text-serene-neutral-600">Download it to open it in its own app.</p>
							{src.downloadUrl && <Button asChild size="sm"><a href={src.downloadUrl}><Download className="mr-1.5 h-4 w-4" /> Download</a></Button>}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
