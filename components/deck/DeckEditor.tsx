"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, BringToFront, Circle, Copy, Download, ExternalLink, ImageIcon, Italic, LayoutTemplate, Loader2, Minus, Palette, Play, Plus, Redo2, SendToBack, Sparkles, Square, SquareRoundCorner, Trash2, Type, Undo2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { useDeckDoc } from "@/lib/client/deck-live";
import { BLANK_SPEC, H, LAYOUT_NAMES, TEMPLATES, THEMES, W, buildDeck, layoutEls, resolve, templateDeck, uid, type Deck, type El, type LayoutKind, type Slide, type Theme } from "@/lib/deck/model";
import { deckToPptx } from "@/lib/deck/export";
import { generateDeck, deckAssetUrls } from "@/app/actions/mjengo-deck";
import { sharePhotoRegister, sharePhotoUpload } from "@/app/actions/mjengo-ideas";
import { inspireSearch, type InspireItem } from "@/app/actions/mjengo-inspire";
import { listAssets, type AssetRow } from "@/app/actions/mjengo-ai";
import { LivePeople } from "@/components/LivePeople";
import { SlideView, elStyle, srcOf, textStyle } from "./SlideView";

type Handle = "nw" | "ne" | "sw" | "se";
const SWATCHES = ["@text", "@muted", "@accent", "@accent2", "@bg", "@surface", "#FFFFFF", "#000000", "#E5484D", "#F59E0B", "#16A34A", "#2563EB"];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/**
 * The presentation editor. Everything on a slide is a box that is dragged, resized, typed into and recoloured; slides
 * are added from layouts, templates or AI. People editing the same presentation see each other's changes at once, and
 * each person's name and photo appears on the box they have selected. Undo and redo are the person's own.
 */
