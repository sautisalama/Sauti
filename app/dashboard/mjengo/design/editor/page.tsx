"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { MjengoLoader } from "../../_components/MjengoLoader";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Canvas, Circle, FabricImage, Gradient, Line, Path, Rect, Textbox, Triangle, type FabricObject } from "fabric";
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Copy, Download, Image as ImageIcon, Italic, Gift, Layers, LayoutTemplate, Loader2, Redo2, Save, Shapes, Sparkles, Trash2, Type, Undo2, Upload } from "lucide-react";
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
import { splitIntoLayers, type LayerSplit } from "@/lib/client/split-layers";
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

type Panel = "templates" | "text" | "shapes" | "uploads" | "inspire";
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
		const want = new URLSearchParams(window.location.search).get("size");
		return SIZES.find((x) => x.id === want) ?? SIZES[0];
	});
	const [ideaSeed, setIdeaSeed] = useState(1);
	const [zoomMul, setZoomMul] = useState(1);
	const zoomRef = useRef(1);
	zoomRef.current = zoomMul;
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
			if (match) setSize(match);
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
		history.current.lock = true;
		c.clear();
		b.build(c, size.w, size.h);
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
		if (match) setSize(match);
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

	/** Keep the design (not just a picture of it) so it can be reopened and changed. */
	const saveDesign = async () => {
		setBusy("save");
		try {
			const c = canvas.current!;
			c.discardActiveObject();
			c.renderAll();
			const thumb = c.toDataURL({ format: "jpeg", quality: 0.7, multiplier: Math.min(1, 360 / size.w) / scale });
			const row = await unwrap(saveTemplate(designId, { kind: "design", name: name || "Untitled design", data: { json: c.toJSON(), w: size.w, h: size.h, thumb, template: false } }));
			setDesignId(row.id);
			setSaved(true);
			window.history.replaceState(null, "", `/dashboard/mjengo/design/editor?id=${row.id}`);
			toast({ title: "Design saved" });
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
									<PopoverTrigger asChild><button className="h-8 shrink-0 rounded-lg px-2 text-xs font-medium hover:bg-serene-neutral-100">Spacing</button></PopoverTrigger>
									<PopoverContent align="start" className="w-56 space-y-3 p-3">
										<label className="block text-xs text-serene-neutral-600">Letter spacing<input type="range" min={-50} max={500} step={10} value={t?.charSpacing ?? 0} onChange={(e) => set({ charSpacing: Number(e.target.value) })} className="mt-1 w-full accent-[#7D2AE8]" /></label>
										<label className="block text-xs text-serene-neutral-600">Line spacing<input type="range" min={0.8} max={2.5} step={0.05} value={t?.lineHeight ?? 1.2} onChange={(e) => set({ lineHeight: Number(e.target.value) })} className="mt-1 w-full accent-[#7D2AE8]" /></label>
									</PopoverContent>
								</Popover>
							</>
						)}
						{sep}
						{o.type === "image" && <button onClick={splitSelected} className="h-8 shrink-0 rounded-lg bg-[#7D2AE8]/10 px-2.5 text-xs font-semibold text-[#7D2AE8] hover:bg-[#7D2AE8]/15">Split into layers</button>}
						<Popover>
							<PopoverTrigger asChild><button className="h-8 shrink-0 rounded-lg px-2 text-xs font-medium hover:bg-serene-neutral-100">Position</button></PopoverTrigger>
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
			{/* Canva-style header: a slim bar on phones, with the name and size moved into the tool strip */}
			<div className="flex shrink-0 items-center gap-1 px-2 py-1.5 text-white sm:gap-2 sm:px-3 sm:py-2" style={{ background: `linear-gradient(90deg, ${CANVA.teal}, ${CANVA.purple})` }}>
				<Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-white hover:bg-white/20 hover:text-white sm:h-8 sm:w-8" aria-label="Back"><Link href="/dashboard/mjengo/design"><ArrowLeft className="h-[18px] w-[18px]" /></Link></Button>
				<Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Design name" className="hidden h-8 w-44 border-transparent bg-white/15 text-sm font-medium text-white placeholder:text-white/70 focus-visible:ring-white/60 sm:block" />
				<select value={size.id} onChange={(e) => changeSize(SIZES.find((s) => s.id === e.target.value)!)} aria-label="Size" className="hidden h-8 rounded-md border border-white/30 bg-white/15 px-2 text-sm text-white sm:block">
					{SIZES.map((s) => <option key={s.id} value={s.id} className="text-black">{s.label}</option>)}
				</select>
				<Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-white hover:bg-white/20 hover:text-white sm:h-8 sm:w-8" aria-label="Undo" disabled={!canUndo} onClick={() => restore(history.current.at - 1)}><Undo2 className="h-[18px] w-[18px]" /></Button>
				<Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-white hover:bg-white/20 hover:text-white sm:h-8 sm:w-8" aria-label="Redo" disabled={!canRedo} onClick={() => restore(history.current.at + 1)}><Redo2 className="h-[18px] w-[18px]" /></Button>
				<span className="min-w-0 flex-1 truncate px-1 text-sm font-medium sm:hidden">{name}</span>
				<span className="hidden flex-1 sm:block" />
				<Button variant="ghost" size="sm" className="hidden h-8 gap-1.5 text-white hover:bg-white/20 hover:text-white sm:inline-flex" onClick={saveAsTemplate} disabled={busy !== null}><Copy className="h-4 w-4" /><span className="hidden lg:inline">Save as template</span></Button>
				<Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-white hover:bg-white/20 hover:text-white sm:hidden" aria-label="Download" onClick={download}><Download className="h-[18px] w-[18px]" /></Button>
				<Button variant="ghost" size="sm" className="hidden h-8 gap-1.5 text-white hover:bg-white/20 hover:text-white sm:inline-flex" onClick={download}><Download className="h-4 w-4" /><span className="hidden lg:inline">Download</span></Button>
				<span className="hidden text-xs text-white/80 lg:inline">{saved ? "Saved" : "Unsaved changes"}</span>
				<Button variant="ghost" size="sm" className="h-9 shrink-0 gap-1.5 text-white hover:bg-white/20 hover:text-white sm:h-8" onClick={saveDesign} disabled={busy !== null}><Save className="h-4 w-4" /><span className="hidden sm:inline">Save</span></Button>
				<Button size="sm" className="h-9 shrink-0 gap-1.5 bg-white text-[#7D2AE8] hover:bg-white/90 sm:h-8" onClick={saveToStudio} disabled={busy !== null} aria-label="Save picture">{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}<span className="hidden sm:inline">Save picture</span></Button>
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
									{Array.from({ length: 6 }).map((_, i) => {
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
									<input type="color" aria-label="Custom background" onChange={(e) => setBackground(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-serene-neutral-200 p-0.5" />
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
					{panel === "shapes" && <ElementsPanel onShape={addShape} onQr={(u) => addImage(u, 0.28)} onSvg={(u) => addImage(u, 0.2)} />}
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
						<PopoverContent align="end" side="top" className="max-h-80 w-72 overflow-y-auto p-1.5">
							{(canvas.current?.getObjects() ?? []).length === 0 && <p className="p-3 text-xs text-serene-neutral-500">Nothing on the page yet.</p>}
							{[...(canvas.current?.getObjects() ?? [])].reverse().map((ob, i) => {
								const kind = ob.type === "textbox" ? "Text" : ob.type === "image" ? "Picture" : ob.type === "circle" ? "Circle" : ob.type === "rect" ? "Shape" : ob.type === "path" ? "Graphic" : "Shape";
								const label = ob.type === "textbox" ? String((ob as Textbox).text ?? "").slice(0, 28) || "Text" : kind;
								const active = canvas.current?.getActiveObject() === ob;
								return (
									<div key={i} className={cn("group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm", active ? "bg-sauti-teal-light" : "hover:bg-serene-neutral-100")}>
										<button className="min-w-0 flex-1 truncate text-left" onClick={() => { canvas.current?.setActiveObject(ob); canvas.current?.requestRenderAll(); bump((n) => n + 1); }}><span className="mr-1.5 text-xs text-serene-neutral-400">{kind}</span>{ob.type === "textbox" ? label : ""}</button>
										<button aria-label={ob.visible === false ? "Show" : "Hide"} className="px-1 text-xs text-serene-neutral-500 hover:text-serene-neutral-900" onClick={() => { ob.set({ visible: ob.visible === false }); canvas.current?.requestRenderAll(); snapshot(); bump((n) => n + 1); }}>{ob.visible === false ? "Show" : "Hide"}</button>
										<button aria-label="Delete layer" className="px-1 text-xs text-red-600" onClick={() => { canvas.current?.remove(ob); canvas.current?.requestRenderAll(); bump((n) => n + 1); }}>Delete</button>
									</div>
								);
							})}
						</PopoverContent>
					</Popover>
				</div>
			</div>
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
