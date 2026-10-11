"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, Circle, FabricImage, Line, Rect, Textbox, Triangle, type FabricObject } from "fabric";
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Copy, Download, Image as ImageIcon, Italic, Gift, LayoutTemplate, Loader2, Redo2, Save, Shapes, Trash2, Type, Undo2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { putToSignedUrl } from "@/lib/client/upload";
import { deleteTemplate, listTemplates, saveTemplate, studioRegister, studioUpload, type TemplateRow } from "@/app/actions/mjengo-templates";
import { listAssets, type AssetRow } from "@/app/actions/mjengo-ai";
import { PostThis } from "../_components/PostThis";

/* Canva's palette: the editor borrows its look so it feels familiar. */
const CANVA = { teal: "#00C4CC", purple: "#7D2AE8", ink: "#0E1318" };
const PALETTE = ["#0E1318", "#FFFFFF", "#7D2AE8", "#00C4CC", "#FF5757", "#FFDE59", "#5CE1E6", "#FF66C4", "#068297", "#38B6FF", "#8C52FF", "#7ED957"];
const FONTS = ["Inter", "Arial", "Georgia", "Trebuchet MS", "Impact", "Courier New", "Times New Roman"];
const SIZES = [
	{ id: "instagram", label: "Instagram post", w: 1080, h: 1080 },
	{ id: "story", label: "Story", w: 1080, h: 1920 },
	{ id: "linkedin", label: "LinkedIn post", w: 1200, h: 627 },
	{ id: "facebook", label: "Facebook post", w: 1200, h: 630 },
	{ id: "tiktok", label: "TikTok photo", w: 1080, h: 1920 },
	{ id: "x", label: "X post", w: 1600, h: 900 },
	{ id: "poster", label: "A4 poster", w: 1240, h: 1754 },
] as const;

type Panel = "templates" | "text" | "shapes" | "uploads" | "studio" | "market";
type Builder = (c: Canvas, w: number, h: number) => void;

const text = (t: string, o: Partial<ConstructorParameters<typeof Textbox>[1]>) => new Textbox(t, { fontFamily: "Inter", fill: CANVA.ink, ...o });

/** Starting layouts, drawn with the same objects people can edit afterwards. */
const BUILT_IN: { id: string; name: string; build: Builder; swatch: string }[] = [
	{
		id: "quote", name: "Quote card", swatch: CANVA.purple,
		build: (c, w, h) => {
			c.backgroundColor = CANVA.purple;
			c.add(text("“", { left: w * 0.08, top: h * 0.08, fontSize: h * 0.22, fill: "#FFFFFF", fontWeight: "bold", width: w * 0.3 }));
			c.add(text("Write the words that matter here.", { left: w * 0.08, top: h * 0.3, width: w * 0.84, fontSize: h * 0.075, fill: "#FFFFFF", fontWeight: "bold", lineHeight: 1.15 }));
			c.add(text("Name, role", { left: w * 0.08, top: h * 0.78, width: w * 0.6, fontSize: h * 0.034, fill: "#EADCFF" }));
		},
	},
	{
		id: "announce", name: "Announcement", swatch: CANVA.teal,
		build: (c, w, h) => {
			c.backgroundColor = "#FFFFFF";
			c.add(new Rect({ left: 0, top: 0, width: w, height: h * 0.34, fill: CANVA.teal }));
			c.add(text("NEWS", { left: w * 0.08, top: h * 0.1, width: w * 0.6, fontSize: h * 0.07, fill: "#FFFFFF", fontWeight: "bold", charSpacing: 200 }));
			c.add(text("Your headline goes here", { left: w * 0.08, top: h * 0.42, width: w * 0.84, fontSize: h * 0.085, fontWeight: "bold" }));
			c.add(text("One or two lines to explain it, who it is for and when.", { left: w * 0.08, top: h * 0.66, width: w * 0.84, fontSize: h * 0.04, fill: "#4B5563" }));
		},
	},
	{
		id: "stat", name: "Big number", swatch: "#FFDE59",
		build: (c, w, h) => {
			c.backgroundColor = "#FFDE59";
			c.add(text("1,240", { left: w * 0.08, top: h * 0.2, width: w * 0.84, fontSize: h * 0.26, fontWeight: "bold" }));
			c.add(text("people reached this year", { left: w * 0.08, top: h * 0.62, width: w * 0.84, fontSize: h * 0.06, fontWeight: "bold" }));
			c.add(text("Sauti Salama", { left: w * 0.08, top: h * 0.88, width: w * 0.6, fontSize: h * 0.035 }));
		},
	},
	{
		id: "event", name: "Event", swatch: CANVA.ink,
		build: (c, w, h) => {
			c.backgroundColor = CANVA.ink;
			c.add(new Circle({ left: w * 0.62, top: -h * 0.12, radius: w * 0.32, fill: CANVA.purple }));
			c.add(text("YOU ARE INVITED", { left: w * 0.08, top: h * 0.12, width: w * 0.7, fontSize: h * 0.035, fill: CANVA.teal, charSpacing: 250, fontWeight: "bold" }));
			c.add(text("Event name", { left: w * 0.08, top: h * 0.35, width: w * 0.84, fontSize: h * 0.11, fill: "#FFFFFF", fontWeight: "bold" }));
			c.add(text("Date  |  Time  |  Place", { left: w * 0.08, top: h * 0.7, width: w * 0.84, fontSize: h * 0.04, fill: "#D1D5DB" }));
		},
	},
	{
		id: "plain", name: "Plain white", swatch: "#FFFFFF",
		build: (c) => { c.backgroundColor = "#FFFFFF"; },
	},
];

