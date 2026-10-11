"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Highlighter, Loader2, MousePointer2, PenLine, Save, Signature, Trash2, Type, Undo2 } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { putToSignedUrl } from "@/lib/client/upload";
import { MjengoLoader } from "../../_components/MjengoLoader";
import { finishReplace, getFileUrl, prepareReplace, prepareUpload, registerUpload } from "../../vault/api";

type Tool = "select" | "highlight" | "pen" | "text" | "sign";
/** All positions are fractions of the page, so they hold at any zoom. */
type Mark =
	| { id: string; page: number; kind: "highlight"; x: number; y: number; w: number; h: number; color: string }
	| { id: string; page: number; kind: "pen"; points: [number, number][]; color: string }
	| { id: string; page: number; kind: "text"; x: number; y: number; text: string; size: number; color: string }
	| { id: string; page: number; kind: "sign"; x: number; y: number; w: number; h: number; dataUrl: string };

const COLORS = { yellow: "#facc15", green: "#4ade80", pink: "#f472b6", blue: "#38bdf8" } as const;
const uid = () => Math.random().toString(36).slice(2, 10);
const hex = (c: string) => { const n = parseInt(c.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

function PdfScreen() {
	const { toast } = useToast();
	const params = useSearchParams();
	const fileId = params.get("file");

	const [name, setName] = useState("document.pdf");
	const [level, setLevel] = useState<"view" | "share" | "edit">("edit");
	const [folderId, setFolderId] = useState<string | null>(null);
	const [bytes, setBytes] = useState<Uint8Array | null>(null);
	const [pages, setPages] = useState<{ w: number; h: number }[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [tool, setTool] = useState<Tool>("highlight");
	const [color, setColor] = useState<string>(COLORS.yellow);
	const [marks, setMarks] = useState<Mark[]>([]);
	const [selected, setSelected] = useState<string | null>(null);
	const [signature, setSignature] = useState<string | null>(null);
	const [signing, setSigning] = useState(false);
	const [zoom, setZoom] = useState(1.25);
	const canvases = useRef<(HTMLCanvasElement | null)[]>([]);

	// Load the file and measure the pages.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				if (!fileId) throw new Error("Open a PDF from Files.");
				const info = await getFileUrl(fileId);
				const res = await fetch(info.url);
				if (!res.ok) throw new Error("Could not download the file.");
				const data = new Uint8Array(await res.arrayBuffer());
				const pdfjs = await import("pdfjs-dist");
				pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
				const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
				const sizes: { w: number; h: number }[] = [];
				for (let i = 1; i <= doc.numPages; i++) {
					const v = (await doc.getPage(i)).getViewport({ scale: 1 });
					sizes.push({ w: v.width, h: v.height });
				}
				if (cancelled) return;
				setName(info.name);
				setLevel(info.level);
				setFolderId(info.folderId);
				setBytes(data);
				setPages(sizes);
				void doc.cleanup();
			} catch (e) {
				toast({ title: "Could not open the PDF", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => { cancelled = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileId]);

	// Draw each page onto its canvas (again when the zoom changes).
	useEffect(() => {
		if (!bytes || !pages.length) return;
		let cancelled = false;
		(async () => {
			const pdfjs = await import("pdfjs-dist");
			pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
			const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
			for (let i = 1; i <= doc.numPages && !cancelled; i++) {
				const page = await doc.getPage(i);
				const vp = page.getViewport({ scale: zoom * (window.devicePixelRatio || 1) });
				const canvas = canvases.current[i - 1];
				if (!canvas) continue;
				canvas.width = vp.width;
				canvas.height = vp.height;
				await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise;
			}
			void doc.cleanup();
		})().catch(() => undefined);
		return () => { cancelled = true; };
	}, [bytes, pages, zoom]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.key === "Delete" || e.key === "Backspace") && selected && !(e.target as HTMLElement)?.closest("input, textarea")) {
				setMarks((m) => m.filter((x) => x.id !== selected));
				setSelected(null);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [selected]);

	const add = (m: Mark) => setMarks((x) => [...x, m]);

	/** Write every mark into a new copy of the PDF. */
	const build = async (): Promise<Uint8Array> => {
		if (!bytes) throw new Error("The PDF is not ready yet.");
		const doc = await PDFDocument.load(bytes);
		const font = await doc.embedFont(StandardFonts.Helvetica);
		const all = doc.getPages();
		for (const m of marks) {
			const page = all[m.page];
			if (!page) continue;
			const { width: W, height: H } = page.getSize();
			if (m.kind === "highlight") {
				page.drawRectangle({ x: m.x * W, y: H - (m.y + m.h) * H, width: m.w * W, height: m.h * H, color: hex(m.color), opacity: 0.4 });
			} else if (m.kind === "pen") {
				for (let i = 1; i < m.points.length; i++) {
					const [x1, y1] = m.points[i - 1];
					const [x2, y2] = m.points[i];
					page.drawLine({ start: { x: x1 * W, y: H - y1 * H }, end: { x: x2 * W, y: H - y2 * H }, thickness: 1.8, color: hex(m.color) });
				}
			} else if (m.kind === "text") {
				const size = m.size * (H / pages[m.page].h);
				page.drawText(m.text, { x: m.x * W, y: H - m.y * H - size, size, font, color: hex(m.color) });
			} else if (m.kind === "sign") {
				const img = await doc.embedPng(m.dataUrl);
				page.drawImage(img, { x: m.x * W, y: H - (m.y + m.h) * H, width: m.w * W, height: m.h * H });
			}
		}
		return await doc.save();
	};

	const save = async () => {
		setSaving(true);
		try {
			const out = await build();
			const blob = new File([out as BlobPart], name, { type: "application/pdf" });
			if (fileId && level === "edit") {
				const { signedUrl } = await prepareReplace(fileId);
				await putToSignedUrl(signedUrl, blob);
				await finishReplace(fileId, blob.size);
				setBytes(out);
				setMarks([]);
			} else {
				const copyName = name.replace(/\.pdf$/i, "") + " (marked up).pdf";
				const { path, signedUrl } = await prepareUpload(folderId, copyName, blob.size);
				await putToSignedUrl(signedUrl, new File([out as BlobPart], copyName, { type: "application/pdf" }));
				await registerUpload(folderId, path, copyName, blob.size, "application/pdf");
			}
			toast({ title: "Saved to Files", description: level === "edit" ? name : "A marked-up copy was added." });
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setSaving(false);
		}
	};

	const download = async () => {
		try {
			const url = URL.createObjectURL(new Blob([(await build()) as BlobPart], { type: "application/pdf" }));
			const a = document.createElement("a");
			a.href = url;
			a.download = name;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			toast({ title: "Could not download", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	};

	const tools: [Tool, string, React.ReactNode][] = [
		["select", "Select", <MousePointer2 key="s" className="h-[18px] w-[18px]" />],
		["highlight", "Highlight", <Highlighter key="h" className="h-[18px] w-[18px]" />],
		["pen", "Draw", <PenLine key="p" className="h-[18px] w-[18px]" />],
		["text", "Text", <Type key="t" className="h-[18px] w-[18px]" />],
		["sign", "Sign", <Signature key="g" className="h-[18px] w-[18px]" />],
	];

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#f4f4f2]">
			<div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-black/[0.07] bg-white px-3 py-1.5">
				<Button asChild variant="ghost" size="icon" aria-label="Back to Files"><Link href="/dashboard/mjengo/vault"><ArrowLeft className="h-[18px] w-[18px]" /></Link></Button>
				<span className="max-w-[200px] truncate px-1 text-[15px] font-medium text-[#37352f]">{name}</span>
				<span className="mx-1 h-5 w-px bg-black/10" />
				{tools.map(([t, label, icon]) => (
					<button key={t} onClick={() => { setTool(t); if (t === "sign" && !signature) setSigning(true); }} aria-pressed={tool === t} title={label} aria-label={label} className={cn("flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm", tool === t ? "bg-sauti-teal-light text-sauti-dark" : "text-[#787774] hover:bg-black/5")}>{icon}<span className="hidden md:inline">{label}</span></button>
				))}
				{(tool === "highlight" || tool === "pen" || tool === "text") && (
					<div className="ml-1 flex items-center gap-1">
						{(tool === "text" || tool === "pen" ? ["#111827", "#dc2626", "#2563eb", "#16a34a"] : Object.values(COLORS)).map((c) => (
							<button key={c} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={cn("h-5 w-5 rounded-full ring-offset-1", color === c && "ring-2 ring-sauti-teal")} style={{ background: c }} />
						))}
					</div>
				)}
				<span className="flex-1" />
				<Button variant="ghost" size="icon" aria-label="Undo" disabled={!marks.length} onClick={() => setMarks((m) => m.slice(0, -1))}><Undo2 className="h-[18px] w-[18px]" /></Button>
				<Button variant="ghost" size="icon" aria-label="Delete the selected mark" disabled={!selected} onClick={() => { setMarks((m) => m.filter((x) => x.id !== selected)); setSelected(null); }}><Trash2 className="h-[18px] w-[18px]" /></Button>
				<select value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" className="h-9 rounded-lg border border-black/10 bg-white px-2 text-sm">
					{[0.75, 1, 1.25, 1.5, 2].map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
				</select>
				<Button variant="ghost" size="sm" className="gap-1.5" onClick={download} disabled={loading}><Download className="h-4 w-4" /><span className="hidden sm:inline">Download</span></Button>
				<Button size="sm" className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={save} disabled={loading || saving || (!marks.length && level === "edit")}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
			</div>

			<div className="min-h-0 flex-1 overflow-auto p-4">
				{loading ? <MjengoLoader label="Opening the PDF" /> : (
					<div className="mx-auto flex w-fit flex-col gap-4">
						{pages.map((p, i) => (
							<PageView
								key={i}
								index={i}
								size={p}
								zoom={zoom}
								canvasRef={(el) => { canvases.current[i] = el; }}
								marks={marks.filter((m) => m.page === i)}
								tool={tool}
								color={color}
								selected={selected}
								onSelect={setSelected}
								onAdd={add}
								onChange={(id, patch) => setMarks((m) => m.map((x) => (x.id === id ? ({ ...x, ...patch } as Mark) : x)))}
								signature={signature}
								onNeedSignature={() => setSigning(true)}
							/>
						))}
					</div>
				)}
			</div>

			<SignatureDialog open={signing} onClose={() => setSigning(false)} onDone={(url) => { setSignature(url); setSigning(false); setTool("sign"); }} />
		</div>
	);
}

function PageView({ index, size, zoom, canvasRef, marks, tool, color, selected, onSelect, onAdd, onChange, signature, onNeedSignature }: {
	index: number; size: { w: number; h: number }; zoom: number; canvasRef: (el: HTMLCanvasElement | null) => void;
	marks: Mark[]; tool: Tool; color: string; selected: string | null; onSelect: (id: string | null) => void; onAdd: (m: Mark) => void;
	onChange: (id: string, patch: Partial<Mark>) => void; signature: string | null; onNeedSignature: () => void;
}) {
	const W = size.w * zoom;
	const H = size.h * zoom;
	const box = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
	const [stroke, setStroke] = useState<[number, number][] | null>(null);
	const [typing, setTyping] = useState<{ x: number; y: number; text: string } | null>(null);
	const start = useRef<{ x: number; y: number } | null>(null);

	const pos = (e: React.PointerEvent): [number, number] => {
		const r = box.current!.getBoundingClientRect();
		return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
	};

	const down = (e: React.PointerEvent) => {
		if ((e.target as HTMLElement).closest("[data-mark]")) return;
		const [x, y] = pos(e);
		onSelect(null);
		if (tool === "highlight") { start.current = { x, y }; setDraft({ x, y, w: 0, h: 0 }); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
		else if (tool === "pen") { setStroke([[x, y]]); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
		else if (tool === "text") setTyping({ x, y, text: "" });
		else if (tool === "sign") {
			if (!signature) return onNeedSignature();
			const w = 0.28;
			const h = w * 0.4 * (size.w / size.h);
			onAdd({ id: uid(), page: index, kind: "sign", x: Math.min(x, 1 - w), y: Math.min(y, 1 - h), w, h, dataUrl: signature });
		}
	};
	const move = (e: React.PointerEvent) => {
		const [x, y] = pos(e);
		if (draft && start.current) setDraft({ x: Math.min(x, start.current.x), y: Math.min(y, start.current.y), w: Math.abs(x - start.current.x), h: Math.abs(y - start.current.y) });
		else if (stroke) setStroke((s) => (s ? [...s, [x, y]] : s));
	};
	const up = () => {
		if (draft && draft.w > 0.004 && draft.h > 0.003) onAdd({ id: uid(), page: index, kind: "highlight", color, ...draft });
		if (stroke && stroke.length > 1) onAdd({ id: uid(), page: index, kind: "pen", points: stroke, color });
		setDraft(null); setStroke(null); start.current = null;
	};
	const commitText = () => {
		if (typing && typing.text.trim()) onAdd({ id: uid(), page: index, kind: "text", x: typing.x, y: typing.y, text: typing.text, size: 14, color });
		setTyping(null);
	};

	const cursor = tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";
	return (
		<div ref={box} className="relative bg-white shadow-md" style={{ width: W, height: H }}>
			<canvas ref={canvasRef} style={{ width: W, height: H }} className="absolute inset-0" />
			<div className="absolute inset-0 touch-none" style={{ cursor }} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
				{marks.map((m) => {
					const sel = selected === m.id;
					if (m.kind === "highlight") return <div key={m.id} data-mark onPointerDown={(e) => { e.stopPropagation(); onSelect(m.id); }} className={cn("absolute", sel && "outline outline-2 outline-sauti-teal")} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%`, background: m.color, opacity: 0.4, cursor: "pointer" }} />;
					if (m.kind === "text") return <div key={m.id} data-mark onPointerDown={(e) => { e.stopPropagation(); onSelect(m.id); }} className={cn("absolute whitespace-pre font-sans leading-none", sel && "outline outline-2 outline-sauti-teal")} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, fontSize: m.size * zoom, color: m.color, cursor: "pointer" }}>{m.text}</div>;
					if (m.kind === "sign") return <img key={m.id} data-mark src={m.dataUrl} alt="Signature" draggable={false} onPointerDown={(e) => { e.stopPropagation(); onSelect(m.id); }} className={cn("absolute", sel && "outline outline-2 outline-sauti-teal")} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%`, cursor: "pointer" }} />;
					return null;
				})}
				<svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
					{marks.filter((m): m is Extract<Mark, { kind: "pen" }> => m.kind === "pen").map((m) => (
						<polyline key={m.id} points={m.points.map((p) => p.join(",")).join(" ")} fill="none" stroke={m.color} strokeWidth={0.003} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
					))}
					{stroke && <polyline points={stroke.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />}
				</svg>
				{draft && <div className="absolute" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%`, background: color, opacity: 0.4 }} />}
				{typing && (
					<input
						autoFocus
						value={typing.text}
						onChange={(e) => setTyping({ ...typing, text: e.target.value })}
						onBlur={commitText}
						onKeyDown={(e) => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTyping(null); }}
						className="absolute min-w-[120px] rounded border border-sauti-teal bg-white/90 px-1 outline-none"
						style={{ left: `${typing.x * 100}%`, top: `${typing.y * 100}%`, fontSize: 14 * zoom, color }}
						aria-label="Text to place"
					/>
				)}
			</div>
		</div>
	);
}

/** Draw a signature with the finger, mouse or pen, or type one. Returns a transparent PNG. */
function SignatureDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (dataUrl: string) => void }) {
	const [mode, setMode] = useState<"draw" | "type">("draw");
	const [typed, setTyped] = useState("");
	const pad = useRef<HTMLCanvasElement>(null);
	const drawing = useRef(false);
	const last = useRef<{ x: number; y: number } | null>(null);
	const [empty, setEmpty] = useState(true);
	useEffect(() => {
		if (!open) return;
		setEmpty(true);
		setTyped("");
		const c = pad.current;
		if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
	}, [open, mode]);

	const point = (e: React.PointerEvent) => {
		const c = pad.current!;
		const r = c.getBoundingClientRect();
		return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
	};
	const done = () => {
		const out = document.createElement("canvas");
		out.width = 600; out.height = 240;
		const ctx = out.getContext("2d")!;
		if (mode === "draw") ctx.drawImage(pad.current!, 0, 0, 600, 240);
		else { ctx.fillStyle = "#111827"; ctx.font = "italic 96px 'Segoe Script', 'Brush Script MT', cursive"; ctx.textBaseline = "middle"; ctx.fillText(typed, 20, 120, 560); }
		onDone(out.toDataURL("image/png"));
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader><DialogTitle>Your signature</DialogTitle><DialogDescription>It stays in this window only. Click on the page to place it.</DialogDescription></DialogHeader>
				<div className="inline-flex w-fit rounded-lg border border-serene-neutral-200 p-0.5">
					{(["draw", "type"] as const).map((m) => <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={cn("rounded-md px-3 py-1 text-sm font-medium capitalize", mode === m ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}>{m}</button>)}
				</div>
				{mode === "draw" ? (
					<canvas
						ref={pad}
						width={600}
						height={240}
						className="h-40 w-full touch-none rounded-xl border border-dashed border-serene-neutral-300 bg-white"
						onPointerDown={(e) => { drawing.current = true; last.current = point(e); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
						onPointerMove={(e) => {
							if (!drawing.current || !last.current) return;
							const p = point(e);
							const ctx = pad.current!.getContext("2d")!;
							ctx.strokeStyle = "#111827"; ctx.lineWidth = 4; ctx.lineCap = "round";
							ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
							last.current = p;
							setEmpty(false);
						}}
						onPointerUp={() => { drawing.current = false; last.current = null; }}
					/>
				) : (
					<div className="space-y-2">
						<Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your name" autoFocus />
						<p className="rounded-xl border border-dashed border-serene-neutral-300 p-4 text-3xl italic" style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}>{typed || "Your name"}</p>
					</div>
				)}
				<DialogFooter>
					<Button variant="ghost" onClick={() => { setEmpty(true); const c = pad.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); setTyped(""); }}>Clear</Button>
					<Button className="bg-sauti-teal hover:bg-sauti-dark" disabled={mode === "draw" ? empty : !typed.trim()} onClick={done}>Use this signature</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default function PdfPage() {
	return (
		<Suspense fallback={<MjengoLoader label="Opening the PDF" className="h-full min-h-0" />}>
			<PdfScreen />
		</Suspense>
	);
}


