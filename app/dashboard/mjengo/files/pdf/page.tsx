"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Bold, Copy, MessageSquarePlus, Download, Highlighter, Image as ImageIcon, ImagePlus, Loader2, MapPin, Minus, MousePointer2, PenLine, Plus, Redo2, Save, Share2, Signature, Trash2, Type, Undo2 } from "lucide-react";
import { PDFDocument, PDFHexString, StandardFonts, rgb } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CommentPins, CommentsPanel, usePdfComments, type Spot } from "./_Comments";
import { putToSignedUrl } from "@/lib/client/upload";
import { unwrap } from "@/lib/action-result";
import { deleteSignature, listSignatures, saveSignatureImage, type SignatureRow } from "@/app/actions/mjengo-signatures";
import { MjengoLoader } from "../../_components/MjengoLoader";
import { ShareDialog } from "../../_components/ShareDialog";
import { finishReplace, getFileUrl, prepareReplace, prepareUpload, registerUpload } from "../../vault/api";

type Tool = "select" | "highlight" | "pen" | "text" | "pin" | "sign";
/** All positions are fractions of the page, so they hold at any zoom. */
type Mark =
	| { id: string; page: number; kind: "highlight"; x: number; y: number; w: number; h: number; color: string }
	| { id: string; page: number; kind: "pen"; points: [number, number][]; color: string; width: number }
	| { id: string; page: number; kind: "text"; x: number; y: number; text: string; size: number; color: string; bold?: boolean }
	| { id: string; page: number; kind: "sign"; x: number; y: number; w: number; h: number; dataUrl: string }
	| { id: string; page: number; kind: "pin"; x: number; y: number; text: string };

