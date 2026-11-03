"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";

type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;

/** Renders one page lazily, crisp at the container width, with selectable text and live links. */
function PdfPage({ doc, index, width }: { doc: PdfDoc; index: number; width: number }) {
	const holder = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const textRef = useRef<HTMLDivElement>(null);
	const [ratio, setRatio] = useState(1.414);
	const [visible, setVisible] = useState(index < 2);

	useEffect(() => {
		const el = holder.current;
		if (!el || visible) return;
		const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: "1200px 0px" });
		io.observe(el);
		return () => io.disconnect();
	}, [visible]);

	useEffect(() => {
		if (!visible || !width) return;
		let cancelled = false;
		let task: { cancel: () => void } | null = null;
		(async () => {
			const page = await doc.getPage(index + 1);
			const base = page.getViewport({ scale: 1 });
			const scale = width / base.width;
			const viewport = page.getViewport({ scale });
			if (cancelled) return;
			setRatio(base.height / base.width);
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
	}, [doc, index, width, visible]);

	return (
		<div ref={holder} className="relative mx-auto w-full overflow-hidden bg-white shadow-[0_1px_3px_rgba(26,54,93,0.12),0_8px_28px_rgba(26,54,93,0.08)] ring-1 ring-black/5 sm:rounded-lg" style={{ aspectRatio: `1 / ${ratio}` }}>
			<canvas ref={canvasRef} className="block" aria-label={`Page ${index + 1}`} role="img" />
			<div ref={textRef} className="pdf-text-layer" />
		</div>
	);
}

/** The PDF shown as the post itself: pages flow down the article like a blog, in the site's theme. */
export function PdfReader({ url, title }: { url: string; title: string }) {
	const wrap = useRef<HTMLDivElement>(null);
	const [doc, setDoc] = useState<PdfDoc | null>(null);
	const [width, setWidth] = useState(0);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		const el = wrap.current;
		if (!el) return;
		const measure = () => setWidth(Math.floor(el.clientWidth));
		measure();
		const ro = new ResizeObserver(() => {
			// Re-render only on meaningful width changes.
			const w = Math.floor(el.clientWidth);
			setWidth((p) => (Math.abs(p - w) > 24 ? w : p));
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	useEffect(() => {
		let cancelled = false;
		let task: { destroy: () => Promise<void> } | null = null;
		(async () => {
			const pdfjs = await import("pdfjs-dist");
			pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
			const t = pdfjs.getDocument({ url });
			task = t;
			const d = await t.promise;
			if (!cancelled) setDoc(d);
		})().catch(() => !cancelled && setFailed(true));
		return () => {
			cancelled = true;
			void task?.destroy();
		};
	}, [url]);

	return (
		<section aria-label={title ? `${title} (document)` : "Document"} className="-mx-4 sm:mx-0">
			<style>{`
				.pdf-text-layer{position:absolute;inset:0;overflow:hidden;line-height:1;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;opacity:1}
				.pdf-text-layer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%}
				.pdf-text-layer ::selection{background:rgba(0,128,128,.3)}
			`}</style>
			<div ref={wrap} className="w-full">
				{failed ? (
					<p className="rounded-xl border border-gray-200 bg-[#f8f9fb] p-6 text-gray-600">
						The document couldn’t be shown here. <a className="font-semibold text-sauti-teal underline" href={url} target="_blank" rel="noopener noreferrer">Open the PDF</a> to read it.
					</p>
				) : !doc ? (
					<div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-gray-500" role="status">
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading document…
					</div>
				) : (
					<div className="space-y-4 sm:space-y-6">
						{Array.from({ length: doc.numPages }, (_, i) => (
							<PdfPage key={i} doc={doc} index={i} width={width} />
						))}
					</div>
				)}
			</div>
			<p className="mt-6 px-4 text-center sm:px-0">
				<a href={url} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center gap-2 text-sm font-bold text-[#1a365d] hover:text-sauti-orange">
					<Download className="h-4 w-4" aria-hidden /> Download the PDF
				</a>
			</p>
		</section>
	);
}
