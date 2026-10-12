"use client";

import { ColourInput } from "@/components/mjengo/ColourInput";
import { PaletteSources } from "@/components/mjengo/PaletteSources";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { MjengoLoader } from "../../_components/MjengoLoader";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ActiveSelection, cache, Canvas, Circle, FabricImage, Gradient, Group, Line, Path, PencilBrush, Rect, Shadow, Textbox, Triangle, filters, type FabricObject } from "fabric";
import { AlignCenter, AlignHorizontalJustifyCenter, AlignLeft, AlignRight, ArrowLeft, ArrowUpDown, Bold, ChevronDown, ChevronUp, Eraser, Eye, EyeOff, GripVertical, Group as GroupIcon, MoveVertical, Scissors, SlidersHorizontal, Ungroup, Wand2, Copy, Download, Image as ImageIcon, Italic, Gift, Layers, LayoutTemplate, Loader2, Redo2, Save, Shapes, Sparkles, Trash2, Type, Undo2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { putToSignedUrl } from "@/lib/client/upload";
import { deleteTemplate, listTemplates, saveTemplate, studioRegister, studioUpload, type TemplateRow } from "@/app/actions/mjengo-templates";
import { listAssets, type AssetRow } from "@/app/actions/mjengo-ai";
import { encodeSrc, sceneDataUrl, TEMPLATES, type DesignTemplate } from "@/lib/mjengo/design-templates";
import { ensureFont } from "@/lib/mjengo/fonts";
import { TemplatePreview } from "@/components/design/TemplatePreview";
import { inspireImage } from "@/app/actions/mjengo-inspire";
import { InspirePanel } from "./_InspirePanel";
import { removeBackground, splitIntoLayers, type LayerSplit } from "@/lib/client/split-layers";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PDFDocument } from "pdf-lib";
import { ElementsPanel, FontPicker, TextPanel, UploadsPanel, type ShapeKind, type TextPreset } from "./_Panels";
import { CONCEPTS, conceptTemplate, generateTemplate, templateFromId } from "@/lib/mjengo/design-generator";
import { FONT_OPTIONS } from "@/lib/mjengo/fonts";
import { PostThis } from "../../_components/PostThis";

/* Canva's palette: the editor borrows its look so it feels familiar. */
const CANVA = { teal: "#00C4CC", purple: "#7D2AE8", ink: "#0E1318" };
const PALETTE = ["#0E1318", "#FFFFFF", "#7D2AE8", "#00C4CC", "#FF5757", "#FFDE59", "#5CE1E6", "#FF66C4", "#068297", "#38B6FF", "#8C52FF", "#7ED957"];
const FONTS = FONT_OPTIONS.map((f) => f.family);
const SIZES = [
	{ id: "instagram", label: "Instagram post", w: 1080, h: 1080 },
	{ id: "story", label: "Story", w: 1080, h: 1920 },
	{ id: "linkedin", label: "LinkedIn post", w: 1200, h: 627 },
	{ id: "facebook", label: "Facebook post", w: 1200, h: 630 },
	{ id: "tiktok", label: "TikTok photo", w: 1080, h: 1920 },
	{ id: "x", label: "X post", w: 1600, h: 900 },
	{ id: "poster", label: "A4 poster", w: 1240, h: 1754 },
] as const;

type Panel = "templates" | "text" | "shapes" | "uploads" | "inspire" | "brand";
type Builder = (c: Canvas, w: number, h: number) => void;

// Fabric 7 positions objects by their centre unless told otherwise; everything here is placed by its top-left corner.
const TL = { originX: "left", originY: "top" } as const;
const text = (t: string, o: Partial<ConstructorParameters<typeof Textbox>[1]>) => new Textbox(t, { fontFamily: "Inter", fill: CANVA.ink, ...TL, ...o });

/** Starting layouts, drawn with the same objects people can edit afterwards (the hub previews the same layers). */
function buildFrom(t: DesignTemplate): Builder {
	return (c, w, h) => {
		c.backgroundColor = t.bg2
			? new Gradient({ type: "linear", gradientUnits: "pixels", coords: { x1: 0, y1: 0, x2: 0, y2: h }, colorStops: [{ offset: 0, color: t.bg }, { offset: 1, color: t.bg2 }] })
			: t.bg;
		const ink = (t.layers.find((x) => x.t === "text") as { color?: string } | undefined)?.color ?? "#000000";
		for (const l of t.layers) {
			if (l.t === "rect" || l.t === "photo") {
				const r = l.r ? l.r * Math.min(l.w * w, l.h * h) : 0;
				const ghost = l.t === "rect" && l.fill === "transparent";
				const o = new Rect({ ...TL, left: l.x * w, top: l.y * h, width: l.w * w, height: l.h * h, fill: ghost ? "rgba(0,0,0,0)" : l.fill, stroke: ghost ? ink : undefined, strokeWidth: ghost ? 3 : 0, opacity: ghost ? 0.3 : 1, rx: r, ry: r });
				c.add(o);
				if (l.t === "photo" && (l.scene || l.src)) {
					// A picture in the slot: drawn as a real image so it can be replaced or moved like any photo.
					const at = c.getObjects().length;
					FabricImage.fromURL(l.src ? encodeSrc(l.src) : sceneDataUrl(l.scene ?? "hills", l.fill, 400, Math.max(120, Math.round((400 * (l.h * h)) / (l.w * w)))), { crossOrigin: "anonymous" }).then((img) => {
						const k = Math.max((l.w * w) / (img.width ?? 1), (l.h * h) / (img.height ?? 1));
						// Cover the slot and keep the middle of the picture.
						img.set({ ...TL, left: l.x * w - ((img.width ?? 0) * k - l.w * w) / 2, top: l.y * h - ((img.height ?? 0) * k - l.h * h) / 2, scaleX: k, scaleY: k, clipPath: new Rect({ ...TL, left: l.x * w, top: l.y * h, width: l.w * w, height: l.h * h, rx: r, ry: r, absolutePositioned: true }) });
						c.insertAt(Math.min(at, c.getObjects().length), img);
						c.requestRenderAll();
					}).catch(() => undefined);
				}
			} else if (l.t === "circle") {
				c.add(new Circle({ ...TL, left: l.x * w, top: l.y * h, radius: (l.d * w) / 2, fill: l.fill }));
			} else if (l.t === "line") {
				c.add(new Rect({ ...TL, left: l.x * w, top: l.y * h, width: l.w * w, height: Math.max(2, l.th * h), fill: l.color }));
			} else {
				if (l.font) {
					const fam = l.font;
					void ensureFont(fam).then(() => {
						cache.clearFontCache(fam);
						c.getObjects().forEach((o) => { if (o.type === "textbox" && (o as Textbox).fontFamily === fam) { o.set({ fontFamily: fam, dirty: true }); (o as Textbox).initDimensions(); o.setCoords(); } });
						c.requestRenderAll();
					});
				}
				c.add(text(l.text, {
					left: l.x * w, top: l.y * h, width: l.w * w, fontSize: l.size * h, fill: l.color,
					fontFamily: l.font ?? "Inter",
					fontWeight: l.bold ? "bold" : "normal", fontStyle: l.italic ? "italic" : "normal",
					charSpacing: l.spacing ?? 0, textAlign: l.align ?? "left", lineHeight: l.lh ?? 1.2,
				}));
			}
		}
	};
}

export const BUILT_IN: { id: string; name: string; build: Builder; swatch: string; template: DesignTemplate }[] = TEMPLATES.map((t) => ({ id: t.id, name: t.name, build: buildFrom(t), swatch: t.bg, template: t }));

