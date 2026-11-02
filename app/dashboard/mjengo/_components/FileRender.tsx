"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SlideView } from "@/components/deck/SlideView";
import { parseDeck, type Deck } from "@/lib/deck/model";

export type RenderKind = "docx" | "sheet" | "pptx" | "deck" | "draw" | "svg";

/** Files the browser cannot show by itself but that can be drawn here, by their ending. */
export const renderKindOf = (name: string, mime?: string | null): RenderKind | null => {
	const ext = name.toLowerCase().split(".").pop() ?? "";
	if (ext === "docx") return "docx";
	if (ext === "xlsx" || ext === "xls") return "sheet";
	if (ext === "pptx") return "pptx";
	if (ext === "deck") return "deck";
	if (ext === "excalidraw") return "draw";
	if (ext === "svg" || (mime ?? "").includes("svg")) return "svg";
	return null;
};

type Out =
	| { t: "html"; html: string }
	| { t: "slides"; slides: { title: string; lines: string[]; images: string[] }[] }
	| { t: "deck"; deck: Deck }
	| { t: "image"; src: string };

const PAPER = `<style>body{font:15px/1.6 system-ui,sans-serif;color:#111827;background:#fff;margin:0;padding:28px 36px;max-width:820px}
table{border-collapse:collapse;margin:0 0 24px}td,th{border:1px solid #d1d5db;padding:4px 9px;font-size:13px;vertical-align:top}th{background:#f3f4f6}
h1,h2,h3{line-height:1.25}img{max-width:100%}p.sheet{font-weight:700;margin:20px 0 6px}</style>`;

async function build(kind: RenderKind, url: string, name: string): Promise<Out> {
	if (kind === "svg") return { t: "image", src: url };
	const res = await fetch(url);
	if (!res.ok) throw new Error("Could not download the file to show it.");
	if (kind === "deck") {
		const deck = parseDeck(await res.text());
		if (!deck) throw new Error("This presentation could not be read.");
		return { t: "deck", deck };
	}
	if (kind === "draw") {
		const { exportToSvg } = await import("@excalidraw/excalidraw");
		const j = JSON.parse(await res.text()) as { elements?: never[]; appState?: Record<string, unknown>; files?: Record<string, never> };
		const svg = await exportToSvg({ elements: j.elements ?? [], appState: { ...(j.appState ?? {}), exportBackground: true, viewBackgroundColor: "#ffffff" } as never, files: j.files ?? {} });
		return { t: "image", src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}` };
	}
	const buf = await res.arrayBuffer();
	if (kind === "docx") {
		const mammoth = await import("mammoth");
		const r = await mammoth.convertToHtml({ arrayBuffer: buf });
		return { t: "html", html: `${PAPER}${r.value || "<p>This document is empty.</p>"}` };
	}
	if (kind === "sheet") {
		const XLSX = await import("xlsx");
		const wb = XLSX.read(buf, { type: "array" });
		const parts = wb.SheetNames.slice(0, 6).map((n) => {
			const ws = wb.Sheets[n];
			const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false }).slice(0, 500);
			const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
			return `${wb.SheetNames.length > 1 ? `<p class="sheet">${esc(n)}</p>` : ""}<table>${rows.map((r) => `<tr>${(r as unknown[]).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
		});
		return { t: "html", html: `${PAPER}${parts.join("") || "<p>This spreadsheet is empty.</p>"}` };
	}
	const { readPptxBasic } = await import("@/lib/mjengo/pptx-basic");
	const slides = await readPptxBasic(buf);
	if (!slides.length) throw new Error(`${name} has no slides to show.`);
	return { t: "slides", slides };
}

/** A file drawn in the page: Word, Excel and PowerPoint files, slides and drawings made here, and SVG. */
export function FileRender({ kind, url, name }: { kind: RenderKind; url: string; name: string }) {
	const [out, setOut] = useState<Out | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		let live = true;
		setOut(null); setError(null);
		build(kind, url, name).then((o) => live && setOut(o)).catch((e) => live && setError(e instanceof Error ? e.message : "Could not show this file."));
		return () => { live = false; };
	}, [kind, url, name]);

	if (error) return <p className="max-w-sm px-6 text-center text-sm text-serene-neutral-700" role="alert">{error} Download it to open it in its own app.</p>;
	if (!out) return <span className="flex items-center gap-2 text-sm text-serene-neutral-600" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Preparing the preview</span>;
	if (out.t === "html") return <iframe sandbox="" srcDoc={out.html} title={name} className="h-full w-full border-0 bg-white" />;
	if (out.t === "image") return <div className="flex h-full w-full items-center justify-center overflow-auto bg-white p-4">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={out.src} alt={name} className="max-h-full max-w-full object-contain" /></div>;
	if (out.t === "deck") {
		return (
			<ol className="h-full w-full space-y-4 overflow-y-auto p-5">
				{out.deck.slides.map((s, i) => <li key={s.id} className="mx-auto w-fit overflow-hidden rounded-lg shadow-md"><SlideView slide={s} theme={out.deck.theme} width={Math.min(720, typeof window === "undefined" ? 720 : window.innerWidth - 80)} /><span className="sr-only">Slide {i + 1}</span></li>)}
			</ol>
		);
	}
	return (
		<ol className="h-full w-full space-y-3 overflow-y-auto p-5">
			{out.slides.map((s, i) => (
				<li key={i} className="mx-auto max-w-2xl rounded-xl bg-white p-5 shadow-sm" style={{ color: "#111827" }}>
					<p className="text-xs font-medium" style={{ color: "#6b7280" }}>Slide {i + 1}</p>
					<h3 className="mt-1 text-base font-bold">{s.title}</h3>
					{s.lines.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{s.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>}
					{s.images.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{s.images.map((src, j) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={j} src={src} alt="" className="max-h-40 rounded-md object-contain" />)}</div>}
				</li>
			))}
		</ol>
	);
}