const COLORS = { yellow: "#facc15", green: "#4ade80", pink: "#f472b6", blue: "#38bdf8" } as const;
const INK = ["#111827", "#dc2626", "#2563eb", "#16a34a"];
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const hex = (c: string) => { const n = parseInt(c.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

/** Where a mark sits, as fractions of the page. */
function bounds(m: Mark): { x: number; y: number; w: number; h: number } {
	if (m.kind === "pen") {
		const xs = m.points.map((p) => p[0]); const ys = m.points.map((p) => p[1]);
		const x = Math.min(...xs), y = Math.min(...ys);
		return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
	}
	if (m.kind === "highlight" || m.kind === "sign") return { x: m.x, y: m.y, w: m.w, h: m.h };
	return { x: m.x, y: m.y, w: 0.02, h: 0.02 };
}

function PdfScreen() {
	const { toast } = useToast();
	const params = useSearchParams();
	const fileId = params.get("file");

	const [name, setName] = useState("document.pdf");
	const [level, setLevel] = useState<"view" | "share" | "edit">("edit");
	// Comments live on the server, so everyone with access sees the same threads; they are separate from the marks.
	const cm = usePdfComments(fileId);
	const [commentsOpen, setCommentsOpen] = useState(false);
	const [pendingSpot, setPendingSpot] = useState<Spot | null>(null);
	const [activeComment, setActiveComment] = useState<string | null>(null);
	const [folderId, setFolderId] = useState<string | null>(null);
	const [bytes, setBytes] = useState<Uint8Array | null>(null);
	const [pages, setPages] = useState<{ w: number; h: number }[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	// Opens ready to read and scroll; a tool is picked on purpose, so a touch never starts a highlight by accident.
	const [tool, setTool] = useState<Tool>("select");
	const [color, setColor] = useState<string>(COLORS.yellow);
	const [thickness, setThickness] = useState(2);
	const [marks, setMarksState] = useState<Mark[]>([]);
	const marksRef = useRef<Mark[]>([]);
	const past = useRef<Mark[][]>([]);
	const future = useRef<Mark[][]>([]);
	const [, bump] = useState(0);
	const [selected, setSelected] = useState<string | null>(null);
	const [signature, setSignature] = useState<string | null>(null);
	const [signing, setSigning] = useState(false);
	const [library, setLibrary] = useState<SignatureRow[]>([]);
	const loadLibrary = useCallback(() => { unwrap(listSignatures()).then(setLibrary).catch(() => undefined); }, []);
	useEffect(() => { loadLibrary(); }, [loadLibrary]);
	const [zoom, setZoom] = useState(1.25);
	// A phone starts with the whole page in view.
	useEffect(() => { if (window.innerWidth < 640) setZoom(0.5); }, []);
	const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
	const scroller = useRef<HTMLDivElement>(null);
	const picture = useRef<HTMLInputElement>(null);

	/* ------------------------------------------------------------ History */
	const setMarks = (next: Mark[]) => { marksRef.current = next; setMarksState(next); };
	/** Remember where things were, so Undo can come back to it. */
	const record = () => {
		past.current.push(marksRef.current);
		if (past.current.length > 100) past.current.shift();
		future.current = [];
		bump((n) => n + 1);
	};
	const commit = (fn: (m: Mark[]) => Mark[]) => { record(); setMarks(fn(marksRef.current)); };
	const live = (fn: (m: Mark[]) => Mark[]) => setMarks(fn(marksRef.current));
	const undo = () => {
		const prev = past.current.pop();
		if (!prev) return;
		future.current.push(marksRef.current);
		setMarks(prev);
		setSelected((s) => (prev.some((m) => m.id === s) ? s : null));
		bump((n) => n + 1);
	};
	const redo = () => {
		const next = future.current.pop();
		if (!next) return;
		past.current.push(marksRef.current);
		setMarks(next);
		bump((n) => n + 1);
	};
	const resetHistory = () => { past.current = []; future.current = []; setMarks([]); setSelected(null); bump((n) => n + 1); };

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

	const sel = marks.find((m) => m.id === selected) ?? null;

	const remove = () => { if (!selected) return; commit((m) => m.filter((x) => x.id !== selected)); setSelected(null); };
	const duplicate = () => {
		if (!sel) return;
		const copy = { ...sel, id: uid() } as Mark;
		if (copy.kind === "pen") copy.points = copy.points.map(([x, y]) => [Math.min(1, x + 0.02), Math.min(1, y + 0.02)] as [number, number]);
		else copy.x = Math.min(0.95, copy.x + 0.02), copy.y = Math.min(0.95, copy.y + 0.02);
		commit((m) => [...m, copy]);
		setSelected(copy.id);
	};

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
			const mod = e.ctrlKey || e.metaKey;
			if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
			if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
			if (mod && e.key.toLowerCase() === "d" && sel) { e.preventDefault(); duplicate(); return; }
			if ((e.key === "Delete" || e.key === "Backspace") && selected) { e.preventDefault(); remove(); return; }
			if (e.key === "Escape") { setSelected(null); return; }
			if (selected && e.key.startsWith("Arrow")) {
				e.preventDefault();
				const d = e.shiftKey ? 0.01 : 0.002;
				const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
				const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
				commit((ms) => ms.map((m) => (m.id !== selected ? m : m.kind === "pen" ? { ...m, points: m.points.map(([x, y]) => [clamp(x + dx, 0, 1), clamp(y + dy, 0, 1)] as [number, number]) } : { ...m, x: clamp(m.x + dx, 0, 1), y: clamp(m.y + dy, 0, 1) })));
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	});

	const add = (m: Mark) => { commit((x) => [...x, m]); };

	/** A picture from the device, placed on the page in view, then ready to move and resize. */
	const placePicture = (file: File | undefined) => {
		if (!file) return;
		if (!file.type.startsWith("image/")) { toast({ title: "Choose a picture", variant: "destructive" }); return; }
		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => {
				const k = Math.min(1, 1400 / Math.max(img.width, img.height));
				const c = document.createElement("canvas");
				c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
				c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
				const box = scroller.current?.getBoundingClientRect();
				const el = box ? document.elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2).find((n) => (n as HTMLElement).dataset?.page != null) as HTMLElement | undefined : undefined;
				const pg = el ? Number(el.dataset.page) : 0;
				const size = pages[pg] ?? pages[0];
				if (!size) return;
				const w = 0.35;
				const h = w * (c.height / c.width) * (size.w / size.h);
				const m: Mark = { id: uid(), page: pg, kind: "sign", x: (1 - w) / 2, y: clamp(0.3, 0, 1 - h), w, h: Math.min(h, 0.9), dataUrl: c.toDataURL("image/png") };
				add(m);
				setSelected(m.id);
				setTool("select");
			};
			img.src = String(reader.result);
		};
		reader.readAsDataURL(file);
		if (picture.current) picture.current.value = "";
	};

	/** Write every mark into a new copy of the PDF. */
	const build = async (): Promise<Uint8Array> => {
		if (!bytes) throw new Error("The PDF is not ready yet.");
		const doc = await PDFDocument.load(bytes);
		const font = await doc.embedFont(StandardFonts.Helvetica);
		const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
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
					page.drawLine({ start: { x: x1 * W, y: H - y1 * H }, end: { x: x2 * W, y: H - y2 * H }, thickness: m.width * 0.9, color: hex(m.color), lineCap: 1 });
				}
			} else if (m.kind === "text") {
				const size = m.size * (H / pages[m.page].h);
				m.text.split("\n").forEach((line, i) => {
					if (line) page.drawText(line, { x: m.x * W, y: H - m.y * H - size - i * size * 1.2, size, font: m.bold ? fontBold : font, color: hex(m.color) });
				});
			} else if (m.kind === "sign") {
				const img = await doc.embedPng(m.dataUrl);
				page.drawImage(img, { x: m.x * W, y: H - (m.y + m.h) * H, width: m.w * W, height: m.h * H });
			} else if (m.kind === "pin") {
				const x = m.x * W, y = H - m.y * H - 16;
				// A real note annotation, so other PDF viewers show the comment too, plus a visible marker.
				const ref = doc.context.register(doc.context.obj({
					Type: "Annot", Subtype: "Text", Rect: [x, y, x + 16, y + 16], Contents: PDFHexString.fromText(m.text), Name: "Comment", C: [1, 0.8, 0], F: 4, T: PDFHexString.fromText("Sauti Salama"),
				}));
				page.node.addAnnot(ref);
				page.drawRectangle({ x, y, width: 16, height: 16, color: rgb(1, 0.8, 0), borderColor: rgb(0.6, 0.45, 0), borderWidth: 0.8, opacity: 0.95 });
				page.drawText("i", { x: x + 6, y: y + 4, size: 9, font: fontBold, color: rgb(0.3, 0.2, 0) });
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
				resetHistory();
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
		["pin", "Note", <MapPin key="n" className="h-[18px] w-[18px]" />],
		["sign", "Sign", <Signature key="g" className="h-[18px] w-[18px]" />],
	];

	const toolButtons = (
		<>
			{tools.map(([t, label, icon]) => (
				<button key={t} onClick={() => { setTool(t); if (t === "sign") setSigning(true); }} aria-pressed={tool === t} title={label} aria-label={label} className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm", tool === t ? "bg-sauti-teal-light text-sauti-dark" : "text-[#787774] hover:bg-black/5")}>{icon}<span className="text-xs sm:text-sm md:inline">{label}</span></button>
			))}
			<button onClick={() => picture.current?.click()} title="Add a picture" aria-label="Add a picture" className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-[#787774] hover:bg-black/5"><ImagePlus className="h-[18px] w-[18px]" /><span className="text-xs sm:text-sm md:inline">Picture</span></button>
		</>
	);

	const applyColor = (c: string) => {
		setColor(c);
		if (sel && "color" in sel) commit((ms) => ms.map((m) => (m.id === sel.id && "color" in m ? { ...m, color: c } : m)));
	};
	const activeKind = sel?.kind ?? (tool === "highlight" ? "highlight" : tool === "pen" ? "pen" : tool === "text" ? "text" : null);
	const palette = activeKind === "highlight" ? Object.values(COLORS) : INK;
	const shownColor = sel && "color" in sel ? sel.color : color;
	const textSize = sel?.kind === "text" ? sel.size : 14;
	const penWidth = sel?.kind === "pen" ? sel.width : thickness;

	const contextual = activeKind && activeKind !== "sign" && activeKind !== "pin" ? (
		<div className="flex shrink-0 items-center gap-2">
			<div className="flex shrink-0 items-center gap-1.5">
				{palette.map((c) => (
					<button key={c} aria-label={`Colour ${c}`} aria-pressed={shownColor === c} onClick={() => applyColor(c)} className={cn("h-6 w-6 rounded-full ring-offset-1", shownColor === c && "ring-2 ring-sauti-teal")} style={{ background: c }} />
				))}
			</div>
			{activeKind === "text" && (
				<div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-black/10 bg-white px-0.5">
					<button aria-label="Smaller text" className="flex h-7 w-7 items-center justify-center rounded hover:bg-black/5" onClick={() => sel?.kind === "text" && commit((ms) => ms.map((m) => (m.id === sel.id && m.kind === "text" ? { ...m, size: Math.max(6, m.size - 2) } : m)))}><Minus className="h-3.5 w-3.5" /></button>
					<span className="w-7 text-center text-xs tabular-nums">{textSize}</span>
					<button aria-label="Larger text" className="flex h-7 w-7 items-center justify-center rounded hover:bg-black/5" onClick={() => sel?.kind === "text" && commit((ms) => ms.map((m) => (m.id === sel.id && m.kind === "text" ? { ...m, size: Math.min(96, m.size + 2) } : m)))}><Plus className="h-3.5 w-3.5" /></button>
					<button aria-label="Bold" aria-pressed={sel?.kind === "text" && !!sel.bold} className={cn("flex h-7 w-7 items-center justify-center rounded hover:bg-black/5", sel?.kind === "text" && sel.bold && "bg-sauti-teal-light")} onClick={() => sel?.kind === "text" && commit((ms) => ms.map((m) => (m.id === sel.id && m.kind === "text" ? { ...m, bold: !m.bold } : m)))}><Bold className="h-3.5 w-3.5" /></button>
				</div>
			)}
			{activeKind === "pen" && (
				<label className="flex shrink-0 items-center gap-1.5 text-xs text-[#787774]">Thickness
					<input type="range" min={1} max={12} value={penWidth} className="w-20 accent-[#068297]"
						onPointerDown={() => sel?.kind === "pen" && record()}
						onChange={(e) => { const v = Number(e.target.value); setThickness(v); if (sel?.kind === "pen") live((ms) => ms.map((m) => (m.id === sel.id && m.kind === "pen" ? { ...m, width: v } : m))); }} />
				</label>
			)}
		</div>
	) : null;

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#f4f4f2]">
			<div className="shrink-0 border-b border-black/[0.07] bg-white">
				<div className="flex items-center gap-1 px-2 py-1.5 sm:px-3">
					<Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Back to Files"><Link href="/dashboard/mjengo/vault"><ArrowLeft className="h-[18px] w-[18px]" /></Link></Button>
					<span className="min-w-0 flex-1 truncate px-1 text-[15px] font-medium text-[#37352f] sm:max-w-[240px] sm:flex-none">{name}</span>
					<span className="mx-1 hidden h-5 w-px bg-black/10 sm:block" />
					<div className="hidden items-center gap-1 sm:flex">{toolButtons}</div>
					<span className="hidden flex-1 sm:block" />
					<Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!past.current.length} onClick={undo}><Undo2 className="h-[18px] w-[18px]" /></Button>
					<Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!future.current.length} onClick={redo}><Redo2 className="h-[18px] w-[18px]" /></Button>
					<Button variant="ghost" size="icon" className="hidden h-9 w-9 shrink-0 sm:inline-flex" aria-label="Duplicate the selected mark" title="Duplicate (Ctrl+D)" disabled={!selected} onClick={duplicate}><Copy className="h-[18px] w-[18px]" /></Button>
					<Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Delete the selected mark" title="Delete" disabled={!selected} onClick={remove}><Trash2 className="h-[18px] w-[18px]" /></Button>
					<select value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" className="hidden h-9 rounded-lg border border-black/10 bg-white px-2 text-sm sm:block">
						{[0.5, 0.75, 1, 1.25, 1.5, 2].map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
					</select>
					{fileId && <Button variant={commentsOpen ? "secondary" : "ghost"} size="sm" className="h-9 shrink-0 gap-1.5" aria-pressed={commentsOpen} aria-label="Comments" title="Comments: click on the page to leave one" onClick={() => { setCommentsOpen((v) => !v); setPendingSpot(null); }}><MessageSquarePlus className="h-4 w-4" /><span className="hidden sm:inline">Comments{cm.comments.filter((c) => !c.parentId && !c.resolved).length > 0 ? ` (${cm.comments.filter((c) => !c.parentId && !c.resolved).length})` : ""}</span></Button>}
					{fileId && level !== "view" && <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5" onClick={() => setShareOpen(true)} aria-label="Share"><Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span></Button>}
					<Button variant="ghost" size="sm" className="h-9 shrink-0 gap-1.5" aria-label="Download" onClick={download} disabled={loading}><Download className="h-4 w-4" /><span className="hidden sm:inline">Download</span></Button>
					<Button size="sm" className="h-9 shrink-0 gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={save} disabled={loading || saving || (!marks.length && level === "edit")}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
				</div>
				{/* On a phone the tools get their own scrolling row, like a mobile document app. */}
				<div className="flex items-center gap-1 overflow-x-auto border-t border-black/[0.05] px-2 py-1 scrollbar-hide sm:hidden">
					{toolButtons}
					{contextual}
					<select value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" className="ml-auto h-9 shrink-0 rounded-lg border border-black/10 bg-white px-2 text-sm">
						{[0.5, 0.75, 1, 1.25, 1.5, 2].map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
					</select>
				</div>
				{contextual && <div className="hidden items-center gap-1 px-3 pb-1.5 sm:flex">{contextual}</div>}
			</div>
			<input ref={picture} type="file" accept="image/*" className="hidden" onChange={(e) => placePicture(e.target.files?.[0])} />

			<div ref={scroller} className="min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto overscroll-contain p-2 sm:p-4" style={{ WebkitOverflowScrolling: "touch" }}>
				{loading ? <MjengoLoader label="Opening the PDF" /> : (
					<div className="mx-auto flex w-fit flex-col gap-4">
						{pages.map((p, i) => (
							<div key={i} className="relative">
							<PageView
								index={i}
								size={p}
								zoom={zoom}
								canvasRef={(el) => { canvases.current[i] = el; }}
								marks={marks.filter((m) => m.page === i)}
								tool={tool}
								color={color}
								thickness={thickness}
								selected={selected}
								onSelect={setSelected}
								onAdd={(m) => { add(m); if (m.kind === "text" || m.kind === "pin") { setSelected(m.id); setTool("select"); } }}
								onBegin={record}
								onLive={(id, patch) => live((ms) => ms.map((x) => (x.id === id ? ({ ...x, ...patch } as Mark) : x)))}
								onEdit={(id, patch) => commit((ms) => ms.map((x) => (x.id === id ? ({ ...x, ...patch } as Mark) : x)))}
								onDelete={(id) => { commit((ms) => ms.filter((x) => x.id !== id)); setSelected(null); }}
								signature={signature}
								onNeedSignature={() => setSigning(true)}
							/>
							<CommentPins page={i} api={cm} active={activeComment} commenting={commentsOpen} pending={pendingSpot} onPick={(id) => { setActiveComment(id); setCommentsOpen(true); setPendingSpot(null); }} onSpot={(sp) => { setPendingSpot(sp); setActiveComment(null); }} />
							</div>
						))}
					</div>
				)}
			</div>

			{commentsOpen && fileId && <CommentsPanel api={cm} active={activeComment} onPick={setActiveComment} pending={pendingSpot} onCancelPending={() => setPendingSpot(null)} onClose={() => { setCommentsOpen(false); setPendingSpot(null); }} canResolve />}
			<ShareDialog item={shareOpen && fileId ? ({ type: "file", id: fileId, name } as never) : null} onClose={() => setShareOpen(false)} />
			<SignatureDialog open={signing} onClose={() => setSigning(false)} onDone={(url) => { setSignature(url); setSigning(false); setTool("sign"); }} library={library} onLibraryChanged={loadLibrary} />
		</div>
	);
}

type Drag = { id: string; sx: number; sy: number; orig: Mark; mode: "move" | "resize"; handle?: "nw" | "ne" | "sw" | "se"; moved: boolean; wasSelected: boolean };

function PageView({ index, size, zoom, canvasRef, marks, tool, color, thickness, selected, onSelect, onAdd, onBegin, onLive, onEdit, onDelete, signature, onNeedSignature }: {
	index: number; size: { w: number; h: number }; zoom: number; canvasRef: (el: HTMLCanvasElement | null) => void;
	marks: Mark[]; tool: Tool; color: string; thickness: number; selected: string | null; onSelect: (id: string | null) => void; onAdd: (m: Mark) => void;
	onBegin: () => void; onLive: (id: string, patch: Partial<Mark>) => void; onEdit: (id: string, patch: Partial<Mark>) => void; onDelete: (id: string) => void;
	signature: string | null; onNeedSignature: () => void;
}) {
	const W = size.w * zoom;
	const H = size.h * zoom;
	const box = useRef<HTMLDivElement>(null);
	const layer = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
	const [stroke, setStroke] = useState<[number, number][] | null>(null);
	/** Typing a new text or note (no id), or changing one that is already there (id). */
	const [typing, setTyping] = useState<{ id?: string; kind: "text" | "pin"; x: number; y: number; text: string } | null>(null);
	const start = useRef<{ x: number; y: number } | null>(null);
	// The newest highlight box and pen stroke, so a quick release never commits a stale render's value.
	const liveDraft = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
	const liveStroke = useRef<[number, number][] | null>(null);
	const drag = useRef<Drag | null>(null);
	const typingInput = useRef<HTMLTextAreaElement>(null);
	// Focus after the click has finished, otherwise the browser takes the focus back and the box closes at once.
	useEffect(() => {
		if (!typing) return;
		const t = setTimeout(() => { typingInput.current?.focus(); typingInput.current?.select(); }, 30);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [typing === null]);

	const pos = (e: React.PointerEvent): [number, number] => {
		const r = box.current!.getBoundingClientRect();
		return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
	};

	const down = (e: React.PointerEvent) => {
		if ((e.target as HTMLElement).closest("[data-mark], [data-typing]")) return;
		const [x, y] = pos(e);
		onSelect(null);
		if (tool === "highlight") { start.current = { x, y }; liveDraft.current = { x, y, w: 0, h: 0 }; setDraft(liveDraft.current); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
		else if (tool === "pen") { liveStroke.current = [[x, y]]; setStroke(liveStroke.current); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
		else if (tool === "text") { e.preventDefault(); setTyping({ kind: "text", x, y, text: "" }); }
		else if (tool === "pin") { e.preventDefault(); setTyping({ kind: "pin", x, y, text: "" }); }
		else if (tool === "sign") {
			if (!signature) return onNeedSignature();
			const w = 0.28;
			const h = w * 0.4 * (size.w / size.h);
			onAdd({ id: uid(), page: index, kind: "sign", x: Math.min(x, 1 - w), y: Math.min(y, 1 - h), w, h, dataUrl: signature });
		}
	};

	const beginDrag = (e: React.PointerEvent, m: Mark, mode: Drag["mode"], handle?: Drag["handle"]) => {
		e.stopPropagation();
		const [sx, sy] = pos(e);
		drag.current = { id: m.id, sx, sy, orig: m, mode, handle, moved: false, wasSelected: selected === m.id };
		onSelect(m.id);
		layer.current?.setPointerCapture(e.pointerId);
	};

	const move = (e: React.PointerEvent) => {
		const [x, y] = pos(e);
		const d = drag.current;
		if (d) {
			const dx = x - d.sx, dy = y - d.sy;
			if (!d.moved) {
				if (Math.abs(dx) + Math.abs(dy) < 0.003) return;
				d.moved = true;
				onBegin();
			}
			const o = d.orig;
			if (d.mode === "move") {
				const b = bounds(o);
				const mx = clamp(dx, -b.x, 1 - b.x - b.w), my = clamp(dy, -b.y, 1 - b.y - b.h);
				if (o.kind === "pen") onLive(o.id, { points: o.points.map(([px, py]) => [px + mx, py + my] as [number, number]) });
				else onLive(o.id, { x: (o as { x: number }).x + mx, y: (o as { y: number }).y + my } as Partial<Mark>);
			} else if (o.kind === "highlight") {
				let nx = o.x, ny = o.y, nw = o.w, nh = o.h;
				if (d.handle?.includes("e")) nw = Math.max(0.01, o.w + dx);
				if (d.handle?.includes("w")) { nx = clamp(o.x + dx, 0, o.x + o.w - 0.01); nw = o.x + o.w - nx; }
				if (d.handle?.includes("s")) nh = Math.max(0.005, o.h + dy);
				if (d.handle?.includes("n")) { ny = clamp(o.y + dy, 0, o.y + o.h - 0.005); nh = o.y + o.h - ny; }
				onLive(o.id, { x: nx, y: ny, w: Math.min(nw, 1 - nx), h: Math.min(nh, 1 - ny) });
			} else if (o.kind === "sign") {
				const sign = d.handle?.includes("w") ? -1 : 1;
				const f = Math.max(0.15, (o.w + dx * sign) / o.w);
				const nw = Math.min(1, o.w * f), nh = Math.min(1, o.h * f);
				const nx = d.handle?.includes("w") ? o.x + o.w - nw : o.x;
				const ny = d.handle?.includes("n") ? o.y + o.h - nh : o.y;
				onLive(o.id, { x: clamp(nx, 0, 1 - nw), y: clamp(ny, 0, 1 - nh), w: nw, h: nh });
			} else if (o.kind === "text") {
				onLive(o.id, { size: clamp(Math.round(o.size + (dx * size.w) / 5), 6, 96) });
			}
			return;
		}
		if (liveDraft.current && start.current) { liveDraft.current = { x: Math.min(x, start.current.x), y: Math.min(y, start.current.y), w: Math.abs(x - start.current.x), h: Math.abs(y - start.current.y) }; setDraft(liveDraft.current); }
		else if (liveStroke.current) { liveStroke.current = [...liveStroke.current, [x, y]]; setStroke(liveStroke.current); }
	};

	const up = () => {
		const d = drag.current;
		if (d) {
			drag.current = null;
			// A tap on a text or note that was already selected changes it, like tapping text in the design editor.
			if (!d.moved && d.wasSelected && (d.orig.kind === "text" || d.orig.kind === "pin")) {
				setTyping({ id: d.orig.id, kind: d.orig.kind, x: d.orig.x, y: d.orig.y, text: d.orig.text });
			}
			return;
		}
		const d2 = liveDraft.current, st = liveStroke.current;
		if (d2 && d2.w > 0.004 && d2.h > 0.003) onAdd({ id: uid(), page: index, kind: "highlight", color, ...d2 });
		if (st && st.length > 1) onAdd({ id: uid(), page: index, kind: "pen", points: st, color, width: thickness });
		liveDraft.current = null; liveStroke.current = null;
		setDraft(null); setStroke(null); start.current = null;
	};

	const commitTyping = () => {
		const t = typing;
		setTyping(null);
		if (!t) return;
		const text = t.text.replace(/\s+$/, "");
		if (t.id) {
			if (text.trim()) onEdit(t.id, { text } as Partial<Mark>);
			else onDelete(t.id);
		} else if (text.trim()) {
			onAdd(t.kind === "text" ? { id: uid(), page: index, kind: "text", x: t.x, y: t.y, text, size: 14, color: INK.includes(color) ? color : INK[0] } : { id: uid(), page: index, kind: "pin", x: t.x, y: t.y, text });
		}
	};

	const cursor = tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";
	const touchNone = tool === "highlight" || tool === "pen" || drag.current !== null;
	const handles = (m: Mark) => {
		if (m.kind !== "highlight" && m.kind !== "sign" && m.kind !== "text") return null;
		const corners: Drag["handle"][] = m.kind === "text" ? ["se"] : ["nw", "ne", "sw", "se"];
		return corners.map((h) => (
			<span key={h} data-mark onPointerDown={(e) => beginDrag(e, m, "resize", h)} aria-hidden
				className="absolute z-10 h-3.5 w-3.5 touch-none rounded-sm border-2 border-sauti-teal bg-white"
				style={{ [h!.includes("n") ? "top" : "bottom"]: -7, [h!.includes("w") ? "left" : "right"]: -7, cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize" }} />
		));
	};

	return (
		<div ref={box} data-page={index} className="relative bg-white shadow-md" style={{ width: W, height: H }}>
			<canvas ref={canvasRef} style={{ width: W, height: H }} className="absolute inset-0" />
			<div ref={layer} className={cn("absolute inset-0", touchNone ? "touch-none" : "touch-pan-x touch-pan-y")} style={{ cursor }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
				{marks.map((m) => {
					const isSel = selected === m.id;
					const ring = isSel ? "outline outline-2 outline-offset-2 outline-sauti-teal" : "hover:outline hover:outline-1 hover:outline-offset-2 hover:outline-sauti-teal/50";
					const common = { "data-mark": true, onPointerDown: (e: React.PointerEvent) => beginDrag(e, m, "move"), onDoubleClick: () => (m.kind === "text" || m.kind === "pin") && setTyping({ id: m.id, kind: m.kind, x: m.x, y: m.y, text: m.text }) };
					if (m.kind === "highlight") return <div key={m.id} {...common} className={cn("absolute touch-none", ring)} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%`, background: m.color + "66", cursor: "move" }}>{isSel && handles(m)}</div>;
					if (m.kind === "text") {
						if (typing?.id === m.id) return null;
						return <div key={m.id} {...common} className={cn("absolute touch-none select-none whitespace-pre font-sans leading-[1.2]", ring)} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, fontSize: m.size * zoom, color: m.color, fontWeight: m.bold ? 700 : 400, cursor: "move" }}>{m.text}{isSel && handles(m)}</div>;
					}
					if (m.kind === "sign") return <div key={m.id} {...common} className={cn("absolute touch-none", ring)} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%`, cursor: "move" }}><img src={m.dataUrl} alt="Signature or picture" draggable={false} className="h-full w-full select-none" />{isSel && handles(m)}</div>;
					if (m.kind === "pin") {
						if (typing?.id === m.id) return null;
						return (
							<div key={m.id} {...common} className="absolute touch-none" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, cursor: "move" }}>
								<span className={cn("flex h-6 w-6 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none border border-amber-600 bg-amber-300 text-amber-950 shadow", isSel && "ring-2 ring-sauti-teal ring-offset-1")}><MapPin className="h-3.5 w-3.5" /></span>
								{isSel && <span className="absolute left-3 top-1 z-10 w-48 whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950 shadow-lg">{m.text}<span className="mt-1 block text-[10px] text-amber-700">Tap again to edit</span></span>}
							</div>
						);
					}
					return null;
				})}
				<svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
					{marks.filter((m): m is Extract<Mark, { kind: "pen" }> => m.kind === "pen").map((m) => (
						<polyline key={m.id} points={m.points.map((p) => p.join(",")).join(" ")} fill="none" stroke={m.color} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: m.width * Math.max(0.6, zoom) }} />
					))}
					{stroke && <polyline points={stroke.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: thickness * Math.max(0.6, zoom) }} />}
				</svg>
				{/* Pens are picked up from a transparent box over the stroke, so they can be moved too. */}
				{marks.filter((m): m is Extract<Mark, { kind: "pen" }> => m.kind === "pen").map((m) => {
					const b = bounds(m);
					const isSel = selected === m.id;
					return <div key={`${m.id}-hit`} data-mark onPointerDown={(e) => beginDrag(e, m, "move")} className={cn("absolute touch-none", isSel ? "outline outline-2 outline-offset-4 outline-sauti-teal" : "hover:outline hover:outline-1 hover:outline-offset-4 hover:outline-sauti-teal/50")} style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${Math.max(b.w, 0.01) * 100}%`, height: `${Math.max(b.h, 0.01) * 100}%`, cursor: "move" }} />;
				})}
				{draft && <div className="absolute" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%`, background: color, opacity: 0.4 }} />}
				{typing && (
					<textarea
						data-typing
						ref={typingInput}
						onPointerDown={(e) => e.stopPropagation()}
						value={typing.text}
						onChange={(e) => setTyping({ ...typing, text: e.target.value })}
						onBlur={commitTyping}
						onKeyDown={(e) => {
							if ((e.key === "Enter" && !e.shiftKey && typing.kind === "text") || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); commitTyping(); }
							if (e.key === "Escape") { e.preventDefault(); setTyping(null); }
						}}
						rows={Math.max(1, typing.text.split("\n").length)}
						placeholder={typing.kind === "pin" ? "Write a note" : "Type here"}
						className={cn("absolute z-20 resize-none rounded border border-sauti-teal bg-white/95 px-1 leading-[1.2] shadow outline-none", typing.kind === "pin" ? "min-w-[180px] bg-amber-50" : "min-w-[120px]")}
						style={{ left: `${typing.x * 100}%`, top: `${typing.y * 100}%`, fontSize: typing.kind === "pin" ? 13 : (marks.find((m) => m.id === typing.id && m.kind === "text") as Extract<Mark, { kind: "text" }> | undefined)?.size ? (marks.find((m) => m.id === typing.id) as Extract<Mark, { kind: "text" }>).size * zoom : 14 * zoom, color: typing.kind === "text" ? ((marks.find((m) => m.id === typing.id) as Extract<Mark, { kind: "text" }> | undefined)?.color ?? (INK.includes(color) ? color : INK[0])) : undefined }}
						aria-label={typing.kind === "pin" ? "Note text" : "Text to place"}
					/>
				)}
			</div>
		</div>
	);
}