function DesignEditor() {
	const search = useSearchParams();
	const initialId = search.get("id");
	const initialTemplate = search.get("template");
	const isCopy = search.get("copy") === "1";
	const inspire = search.get("inspire");
	const [designId, setDesignId] = useState<string | null>(isCopy ? null : initialId);
	const { toast } = useToast();
	const host = useRef<HTMLDivElement>(null);
	const el = useRef<HTMLCanvasElement>(null);
	const canvas = useRef<Canvas | null>(null);
	const history = useRef<{ stack: string[]; at: number; lock: boolean }>({ stack: [], at: -1, lock: false });
	const fileInput = useRef<HTMLInputElement>(null);

	const [size, setSize] = useState<(typeof SIZES)[number]>(() => {
		if (typeof window === "undefined") return SIZES[0];
		const q = new URLSearchParams(window.location.search);
		// The size in the link wins; otherwise a template brings its own size with it.
		const tid = q.get("template");
		const fromTemplate = tid ? (/^gen-\d+-[a-z-]+-([a-z]+)$/.exec(tid)?.[1] ?? TEMPLATES.find((t) => t.id === tid)?.size) : undefined;
		const want = q.get("size") ?? fromTemplate;
		return SIZES.find((x) => x.id === want) ?? SIZES[0];
	});
	const [ideaSeed, setIdeaSeed] = useState(1);
	const [uiReady, setUiReady] = useState(false);
	useEffect(() => setUiReady(true), []);
	const [drawing, setDrawing] = useState<{ on: boolean; color: string; width: number }>({ on: false, color: "#0E1318", width: 8 });
	const [guides, setGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
	const [magic, setMagic] = useState<string | null>(null);
	const [checks, setChecks] = useState<{ ok: boolean; items: string[] } | null>(null);
	const [brand, setBrand] = useState<{ colours: string[]; fonts: string[]; logo: string | null }>({ colours: ["#068297", "#7D2AE8", "#FFDE59", "#0E1318", "#FFFFFF"], fonts: ["Poppins", "Inter"], logo: "/Logo.png" });
	useEffect(() => { try { const b = localStorage.getItem("ss_design_brand"); if (b) setBrand(JSON.parse(b)); } catch { /* defaults */ } }, []);
	const saveBrand = (b: typeof brand) => { setBrand(b); try { localStorage.setItem("ss_design_brand", JSON.stringify(b)); } catch { /* ignore */ } };
	const [zoomMul, setZoomMul] = useState(1);
	const zoomRef = useRef(1);
	zoomRef.current = zoomMul;
	const lastSel = useRef<FabricObject | null>(null);
	const sizeRef = useRef(size);
	sizeRef.current = size;
	const [panel, setPanel] = useState<Panel | null>("templates");
	const [scale, setScale] = useState(0.5);
	const [selected, setSelected] = useState<FabricObject | null>(null);
	const [, bump] = useState(0);
	const [mine, setMine] = useState<TemplateRow[]>([]);
	const [assets, setAssets] = useState<AssetRow[]>([]);
	const [name, setName] = useState("Untitled design");
	const [saved, setSaved] = useState(true);
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
		fit();
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
		const sz = sizeRef.current;
		if (box.clientWidth < 80 || box.clientHeight < 80) return;
		const base = Math.min((box.clientWidth - 32) / sz.w, (box.clientHeight - 36 - 96) / sz.h, 1);
		const s = Math.max(0.05, base * zoomRef.current);
		c.setDimensions({ width: Math.round(sz.w * s), height: Math.round(sz.h * s) });
		// clear() and loadFromJSON() reset the view, so the zoom is always set again here.
		c.setViewportTransform([s, 0, 0, s, 0, 0]);
		c.requestRenderAll();
		setScale(s);
	}, []);

	useEffect(() => {
		if (!el.current) return;
		const c = new Canvas(el.current, { width: size.w * 0.5, height: size.h * 0.5, backgroundColor: "#FFFFFF", preserveObjectStacking: true });
		canvas.current = c;
		const onSel = () => setSelected(c.getActiveObject() ?? null);
		c.on("selection:created", onSel);
		c.on("selection:updated", onSel);
		c.on("selection:cleared", () => setSelected(null));
		c.on("object:modified", () => { snapshot(); setSaved(false); bump((n) => n + 1); });
		// One tap on text that is already selected starts typing (the keyboard opens on a phone).
		c.on("mouse:down", (e) => { lastSel.current = (e as { target?: FabricObject }).target === c.getActiveObject() ? c.getActiveObject() ?? null : null; });
		c.on("mouse:up", (e) => {
			const t = (e as { target?: FabricObject }).target as (Textbox & { isEditing?: boolean }) | undefined;
			if (t && t.type === "textbox" && lastSel.current === t && !t.isEditing) { t.enterEditing(); t.hiddenTextarea?.focus(); c.requestRenderAll(); }
		});
		c.on("object:added", () => snapshot());
		c.on("object:removed", () => snapshot());
		if (!initialId) {
			const sp = new URLSearchParams(window.location.search);
			const conceptId = sp.get("concept");
			const picked = initialTemplate ? templateFromId(initialTemplate) : conceptId ? conceptTemplate(conceptId, size.id as never, Number(sp.get("variant") ?? 0)) : null;
			if (picked) buildFrom(picked)(c, size.w, size.h);
			else (BUILT_IN.find((b) => b.id === initialTemplate) ?? BUILT_IN[BUILT_IN.length - 1]).build(c, size.w, size.h);
		}
		fit();
		snapshot();
		const ro = new ResizeObserver(() => fit());
		if (host.current) ro.observe(host.current);
		return () => { ro.disconnect(); c.dispose(); canvas.current = null; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	useEffect(() => { fit(); }, [fit, size, zoomMul]);

	useEffect(() => {
		unwrap(listTemplates("design")).then(async (rows) => {
			setMine(rows);
			// Opening a saved design: bring its pages, size and name back.
			if (!initialId) return;
			const row = rows.find((r) => r.id === initialId);
			const d = row?.data as { json?: unknown; w?: number; h?: number } | undefined;
			const c = canvas.current;
			if (!row || !d?.json || !c) return;
			const match = SIZES.find((x) => x.w === d.w && x.h === d.h);
			const next = match ?? (d.w && d.h ? ({ id: "custom", label: "Custom", w: d.w, h: d.h } as never) : null);
			if (next) { sizeRef.current = next; setSize(next); }
			setName(isCopy ? `${row.name} copy` : row.name);
			history.current.lock = true;
			await c.loadFromJSON(d.json as never);
			history.current.lock = false;
			fit();
			snapshot();
			setSaved(true);
		}).catch(() => setMine([]));
		unwrap(listAssets()).then(setAssets).catch(() => setAssets([]));
	}, []);

	// Keyboard: the shortcuts people know from Canva and Figma.
	const clip = useRef<FabricObject | null>(null);
	useEffect(() => {
		const onKey = async (e: KeyboardEvent) => {
			if ((e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable=true]")) return;
			const c = canvas.current;
			if (!c) return;
			const active = c.getActiveObject() as (FabricObject & { isEditing?: boolean }) | undefined;
			if (active?.isEditing) return;
			const mod = e.ctrlKey || e.metaKey;
			const k = e.key.toLowerCase();
			if ((e.key === "Delete" || e.key === "Backspace") && active) { e.preventDefault(); const objs = active.type === "activeselection" ? (active as ActiveSelection).getObjects() : [active]; c.discardActiveObject(); objs.forEach((x) => c.remove(x)); c.requestRenderAll(); return; }
			if (mod && k === "z") { e.preventDefault(); restore(history.current.at + (e.shiftKey ? 1 : -1)); return; }
			if (mod && k === "y") { e.preventDefault(); restore(history.current.at + 1); return; }
			if (mod && k === "s") { e.preventDefault(); void saveDesignRef.current(false); return; }
			if (mod && k === "a") { e.preventDefault(); c.discardActiveObject(); const all = c.getObjects().filter((x) => x.selectable !== false); if (all.length) { c.setActiveObject(new ActiveSelection(all, { canvas: c })); c.requestRenderAll(); } return; }
			if (mod && k === "c" && active) { e.preventDefault(); clip.current = await active.clone(); return; }
			if (mod && k === "v" && clip.current) { e.preventDefault(); const copy = await clip.current.clone(); copy.set({ left: (copy.left ?? 0) + 24, top: (copy.top ?? 0) + 24 }); clip.current = copy; c.add(copy); c.setActiveObject(copy); c.requestRenderAll(); return; }
			if (mod && k === "d" && active) { e.preventDefault(); const copy = await active.clone(); copy.set({ left: (active.left ?? 0) + 24, top: (active.top ?? 0) + 24 }); c.add(copy); c.setActiveObject(copy); c.requestRenderAll(); return; }
			if (mod && k === "g") { e.preventDefault(); groupRef.current(); return; }
			if (e.key === "Escape") { c.discardActiveObject(); c.requestRenderAll(); return; }
			if (active && e.key.startsWith("Arrow")) {
				e.preventDefault();
				const step = e.shiftKey ? 10 : 1;
				const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
				const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
				active.set({ left: (active.left ?? 0) + dx, top: (active.top ?? 0) + dy });
				active.setCoords();
				c.requestRenderAll();
				snapshot();
				return;
			}
			if (active && e.key === "]") { c.bringObjectForward(active); c.requestRenderAll(); snapshot(); }
			if (active && e.key === "[") { c.sendObjectBackwards(active); c.requestRenderAll(); snapshot(); }
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Smart guides: objects snap to the page's edges and middle while they move.
	useEffect(() => {
		const c = canvas.current;
		if (!c) return;
		const onMove = (ev: { target?: FabricObject }) => {
			const o2 = ev.target;
			if (!o2) return;
			const z = c.getZoom() || 1;
			const T = 6 / z;
			const W = sizeRef.current.w, H = sizeRef.current.h;
			const ac = o2.getCoords();
			const xs = ac.map((p) => p.x), ys = ac.map((p) => p.y);
			const l = Math.min(...xs), r = Math.max(...xs), t = Math.min(...ys), b = Math.max(...ys);
			const cx = (l + r) / 2, cy = (t + b) / 2;
			let v: number | null = null, h: number | null = null;
			for (const [pos, target] of [[l, 0], [cx, W / 2], [r, W]] as const) if (Math.abs(pos - target) < T) { o2.set({ left: (o2.left ?? 0) + (target - pos) }); v = target; break; }
			for (const [pos, target] of [[t, 0], [cy, H / 2], [b, H]] as const) if (Math.abs(pos - target) < T) { o2.set({ top: (o2.top ?? 0) + (target - pos) }); h = target; break; }
			setGuides({ v, h });
		};
		const clear = () => setGuides({ v: null, h: null });
		c.on("object:moving", onMove as never);
		c.on("mouse:up", clear);
		return () => { c.off("object:moving", onMove as never); c.off("mouse:up", clear); };
	}, []);

	// Freehand drawing.
	useEffect(() => {
		const c = canvas.current;
		if (!c) return;
		c.isDrawingMode = drawing.on;
		if (drawing.on) {
			const brush = new PencilBrush(c);
			brush.color = drawing.color;
			brush.width = drawing.width;
			c.freeDrawingBrush = brush;
		}
	}, [drawing]);

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

	/** One flat picture, full bleed, sent to the back. The fallback when it cannot be split. */
	const placeSingle = async (data: string) => {
		const c = canvas.current;
		if (!c) return null;
		const img = await FabricImage.fromURL(data);
		const sz = sizeRef.current;
		const k = Math.max(sz.w / (img.width ?? 1), sz.h / (img.height ?? 1));
		img.set({ ...TL, scaleX: k, scaleY: k, left: (sz.w - (img.width ?? 0) * k) / 2, top: (sz.h - (img.height ?? 0) * k) / 2 });
		c.add(img);
		c.sendObjectToBack(img);
		c.requestRenderAll();
		return img;
	};

	/** Backdrop, subject and each line of text as separate, editable layers. */
	const placeSplit = async (sp: LayerSplit, over?: FabricObject | null) => {
		const c = canvas.current;
		if (!c) return;
		const sz = sizeRef.current;
		const box = over ? { x: over.left ?? 0, y: over.top ?? 0, w: over.getScaledWidth(), h: over.getScaledHeight() } : { x: 0, y: 0, w: sz.w, h: sz.h };
		const k = over ? box.w / sp.width : Math.max(box.w / sp.width, box.h / sp.height);
		const ox = over ? box.x : box.x + (box.w - sp.width * k) / 2;
		const oy = over ? box.y : box.y + (box.h - sp.height * k) / 2;
		const at = over ? c.getObjects().indexOf(over) : 0;
		if (over) c.remove(over);
		history.current.lock = true;
		const back = await FabricImage.fromURL(sp.backdrop);
		back.set({ ...TL, left: ox, top: oy, scaleX: k, scaleY: k });
		c.insertAt(Math.max(0, at), back);
		if (sp.subject) {
			const sub = await FabricImage.fromURL(sp.subject);
			sub.set({ ...TL, left: ox, top: oy, scaleX: k, scaleY: k });
			c.insertAt(Math.max(0, at) + 1, sub);
		}
		for (const t of sp.texts) {
			const big = t.size * k > sz.h * 0.05;
			c.add(text(t.text, { left: ox + t.x * k, top: oy + t.y * k - t.size * k * 0.12, width: Math.max(40, t.w * k * 1.12), fontSize: t.size * k, fill: t.color, fontWeight: big ? "bold" : "normal", fontFamily: "Inter" }));
		}
		history.current.lock = false;
		c.discardActiveObject();
		fit();
		snapshot();
		setSaved(false);
	};

	const [splitting, setSplitting] = useState<string | null>(null);
	const skipSplit = useRef(false);
	const splitAndPlace = async (data: string, over?: FabricObject | null) => {
		skipSplit.current = false;
		setSplitting("Getting ready");
		try {
			const sp = await splitIntoLayers(data, (m) => setSplitting(m));
			if (skipSplit.current) throw new Error("skipped");
			if (!sp.subject && sp.texts.length === 0) throw new Error("nothing to split");
			await placeSplit(sp, over);
			toast({ title: "Split into layers", description: `${sp.subject ? "Subject and background" : "Picture"}${sp.texts.length ? `, ${sp.texts.length} line${sp.texts.length === 1 ? "" : "s"} of text` : ""}. Click any piece to edit it.` });
		} catch (e) {
			if (!over) await placeSingle(data);
			if (!(e instanceof Error) || (e.message !== "skipped" && e.message !== "nothing to split")) toast({ title: "Kept as one picture", description: "The layers could not be separated on this device." });
			else if (e.message === "nothing to split") toast({ title: "Kept as one picture", description: "No separate subject or text was found in it." });
		} finally {
			setSplitting(null);
		}
	};

	// A picture picked from the inspiration arrives at once, with an offer to split it into layers.
	const [offer, setOffer] = useState<{ data: string; img: FabricObject } | null>(null);
	useEffect(() => {
		if (!inspire) return;
		let on = true;
		const load = /^https?:|^\//.test(inspire) && !/pinimg|unsplash|pexels|pixabay|openverse|iconify|giphy/.test(inspire)
			? Promise.resolve(inspire)
			: unwrap(inspireImage(inspire));
		load.then(async (data) => {
			if (!on) return;
			setName("Inspired design");
			const img = await placeSingle(data);
			if (img && on) setOffer({ data, img });
		}).catch(() => toast({ title: "Could not use that picture", variant: "destructive" }));
		return () => { on = false; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [inspire]);

	/** The selected picture, split into layers in place. */
	const splitSelected = async () => {
		const sel = canvas.current?.getActiveObject();
		if (!sel || sel.type !== "image") return;
		const img = sel as FabricImage;
		const data = img.toDataURL({ format: "png", multiplier: 1 });
		await splitAndPlace(data, img);
	};

	const applyBuilt = (b: (typeof BUILT_IN)[number]) => {
		const c = canvas.current;
		if (!c) return;
		// A template brings its own page: the page takes its shape instead of squeezing the template into the
		// current one (a story template must not end up on a square).
		const own = SIZES.find((x) => x.id === b.template.size);
		const target = b.id !== "plain" && own ? own : size;
		if (target.id !== size.id) { sizeRef.current = target; setSize(target); }
		history.current.lock = true;
		c.clear();
		b.build(c, target.w, target.h);
		history.current.lock = false;
		fit();
		snapshot();
	};

	/** A generated idea: built with the page's own size so it never has to be reshaped. */
	const applyIdea = (t: DesignTemplate) => applyBuilt({ id: t.id, name: t.name, build: buildFrom(t), swatch: t.bg, template: t });

	const setBackground = (a: string, b?: string) => {
		const c = canvas.current;
		if (!c) return;
		c.backgroundColor = b
			? new Gradient({ type: "linear", gradientUnits: "pixels", coords: { x1: 0, y1: 0, x2: 0, y2: size.h }, colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }] })
			: a;
		c.requestRenderAll();
		snapshot();
		setSaved(false);
	};

	const applyMine = async (t: TemplateRow) => {
		const c = canvas.current;
		const d = t.data as { json?: unknown; w?: number; h?: number };
		if (!c || !d.json) return;
		const match = SIZES.find((s) => s.w === d.w && s.h === d.h);
		const next = match ?? (d.w && d.h ? ({ id: "custom", label: "Custom", w: d.w, h: d.h } as never) : null);
		if (next) { sizeRef.current = next; setSize(next); }
		history.current.lock = true;
		await c.loadFromJSON(d.json as never);
		history.current.lock = false;
		fit();
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
	const addShape = (k: ShapeKind) => {
		const w = size.w * 0.3;
		const paths: Partial<Record<ShapeKind, string>> = {
			star: "M12 2l3 7 7.5.6-5.7 4.9 1.8 7.4L12 18l-6.6 3.9 1.8-7.4L1.5 9.6 9 9z",
			heart: "M12 21s-8-5.4-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.6-8 11-8 11z",
			arrow: "M3 11h13l-4-4 1.4-1.4L20 12l-6.6 6.4L12 17l4-4H3z",
			bubble: "M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z",
		};
		if (k === "rect") add(new Rect({ width: w, height: w, fill: CANVA.purple }));
		else if (k === "rounded") add(new Rect({ width: w, height: w, fill: CANVA.purple, rx: w * 0.18, ry: w * 0.18 }));
		else if (k === "circle") add(new Circle({ radius: w / 2, fill: CANVA.teal }));
		else if (k === "triangle") add(new Triangle({ width: w, height: w * 0.87, fill: "#FFDE59" }));
		else if (k === "line") add(new Line([0, 0, size.w * 0.4, 0], { stroke: CANVA.ink, strokeWidth: 8, strokeLineCap: "round" }));
		else if (k === "dashed") add(new Line([0, 0, size.w * 0.4, 0], { stroke: CANVA.ink, strokeWidth: 8, strokeDashArray: [24, 18], strokeLineCap: "round" }));
		else {
			const o = new Path(paths[k] ?? paths.star!, { fill: k === "heart" ? "#FF5C8A" : k === "star" ? "#FFDE59" : CANVA.purple });
			o.scaleToWidth(w);
			add(o);
		}
	};
	/** A text style from the Text panel: its font, weight and finish, placed in the middle of the page. */
	const addPreset = async (p: TextPreset) => {
		await ensureFont(p.font);
		const t = p.caps ? p.sample.toUpperCase() : p.sample;
		add(text(t, {
			width: size.w * 0.7, fontSize: p.size * size.h, fontFamily: p.font, fontWeight: p.bold ? "bold" : "normal", fontStyle: p.italic ? "italic" : "normal",
			fill: p.color ?? CANVA.ink, charSpacing: p.spacing ?? 0, textAlign: p.align ?? "left", lineHeight: p.lh ?? 1.15,
			...(p.bg ? { backgroundColor: p.bg } : {}),
		}));
	};
	const changeFont = async (family: string) => {
		await ensureFont(family);
		cache.clearFontCache(family);
		set({ fontFamily: family });
		const t = canvas.current?.getActiveObject() as Textbox | undefined;
		if (t && "initDimensions" in t) { t.initDimensions(); t.setCoords(); canvas.current?.requestRenderAll(); }
	};
	const addImage = async (url: string, frac = 0.7) => {
		const c = canvas.current;
		if (!c) return;
		try {
			const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
			const k = Math.min((size.w * frac) / (img.width ?? 1), (size.h * frac) / (img.height ?? 1), 4);
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
	const dataUrl = (mult = 1, format: "png" | "jpeg" = "png") => canvas.current!.toDataURL({ format, quality: 0.92, multiplier: mult / scale });
	const flat = (fn: () => void) => { const c = canvas.current; if (!c) return; c.discardActiveObject(); c.requestRenderAll(); fn(); };
	const fileBase = () => (name || "design").replace(/[\\/:*?"<>|]+/g, " ").trim();
	const saveBlob = (blob: Blob, filename: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 20_000); };

	/** Download in the format asked for: PNG, a sharper 2x PNG, transparent PNG, JPG, SVG or a one-page PDF. */
	const exportAs = async (kind: "png" | "png2" | "transparent" | "jpg" | "svg" | "pdf") => {
		const c = canvas.current;
		if (!c) return;
		flat(() => undefined);
		try {
			if (kind === "svg") {
				const svg = c.toSVG({ width: `${size.w}`, height: `${size.h}`, viewBox: { x: 0, y: 0, width: size.w, height: size.h } } as never);
				saveBlob(new Blob([svg], { type: "image/svg+xml" }), `${fileBase()}.svg`);
			} else if (kind === "pdf") {
				const png = await (await fetch(dataUrl(1))).arrayBuffer();
				const doc = await PDFDocument.create();
				const pg = doc.addPage([size.w * 0.75, size.h * 0.75]);
				const img = await doc.embedPng(png);
				pg.drawImage(img, { x: 0, y: 0, width: pg.getWidth(), height: pg.getHeight() });
				saveBlob(new Blob([new Uint8Array(await doc.save())], { type: "application/pdf" }), `${fileBase()}.pdf`);
			} else if (kind === "transparent") {
				const prev = c.backgroundColor;
				c.backgroundColor = "rgba(0,0,0,0)";
				c.requestRenderAll();
				const url = dataUrl(1);
				c.backgroundColor = prev;
				c.requestRenderAll();
				saveBlob(await (await fetch(url)).blob(), `${fileBase()} transparent.png`);
			} else {
				const blob = await (await fetch(kind === "jpg" ? dataUrl(1, "jpeg") : dataUrl(kind === "png2" ? 2 : 1))).blob();
				saveBlob(blob, `${fileBase()}${kind === "png2" ? "@2x" : ""}.${kind === "jpg" ? "jpg" : "png"}`);
			}
		} catch (e) {
			toast({ title: "Could not download", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	};

	/** Keep a copy of the design as it is now, without changing which design is open. */
	const saveCopy = async (label: string) => {
		const c = canvas.current;
		if (!c) return;
		const thumb = c.toDataURL({ format: "jpeg", quality: 0.7, multiplier: Math.min(1, 360 / size.w) / scale });
		await unwrap(saveTemplate(null, { kind: "design", name: `${name || "Untitled design"} ${label}`, data: { json: c.toJSON(), w: size.w, h: size.h, thumb, template: false } }));
	};

	const groupSel = () => {
		const c = canvas.current;
		const sel = c?.getActiveObject();
		if (!c || !sel) return;
		if (sel.type === "activeselection") {
			const objs = (sel as ActiveSelection).getObjects();
			c.discardActiveObject();
			objs.forEach((x) => c.remove(x));
			const g = new Group(objs);
			c.add(g);
			c.setActiveObject(g);
		} else if (sel.type === "group") {
			const g = sel as Group;
			const objs = g.removeAll();
			c.discardActiveObject();
			c.remove(g);
			objs.forEach((x) => c.add(x));
			c.setActiveObject(new ActiveSelection(objs, { canvas: c }));
		}
		c.requestRenderAll();
		snapshot();
		bump((n) => n + 1);
	};
	const groupRef = useRef(groupSel);
	groupRef.current = groupSel;

	const alignPage = (to: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
		const c = canvas.current;
		const t = c?.getActiveObject();
		if (!c || !t) return;
		const co = t.getCoords();
		const xs = co.map((p) => p.x), ys = co.map((p) => p.y);
		const l = Math.min(...xs), r = Math.max(...xs), tp = Math.min(...ys), bt = Math.max(...ys);
		const W = size.w, H = size.h;
		const dx = to === "left" ? -l : to === "right" ? W - r : to === "center" ? W / 2 - (l + r) / 2 : 0;
		const dy = to === "top" ? -tp : to === "bottom" ? H - bt : to === "middle" ? H / 2 - (tp + bt) / 2 : 0;
		t.set({ left: (t.left ?? 0) + dx, top: (t.top ?? 0) + dy });
		t.setCoords();
		c.requestRenderAll();
		snapshot();
	};

	/** Remove the background from the selected picture. Runs on this device. */
	const removeBg = async () => {
		const c = canvas.current;
		const sel = c?.getActiveObject();
		if (!c || !sel || sel.type !== "image") return;
		const img = sel as FabricImage;
		setMagic("Removing the background (the first time downloads a small model)");
		try {
			const out = await removeBackground(img.toDataURL({ format: "png", multiplier: 1 }));
			if (!out) throw new Error("No subject found");
			const next = await FabricImage.fromURL(out);
			const k = img.getScaledWidth() / (next.width ?? 1);
			next.set({ left: img.left, top: img.top, originX: img.originX, originY: img.originY, scaleX: k, scaleY: k, angle: img.angle });
			const at = c.getObjects().indexOf(img);
			c.remove(img);
			c.insertAt(at, next);
			c.setActiveObject(next);
			c.requestRenderAll();
			snapshot();
		} catch {
			toast({ title: "Could not remove the background", description: "No clear subject was found, or this device could not run the model.", variant: "destructive" });
		} finally {
			setMagic(null);
		}
	};

	/** Ask the writing model for text: streams back and returns the whole answer. */
	const aiText = async (prompt: string, selection: string) => {
		const res = await fetch("/api/mjengo/ai/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, action: "write", selection, document: "" }) });
		if (!res.ok || !res.body) throw new Error("The AI service is unavailable.");
		const reader = res.body.getReader();
		const dec = new TextDecoder();
		let acc = "";
		for (;;) { const { done, value } = await reader.read(); if (done) break; acc += dec.decode(value, { stream: true }); }
		return acc.trim().replace(/^["“]|["”]$/g, "");
	};
	const writeWithAi = async (instruction: string) => {
		const c = canvas.current;
		const t = c?.getActiveObject() as Textbox | undefined;
		if (!c || !t || !("text" in t)) return toast({ title: "Select some text first" });
		setMagic("Writing");
		try {
			const out = await aiText(`${instruction}. Keep it short enough to fit on a social media graphic. Reply with only the new text.`, String(t.text ?? ""));
			t.set({ text: out });
			t.initDimensions();
			c.requestRenderAll();
			snapshot();
		} catch (e) {
			toast({ title: "Could not write", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally { setMagic(null); }
	};
	const translateAll = async (lang: string) => {
		const c = canvas.current;
		if (!c) return;
		const texts = c.getObjects().filter((x) => x.type === "textbox") as Textbox[];
		if (!texts.length) return toast({ title: "There is no text to translate" });
		setMagic(`Translating to ${lang}`);
		try {
			for (const t of texts) {
				const out = await aiText(`Translate this text into ${lang}. Keep the tone and meaning. Reply with only the translation.`, String(t.text ?? ""));
				if (out) { t.set({ text: out }); t.initDimensions(); }
			}
			c.requestRenderAll();
			snapshot();
		} catch (e) {
			toast({ title: "Could not translate", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally { setMagic(null); }
	};

	const lum = (hex: string) => {
		const m = /^#?([0-9a-f]{6})$/i.exec(hex);
		if (!m) return 0;
		const n = parseInt(m[1], 16);
		const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
		return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
	};
	/** Accessibility: is the text readable against what is behind it, and is any of it too small? */
	const checkDesign = () => {
		const c = canvas.current;
		if (!c) return;
		const items: string[] = [];
		const texts = c.getObjects().filter((x) => x.type === "textbox") as Textbox[];
		const bg = typeof c.backgroundColor === "string" ? c.backgroundColor : "#FFFFFF";
		const hexOf = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : null);
		for (const t of texts) {
			const fg = hexOf(t.fill);
			if (!fg) continue;
			// What is directly under the text: the nearest filled shape that covers its middle, else the page.
			const cx = (t.left ?? 0) + t.getScaledWidth() / 2, cy = (t.top ?? 0) + t.getScaledHeight() / 2;
			const under = [...c.getObjects()].slice(0, c.getObjects().indexOf(t)).reverse().find((x) => (x.type === "rect" || x.type === "circle") && hexOf(x.fill) && x.containsPoint({ x: cx, y: cy } as never));
			const back = hexOf(under?.fill) ?? hexOf(bg) ?? "#FFFFFF";
			const [hi, lo] = [lum(fg), lum(back)].sort((a, b) => b - a);
			const ratio = (hi + 0.05) / (lo + 0.05);
			const px = (t.fontSize ?? 20) * (t.scaleY ?? 1);
			const large = px >= size.h * 0.045;
			const label = `"${String(t.text ?? "").slice(0, 28)}"`;
			if (ratio < (large ? 3 : 4.5)) items.push(`${label} is hard to read: contrast ${ratio.toFixed(1)} to 1 (aim for ${large ? "3" : "4.5"}).`);
			if (px < size.h * 0.02) items.push(`${label} is very small for a social post.`);
		}
		if (texts.length === 0) items.push("There is no text on the page.");
		setChecks({ ok: items.length === 0, items });
	};

	/** Swap one picture's filters. A neutral value removes the filter. */
	const setFilter = (img: FabricImage, type: string, make: (() => unknown) | null) => {
		img.filters = (img.filters ?? []).filter((f) => f.type !== type);
		if (make) img.filters.push(make() as never);
		img.applyFilters();
		canvas.current?.requestRenderAll();
		snapshot();
		bump((n) => n + 1);
	};
	const filterVal = (img: FabricImage, type: string, prop: string, d: number) => {
		const f = img.filters?.find((x) => x.type === type) as unknown as Record<string, number> | undefined;
		return f ? (f[prop] ?? d) : d;
	};
	const cropTo = (img: FabricImage, shape: "none" | "circle" | "rounded") => {
		const w = img.width ?? 100, h = img.height ?? 100;
		img.clipPath = shape === "none" ? undefined : shape === "circle"
			? new Circle({ radius: Math.min(w, h) / 2, originX: "center", originY: "center" })
			: new Rect({ width: w, height: h, rx: Math.min(w, h) * 0.12, ry: Math.min(w, h) * 0.12, originX: "center", originY: "center" });
		img.dirty = true;
		canvas.current?.requestRenderAll();
		snapshot();
	};
	const useShadow = (o2: FabricObject) => o2.shadow as Shadow | null;

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

	/** Keep the design (not just a picture of it) so it can be reopened and changed. */
	const saveDesign = async (silent = false) => {
		if (!silent) setBusy("save");
		try {
			const c = canvas.current!;
			c.discardActiveObject();
			c.renderAll();
			const thumb = c.toDataURL({ format: "jpeg", quality: 0.7, multiplier: Math.min(1, 360 / size.w) / scale });
			const row = await unwrap(saveTemplate(designId, { kind: "design", name: name || "Untitled design", data: { json: c.toJSON(), w: size.w, h: size.h, thumb, template: false } }));
			setDesignId(row.id);
			setSaved(true);
			window.history.replaceState(null, "", `/dashboard/mjengo/design/editor?id=${row.id}`);
			if (!silent) toast({ title: "Design saved" });
		} catch (e) {
			if (!silent) toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			if (!silent) setBusy(null);
		}
	};
	const saveDesignRef = useRef(saveDesign);
	saveDesignRef.current = saveDesign;
	// Changes are kept as you work, once the design has been saved the first time.
	useEffect(() => {
		if (saved || !designId) return;
		const t = setTimeout(() => { void saveDesignRef.current(true); }, 5000);
		return () => clearTimeout(t);
	}, [saved, designId, zoomMul]);

	const saveAsTemplate = async () => {
		const n = window.prompt("Name this template", name);
		if (!n?.trim()) return;
		setBusy("template");
		try {
			await unwrap(saveTemplate(null, { kind: "design", name: n, data: { json: canvas.current!.toJSON(), w: size.w, h: size.h, template: true } }));
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
		["templates", "Design", <LayoutTemplate key="t" className="h-5 w-5" />],
		["shapes", "Elements", <Shapes key="s" className="h-5 w-5" />],
		["text", "Text", <Type key="x" className="h-5 w-5" />],
		["inspire", "Photos", <Sparkles key="n" className="h-5 w-5" />],
		["uploads", "Uploads", <Upload key="u" className="h-5 w-5" />],
		["brand", "Brand", <ImageIcon key="b" className="h-5 w-5" />],
	];
	const canUndo = history.current.at > 0;
	const canRedo = history.current.at < history.current.stack.length - 1;

	/** The context toolbar: what you can do to the thing selected, as a floating pill on desktop. */
	const propBar = (cls: string, floating = false) => {
		const sep = <span className="mx-0.5 h-5 w-px shrink-0 bg-black/10" />;
		const tgl = (on: boolean) => cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", on ? "bg-[#7D2AE8]/10 text-[#7D2AE8]" : "hover:bg-serene-neutral-100");
		const fill = o ? (o.type === "line" ? (o.stroke as string) : (o.fill as string)) : "#000000";
		const colourValue = typeof fill === "string" && fill.startsWith("#") ? fill : "#7D2AE8";
		const t = o as unknown as Textbox | null;
		return (
			<div className={cn("flex shrink-0 items-center gap-1 bg-white px-2.5 py-1.5", floating ? "rounded-2xl border border-black/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)]" : "min-h-12 max-sm:overflow-x-auto max-sm:border-t", cls)}>
				{!o ? (
					<>
						<Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Design name" className="h-9 min-w-[8rem] flex-1 text-sm" />
						<select value={size.id} onChange={(e) => changeSize(SIZES.find((s) => s.id === e.target.value)!)} aria-label="Size" className="h-9 max-w-[9rem] shrink-0 rounded-md border border-serene-neutral-200 bg-white px-2 text-sm">
							{SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
						</select>
					</>
				) : (
					<>
						{isText && (
							<>
								<FontPicker value={o.fontFamily ?? "Inter"} onChange={(f) => void changeFont(f)} />
								{sep}
								<div className="flex shrink-0 items-center rounded-lg border border-serene-neutral-200">
									<button aria-label="Smaller" onClick={() => set({ fontSize: Math.max(4, Math.round((o.fontSize ?? 40) - 2)) })} className="flex h-8 w-7 items-center justify-center hover:bg-serene-neutral-100">-</button>
									<input type="number" value={Math.round(o.fontSize ?? 40)} onChange={(e) => set({ fontSize: Number(e.target.value) })} aria-label="Font size" className="h-8 w-12 border-x border-serene-neutral-200 bg-transparent text-center text-sm outline-none" />
									<button aria-label="Larger" onClick={() => set({ fontSize: Math.round((o.fontSize ?? 40) + 2) })} className="flex h-8 w-7 items-center justify-center hover:bg-serene-neutral-100">+</button>
								</div>
								{sep}
							</>
						)}
						<Popover>
							<PopoverTrigger asChild>
								<button aria-label="Colour" className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-1.5 hover:bg-serene-neutral-100"><span className="h-6 w-6 rounded-full border border-black/15" style={{ background: colourValue }} />{!isText && <span className="text-xs text-serene-neutral-600">Colour</span>}</button>
							</PopoverTrigger>
							<PopoverContent align="start" className="w-60 p-3">
								<p className="mb-2 text-xs font-semibold text-serene-neutral-600">Colour</p>
								<div className="grid grid-cols-6 gap-1.5">
									{PALETTE.map((c) => <button key={c} aria-label={`Colour ${c}`} onClick={() => set(o.type === "line" ? { stroke: c } : { fill: c })} className="aspect-square rounded-full border border-black/10 hover:scale-110" style={{ background: c }} />)}
								</div>
								<label className="mt-3 flex items-center gap-2 text-xs text-serene-neutral-600">Custom
									<input type="color" value={colourValue} onChange={(e) => set(o.type === "line" ? { stroke: e.target.value } : { fill: e.target.value })} className="h-7 w-12 cursor-pointer rounded border border-serene-neutral-200 p-0.5" />
								</label>
							</PopoverContent>
						</Popover>
						{isText && (
							<>
								{sep}
								<button onClick={() => set({ fontWeight: o.fontWeight === "bold" ? "normal" : "bold" })} aria-pressed={o.fontWeight === "bold"} aria-label="Bold" className={tgl(o.fontWeight === "bold")}><Bold className="h-4 w-4" /></button>
								<button onClick={() => set({ fontStyle: o.fontStyle === "italic" ? "normal" : "italic" })} aria-pressed={o.fontStyle === "italic"} aria-label="Italic" className={tgl(o.fontStyle === "italic")}><Italic className="h-4 w-4" /></button>
								<button onClick={() => set({ underline: !t?.underline })} aria-pressed={!!t?.underline} aria-label="Underline" className={tgl(!!t?.underline)}><span className="text-sm font-semibold underline">U</span></button>
								<button onClick={() => set({ linethrough: !t?.linethrough })} aria-pressed={!!t?.linethrough} aria-label="Strikethrough" className={tgl(!!t?.linethrough)}><span className="text-sm font-semibold line-through">S</span></button>
								<button onClick={() => { const cur = String(t?.text ?? ""); const up = cur === cur.toUpperCase(); set({ text: up ? cur.toLowerCase() : cur.toUpperCase() }); }} aria-label="Change case" className={tgl(false)}><span className="text-xs font-semibold">aA</span></button>
								{sep}
								{([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => <button key={a} onClick={() => set({ textAlign: a })} aria-label={`Align ${a}`} aria-pressed={o.textAlign === a} className={tgl(o.textAlign === a)}><Icon className="h-4 w-4" /></button>)}
								<Popover>
									<PopoverTrigger asChild><button aria-label="Spacing" title="Spacing" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-serene-neutral-100"><MoveVertical className="h-[18px] w-[18px]" /></button></PopoverTrigger>
									<PopoverContent align="start" className="w-56 space-y-3 p-3">
										<label className="block text-xs text-serene-neutral-600">Letter spacing<input type="range" min={-50} max={500} step={10} value={t?.charSpacing ?? 0} onChange={(e) => set({ charSpacing: Number(e.target.value) })} className="mt-1 w-full accent-[#7D2AE8]" /></label>
										<label className="block text-xs text-serene-neutral-600">Line spacing<input type="range" min={0.8} max={2.5} step={0.05} value={t?.lineHeight ?? 1.2} onChange={(e) => set({ lineHeight: Number(e.target.value) })} className="mt-1 w-full accent-[#7D2AE8]" /></label>
									</PopoverContent>
								</Popover>
							</>
						)}
						{sep}
						{o.type === "image" && <button onClick={() => void removeBg()} aria-label="Remove background" title="Remove background" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#7D2AE8]/10 text-[#7D2AE8] hover:bg-[#7D2AE8]/15"><Eraser className="h-[18px] w-[18px]" /></button>}
						{o.type === "image" && <button onClick={splitSelected} aria-label="Split into layers" title="Split into layers" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-serene-neutral-100"><Scissors className="h-[18px] w-[18px]" /></button>}
						{o.type === "image" && (
							<Popover>
								<PopoverTrigger asChild><button aria-label="Adjust" title="Adjust" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-serene-neutral-100"><SlidersHorizontal className="h-[18px] w-[18px]" /></button></PopoverTrigger>
								<PopoverContent align="start" className="w-64 space-y-3 p-3">
									{([["Brightness", "Brightness", "brightness", -0.5, 0.5, 0, () => filters.Brightness], ["Contrast", "Contrast", "contrast", -0.5, 0.5, 0, () => filters.Contrast], ["Saturation", "Saturation", "saturation", -1, 1, 0, () => filters.Saturation], ["Blur", "Blur", "blur", 0, 0.5, 0, () => filters.Blur]] as const).map(([label, type, prop, min, max, d, cls]) => (
										<label key={type} className="block text-xs text-serene-neutral-600">{label}
											<input type="range" min={min} max={max} step={0.02} value={filterVal(o as unknown as FabricImage, type, prop, d)} onChange={(e) => { const v = Number(e.target.value); const C = cls() as unknown as new (o: Record<string, number>) => unknown; setFilter(o as unknown as FabricImage, type, v === d ? null : () => new C({ [prop]: v })); }} className="mt-1 w-full accent-[#7D2AE8]" />
										</label>
									))}
									<div className="flex flex-wrap gap-1.5">
										<button className="h-8 rounded-lg border border-serene-neutral-200 px-2.5 text-xs hover:bg-serene-neutral-50" onClick={() => { const im = o as unknown as FabricImage; setFilter(im, "Grayscale", im.filters?.some((f) => f.type === "Grayscale") ? null : () => new filters.Grayscale()); }}>Black and white</button>
										<button className="h-8 rounded-lg border border-serene-neutral-200 px-2.5 text-xs hover:bg-serene-neutral-50" onClick={() => { const im = o as unknown as FabricImage; im.filters = []; im.applyFilters(); canvas.current?.requestRenderAll(); snapshot(); bump((n) => n + 1); }}>Reset</button>
									</div>
									<div>
										<p className="mb-1 text-xs text-serene-neutral-600">Crop to a shape</p>
										<div className="flex gap-1.5">
											{([["none", "Rectangle"], ["rounded", "Rounded"], ["circle", "Circle"]] as const).map(([k, l]) => <button key={k} className="h-8 rounded-lg border border-serene-neutral-200 px-2.5 text-xs hover:bg-serene-neutral-50" onClick={() => cropTo(o as unknown as FabricImage, k)}>{l}</button>)}
										</div>
									</div>
									<div className="flex gap-1.5">
										<button className="h-8 rounded-lg border border-serene-neutral-200 px-2.5 text-xs hover:bg-serene-neutral-50" onClick={() => set({ flipX: !(o as unknown as { flipX?: boolean }).flipX })}>Flip across</button>
										<button className="h-8 rounded-lg border border-serene-neutral-200 px-2.5 text-xs hover:bg-serene-neutral-50" onClick={() => set({ flipY: !(o as unknown as { flipY?: boolean }).flipY })}>Flip down</button>
									</div>
								</PopoverContent>
							</Popover>
						)}
						<Popover>
							<PopoverTrigger asChild><button aria-label="Effects" title="Effects" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-serene-neutral-100"><Wand2 className="h-[18px] w-[18px]" /></button></PopoverTrigger>
							<PopoverContent align="start" className="w-64 space-y-3 p-3">
								{(() => {
									const sh = useShadow(o);
									const setShadow = (patch: Partial<{ color: string; blur: number; offsetX: number; offsetY: number }> | null) => set({ shadow: patch === null ? null : new Shadow({ color: sh?.color ?? "rgba(0,0,0,0.35)", blur: sh?.blur ?? 20, offsetX: sh?.offsetX ?? 8, offsetY: sh?.offsetY ?? 8, ...patch }) });
									return (
										<>
											<div>
												<div className="mb-1 flex items-center justify-between text-xs font-semibold text-serene-neutral-700">Shadow<button className="rounded px-1.5 py-0.5 text-[11px] font-medium text-[#7D2AE8] hover:bg-[#7D2AE8]/10" onClick={() => setShadow(sh ? null : {})}>{sh ? "Remove" : "Add"}</button></div>
												{sh && (
													<div className="space-y-1.5">
														<label className="block text-xs text-serene-neutral-600">Blur<input type="range" min={0} max={80} value={sh.blur} onChange={(e) => setShadow({ blur: Number(e.target.value) })} className="w-full accent-[#7D2AE8]" /></label>
														<label className="block text-xs text-serene-neutral-600">Distance across<input type="range" min={-60} max={60} value={sh.offsetX} onChange={(e) => setShadow({ offsetX: Number(e.target.value) })} className="w-full accent-[#7D2AE8]" /></label>
														<label className="block text-xs text-serene-neutral-600">Distance down<input type="range" min={-60} max={60} value={sh.offsetY} onChange={(e) => setShadow({ offsetY: Number(e.target.value) })} className="w-full accent-[#7D2AE8]" /></label>
													</div>
												)}
											</div>
											<div>
												<p className="mb-1 text-xs font-semibold text-serene-neutral-700">Outline</p>
												<div className="flex items-center gap-2">
													<input type="color" value={typeof o.stroke === "string" && o.stroke.startsWith("#") ? o.stroke : "#000000"} onChange={(e) => set({ stroke: e.target.value, strokeWidth: o.strokeWidth || 4, paintFirst: "stroke" })} className="h-7 w-10 cursor-pointer rounded border border-serene-neutral-200 p-0.5" />
													<input type="range" min={0} max={30} value={o.strokeWidth ?? 0} onChange={(e) => set({ strokeWidth: Number(e.target.value), stroke: o.stroke || "#000000", paintFirst: "stroke" })} className="flex-1 accent-[#7D2AE8]" />
												</div>
											</div>
											{o.type === "rect" && (
												<label className="block text-xs font-semibold text-serene-neutral-700">Corner roundness
													<input type="range" min={0} max={200} value={(o as unknown as Rect).rx ?? 0} onChange={(e) => set({ rx: Number(e.target.value), ry: Number(e.target.value) })} className="mt-1 w-full accent-[#7D2AE8]" />
												</label>
											)}
											<label className="block text-xs font-semibold text-serene-neutral-700">Blend
												<select value={(o.globalCompositeOperation as string) || "source-over"} onChange={(e) => set({ globalCompositeOperation: e.target.value })} className="mt-1 h-8 w-full rounded-md border border-serene-neutral-200 bg-white px-2 text-sm font-normal">
													{[["source-over", "Normal"], ["multiply", "Multiply"], ["screen", "Screen"], ["overlay", "Overlay"], ["darken", "Darken"], ["lighten", "Lighten"], ["color-dodge", "Colour dodge"], ["difference", "Difference"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
												</select>
											</label>
										</>
									);
								})()}
							</PopoverContent>
						</Popover>
						<Popover>
							<PopoverTrigger asChild><button aria-label="Align" title="Align" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-serene-neutral-100"><AlignHorizontalJustifyCenter className="h-[18px] w-[18px]" /></button></PopoverTrigger>
							<PopoverContent align="start" className="w-52 p-2">
								<div className="grid grid-cols-3 gap-1.5">
									{([["left", "Left"], ["center", "Centre"], ["right", "Right"], ["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"]] as const).map(([k, l]) => <button key={k} onClick={() => alignPage(k)} className="h-8 rounded-lg border border-serene-neutral-200 text-xs hover:bg-serene-neutral-50">{l}</button>)}
								</div>
							</PopoverContent>
						</Popover>
						{(o.type === "activeselection" || o.type === "group") && <button onClick={groupSel} aria-label={o.type === "group" ? "Ungroup" : "Group"} title={o.type === "group" ? "Ungroup" : "Group"} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-serene-neutral-100">{o.type === "group" ? <Ungroup className="h-[18px] w-[18px]" /> : <GroupIcon className="h-[18px] w-[18px]" />}</button>}
						<Popover>
							<PopoverTrigger asChild><button aria-label="Position" title="Position" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-serene-neutral-100"><ArrowUpDown className="h-[18px] w-[18px]" /></button></PopoverTrigger>
							<PopoverContent align="start" className="w-56 space-y-2 p-3">
								<div className="grid grid-cols-2 gap-1.5">
									<button className="h-8 rounded-lg border border-serene-neutral-200 text-xs hover:bg-serene-neutral-50" onClick={() => { const c = canvas.current; if (c && o) { c.bringObjectToFront(o); c.requestRenderAll(); snapshot(); } }}>To front</button>
									<button className="h-8 rounded-lg border border-serene-neutral-200 text-xs hover:bg-serene-neutral-50" onClick={() => { const c = canvas.current; if (c && o) { c.sendObjectToBack(o); c.requestRenderAll(); snapshot(); } }}>To back</button>
									<button className="h-8 rounded-lg border border-serene-neutral-200 text-xs hover:bg-serene-neutral-50" onClick={() => { const c = canvas.current; if (c && o) { c.bringObjectForward(o); c.requestRenderAll(); snapshot(); } }}>Forward</button>
									<button className="h-8 rounded-lg border border-serene-neutral-200 text-xs hover:bg-serene-neutral-50" onClick={() => { const c = canvas.current; if (c && o) { c.sendObjectBackwards(o); c.requestRenderAll(); snapshot(); } }}>Backward</button>
									<button className="h-8 rounded-lg border border-serene-neutral-200 text-xs hover:bg-serene-neutral-50" onClick={() => { const c = canvas.current; if (c && o) { c.centerObjectH(o); o.setCoords(); c.requestRenderAll(); snapshot(); } }}>Centre across</button>
									<button className="h-8 rounded-lg border border-serene-neutral-200 text-xs hover:bg-serene-neutral-50" onClick={() => { const c = canvas.current; if (c && o) { c.centerObjectV(o); o.setCoords(); c.requestRenderAll(); snapshot(); } }}>Centre down</button>
								</div>
								<label className="block text-xs text-serene-neutral-600">Transparency<input type="range" min={0.1} max={1} step={0.05} value={o.opacity ?? 1} onChange={(e) => set({ opacity: Number(e.target.value) })} className="mt-1 w-full accent-[#7D2AE8]" /></label>
							</PopoverContent>
						</Popover>
					</>
				)}
			</div>
		);
	};

	return (
		<div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white">
			{/* One calm bar: File, Resize, Magic and Share hold what used to be eight buttons. */}
			<div className="flex shrink-0 items-center gap-0.5 px-2 py-1.5 text-white sm:gap-1 sm:px-3 sm:py-2" style={{ background: `linear-gradient(90deg, ${CANVA.teal}, ${CANVA.purple})` }}>
				<Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-white hover:bg-white/20 hover:text-white sm:h-8 sm:w-8" aria-label="Back to Design"><Link href="/dashboard/mjengo/design"><ArrowLeft className="h-[18px] w-[18px]" /></Link></Button>

				<DropdownMenu>
					<DropdownMenuTrigger asChild><button className="h-9 shrink-0 rounded-md px-2.5 text-sm font-medium hover:bg-white/20 sm:h-8">File</button></DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-60">
						<DropdownMenuItem asChild><Link href="/dashboard/mjengo/design">New design</Link></DropdownMenuItem>
						<DropdownMenuItem onClick={() => void saveDesign(false)}>Save <span className="ml-auto text-xs text-serene-neutral-400">Ctrl S</span></DropdownMenuItem>
						<DropdownMenuItem onClick={saveAsTemplate}>Save as a template</DropdownMenuItem>
						<DropdownMenuItem onClick={async () => { try { await saveCopy("copy"); toast({ title: "Copy saved" }); } catch { toast({ title: "Could not copy", variant: "destructive" }); } }}>Make a copy</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-xs text-serene-neutral-500">Download</DropdownMenuLabel>
						<DropdownMenuItem onClick={() => void exportAs("png")}>PNG</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void exportAs("png2")}>PNG, double size</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void exportAs("transparent")}>PNG, transparent background</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void exportAs("jpg")}>JPG</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void exportAs("pdf")}>PDF</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void exportAs("svg")}>SVG (vector)</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu>
					<DropdownMenuTrigger asChild><button className="h-9 shrink-0 rounded-md px-2.5 text-sm font-medium hover:bg-white/20 sm:h-8">Resize</button></DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-60">
						<DropdownMenuLabel className="text-xs text-serene-neutral-500">Resize this design (a copy of the original is kept)</DropdownMenuLabel>
						{SIZES.map((sz) => (
							<DropdownMenuItem key={sz.id} onClick={async () => { if (sz.id === size.id) return; try { await saveCopy(`(${size.label})`); } catch { /* resize anyway */ } changeSize(sz); }}>
								<span className={cn(size.id === sz.id && "font-semibold text-sauti-teal")}>{sz.label}</span><span className="ml-auto text-xs text-serene-neutral-400">{sz.w} x {sz.h}</span>
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => {
							const v = window.prompt("Custom size in pixels, like 1500x500", `${size.w}x${size.h}`);
							const m = v && /^(\d{2,5})\s*[x*,]\s*(\d{2,5})$/i.exec(v.trim());
							if (m) changeSize({ id: "custom", label: "Custom", w: Math.min(6000, Number(m[1])), h: Math.min(6000, Number(m[2])) } as never);
						}}>Custom size...</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu>
					<DropdownMenuTrigger asChild><button className="flex h-9 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm font-medium hover:bg-white/20 sm:h-8"><Sparkles className="h-3.5 w-3.5" /> Magic</button></DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-64">
						<DropdownMenuLabel className="text-xs text-serene-neutral-500">On the selected text</DropdownMenuLabel>
						<DropdownMenuItem onClick={() => void writeWithAi("Write a stronger, clearer version of this text")}>Improve the wording</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void writeWithAi("Make this text shorter and punchier")}>Make it shorter</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void writeWithAi("Rewrite this text in a warm, caring tone")}>Make it warmer</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-xs text-serene-neutral-500">On the whole design</DropdownMenuLabel>
						<DropdownMenuItem onClick={() => void translateAll("Swahili")}>Translate to Swahili</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void translateAll("English")}>Translate to English</DropdownMenuItem>
						<DropdownMenuItem onClick={checkDesign}>Check readability and size</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-xs text-serene-neutral-500">On the selected picture</DropdownMenuLabel>
						<DropdownMenuItem onClick={() => void removeBg()}>Remove the background</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void splitSelected()}>Split into layers</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<span className="mx-1 hidden h-5 w-px bg-white/30 sm:block" />
				<Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-white hover:bg-white/20 hover:text-white sm:h-8 sm:w-8" aria-label="Undo" disabled={!canUndo} onClick={() => restore(history.current.at - 1)}><Undo2 className="h-[18px] w-[18px]" /></Button>
				<Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-white hover:bg-white/20 hover:text-white sm:h-8 sm:w-8" aria-label="Redo" disabled={!canRedo} onClick={() => restore(history.current.at + 1)}><Redo2 className="h-[18px] w-[18px]" /></Button>
				<span className="hidden shrink-0 px-1 text-xs text-white/80 md:inline" aria-live="polite">{busy ? "Saving..." : saved ? "All changes saved" : designId ? "Saving soon" : "Not saved yet"}</span>

				<span className="flex-1" />
				<Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Design name" className="hidden h-8 w-52 shrink border-transparent bg-white/15 text-center text-sm font-medium text-white placeholder:text-white/70 focus-visible:ring-white/60 sm:block" />
				<span className="flex-1" />

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button size="sm" className="h-9 shrink-0 gap-1.5 bg-white font-semibold text-[#7D2AE8] hover:bg-white/90 sm:h-8" disabled={busy !== null}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Share</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-60">
						<DropdownMenuItem onClick={saveToStudio}>Post or schedule it</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void saveDesign(false)}>Save the design</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-xs text-serene-neutral-500">Download</DropdownMenuLabel>
						<DropdownMenuItem onClick={() => void exportAs("png")}>PNG</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void exportAs("jpg")}>JPG</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void exportAs("pdf")}>PDF</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="flex min-h-0 flex-1 max-sm:flex-col-reverse">
				{/* Rail and panel: a column on the left on desktop, a bar along the bottom on phones */}
				<nav aria-label="Design tools" className="flex shrink-0 items-center gap-1 border-serene-neutral-100 bg-[#0E1318] py-2 max-sm:h-16 max-sm:w-full max-sm:flex-row max-sm:overflow-x-auto max-sm:border-t max-sm:bg-white max-sm:px-1 max-sm:py-1 sm:w-16 sm:flex-col sm:border-r">
					{rail.map(([k, label, icon]) => (
						<button key={k} onClick={() => setPanel((cur) => (cur === k ? null : k))} aria-pressed={panel === k} className={cn("flex w-14 shrink-0 flex-col items-center gap-1 rounded-xl py-2 text-[11px] max-sm:w-[4.5rem] max-sm:py-1.5", panel === k ? "bg-white/15 text-white max-sm:bg-[#7D2AE8]/10 max-sm:text-[#7D2AE8]" : "text-white/65 hover:bg-white/10 max-sm:text-[#475569] max-sm:hover:bg-black/5")}>{icon}{label}</button>
					))}
				</nav>
				<aside className={cn("shrink-0 overflow-y-auto overflow-x-hidden border-serene-neutral-100 bg-white p-3 sm:w-72 sm:border-r", panel ? "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-16 max-sm:z-30 max-sm:max-h-[45dvh] max-sm:rounded-t-2xl max-sm:border-t max-sm:shadow-2xl" : "hidden")}>
					{panel === "templates" && (
						<div className="space-y-4">
							<div>
								<h3 className="mb-2 text-sm font-semibold">Start from</h3>
								<div className="grid grid-cols-2 gap-2">
									{BUILT_IN.filter((b) => b.id !== "plain").map((b) => (
										<button key={b.id} onClick={() => applyBuilt(b)} className="group rounded-xl text-left transition hover:-translate-y-0.5">
											<TemplatePreview template={b.template} className="group-hover:ring-[#7D2AE8]" />
											<span className="mt-1 block truncate text-xs font-medium">{b.name}</span>
										</button>
									))}
								</div>
							</div>
							<div>
								<div className="mb-2 flex items-center justify-between">
									<h3 className="text-sm font-semibold">Ideas for this page</h3>
									<button onClick={() => setIdeaSeed((n) => n + 1)} className="rounded-md px-2 py-0.5 text-xs font-medium text-[#7D2AE8] hover:bg-[#7D2AE8]/10">Shuffle</button>
								</div>
								<div className="grid grid-cols-2 gap-2">
									{Array.from({ length: uiReady ? 6 : 0 }).map((_, i) => {
										const t = generateTemplate(ideaSeed * 31 + i, { size: size.id });
										return (
											<button key={t.id} onClick={() => applyIdea(t)} className="group text-left transition hover:-translate-y-0.5">
												<TemplatePreview template={t} className="group-hover:ring-[#7D2AE8]" />
												<span className="mt-1 block truncate text-xs font-medium">{t.name}</span>
											</button>
										);
									})}
								</div>
							</div>
							<div>
								<h3 className="mb-2 text-sm font-semibold">Moods</h3>
								<div className="grid grid-cols-3 gap-1.5">
									{CONCEPTS.map((c, i) => (
										<button key={c.id} onClick={() => applyIdea(conceptTemplate(c.id, size.id, i))} title={`${c.name}: ${c.mood}`} className="overflow-hidden rounded-lg ring-1 ring-black/10 transition hover:ring-[#7D2AE8]">
											<span className="flex h-9">{[c.bg, c.accent, c.accent2, c.ink].map((col, k) => <i key={k} className="flex-1" style={{ background: col }} />)}</span>
											<span className="block truncate bg-white px-1 py-0.5 text-[10px] font-medium">{c.name}</span>
										</button>
									))}
								</div>
							</div>
							<div>
								<h3 className="mb-2 text-sm font-semibold">Background</h3>
								<div className="flex flex-wrap gap-1.5">
									{PALETTE.map((c) => <button key={c} aria-label={`Background ${c}`} onClick={() => setBackground(c)} className="h-7 w-7 rounded-full border border-black/10" style={{ background: c }} />)}
									<ColourInput label="Custom background" value="#FFFFFF" onLive={(hex) => setBackground(hex)} onCommit={(hex) => setBackground(hex)} className="h-7 w-9 cursor-pointer rounded border border-serene-neutral-200 p-0.5" />
								</div>
								<div className="mt-2 grid grid-cols-4 gap-1.5">
									{[["#7D2AE8", "#00C4CC"], ["#FF5C8A", "#FFDE59"], ["#0E1318", "#7D2AE8"], ["#068297", "#7FD3E0"], ["#FFF1DB", "#FFD9A8"], ["#1D4ED8", "#38BDF8"], ["#160B2E", "#2A1257"], ["#F1E8FD", "#FFFFFF"]].map(([a, b]) => (
										<button key={a + b} aria-label={`Gradient ${a} to ${b}`} onClick={() => setBackground(a, b)} className="h-9 rounded-lg ring-1 ring-black/10 hover:ring-[#7D2AE8]" style={{ background: `linear-gradient(180deg, ${a}, ${b})` }} />
									))}
								</div>
							</div>
							<div>
								<h3 className="mb-2 text-sm font-semibold">Your templates</h3>
								{mine.filter((t) => (t.data as { template?: boolean }).template).length === 0 ? <p className="text-xs text-serene-neutral-500">Save a design as a template and it appears here for the team.</p> : (
									<ul className="space-y-1">
										{mine.filter((t) => (t.data as { template?: boolean }).template).map((t) => (
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
					{panel === "text" && <TextPanel onPreset={addPreset} onFont={changeFont} current={isText ? (o?.fontFamily ?? null) : null} />}
					{panel === "shapes" && <ElementsPanel onShape={addShape} onQr={(u) => addImage(u, 0.28)} onSvg={(u) => addImage(u, 0.2)} onDraw={() => setDrawing((d) => ({ ...d, on: true }))} />}
					{panel === "brand" && (
						<div className="space-y-5">
							<div>
								<h3 className="mb-2 text-sm font-semibold">Brand colours</h3>
								<div className="flex flex-wrap gap-2">
									{brand.colours.map((c, i) => (
										<button key={c + i} onClick={() => { if (o) set(o.type === "line" ? { stroke: c } : { fill: c }); else setBackground(c); }} onContextMenu={(e) => { e.preventDefault(); saveBrand({ ...brand, colours: brand.colours.filter((_, k) => k !== i) }); }} title={`${c}. Click to apply, right click to remove.`} className="h-9 w-9 rounded-full border border-black/10 shadow-sm hover:scale-110" style={{ background: c }} />
									))}
									<label className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-serene-neutral-300 text-serene-neutral-500 hover:border-[#7D2AE8]" title="Add a colour: it is added once, when you close the picker">+
										<ColourInput label="Add a brand colour" value="#7D2AE8" onCommit={(hex) => { if (!brand.colours.some((c) => c.toLowerCase() === hex.toLowerCase())) saveBrand({ ...brand, colours: [...brand.colours, hex] }); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
									</label>
								</div>
								<PaletteSources className="mt-3" imageUrl={brand.logo} onPick={(hex) => { if (o) set(o.type === "line" ? { stroke: hex } : { fill: hex }); else setBackground(hex); }} onPickAll={(hexes) => saveBrand({ ...brand, colours: [...new Set([...brand.colours, ...hexes])].slice(0, 24) })} />
								<p className="mt-1 text-xs text-serene-neutral-500">Applies to what is selected, or to the background.</p>
							</div>
							<div>
								<h3 className="mb-2 text-sm font-semibold">Brand fonts</h3>
								<ul className="space-y-1">
									{brand.fonts.map((f) => (
										<li key={f} className="flex items-center gap-1">
											<button onClick={() => void changeFont(f)} className="min-w-0 flex-1 truncate rounded-lg border border-serene-neutral-200 px-3 py-2 text-left text-lg hover:border-[#7D2AE8]" style={{ fontFamily: `"${f}", sans-serif` }}>{f}</button>
											<button aria-label={`Remove ${f}`} onClick={() => saveBrand({ ...brand, fonts: brand.fonts.filter((x) => x !== f) })} className="px-2 text-xs text-serene-neutral-400 hover:text-red-600">Remove</button>
										</li>
									))}
								</ul>
								<div className="mt-2"><FontPicker value="Add a font" onChange={(f) => { void ensureFont(f); if (!brand.fonts.includes(f)) saveBrand({ ...brand, fonts: [...brand.fonts, f] }); }} /></div>
							</div>
							<div>
								<h3 className="mb-2 text-sm font-semibold">Logo</h3>
								{brand.logo ? (
									<div className="flex items-center gap-3">
										<button onClick={() => void addImage(brand.logo!, 0.22)} className="flex h-20 w-20 items-center justify-center rounded-xl border border-serene-neutral-200 bg-white p-2 hover:border-[#7D2AE8]" title="Add the logo to the page">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={brand.logo} alt="Brand logo" className="max-h-full max-w-full object-contain" /></button>
										<label className="cursor-pointer text-xs font-medium text-[#7D2AE8] hover:underline">Change<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => saveBrand({ ...brand, logo: String(r.result) }); r.readAsDataURL(f); }} /></label>
									</div>
								) : <label className="cursor-pointer text-sm font-medium text-[#7D2AE8]">Upload a logo<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => saveBrand({ ...brand, logo: String(r.result) }); r.readAsDataURL(f); }} /></label>}
							</div>
						</div>
					)}
					{panel === "uploads" && (
						<>
							<UploadsPanel onPick={(u) => addImage(u)} onUploadClick={() => fileInput.current?.click()} assets={assets} />
							<input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
						</>
					)}
					{panel === "inspire" && (
						<InspirePanel
							onPlace={(data) => addImage(data)}
							onColour={(hex) => { if (o) set(o.type === "line" ? { stroke: hex } : { fill: hex }); else navigator.clipboard?.writeText(hex).then(() => toast({ title: `${hex} copied`, description: "Select something on the page to fill it with a colour." })).catch(() => undefined); }}
							baseColour="#7D2AE8"
						/>
					)}
					{panel === "inspire" && (
						<div className="mt-5 border-t border-serene-neutral-100 pt-4">
							<h3 className="mb-2 text-sm font-semibold">More free places</h3>
							<div className="grid grid-cols-1 gap-2 text-sm">
								{[
									["Canva free templates", "https://www.canva.com/templates/", "Layouts for posters and social posts"],
									["Slidesgo", "https://slidesgo.com/", "Presentation themes"],
									["unDraw", "https://undraw.co/illustrations", "Recolourable illustrations"],
									["Google Fonts", "https://fonts.google.com/", "Open fonts"],
								].map(([n, u, d]) => (
									<a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-serene-neutral-200 p-2.5 hover:border-[#7D2AE8]"><span className="block font-semibold">{n}</span><span className="block text-xs text-serene-neutral-500">{d}</span></a>
								))}
							</div>
							<p className="mt-2 text-xs text-serene-neutral-500">Check each licence before using an image in public.</p>
						</div>
					)}
				</aside>

				{propBar("sm:hidden")}

				{/* Page */}
				<div ref={host} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#EBECF0]">
					{o && <div className="pointer-events-none absolute inset-x-0 top-3 z-20 hidden justify-center px-3 sm:flex"><div className="pointer-events-auto max-w-full overflow-x-auto">{propBar("", true)}</div></div>}
					{drawing.on && (
						<div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-black/10 bg-white px-3 py-2 shadow-lg">
							<span className="text-xs font-semibold text-sauti-dark">Drawing</span>
							<input type="color" value={drawing.color} onChange={(e) => setDrawing((d) => ({ ...d, color: e.target.value }))} aria-label="Pen colour" className="h-7 w-9 cursor-pointer rounded border border-serene-neutral-200 p-0.5" />
							<input type="range" min={1} max={60} value={drawing.width} onChange={(e) => setDrawing((d) => ({ ...d, width: Number(e.target.value) }))} aria-label="Pen width" className="w-28 accent-[#7D2AE8]" />
							<button onClick={() => setDrawing((d) => ({ ...d, on: false }))} className="rounded-lg bg-sauti-teal px-3 py-1 text-xs font-semibold text-white">Done</button>
						</div>
					)}
					{(guides.v !== null || guides.h !== null) && el.current && host.current && (() => {
						const hr = host.current!.getBoundingClientRect();
						const cr = el.current!.getBoundingClientRect();
						const z = canvas.current?.getZoom() ?? 1;
						return (
							<>
								{guides.v !== null && <div className="pointer-events-none absolute z-20 w-px bg-[#FF3D81]" style={{ left: cr.left - hr.left + guides.v * z, top: cr.top - hr.top, height: cr.height }} />}
								{guides.h !== null && <div className="pointer-events-none absolute z-20 h-px bg-[#FF3D81]" style={{ top: cr.top - hr.top + guides.h * z, left: cr.left - hr.left, width: cr.width }} />}
							</>
						);
					})()}
					<div className="absolute inset-x-0 bottom-9 top-0 flex items-center justify-center overflow-auto p-4 pt-16">
						<div className="shrink-0 shadow-xl"><canvas ref={el} /></div>
					</div>
					{(() => {
						// A small toolbar rides above the selected object: lock, duplicate, delete.
						if (!o || !host.current || !el.current) return null;
						const hr = host.current.getBoundingClientRect();
						const cr = el.current.getBoundingClientRect();
						const z = canvas.current?.getZoom() ?? 1;
						const ac = o.aCoords;
						const x = Math.max(70, Math.min(hr.width - 70, cr.left - hr.left + (((ac.tl.x + ac.br.x) / 2) * z)));
						const y = Math.max(64, cr.top - hr.top + Math.min(ac.tl.y, ac.br.y) * z - 44);
						const locked = !!o.lockMovementX;
						return (
							<div className="absolute z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-black/10 bg-white p-0.5 shadow-lg" style={{ left: x, top: y }}>
								<button aria-label={locked ? "Unlock" : "Lock"} title={locked ? "Unlock" : "Lock"} className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold hover:bg-serene-neutral-100", locked && "bg-[#7D2AE8]/10 text-[#7D2AE8]")} onClick={() => { o.set({ lockMovementX: !locked, lockMovementY: !locked, lockRotation: !locked, lockScalingX: !locked, lockScalingY: !locked, hasControls: locked }); canvas.current?.requestRenderAll(); bump((n) => n + 1); }}>{locked ? "Unlock" : "Lock"}</button>
								<button aria-label="Duplicate" title="Duplicate" className="flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold hover:bg-serene-neutral-100" onClick={async () => { const c = canvas.current; if (!c) return; const copy = await o.clone(); copy.set({ left: (o.left ?? 0) + 24, top: (o.top ?? 0) + 24 }); c.add(copy); c.setActiveObject(copy); c.requestRenderAll(); }}>Duplicate</button>
								<button aria-label="Delete" title="Delete" className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50" onClick={() => { const c = canvas.current; if (c) { c.remove(o); c.discardActiveObject(); c.requestRenderAll(); } }}><Trash2 className="h-4 w-4" /></button>
							</div>
						);
					})()}
					<div className="absolute inset-x-0 bottom-0 z-10 flex h-9 items-center gap-3 border-t border-black/[0.07] bg-white px-3 text-xs text-serene-neutral-600">
						<span className="hidden sm:inline">{size.label}</span>
						<span className="flex-1" />
						<button aria-label="Zoom out" onClick={() => setZoomMul((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))} className="flex h-6 w-6 items-center justify-center rounded hover:bg-serene-neutral-100">-</button>
						<input type="range" min={0.25} max={2} step={0.05} value={zoomMul} onChange={(e) => setZoomMul(Number(e.target.value))} aria-label="Zoom" className="w-28 accent-[#7D2AE8]" />
						<button aria-label="Zoom in" onClick={() => setZoomMul((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))} className="flex h-6 w-6 items-center justify-center rounded hover:bg-serene-neutral-100">+</button>
						<button onClick={() => setZoomMul(1)} className="w-12 rounded px-1 text-center font-medium hover:bg-serene-neutral-100" title="Fit the page">{Math.round(scale * 100)}%</button>
						<span className="hidden sm:inline">Page 1 / 1</span>
						<button aria-label="Full screen" onClick={() => { const e = host.current?.parentElement?.parentElement; if (document.fullscreenElement) void document.exitFullscreen(); else void e?.requestFullscreen?.(); }} className="rounded px-1.5 py-0.5 font-medium hover:bg-serene-neutral-100">Full screen</button>
					</div>
					<Popover>
						<PopoverTrigger asChild><button aria-label="Layers" className="absolute bottom-12 right-3 z-10 flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-serene-neutral-700 shadow-md ring-1 ring-black/10 hover:bg-serene-neutral-50"><Layers className="h-4 w-4" /> Layers</button></PopoverTrigger>
						<PopoverContent align="end" side="top" className="max-h-96 w-80 overflow-y-auto p-1.5">
							{(canvas.current?.getObjects() ?? []).length === 0 && <p className="p-3 text-xs text-serene-neutral-500">Nothing on the page yet.</p>}
							{[...(canvas.current?.getObjects() ?? [])].reverse().map((ob, i, all) => {
								const kind = ob.type === "textbox" ? "Text" : ob.type === "image" ? "Picture" : ob.type === "circle" ? "Circle" : ob.type === "rect" ? "Shape" : ob.type === "path" ? "Graphic" : "Shape";
								const label = ob.type === "textbox" ? String((ob as Textbox).text ?? "").slice(0, 28) || "Text" : kind;
								const active = canvas.current?.getActiveObject() === ob;
								const total = all.length;
								// The list shows the top layer first; the canvas counts from the bottom.
								const objIndex = total - 1 - i;
								const moveTo = (to: number) => { const c = canvas.current; if (!c) return; c.moveObjectTo(ob, Math.max(0, Math.min(total - 1, to))); c.requestRenderAll(); snapshot(); setSaved(false); bump((n) => n + 1); };
								return (
									<div
										key={i}
										draggable
										onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(objIndex)); e.dataTransfer.effectAllowed = "move"; }}
										onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
										onDrop={(e) => {
											e.preventDefault();
											const from = Number(e.dataTransfer.getData("text/plain"));
											const c = canvas.current;
											if (!c || Number.isNaN(from) || from === objIndex) return;
											const moving = c.getObjects()[from];
											if (!moving) return;
											c.moveObjectTo(moving, objIndex);
											c.requestRenderAll(); snapshot(); setSaved(false); bump((n) => n + 1);
										}}
										className={cn("group flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm", active ? "bg-sauti-teal-light" : "hover:bg-serene-neutral-100")}
									>
										<span className="cursor-grab text-serene-neutral-300 active:cursor-grabbing" aria-hidden><GripVertical className="h-4 w-4" /></span>
										<button className="min-w-0 flex-1 truncate text-left" onClick={() => { canvas.current?.setActiveObject(ob); canvas.current?.requestRenderAll(); bump((n) => n + 1); }}><span className="mr-1.5 text-xs text-serene-neutral-400">{kind}</span>{ob.type === "textbox" ? label : ""}</button>
										<button aria-label="Move up" disabled={objIndex >= total - 1} className="flex h-6 w-6 items-center justify-center rounded text-serene-neutral-500 hover:bg-white disabled:opacity-30" onClick={() => moveTo(objIndex + 1)}><ChevronUp className="h-4 w-4" /></button>
										<button aria-label="Move down" disabled={objIndex <= 0} className="flex h-6 w-6 items-center justify-center rounded text-serene-neutral-500 hover:bg-white disabled:opacity-30" onClick={() => moveTo(objIndex - 1)}><ChevronDown className="h-4 w-4" /></button>
										<button aria-label={ob.visible === false ? "Show" : "Hide"} className="flex h-6 w-6 items-center justify-center rounded text-serene-neutral-500 hover:bg-white" onClick={() => { ob.set({ visible: ob.visible === false }); canvas.current?.requestRenderAll(); snapshot(); bump((n) => n + 1); }}>{ob.visible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
										<button aria-label="Delete layer" className="flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-red-50" onClick={() => { canvas.current?.remove(ob); canvas.current?.requestRenderAll(); snapshot(); bump((n) => n + 1); }}><Trash2 className="h-4 w-4" /></button>
									</div>
								);
							})}
						</PopoverContent>
					</Popover>
				</div>
			</div>
			{magic && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
					<div className="rounded-2xl border border-serene-neutral-200 bg-white px-6 py-5 text-center shadow-xl"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#7D2AE8]" /><p className="mt-2 text-sm font-semibold text-sauti-dark">{magic}</p></div>
				</div>
			)}
			{checks && (
				<div className="absolute bottom-14 left-1/2 z-40 w-[min(92vw,460px)] -translate-x-1/2 rounded-2xl border border-serene-neutral-200 bg-white p-4 shadow-xl">
					<div className="flex items-center gap-2">
						<p className="flex-1 text-sm font-semibold text-sauti-dark">{checks.ok ? "Looks good: the text is readable and large enough" : `${checks.items.length} thing${checks.items.length === 1 ? "" : "s"} to look at`}</p>
						<button onClick={() => setChecks(null)} className="rounded-md px-2 py-1 text-xs text-serene-neutral-500 hover:bg-serene-neutral-100">Close</button>
					</div>
					{!checks.ok && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-serene-neutral-700">{checks.items.map((t, i) => <li key={i}>{t}</li>)}</ul>}
				</div>
			)}
			{splitting && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
					<div className="w-[min(92vw,380px)] rounded-2xl border border-serene-neutral-200 bg-white p-6 text-center shadow-xl">
						<MjengoLoader compact label="Splitting into layers" />
						<p className="text-sm font-semibold text-sauti-dark">Splitting into layers</p>
						<p className="mt-1 text-xs text-serene-neutral-500">{splitting}. This runs on your device and the first time takes a little longer.</p>
						<Button variant="outline" size="sm" className="mt-4" onClick={() => { skipSplit.current = true; }}>Keep it as one picture</Button>
					</div>
				</div>
			)}
			{offer && !splitting && (
				<div className="absolute bottom-4 left-1/2 z-40 flex w-[min(92vw,460px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-serene-neutral-200 bg-white p-3 shadow-xl">
					<div className="min-w-0 flex-1">
						<p className="text-sm font-semibold text-sauti-dark">Make this editable</p>
						<p className="text-xs text-serene-neutral-500">Split it into a background, the subject and its text, each one a layer you can move or change.</p>
					</div>
					<Button size="sm" className="shrink-0 bg-[#7D2AE8] hover:bg-[#6a22c9]" onClick={() => { const o = offer; setOffer(null); void splitAndPlace(o.data, o.img); }}>Split into layers</Button>
					<Button size="sm" variant="ghost" className="shrink-0" onClick={() => setOffer(null)}>Not now</Button>
				</div>
			)}
			<PostThis open={!!postFor} assetId={postFor} about={name} onClose={() => setPostFor(null)} />
		</div>
	);
}

export default function DesignEditorPage() {
	return (
		<Suspense fallback={<MjengoLoader label="Opening the editor" className="h-full min-h-0" />}>
			<DesignEditor />
		</Suspense>
	);
}