export default function DesignPage() {
	const { toast } = useToast();
	const host = useRef<HTMLDivElement>(null);
	const el = useRef<HTMLCanvasElement>(null);
	const canvas = useRef<Canvas | null>(null);
	const history = useRef<{ stack: string[]; at: number; lock: boolean }>({ stack: [], at: -1, lock: false });
	const fileInput = useRef<HTMLInputElement>(null);

	const [size, setSize] = useState<(typeof SIZES)[number]>(() => {
		if (typeof window === "undefined") return SIZES[0];
		const want = new URLSearchParams(window.location.search).get("size");
		return SIZES.find((x) => x.id === want) ?? SIZES[0];
	});
	const [panel, setPanel] = useState<Panel | null>("templates");
	const [scale, setScale] = useState(0.5);
	const [selected, setSelected] = useState<FabricObject | null>(null);
	const [, bump] = useState(0);
	const [mine, setMine] = useState<TemplateRow[]>([]);
	const [assets, setAssets] = useState<AssetRow[]>([]);
	const [name, setName] = useState("Untitled design");
	const [busy, setBusy] = useState<"save" | "template" | null>(null);
	const [postFor, setPostFor] = useState<string | null>(null);

	/* ------------------------------------------------------------ history */
	const snapshot = useCallback(() => {
		const c = canvas.current;
		const h = history.current;
		if (!c || h.lock) return;
		h.stack = h.stack.slice(0, h.at + 1);
		h.stack.push(JSON.stringify(c.toJSON()));
		if (h.stack.length > 40) h.stack.shift();
		h.at = h.stack.length - 1;
		bump((n) => n + 1);
	}, []);
	const restore = async (i: number) => {
		const c = canvas.current;
		const h = history.current;
		if (!c || i < 0 || i >= h.stack.length) return;
		h.lock = true;
		await c.loadFromJSON(h.stack[i]);
		c.renderAll();
		h.at = i;
		h.lock = false;
		setSelected(null);
		bump((n) => n + 1);
	};

	/* ------------------------------------------------------------ canvas */
	const fit = useCallback(() => {
		const c = canvas.current;
		const box = host.current;
		if (!c || !box) return;
		const s = Math.min((box.clientWidth - 48) / size.w, (box.clientHeight - 48) / size.h, 1);
		c.setDimensions({ width: size.w * s, height: size.h * s });
		c.setZoom(s);
		c.renderAll();
		setScale(s);
	}, [size]);

	useEffect(() => {
		if (!el.current) return;
		const c = new Canvas(el.current, { width: size.w * 0.5, height: size.h * 0.5, backgroundColor: "#FFFFFF", preserveObjectStacking: true });
		canvas.current = c;
		const onSel = () => setSelected(c.getActiveObject() ?? null);
		c.on("selection:created", onSel);
		c.on("selection:updated", onSel);
		c.on("selection:cleared", () => setSelected(null));
		c.on("object:modified", () => { snapshot(); bump((n) => n + 1); });
		c.on("object:added", () => snapshot());
		c.on("object:removed", () => snapshot());
		BUILT_IN[0].build(c, size.w, size.h);
		fit();
		snapshot();
		const ro = new ResizeObserver(() => fit());
		if (host.current) ro.observe(host.current);
		return () => { ro.disconnect(); c.dispose(); canvas.current = null; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	useEffect(() => { fit(); }, [fit]);

	useEffect(() => {
		unwrap(listTemplates("design")).then(setMine).catch(() => setMine([]));
		unwrap(listAssets()).then(setAssets).catch(() => setAssets([]));
	}, []);

	// Keyboard: delete, undo, redo.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
			const c = canvas.current;
			const active = c?.getActiveObject() as (FabricObject & { isEditing?: boolean }) | undefined;
			if ((e.key === "Delete" || e.key === "Backspace") && active && !active.isEditing) { c?.remove(active); c?.discardActiveObject(); c?.renderAll(); }
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); restore(history.current.at + (e.shiftKey ? 1 : -1)); }
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/* ------------------------------------------------------------ actions */
	const changeSize = (s: (typeof SIZES)[number]) => {
		const c = canvas.current;
		if (!c) return;
		// Keep what is there, scaled to the new shape.
		const kx = s.w / size.w;
		const ky = s.h / size.h;
		const k = Math.min(kx, ky);
		c.getObjects().forEach((o) => { o.set({ left: (o.left ?? 0) * kx, top: (o.top ?? 0) * ky, scaleX: (o.scaleX ?? 1) * k, scaleY: (o.scaleY ?? 1) * k }); o.setCoords(); });
		setSize(s);
		snapshot();
	};

	const applyBuilt = (b: (typeof BUILT_IN)[number]) => {
		const c = canvas.current;
		if (!c) return;
		history.current.lock = true;
		c.clear();
		b.build(c, size.w, size.h);
		history.current.lock = false;
		c.renderAll();
		snapshot();
	};

	const applyMine = async (t: TemplateRow) => {
		const c = canvas.current;
		const d = t.data as { json?: unknown; w?: number; h?: number };
		if (!c || !d.json) return;
		const match = SIZES.find((s) => s.w === d.w && s.h === d.h);
		if (match) setSize(match);
		history.current.lock = true;
		await c.loadFromJSON(d.json as never);
		history.current.lock = false;
		c.renderAll();
		snapshot();
	};

	const add = (o: FabricObject) => {
		const c = canvas.current;
		if (!c) return;
		c.add(o);
		c.setActiveObject(o);
		c.centerObject(o);
		c.renderAll();
	};
	const addText = (t: string, fontSize: number, bold = false) => add(text(t, { width: size.w * 0.7, fontSize, fontWeight: bold ? "bold" : "normal", left: size.w * 0.15, top: size.h * 0.4 }));
	const addShape = (k: "rect" | "circle" | "triangle" | "line") => {
		const fill = CANVA.purple;
		if (k === "rect") add(new Rect({ width: size.w * 0.3, height: size.w * 0.3, fill, rx: 12, ry: 12 }));
		else if (k === "circle") add(new Circle({ radius: size.w * 0.15, fill: CANVA.teal }));
		else if (k === "triangle") add(new Triangle({ width: size.w * 0.3, height: size.w * 0.26, fill: "#FFDE59" }));
		else add(new Line([0, 0, size.w * 0.4, 0], { stroke: CANVA.ink, strokeWidth: 8 }));
	};
	const addImage = async (url: string) => {
		const c = canvas.current;
		if (!c) return;
		try {
			const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
			const k = Math.min((size.w * 0.7) / (img.width ?? 1), (size.h * 0.7) / (img.height ?? 1), 1);
			img.scale(k);
			add(img);
		} catch {
			toast({ title: "Could not place the image", variant: "destructive" });
		}
	};
	const upload = (files: FileList | null) => {
		const f = files?.[0];
		if (!f || !f.type.startsWith("image/")) return;
		const r = new FileReader();
		r.onload = () => addImage(String(r.result));
		r.readAsDataURL(f);
		if (fileInput.current) fileInput.current.value = "";
	};

	const set = (patch: Record<string, unknown>) => {
		const o = canvas.current?.getActiveObject();
		if (!o) return;
		o.set(patch as never);
		canvas.current?.renderAll();
		snapshot();
		bump((n) => n + 1);
	};
	const dataUrl = () => canvas.current!.toDataURL({ format: "png", multiplier: 1 / scale });

	const download = () => {
		canvas.current?.discardActiveObject();
		canvas.current?.renderAll();
		const a = document.createElement("a");
		a.href = dataUrl();
		a.download = `${name || "design"}.png`;
		a.click();
	};

	const saveToStudio = async () => {
		setBusy("save");
		try {
			canvas.current?.discardActiveObject();
			canvas.current?.renderAll();
			const blob = await (await fetch(dataUrl())).blob();
			const { path, signedUrl } = await unwrap(studioUpload());
			await putToSignedUrl(signedUrl, new File([blob], "design.png", { type: "image/png" }));
			const reg = await unwrap(studioRegister(path, name, null));
			toast({ title: "Saved to Studio" });
			setPostFor(reg.id);
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(null);
		}
	};

	const saveAsTemplate = async () => {
		const n = window.prompt("Name this template", name);
		if (!n?.trim()) return;
		setBusy("template");
		try {
			await unwrap(saveTemplate(null, { kind: "design", name: n, data: { json: canvas.current!.toJSON(), w: size.w, h: size.h } }));
			setMine(await unwrap(listTemplates("design")));
			toast({ title: "Template saved" });
		} catch (e) {
			toast({ title: "Could not save the template", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(null);
		}
	};

	const o = selected as (FabricObject & { fontFamily?: string; fontSize?: number; fontWeight?: string; fontStyle?: string; textAlign?: string }) | null;
	const isText = !!o && "fontFamily" in o;
	const rail: [Panel, string, React.ReactNode][] = [
		["templates", "Templates", <LayoutTemplate key="t" className="h-5 w-5" />],
		["text", "Text", <Type key="x" className="h-5 w-5" />],
		["shapes", "Shapes", <Shapes key="s" className="h-5 w-5" />],
		["uploads", "Uploads", <Upload key="u" className="h-5 w-5" />],
		["studio", "Studio", <ImageIcon key="i" className="h-5 w-5" />],
		["market", "Free", <Gift key="m" className="h-5 w-5" />],
	];
	const canUndo = history.current.at > 0;
	const canRedo = history.current.at < history.current.stack.length - 1;

	return (
		<div className="flex h-[calc(100dvh-3rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white lg:h-[calc(100dvh-2.5rem)]">
			{/* Canva-style header */}
			<div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-white" style={{ background: `linear-gradient(90deg, ${CANVA.teal}, ${CANVA.purple})` }}>
				<Button asChild variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 hover:text-white" aria-label="Back"><Link href="/dashboard/mjengo/content"><ArrowLeft className="h-[18px] w-[18px]" /></Link></Button>
				<Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Design name" className="h-8 w-44 border-transparent bg-white/15 text-sm font-medium text-white placeholder:text-white/70 focus-visible:ring-white/60" />
				<select value={size.id} onChange={(e) => changeSize(SIZES.find((s) => s.id === e.target.value)!)} aria-label="Size" className="h-8 rounded-md border border-white/30 bg-white/15 px-2 text-sm text-white">
					{SIZES.map((s) => <option key={s.id} value={s.id} className="text-black">{s.label}</option>)}
				</select>
				<Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 hover:text-white" aria-label="Undo" disabled={!canUndo} onClick={() => restore(history.current.at - 1)}><Undo2 className="h-[18px] w-[18px]" /></Button>
				<Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 hover:text-white" aria-label="Redo" disabled={!canRedo} onClick={() => restore(history.current.at + 1)}><Redo2 className="h-[18px] w-[18px]" /></Button>
				<span className="flex-1" />
				<Button variant="ghost" size="sm" className="h-8 gap-1.5 text-white hover:bg-white/20 hover:text-white" onClick={saveAsTemplate} disabled={busy !== null}><Copy className="h-4 w-4" /><span className="hidden sm:inline">Save as template</span></Button>
				<Button variant="ghost" size="sm" className="h-8 gap-1.5 text-white hover:bg-white/20 hover:text-white" onClick={download}><Download className="h-4 w-4" /><span className="hidden sm:inline">Download</span></Button>
				<Button size="sm" className="h-8 gap-1.5 bg-white text-[#7D2AE8] hover:bg-white/90" onClick={saveToStudio} disabled={busy !== null}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save to Studio</Button>
			</div>

			{/* Property bar */}
			<div className="flex min-h-11 shrink-0 flex-wrap items-center gap-1.5 border-b border-serene-neutral-100 bg-white px-3 py-1.5">
				{!o ? <span className="text-xs text-serene-neutral-500">Click something on the page to change its colour, font or size. Press Delete to remove it.</span> : (
					<>
						<div className="flex items-center gap-1">
							{PALETTE.map((c) => <button key={c} aria-label={`Colour ${c}`} onClick={() => set(o.type === "line" ? { stroke: c } : { fill: c })} className="h-5 w-5 rounded-full border border-black/10" style={{ background: c }} />)}
							<input type="color" aria-label="Custom colour" onChange={(e) => set(o.type === "line" ? { stroke: e.target.value } : { fill: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-serene-neutral-200 p-0.5" />
						</div>
						{isText && (
							<>
								<span className="mx-1 h-5 w-px bg-black/10" />
								<select value={o.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} aria-label="Font" className="h-8 rounded-md border border-serene-neutral-200 bg-white px-2 text-sm">{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
								<Input type="number" value={Math.round(o.fontSize ?? 40)} onChange={(e) => set({ fontSize: Number(e.target.value) })} aria-label="Size" className="h-8 w-20 text-sm" />
								<button onClick={() => set({ fontWeight: o.fontWeight === "bold" ? "normal" : "bold" })} aria-pressed={o.fontWeight === "bold"} aria-label="Bold" className={cn("flex h-8 w-8 items-center justify-center rounded-md", o.fontWeight === "bold" ? "bg-sauti-teal-light" : "hover:bg-serene-neutral-100")}><Bold className="h-4 w-4" /></button>
								<button onClick={() => set({ fontStyle: o.fontStyle === "italic" ? "normal" : "italic" })} aria-pressed={o.fontStyle === "italic"} aria-label="Italic" className={cn("flex h-8 w-8 items-center justify-center rounded-md", o.fontStyle === "italic" ? "bg-sauti-teal-light" : "hover:bg-serene-neutral-100")}><Italic className="h-4 w-4" /></button>
								{([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => <button key={a} onClick={() => set({ textAlign: a })} aria-label={`Align ${a}`} aria-pressed={o.textAlign === a} className={cn("flex h-8 w-8 items-center justify-center rounded-md", o.textAlign === a ? "bg-sauti-teal-light" : "hover:bg-serene-neutral-100")}><Icon className="h-4 w-4" /></button>)}
							</>
						)}
						<span className="mx-1 h-5 w-px bg-black/10" />
						<label className="flex items-center gap-1.5 text-xs text-serene-neutral-600">Opacity<input type="range" min={0.1} max={1} step={0.05} value={o.opacity ?? 1} onChange={(e) => set({ opacity: Number(e.target.value) })} className="w-20 accent-[#7D2AE8]" /></label>
						<button onClick={() => { const c = canvas.current; if (c && o) { c.bringObjectForward(o); c.renderAll(); snapshot(); } }} className="h-8 rounded-md px-2 text-xs hover:bg-serene-neutral-100">Forward</button>
						<button onClick={() => { const c = canvas.current; if (c && o) { c.sendObjectBackwards(o); c.renderAll(); snapshot(); } }} className="h-8 rounded-md px-2 text-xs hover:bg-serene-neutral-100">Back</button>
						<button aria-label="Delete" onClick={() => { const c = canvas.current; if (c && o) { c.remove(o); c.discardActiveObject(); c.renderAll(); } }} className="flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
					</>
				)}
			</div>

			<div className="flex min-h-0 flex-1">
				{/* Rail and panel */}
				<nav aria-label="Design tools" className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-serene-neutral-100 bg-[#0E1318] py-2">
					{rail.map(([k, label, icon]) => (
						<button key={k} onClick={() => setPanel((cur) => (cur === k ? null : k))} aria-pressed={panel === k} className={cn("flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[11px]", panel === k ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10")}>{icon}{label}</button>
					))}
				</nav>
				<aside className={cn("shrink-0 overflow-y-auto border-serene-neutral-100 bg-white p-3 sm:w-64 sm:border-r", panel ? "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:max-h-[45dvh] max-sm:border-t max-sm:shadow-2xl" : "hidden")}>
					{panel === "templates" && (
						<div className="space-y-4">
							<div>
								<h3 className="mb-2 text-sm font-semibold">Start from</h3>
								<div className="grid grid-cols-2 gap-2">
									{BUILT_IN.map((b) => (
										<button key={b.id} onClick={() => applyBuilt(b)} className="overflow-hidden rounded-xl border border-serene-neutral-200 text-left hover:border-[#7D2AE8]">
											<span className="block h-20" style={{ background: b.swatch, borderBottom: "1px solid rgba(0,0,0,.06)" }} />
											<span className="block px-2 py-1.5 text-xs font-medium">{b.name}</span>
										</button>
									))}
								</div>
							</div>
							<div>
								<h3 className="mb-2 text-sm font-semibold">Your templates</h3>
								{mine.length === 0 ? <p className="text-xs text-serene-neutral-500">Save a design as a template and it appears here for the team.</p> : (
									<ul className="space-y-1">
										{mine.map((t) => (
											<li key={t.id} className="flex items-center gap-1">
												<button onClick={() => applyMine(t)} className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-serene-neutral-100">{t.name}</button>
												<button aria-label={`Delete ${t.name}`} onClick={async () => { await unwrap(deleteTemplate(t.id)).catch(() => undefined); setMine(await unwrap(listTemplates("design")).catch(() => [])); }} className="flex h-7 w-7 items-center justify-center rounded-md text-serene-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					)}
					{panel === "text" && (
						<div className="space-y-2">
							<button onClick={() => addText("Add a heading", size.h * 0.09, true)} className="w-full rounded-xl border border-serene-neutral-200 p-3 text-left text-2xl font-bold hover:border-[#7D2AE8]">Add a heading</button>
							<button onClick={() => addText("Add a subheading", size.h * 0.055, true)} className="w-full rounded-xl border border-serene-neutral-200 p-3 text-left text-lg font-semibold hover:border-[#7D2AE8]">Add a subheading</button>
							<button onClick={() => addText("A little bit of body text", size.h * 0.035)} className="w-full rounded-xl border border-serene-neutral-200 p-3 text-left text-sm hover:border-[#7D2AE8]">A little bit of body text</button>
						</div>
					)}
					{panel === "shapes" && (
						<div className="grid grid-cols-2 gap-2">
							{([["rect", "Square"], ["circle", "Circle"], ["triangle", "Triangle"], ["line", "Line"]] as const).map(([k, l]) => (
								<button key={k} onClick={() => addShape(k)} className="rounded-xl border border-serene-neutral-200 py-6 text-sm hover:border-[#7D2AE8]">{l}</button>
							))}
						</div>
					)}
					{panel === "uploads" && (
						<div className="space-y-2">
							<Button className="w-full gap-2 bg-[#7D2AE8] hover:bg-[#6a22c9]" onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" /> Upload an image</Button>
							<input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
							<p className="text-xs text-serene-neutral-500">Images stay in this design until you save it to Studio.</p>
						</div>
					)}
					{panel === "market" && (
						<div className="space-y-3 text-sm">
							<p className="text-xs text-serene-neutral-500">Free places to find templates, photos and fonts. Download what you like, then use Uploads to bring it in.</p>
							{[
								["Canva free templates", "https://www.canva.com/templates/", "Layouts for posters and social posts"],
								["Slidesgo", "https://slidesgo.com/", "Presentation themes"],
								["Unsplash", "https://unsplash.com/", "Free photographs"],
								["Pexels", "https://www.pexels.com/", "Free photos and video"],
								["unDraw", "https://undraw.co/illustrations", "Free illustrations, recolourable"],
								["Google Fonts", "https://fonts.google.com/", "Open fonts"],
							].map(([n, u, d]) => (
								<a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-serene-neutral-200 p-3 hover:border-[#7D2AE8]">
									<span className="block font-semibold">{n}</span><span className="block text-xs text-serene-neutral-500">{d}</span>
								</a>
							))}
							<p className="text-xs text-serene-neutral-500">Check each licence before using an image in public.</p>
						</div>
					)}
					{panel === "studio" && (
						<div>
							{assets.length === 0 ? <p className="text-xs text-serene-neutral-500">Images made in the assistant or saved from here show up in Studio.</p> : (
								<div className="grid grid-cols-2 gap-2">
									{assets.filter((a) => a.url).map((a) => <button key={a.id} onClick={() => a.url && addImage(a.url)} className="overflow-hidden rounded-lg border border-serene-neutral-200 hover:border-[#7D2AE8]"><img src={a.url!} alt={a.name} className="aspect-square w-full object-cover" /></button>)}
								</div>
							)}
						</div>
					)}
				</aside>

				{/* Page */}
				<div ref={host} className="flex min-w-0 flex-1 items-center justify-center overflow-auto bg-[#EBECF0] p-2 sm:p-4">
					<div className="shadow-xl"><canvas ref={el} /></div>
				</div>
			</div>
			<PostThis open={!!postFor} assetId={postFor} about={name} onClose={() => setPostFor(null)} />
		</div>
	);
}