/**
 * Choose, draw, type or photograph a signature. Signatures you add are kept for you, so next time you pick
 * one from the list. Returns a transparent PNG.
 */
function SignatureDialog({ open, onClose, onDone, library, onLibraryChanged }: { open: boolean; onClose: () => void; onDone: (dataUrl: string) => void; library: SignatureRow[]; onLibraryChanged: () => void }) {
	const { toast } = useToast();
	const [mode, setMode] = useState<"saved" | "draw" | "type" | "photo">("draw");
	const [typed, setTyped] = useState("");
	const [keep, setKeep] = useState(true);
	const [label, setLabel] = useState("");
	const pad = useRef<HTMLCanvasElement>(null);
	const drawing = useRef(false);
	const last = useRef<{ x: number; y: number } | null>(null);
	const [empty, setEmpty] = useState(true);
	const [photo, setPhoto] = useState<string | null>(null);
	const [cutoff, setCutoff] = useState(200);
	const photoCanvas = useRef<HTMLCanvasElement>(null);
	const photoImg = useRef<HTMLImageElement | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!open) return;
		setMode(library.length ? "saved" : "draw");
		setEmpty(true); setTyped(""); setPhoto(null); setLabel(""); setKeep(true);
	}, [open, library.length]);
	useEffect(() => {
		if (mode === "draw") { setEmpty(true); const c = pad.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); }
	}, [mode]);

	// A photo of a signature on white paper: the paper is made transparent and the picture is trimmed to the ink.
	const renderPhoto = useCallback(() => {
		const img = photoImg.current;
		const c = photoCanvas.current;
		if (!img || !c) return;
		const k = Math.min(1, 700 / img.width);
		c.width = Math.max(1, Math.round(img.width * k));
		c.height = Math.max(1, Math.round(img.height * k));
		const ctx = c.getContext("2d", { willReadFrequently: true })!;
		ctx.drawImage(img, 0, 0, c.width, c.height);
		const d = ctx.getImageData(0, 0, c.width, c.height);
		let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
		for (let y = 0; y < c.height; y++) {
			for (let x = 0; x < c.width; x++) {
				const i = (y * c.width + x) * 4;
				const lum = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
				if (lum > cutoff) d.data[i + 3] = 0;
				else {
					d.data[i + 3] = Math.min(255, (cutoff - lum) * 4);
					if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
				}
			}
		}
		ctx.putImageData(d, 0, 0);
		if (maxX > minX && maxY > minY) {
			const w = maxX - minX + 1, h = maxY - minY + 1;
			const crop = ctx.getImageData(minX, minY, w, h);
			c.width = w; c.height = h;
			ctx.putImageData(crop, 0, 0);
		}
	}, [cutoff]);
	useEffect(() => { if (photo) renderPhoto(); }, [photo, cutoff, renderPhoto, mode]);

	const point = (e: React.PointerEvent) => {
		const c = pad.current!;
		const r = c.getBoundingClientRect();
		return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
	};

	const result = (): string | null => {
		const out = document.createElement("canvas");
		out.width = 600; out.height = 240;
		const ctx = out.getContext("2d")!;
		if (mode === "draw") ctx.drawImage(pad.current!, 0, 0, 600, 240);
		else if (mode === "type") { ctx.fillStyle = "#111827"; ctx.font = "italic 96px 'Segoe Script', 'Brush Script MT', cursive"; ctx.textBaseline = "middle"; ctx.fillText(typed, 20, 120, 560); }
		else if (mode === "photo" && photoCanvas.current) {
			const src = photoCanvas.current;
			const k = Math.min(560 / src.width, 200 / src.height);
			const w = src.width * k, h = src.height * k;
			ctx.drawImage(src, (600 - w) / 2, (240 - h) / 2, w, h);
		} else return null;
		return out.toDataURL("image/png");
	};

	const done = async () => {
		const url = result();
		if (!url) return;
		if (keep) {
			setBusy(true);
			try { await unwrap(saveSignatureImage(label || (mode === "type" ? typed : "Signature"), url)); onLibraryChanged(); } catch (e) { toast({ title: "Used, but not saved for later", description: e instanceof Error ? e.message : undefined }); } finally { setBusy(false); }
		}
		onDone(url);
	};

	const ready = mode === "draw" ? !empty : mode === "type" ? !!typed.trim() : mode === "photo" ? !!photo : false;
	const tabs: [typeof mode, string][] = [["saved", `Yours (${library.length})`], ["draw", "Draw"], ["type", "Type"], ["photo", "From a photo"]];

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader><DialogTitle>Signature</DialogTitle><DialogDescription>Pick one you added before, or add a new one. Then click on the page to place it.</DialogDescription></DialogHeader>
				<div className="inline-flex w-fit flex-wrap rounded-lg border border-serene-neutral-200 p-0.5">
					{tabs.map(([m, l]) => <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={cn("rounded-md px-3 py-1 text-sm font-medium", mode === m ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}>{l}</button>)}
				</div>

				{mode === "saved" && (
					library.length === 0 ? <p className="py-6 text-center text-sm text-serene-neutral-500">No signatures yet. Draw one, type one or add a photo.</p> : (
						<ul className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
							{library.map((s) => (
								<li key={s.id} className="group relative rounded-xl border border-serene-neutral-200 bg-white p-2">
									<button onClick={() => onDone(s.data_url)} className="block w-full"><img src={s.data_url} alt={s.name} className="h-16 w-full object-contain" /><span className="mt-1 block truncate text-xs text-serene-neutral-600">{s.name}</span></button>
									<button aria-label={`Delete ${s.name}`} onClick={async () => { await unwrap(deleteSignature(s.id)).catch(() => undefined); onLibraryChanged(); }} className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-md bg-white text-red-600 shadow group-hover:flex"><Trash2 className="h-3.5 w-3.5" /></button>
								</li>
							))}
						</ul>
					)
				)}

				{mode === "draw" && (
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
				)}

				{mode === "type" && (
					<div className="space-y-2">
						<Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your name" autoFocus />
						<p className="rounded-xl border border-dashed border-serene-neutral-300 p-4 text-3xl italic" style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}>{typed || "Your name"}</p>
					</div>
				)}

				{mode === "photo" && (
					<div className="space-y-3">
						<label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-serene-neutral-300 p-4 text-sm text-serene-neutral-600 hover:border-sauti-teal/60">
							<ImageIcon className="h-4 w-4" /> {photo ? "Choose another photo" : "Choose a photo of your signature on white paper"}
							<input type="file" accept="image/*" className="hidden" onChange={(e) => {
								const f = e.target.files?.[0];
								if (!f) return;
								const r = new FileReader();
								r.onload = () => { const img = new Image(); img.onload = () => { photoImg.current = img; setPhoto(String(r.result)); }; img.src = String(r.result); };
								r.readAsDataURL(f);
							}} />
						</label>
						{photo && (
							<>
								<div className="flex h-32 items-center justify-center rounded-xl border border-serene-neutral-200 p-2" style={{ backgroundImage: "linear-gradient(45deg,#f1f5f9 25%,transparent 25%),linear-gradient(-45deg,#f1f5f9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f1f5f9 75%),linear-gradient(-45deg,transparent 75%,#f1f5f9 75%)", backgroundSize: "16px 16px" }}>
									<canvas ref={photoCanvas} className="max-h-full max-w-full object-contain" />
								</div>
								<label className="flex items-center gap-3 text-xs text-serene-neutral-600">Remove the paper<input type="range" min={120} max={245} value={cutoff} onChange={(e) => setCutoff(Number(e.target.value))} className="flex-1 accent-[#068297]" /></label>
							</>
						)}
					</div>
				)}

				{mode !== "saved" && (
					<div className="flex flex-wrap items-center gap-3">
						<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="h-4 w-4 accent-[#068297]" /> Keep it for next time</label>
						{keep && <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name (optional)" className="h-8 w-44" />}
					</div>
				)}

				<DialogFooter>
					{mode === "draw" && <Button variant="ghost" onClick={() => { setEmpty(true); const c = pad.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); }}>Clear</Button>}
					{mode !== "saved" && <Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={!ready || busy} onClick={done}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Use this signature</Button>}
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