export function DeckEditor({ roomId, seed, me, canEdit, onDeck, start }: {
	roomId: string | null; seed: Deck; me: { id?: string; name: string; avatar?: string | null } | null; canEdit: boolean; onDeck: (d: Deck) => void;
	/** Opens one of these panels when the editor first shows. */
	start?: "templates" | "ai" | null;
}) {
	const { toast } = useToast();
	const { deck, people, synced, ops, select, canUndo, canRedo, undo, redo } = useDeckDoc({ roomId, seed, me, enabled: true });
	const [cur, setCur] = useState<string | null>(null);
	const [sel, setSel] = useState<string | null>(null);
	const [editing, setEditing] = useState<string | null>(null);
	const [drag, setDrag] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
	const [urls, setUrls] = useState<Record<string, string>>({});
	const [panel, setPanel] = useState<null | "templates" | "ai" | "image" | "canva">(start ?? null);
	const [presenting, setPresenting] = useState(false);
	const stage = useRef<HTMLDivElement>(null);
	const [box, setBox] = useState({ w: 800, h: 450 });

	useEffect(() => { if (deck) onDeck(deck); }, [deck, onDeck]);
	useEffect(() => { if (deck && (!cur || !deck.slides.some((s) => s.id === cur))) setCur(deck.slides[0]?.id ?? null); }, [deck, cur]);
	useEffect(() => { select(cur, sel); }, [cur, sel, select]);

	// The slide is as big as the space allows.
	useEffect(() => {
		const el = stage.current;
		if (!el) return;
		const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
		ro.observe(el);
		setBox({ w: el.clientWidth, h: el.clientHeight });
		return () => ro.disconnect();
	}, [!!deck]);
	const width = Math.max(240, Math.min(box.w - 32, (box.h - 32) * (W / H)));
	const scale = width / W;

	// Pictures kept in the library need fresh links.
	const assetKey = useMemo(() => (deck ? [...new Set(deck.slides.flatMap((s) => s.els.map((e) => e.src ?? "")).filter((x) => x.startsWith("asset:")).map((x) => x.slice(6)))].sort().join(",") : ""), [deck]);
	useEffect(() => {
		const need = assetKey.split(",").filter((i) => i && !urls[i]);
		if (!need.length) return;
		unwrap(deckAssetUrls(need)).then((m) => setUrls((u) => ({ ...u, ...m }))).catch(() => undefined);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [assetKey]);

	const slide = deck?.slides.find((s) => s.id === cur) ?? null;
	const el = slide?.els.find((e) => e.id === sel) ?? null;
	const theme = deck?.theme ?? THEMES[0];

	const addEl = useCallback((e: El) => { if (!cur) return; ops.addEl(cur, e); setSel(e.id); }, [cur, ops]);
	const newSlide = (kind: LayoutKind) => {
		if (!deck) return;
		const s: Slide = { id: uid(), notes: "", els: layoutEls(BLANK_SPEC[kind]) };
		const id = ops.addSlide(s, cur);
		setCur(id); setSel(null);
	};
	const removeSel = useCallback(() => { if (cur && sel) { ops.removeEl(cur, sel); setSel(null); } }, [cur, sel, ops]);
	const dupEl = useCallback(() => { if (cur && el) addEl({ ...el, id: uid(), x: el.x + 20, y: el.y + 20 }); }, [cur, el, addEl]);

	// Keyboard: delete, nudge, duplicate, undo and redo (not while typing).
	useEffect(() => {
		const onKey = (ev: KeyboardEvent) => {
			const t = ev.target as HTMLElement;
			if (t.closest("input, textarea, [contenteditable=true], [role=dialog]") || presenting) return;
			const mod = ev.ctrlKey || ev.metaKey;
			if (mod && ev.key.toLowerCase() === "z") { ev.preventDefault(); if (ev.shiftKey) redo(); else undo(); return; }
			if (mod && ev.key.toLowerCase() === "y") { ev.preventDefault(); redo(); return; }
			if (!canEdit) return;
			if (mod && ev.key.toLowerCase() === "d") { ev.preventDefault(); dupEl(); return; }
			if ((ev.key === "Delete" || ev.key === "Backspace") && sel) { ev.preventDefault(); removeSel(); return; }
			if (sel && el && cur && ev.key.startsWith("Arrow")) {
				ev.preventDefault();
				const d = ev.shiftKey ? 10 : 1;
				ops.updateEl(cur, sel, { x: el.x + (ev.key === "ArrowRight" ? d : ev.key === "ArrowLeft" ? -d : 0), y: el.y + (ev.key === "ArrowDown" ? d : ev.key === "ArrowUp" ? -d : 0) });
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [sel, el, cur, canEdit, presenting, undo, redo, dupEl, removeSel, ops]);

	/** Move or resize a box with the pointer: smooth on this screen, sent to the others a few times a second. */
	const startDrag = (ev: React.PointerEvent, e: El, mode: "move" | Handle) => {
		if (!canEdit || !cur || editing === e.id) return;
		ev.stopPropagation();
		ev.preventDefault();
		setSel(e.id);
		const sx = ev.clientX, sy = ev.clientY;
		const o = { x: e.x, y: e.y, w: e.w, h: e.h };
		let last = 0;
		let next = o;
		let moved = false;
		const move = (m: PointerEvent) => {
			const dx = (m.clientX - sx) / scale, dy = (m.clientY - sy) / scale;
			if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
			moved = true;
			if (mode === "move") next = { ...o, x: clamp(o.x + dx, -o.w + 20, W - 20), y: clamp(o.y + dy, -o.h + 20, H - 20) };
			else {
				let { x, y, w, h } = o;
				if (mode.includes("e")) w = Math.max(20, o.w + dx);
				if (mode.includes("w")) { w = Math.max(20, o.w - dx); x = o.x + o.w - w; }
				if (mode.includes("s")) h = Math.max(20, o.h + dy);
				if (mode.includes("n")) { h = Math.max(20, o.h - dy); y = o.y + o.h - h; }
				next = { x, y, w, h };
			}
			setDrag({ id: e.id, ...next });
			if (Date.now() - last > 90) { last = Date.now(); ops.updateEl(cur, e.id, next); }
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			if (moved) ops.updateEl(cur, e.id, next);
			setDrag(null);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};

	const exportPptx = async () => {
		if (!deck) return;
		try {
			const blob = await deckToPptx(deck, urls);
			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = `${deck.title.replace(/[^\w\- ]+/g, "").trim() || "Presentation"}.pptx`;
			a.click();
			setTimeout(() => URL.revokeObjectURL(a.href), 4000);
			return true;
		} catch (e) { toast({ title: "Could not make the PowerPoint file", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); return false; }
	};

	if (!deck || !slide) return <div className="flex h-full items-center justify-center gap-2 text-sm text-serene-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> {synced ? "Opening the slides" : "Joining the presentation"}</div>;

	const idx = deck.slides.findIndex((s) => s.id === slide.id);
	const peopleHere = people.filter((p) => true);
	const patch = (p: Partial<El>) => { if (cur && sel) ops.updateEl(cur, sel, p); };
	const isText = el?.type === "text";

	return (
		<div className="flex h-full min-h-0 flex-col bg-serene-neutral-50">
			{/* Toolbar */}
			<div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-black/[0.07] bg-white px-2 py-1.5">
				<Input value={deck.title} disabled={!canEdit} onChange={(e) => ops.setTitle(e.target.value)} aria-label="Presentation title" className="mr-1 h-8 w-44 border-transparent px-2 text-sm font-medium shadow-none hover:border-black/10 sm:w-56" />
				<Tip label="Undo (Ctrl Z)"><Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canUndo || !canEdit} onClick={undo}><Undo2 className="h-4 w-4" /></Button></Tip>
				<Tip label="Redo (Ctrl Y)"><Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canRedo || !canEdit} onClick={redo}><Redo2 className="h-4 w-4" /></Button></Tip>
				<Sep />
				<Tip label="Add text"><Button variant="ghost" size="sm" className="h-8 gap-1.5" disabled={!canEdit} onClick={() => addEl({ id: uid(), type: "text", x: 120, y: 200, w: 480, h: 80, text: "Type here", size: 28, color: "@text", font: "body", align: "left", valign: "top" })}><Type className="h-4 w-4" /><span className="hidden md:inline">Text</span></Button></Tip>
				<DropdownMenu>
					<DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 gap-1.5" disabled={!canEdit}><Square className="h-4 w-4" /><span className="hidden md:inline">Shape</span></Button></DropdownMenuTrigger>
					<DropdownMenuContent>
						{([["rect", "Rectangle", Square], ["round", "Rounded", SquareRoundCorner], ["ellipse", "Circle", Circle]] as const).map(([shape, label, Icon]) => (
							<DropdownMenuItem key={shape} onSelect={() => addEl({ id: uid(), type: "shape", x: 300, y: 170, w: 240, h: 180, fill: "@accent", shape })}><Icon className="mr-2 h-4 w-4" />{label}</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				<Tip label="Add a picture"><Button variant="ghost" size="sm" className="h-8 gap-1.5" disabled={!canEdit} onClick={() => setPanel("image")}><ImageIcon className="h-4 w-4" /><span className="hidden md:inline">Picture</span></Button></Tip>

				{el && canEdit && (
					<>
						<Sep />
						{isText && (
							<>
								<Tip label="Smaller"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => patch({ size: Math.max(8, (el.size ?? 24) - 2) })}><Minus className="h-4 w-4" /></Button></Tip>
								<span className="w-7 text-center text-xs tabular-nums">{el.size ?? 24}</span>
								<Tip label="Larger"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => patch({ size: Math.min(160, (el.size ?? 24) + 2) })}><Plus className="h-4 w-4" /></Button></Tip>
								<Tip label="Bold"><Button variant={el.bold ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => patch({ bold: !el.bold })}><Bold className="h-4 w-4" /></Button></Tip>
								<Tip label="Italic"><Button variant={el.italic ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => patch({ italic: !el.italic })}><Italic className="h-4 w-4" /></Button></Tip>
								{([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => <Button key={a} variant={(el.align ?? "left") === a ? "secondary" : "ghost"} size="icon" className="h-8 w-8" aria-label={`Align ${a}`} onClick={() => patch({ align: a })}><Icon className="h-4 w-4" /></Button>)}
								<Swatch label="Text colour" value={el.color ?? "@text"} theme={theme} onPick={(c) => patch({ color: c })} />
							</>
						)}
						{el.type === "shape" && <Swatch label="Fill colour" value={el.fill ?? "@surface"} theme={theme} onPick={(c) => patch({ fill: c })} />}
						{el.type === "image" && <Button variant="ghost" size="sm" className="h-8" onClick={() => patch({ fit: el.fit === "contain" ? "cover" : "contain" })}>{el.fit === "contain" ? "Fill the box" : "Fit inside"}</Button>}
						<Tip label="Bring to front"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cur && sel && ops.layer(cur, sel, 1)}><BringToFront className="h-4 w-4" /></Button></Tip>
						<Tip label="Send to back"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cur && sel && ops.layer(cur, sel, -1)}><SendToBack className="h-4 w-4" /></Button></Tip>
						<Tip label="Duplicate (Ctrl D)"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={dupEl}><Copy className="h-4 w-4" /></Button></Tip>
						<Tip label="Delete"><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={removeSel}><Trash2 className="h-4 w-4" /></Button></Tip>
					</>
				)}

				<span className="flex-1" />
				<LivePeople people={peopleHere.map((p) => ({ key: p.key, name: p.name, avatar: p.avatar, color: p.color, at: p.slide ? `slide ${(deck.slides.findIndex((s) => s.id === p.slide) + 1) || "?"}` : null }))} className="mr-1" />
				{canEdit && (
					<>
						<DropdownMenu>
							<DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 gap-1.5"><Palette className="h-4 w-4" /><span className="hidden md:inline">Theme</span></Button></DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuLabel>Colours and fonts</DropdownMenuLabel>
								{THEMES.map((t) => (
									<DropdownMenuItem key={t.id} onSelect={() => ops.setTheme(t)} className="gap-2">
										<span className="flex overflow-hidden rounded ring-1 ring-black/10">{[t.bg, t.accent, t.accent2, t.text].map((c, i) => <span key={i} className="h-5 w-4" style={{ background: c }} />)}</span>
										{t.name}{t.id === theme.id && <span className="ml-auto text-xs text-sauti-teal">Current</span>}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
						<Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => setPanel("templates")}><LayoutTemplate className="h-4 w-4" /><span className="hidden md:inline">Templates</span></Button>
						<Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[#7c3aed]" onClick={() => setPanel("ai")}><Sparkles className="h-4 w-4" /><span className="hidden md:inline">Write with AI</span></Button>
					</>
				)}
				<DropdownMenu>
					<DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-1.5"><Download className="h-4 w-4" /><span className="hidden md:inline">Export</span></Button></DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => void exportPptx()}><Download className="mr-2 h-4 w-4" />PowerPoint (.pptx)</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setPanel("canva")}><ExternalLink className="mr-2 h-4 w-4" />Edit in Canva</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<Button size="sm" className="h-8 gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => setPresenting(true)}><Play className="h-4 w-4" /> Present</Button>
			</div>

			<div className="flex min-h-0 flex-1">
				{/* Slides */}
				<div className="hidden w-[184px] shrink-0 flex-col overflow-y-auto border-r border-black/[0.07] bg-white p-2 md:flex">
					{deck.slides.map((s, i) => (
						<div
							key={s.id}
							draggable={canEdit}
							onDragStart={(e) => e.dataTransfer.setData("text/x-slide", s.id)}
							onDragOver={(e) => canEdit && e.preventDefault()}
							onDrop={(e) => { const id = e.dataTransfer.getData("text/x-slide"); if (id && id !== s.id) ops.moveSlide(id, i); }}
							className="group relative mb-2 flex gap-1.5"
						>
							<span className="w-4 pt-1 text-right text-[11px] text-serene-neutral-500">{i + 1}</span>
							<button onClick={() => { setCur(s.id); setSel(null); }} aria-label={`Slide ${i + 1}`} className={cn("overflow-hidden rounded-md ring-2", s.id === cur ? "ring-sauti-teal" : "ring-black/10 hover:ring-black/30")}>
								<SlideView slide={s} theme={theme} width={140} urls={urls} />
							</button>
							{canEdit && (
								<span className="absolute right-0 top-0 hidden gap-0.5 rounded bg-white/90 p-0.5 shadow group-hover:flex">
									<button aria-label="Duplicate slide" onClick={() => { const id = ops.duplicateSlide(s.id); setCur(id); }} className="rounded p-1 hover:bg-black/5"><Copy className="h-3 w-3" /></button>
									<button aria-label="Delete slide" disabled={deck.slides.length <= 1} onClick={() => ops.deleteSlide(s.id)} className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-3 w-3" /></button>
								</span>
							)}
						</div>
					))}
					{canEdit && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="mt-1 gap-1.5"><Plus className="h-4 w-4" /> New slide</Button></DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuLabel>Layout</DropdownMenuLabel>
								{(Object.keys(LAYOUT_NAMES) as LayoutKind[]).map((k) => <DropdownMenuItem key={k} onSelect={() => newSlide(k)}>{LAYOUT_NAMES[k]}</DropdownMenuItem>)}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>

				{/* Canvas */}
				<div className="flex min-w-0 flex-1 flex-col">
					<div ref={stage} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4" onPointerDown={() => { setSel(null); setEditing(null); }}>
						<div className="relative shadow-[0_6px_30px_rgba(0,0,0,0.18)]" style={{ width, height: H * scale }} onPointerDown={(e) => e.stopPropagation()}>
							<div onPointerDown={() => { setSel(null); setEditing(null); }}>
								<SlideView slide={slide} theme={theme} width={width} urls={urls} hide={editing} />
							</div>
							{/* Boxes get their handles on top of the drawn slide. */}
							{slide.els.map((e) => {
								const g = drag?.id === e.id ? { ...e, ...drag } : e;
								const mine = sel === e.id;
								const others = people.filter((p) => p.slide === slide.id && p.el === e.id);
								if (e.type === "text" && editing === e.id) {
									return (
										<div
											key={e.id}
											contentEditable
											suppressContentEditableWarning
											autoFocus
											ref={(n) => { if (n && document.activeElement !== n) { n.focus(); const r = document.createRange(); r.selectNodeContents(n); r.collapse(false); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); } }}
											onBlur={(ev) => { ops.updateEl(slide.id, e.id, { text: ev.currentTarget.innerText.replace(/\n$/, "") }); setEditing(null); }}
											onKeyDown={(ev) => { if (ev.key === "Escape") (ev.currentTarget as HTMLElement).blur(); }}
											style={{ ...elStyle(g, theme, scale), ...textStyle(g, theme, scale), outline: `2px solid ${resolve(theme, "@accent")}`, background: "rgba(255,255,255,0.0)", cursor: "text" }}
										>{e.text}</div>
									);
								}
								return (
									<div
										key={e.id}
										onPointerDown={(ev) => startDrag(ev, e, "move")}
										onDoubleClick={() => { if (canEdit && e.type === "text") { setSel(e.id); setEditing(e.id); } }}
										style={{ ...elStyle(g, theme, scale), cursor: canEdit ? "move" : "default", outline: mine ? `2px solid ${resolve(theme, "@accent")}` : others.length ? `2px solid ${others[0].color}` : undefined, outlineOffset: 1 }}
									>
										{others.length > 0 && <span className="pointer-events-none absolute -top-5 left-0 flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: others[0].color }}>{others[0].avatar && /* eslint-disable-next-line @next/next/no-img-element */ <img src={others[0].avatar} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />}{others.map((o) => o.name.split(" ")[0]).join(", ")}</span>}
										{mine && canEdit && (["nw", "ne", "sw", "se"] as Handle[]).map((h) => (
											<span key={h} onPointerDown={(ev) => startDrag(ev, e, h)} className="absolute h-3 w-3 rounded-sm border-2 border-white bg-sauti-teal shadow" style={{ left: h.includes("w") ? -6 : undefined, right: h.includes("e") ? -6 : undefined, top: h.includes("n") ? -6 : undefined, bottom: h.includes("s") ? -6 : undefined, cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize" }} />
										))}
									</div>
								);
							})}
						</div>
					</div>
					<div className="shrink-0 border-t border-black/[0.07] bg-white px-3 py-1.5">
						<Input value={slide.notes ?? ""} disabled={!canEdit} onChange={(e) => ops.setSlide(slide.id, { notes: e.target.value })} placeholder={`Speaker notes for slide ${idx + 1}`} aria-label="Speaker notes" className="h-8 border-transparent text-sm shadow-none hover:border-black/10" />
					</div>
					{/* Phones: the slides as a strip */}
					<div className="flex shrink-0 gap-2 overflow-x-auto border-t border-black/[0.07] bg-white p-2 md:hidden">
						{deck.slides.map((s, i) => <button key={s.id} onClick={() => { setCur(s.id); setSel(null); }} aria-label={`Slide ${i + 1}`} className={cn("shrink-0 overflow-hidden rounded ring-2", s.id === cur ? "ring-sauti-teal" : "ring-black/10")}><SlideView slide={s} theme={theme} width={96} urls={urls} /></button>)}
						{canEdit && <Button variant="outline" size="sm" className="h-auto shrink-0" onClick={() => newSlide("bullets")}><Plus className="h-4 w-4" /></Button>}
					</div>
				</div>
			</div>

			{presenting && <Presenter deck={deck} urls={urls} start={idx} onClose={() => setPresenting(false)} />}

			<Dialog open={panel === "templates"} onOpenChange={(o) => !o && setPanel(null)}>
				<DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
					<DialogHeader><DialogTitle>Start from a template</DialogTitle><DialogDescription>This replaces the slides in this presentation. Your colours and fonts can be changed afterwards under Theme.</DialogDescription></DialogHeader>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{TEMPLATES.map((t) => {
							const d = templateDeck(t);
							return (
								<button key={t.id} onClick={() => { ops.replaceAll({ ...d, title: deck.title === "Untitled presentation" ? d.title : deck.title }); setCur(d.slides[0].id); setSel(null); setPanel(null); }} className="group overflow-hidden rounded-xl border border-serene-neutral-200 text-left hover:border-sauti-teal">
									<SlideView slide={d.slides[0]} theme={d.theme} width={300} />
									<div className="p-3"><p className="text-sm font-semibold">{t.name} <span className="ml-1 text-xs font-normal text-serene-neutral-500">{d.slides.length} slides</span></p><p className="text-xs text-serene-neutral-500">{t.blurb}</p></div>
								</button>
							);
						})}
					</div>
				</DialogContent>
			</Dialog>

			<AiPanel open={panel === "ai"} onClose={() => setPanel(null)} theme={theme} onReplace={(d) => { ops.replaceAll(d); setCur(d.slides[0].id); setSel(null); }} onAdd={(slides) => { let after = cur; for (const s of slides) after = ops.addSlide(s, after); if (after) setCur(after); }} />
			<ImagePanel open={panel === "image"} onClose={() => setPanel(null)} onPick={(src, alt) => { addEl({ id: uid(), type: "image", x: 180, y: 90, w: 600, h: 360, src, fit: "cover", alt }); setPanel(null); }} />
			<Dialog open={panel === "canva"} onOpenChange={(o) => !o && setPanel(null)}>
				<DialogContent className="max-w-lg">
					<DialogHeader><DialogTitle>Edit in Canva</DialogTitle><DialogDescription>Canva opens PowerPoint files and turns them into designs you can edit there, with its own photos, brand kit and animations.</DialogDescription></DialogHeader>
					<ol className="list-decimal space-y-2 pl-5 text-sm text-serene-neutral-700">
						<li>Download this presentation as a PowerPoint file.</li>
						<li>In Canva choose <b>Create</b>, then <b>Import file</b>, and pick the file.</li>
						<li>When you are done in Canva, choose <b>Share</b>, <b>Download</b>, <b>PowerPoint</b>, and add the file to Files here. Open it and choose <b>Edit as slides</b> to keep working together.</li>
					</ol>
					<div className="flex flex-wrap gap-2 pt-2">
						<Button className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={async () => { if (await exportPptx()) window.open("https://www.canva.com/", "_blank", "noopener"); }}><Download className="h-4 w-4" /> Download and open Canva</Button>
						<Button variant="ghost" onClick={() => setPanel(null)}>Close</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

const Sep = () => <span className="mx-1 h-5 w-px bg-black/10" />;
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
	return <span title={label} className="inline-flex">{children}</span>;
}

function Swatch({ label, value, theme, onPick }: { label: string; value: string; theme: Theme; onPick: (c: string) => void }) {
	return (
		<Popover>
			<PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-8 gap-1.5" aria-label={label} title={label}><span className="h-4 w-4 rounded-full ring-1 ring-black/20" style={{ background: resolve(theme, value) }} /></Button></PopoverTrigger>
			<PopoverContent className="w-52 p-2">
				<div className="grid grid-cols-6 gap-1.5">
					{SWATCHES.map((c) => <button key={c} aria-label={c} onClick={() => onPick(c)} className="h-6 w-6 rounded-full ring-1 ring-black/20" style={{ background: resolve(theme, c) }} />)}
				</div>
				<label className="mt-2 flex items-center gap-2 text-xs text-serene-neutral-600">Any colour <input type="color" value={resolve(theme, value)} onChange={(e) => onPick(e.target.value.toUpperCase())} className="h-6 w-10 cursor-pointer" /></label>
			</PopoverContent>
		</Popover>
	);
}

/** Full-screen slideshow: arrows, space or a click to move on, Escape to leave, N for the notes. */
function Presenter({ deck, urls, start, onClose }: { deck: Deck; urls: Record<string, string>; start: number; onClose: () => void }) {
	const [i, setI] = useState(Math.max(0, start));
	const [notes, setNotes] = useState(false);
	const [vw, setVw] = useState({ w: typeof window === "undefined" ? 1280 : window.innerWidth, h: typeof window === "undefined" ? 720 : window.innerHeight });
	useEffect(() => {
		const on = () => setVw({ w: window.innerWidth, h: window.innerHeight });
		window.addEventListener("resize", on);
		document.documentElement.requestFullscreen?.().catch(() => undefined);
		return () => { window.removeEventListener("resize", on); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined); };
	}, []);
	useEffect(() => {
		const key = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
			else if (["ArrowRight", "ArrowDown", " ", "PageDown", "Enter"].includes(e.key)) { e.preventDefault(); setI((n) => Math.min(deck.slides.length - 1, n + 1)); }
			else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
			else if (e.key.toLowerCase() === "n") setNotes((v) => !v);
		};
		window.addEventListener("keydown", key);
		return () => window.removeEventListener("keydown", key);
	}, [deck.slides.length, onClose]);
	const s = deck.slides[i];
	const width = Math.min(vw.w, vw.h * (W / H));
	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black" onClick={(e) => { const half = e.clientX < window.innerWidth / 3; setI((n) => (half ? Math.max(0, n - 1) : Math.min(deck.slides.length - 1, n + 1))); }}>
			<SlideView slide={s} theme={deck.theme} width={width} urls={urls} />
			<button onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Leave the slideshow" className="absolute right-3 top-3 rounded-full bg-white/15 p-2 text-white opacity-0 transition hover:bg-white/30 hover:opacity-100 focus:opacity-100"><X className="h-5 w-5" /></button>
			<span className="absolute bottom-3 right-4 text-xs text-white/60">{i + 1} / {deck.slides.length}</span>
			{notes && s.notes && <div className="absolute inset-x-0 bottom-0 bg-black/80 p-4 text-sm text-white">{s.notes}</div>}
		</div>
	);
}

function AiPanel({ open, onClose, theme, onReplace, onAdd }: { open: boolean; onClose: () => void; theme: Theme; onReplace: (d: Deck) => void; onAdd: (s: Slide[]) => void }) {
	const { toast } = useToast();
	const [prompt, setPrompt] = useState("");
	const [count, setCount] = useState(8);
	const [audience, setAudience] = useState("");
	const [busy, setBusy] = useState(false);
	const run = async (mode: "replace" | "add") => {
		setBusy(true);
		try {
			const g = await unwrap(generateDeck(prompt, count, audience));
			const d = buildDeck(g.title, theme, g.slides);
			if (mode === "replace") onReplace(d); else onAdd(d.slides);
			onClose();
		} catch (e) { toast({ title: "Could not write the slides", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	return (
		<Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[#7c3aed]" /> Write the slides with AI</DialogTitle><DialogDescription>Say what it is for. The AI writes the words and picks a layout for each slide, finds photos, and the theme gives it a consistent look. Check every fact before you present.</DialogDescription></DialogHeader>
				<Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="e.g. A pitch to a foundation for a legal aid clinic for survivors in Nairobi: the need, our approach, results so far, and what we are asking for" aria-label="What the presentation is about" />
				<div className="grid grid-cols-2 gap-3">
					<label className="text-xs font-medium text-serene-neutral-600">Slides<Input type="number" min={4} max={16} value={count} onChange={(e) => setCount(Number(e.target.value) || 8)} className="mt-1" /></label>
					<label className="text-xs font-medium text-serene-neutral-600">Who it is for<Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Funders, staff, community" className="mt-1" /></label>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button disabled={busy || prompt.trim().length < 6} onClick={() => run("replace")} className="gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Make a new presentation</Button>
					<Button variant="outline" disabled={busy || prompt.trim().length < 6} onClick={() => run("add")}>Add after this slide</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

/** Pick a picture: upload one, use one from the library, or search free photos. */
function ImagePanel({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (src: string, alt?: string) => void }) {
	const { toast } = useToast();
	const input = useRef<HTMLInputElement>(null);
	const [tab, setTab] = useState<"upload" | "library" | "photos">("upload");
	const [busy, setBusy] = useState(false);
	const [lib, setLib] = useState<AssetRow[] | null>(null);
	const [q, setQ] = useState("");
	const [found, setFound] = useState<InspireItem[] | null>(null);
	useEffect(() => { if (open && tab === "library" && !lib) unwrap(listAssets()).then(setLib).catch(() => setLib([])); }, [open, tab, lib]);

	/** Keep the picture to a sensible size before it is stored. */
	const shrink = (f: File): Promise<Blob> => new Promise((res, rej) => {
		const img = new Image();
		const url = URL.createObjectURL(f);
		img.onload = () => {
			const k = Math.min(1, 1600 / Math.max(img.width, img.height));
			const c = document.createElement("canvas");
			c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
			c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
			URL.revokeObjectURL(url);
			c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read the picture."))), "image/jpeg", 0.85);
		};
		img.onerror = () => rej(new Error("Could not read the picture."));
		img.src = url;
	});
	const upload = async (files: FileList | null) => {
		const f = files?.[0];
		if (!f) return;
		setBusy(true);
		try {
			const blob = await shrink(f);
			const up = await unwrap(sharePhotoUpload("jpg"));
			const put = await fetch(up.signedUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
			if (!put.ok) throw new Error("The upload did not go through.");
			const a = await unwrap(sharePhotoRegister(up.path, f.name.replace(/\.[^.]+$/, ""), "image/jpeg", "Used in a presentation"));
			onPick(`asset:${a.id}`, f.name);
		} catch (e) { toast({ title: "Could not add the picture", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); if (input.current) input.current.value = ""; }
	};
	const search = async () => {
		setBusy(true);
		try {
			let r: InspireItem[] = [];
			try { r = await unwrap(inspireSearch("unsplash", q || "community")); } catch { r = await unwrap(inspireSearch("openverse", q || "community")); }
			setFound(r);
		} catch (e) { toast({ title: "Could not search photos", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
				<DialogHeader><DialogTitle>Add a picture</DialogTitle><DialogDescription>Use photos you have the right to share. Leave out survivors and anyone who has not agreed.</DialogDescription></DialogHeader>
				<div className="inline-flex w-fit rounded-lg border border-serene-neutral-200 p-0.5">
					{(["upload", "library", "photos"] as const).map((t) => <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", tab === t ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}>{t === "upload" ? "Upload" : t === "library" ? "Your images" : "Free photos"}</button>)}
				</div>
				{tab === "upload" && (
					<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-serene-neutral-300 p-8 text-center">
						<input ref={input} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files)} />
						<Button onClick={() => input.current?.click()} disabled={busy} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Choose a picture</Button>
						<p className="text-xs text-serene-neutral-500">It is kept in your images, ready for posts too.</p>
					</div>
				)}
				{tab === "library" && (
					<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
						{!lib && <p className="col-span-full text-sm text-serene-neutral-500">Loading</p>}
						{lib?.filter((a) => a.url).map((a) => /* eslint-disable-next-line @next/next/no-img-element */ <button key={a.id} onClick={() => onPick(`asset:${a.id}`, a.name)} className="aspect-square overflow-hidden rounded-lg ring-1 ring-black/10 hover:ring-sauti-teal"><img src={a.url!} alt={a.name} className="h-full w-full object-cover" /></button>)}
						{lib && lib.length === 0 && <p className="col-span-full text-sm text-serene-neutral-500">No images yet. Upload one, or share photos from the Content page.</p>}
					</div>
				)}
				{tab === "photos" && (
					<div className="space-y-3">
						<form onSubmit={(e) => { e.preventDefault(); void search(); }} className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search free photos, e.g. community meeting Nairobi" aria-label="Search photos" /><Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}</Button></form>
						<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
							{found?.map((p) => /* eslint-disable-next-line @next/next/no-img-element */ <button key={p.id} title={p.credit} onClick={() => onPick(p.full, p.title)} className="aspect-square overflow-hidden rounded-lg ring-1 ring-black/10 hover:ring-sauti-teal"><img src={p.thumb} alt={p.title} className="h-full w-full object-cover" /></button>)}
						</div>
						{found && found.length === 0 && <p className="text-sm text-serene-neutral-500">Nothing found. Try other words.</p>}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
