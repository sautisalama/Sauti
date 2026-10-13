"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Palette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { putToSignedUrl } from "@/lib/client/upload";
import { coloursFromPictures, lookFromAccent, pickAccent, shrinkPicture, type DeckLook } from "@/lib/client/deck-look";
import { makeDeck, type DeckTheme } from "@/app/actions/mjengo-assist";
import { getBrand } from "@/app/actions/mjengo-brand";
import { prepareUpload, registerUpload } from "../vault/api";

const PRESETS: Record<DeckTheme, { label: string; a: string; b: string }> = {
	teal: { label: "Teal", a: "#068297", b: "#E6F4F6" },
	purple: { label: "Purple", a: "#7D2AE8", b: "#F1E8FD" },
	sunrise: { label: "Sunrise", a: "#EA580C", b: "#FFEDD5" },
	night: { label: "Night", a: "#00C4CC", b: "#0E1318" },
};

interface Pic { id: string; name: string; kind: "photo" | "logo"; note: string; dataUrl: string; width: number; height: number; /** Its colours are used for the theme. */ theme: boolean }

/**
 * Presentation with AI. Say what it is about, add the pictures and the logo to use, and the colours are taken
 * from them (shown, and changeable) so the whole deck is drawn in the organisation's own look.
 */
export function DeckStudio({ open, onClose, folderId, onDone }: { open: boolean; onClose: () => void; folderId: string | null; onDone: () => void }) {
	const { toast } = useToast();
	const [topic, setTopic] = useState("");
	const [slides, setSlides] = useState(8);
	const [busy, setBusy] = useState(false);
	const [outline, setOutline] = useState<{ title: string; bullets: string[] }[] | null>(null);
	const [pics, setPics] = useState<Pic[]>([]);
	const [source, setSource] = useState<"preset" | "pictures" | "brand" | "custom">("preset");
	const [preset, setPreset] = useState<DeckTheme>("teal");
	const [extracted, setExtracted] = useState<string[]>([]);
	const [accent, setAccent] = useState("#068297");
	const [dark, setDark] = useState(false);
	const [brandColours, setBrandColours] = useState<string[] | null>(null);
	const [reading, setReading] = useState(false);
	const file = useRef<HTMLInputElement>(null);

	useEffect(() => { if (open) { setTopic(""); setOutline(null); setPics([]); setSource("preset"); setExtracted([]); setDark(false); } }, [open]);

	// Colours come from the pictures marked for theming; they are read again whenever that choice changes.
	const themed = pics.filter((p) => p.theme).map((p) => p.dataUrl);
	const themedKey = themed.map((d) => d.length).join(",");
	useEffect(() => {
		if (source !== "pictures") return;
		let dead = false;
		if (!themed.length) { setExtracted([]); return; }
		setReading(true);
		coloursFromPictures(themed).then((c) => { if (!dead) { setExtracted(c); if (c.length) setAccent(`#${pickAccent(c)}`); } }).finally(() => { if (!dead) setReading(false); });
		return () => { dead = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [source, themedKey]);

	useEffect(() => {
		if (source !== "brand" || brandColours) return;
		unwrap(getBrand()).then((b) => {
			const c = [b.palette.primary, b.palette.secondary, b.palette.accent, ...b.colours].filter(Boolean);
			setBrandColours([...new Set(c.map((x) => x.toUpperCase()))].slice(0, 8));
			if (c[0]) setAccent(c[0]);
		}).catch(() => setBrandColours([]));
	}, [source, brandColours]);

	const swatches = source === "pictures" ? extracted : source === "brand" ? brandColours ?? [] : [];
	const look: DeckTheme | DeckLook = useMemo(() => (source === "preset" ? preset : lookFromAccent(accent, dark)), [source, preset, accent, dark]);
	const shown: DeckLook = typeof look === "string"
		? { bg: PRESETS[look].b.replace("#", ""), title: "0F3B44", text: "334155", accent: PRESETS[look].a.replace("#", ""), band: PRESETS[look].b.replace("#", "") }
		: look;
	const darkShown = parseInt(shown.bg.slice(0, 2), 16) + parseInt(shown.bg.slice(2, 4), 16) + parseInt(shown.bg.slice(4, 6), 16) < 300;

	const add = async (files: FileList | null) => {
		if (!files?.length) return;
		const next: Pic[] = [];
		for (const f of Array.from(files).slice(0, 8 - pics.length)) {
			try {
				const s = await shrinkPicture(f);
				// A small picture or one with "logo" in its name is taken to be a logo.
				const kind = /logo|brand|mark/i.test(f.name) || Math.max(s.width, s.height) < 500 ? "logo" : "photo";
				next.push({ id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 6)}`, name: f.name.replace(/\.[a-z0-9]+$/i, ""), kind, note: "", ...s, theme: true });
			} catch (e) { toast({ title: "Could not use that file", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
		}
		if (next.length) { setPics((p) => [...p, ...next]); setSource("pictures"); }
	};
	const patch = (id: string, v: Partial<Pic>) => setPics((p) => p.map((x) => (x.id === id ? { ...x, ...v } : x)));

	const create = async () => {
		setBusy(true);
		try {
			const images = pics.map((p) => ({ name: p.name, kind: p.kind, note: p.note, dataUrl: p.dataUrl, width: p.width, height: p.height }));
			const r = await unwrap(makeDeck(topic, look, slides, images));
			const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
			const f = new File([bytes], r.name, { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
			const { path, signedUrl } = await prepareUpload(folderId, r.name, f.size);
			await putToSignedUrl(signedUrl, f);
			await registerUpload(folderId, path, r.name, f.size, f.type);
			setOutline(r.outline);
		} catch (e) {
			toast({ title: "Could not make the presentation", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
				<DialogHeader><DialogTitle>Presentation with AI</DialogTitle><DialogDescription>Say what it is about, add your pictures and logo, and the deck is made in their colours.</DialogDescription></DialogHeader>
				{outline ? (
					<div className="space-y-3">
						<p className="text-sm text-serene-neutral-600">Saved to Files. Here is what is in it:</p>
						<ol className="max-h-72 list-decimal space-y-1 overflow-y-auto pl-5 text-sm">{outline.map((o, i) => <li key={i}><span className="font-medium">{o.title}</span></li>)}</ol>
						<DialogFooter><Button className="bg-sauti-teal hover:bg-sauti-dark" onClick={onDone}>Done</Button></DialogFooter>
					</div>
				) : (
					<div className="space-y-4">
						<Textarea rows={4} autoFocus value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="A briefing for a county government partner on our legal aid clinics: what we do, results so far, and what we need from them." />

						<div>
							<div className="mb-1.5 flex items-center justify-between">
								<p className="text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">Pictures and logo</p>
								<Button type="button" size="sm" variant="outline" className="h-8 min-w-0 gap-1.5" onClick={() => file.current?.click()} disabled={pics.length >= 8}><ImagePlus className="h-4 w-4" /> Add</Button>
								<input ref={file} type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
							</div>
							{pics.length === 0 ? (
								<button type="button" onClick={() => file.current?.click()} className="w-full rounded-xl border border-dashed border-serene-neutral-300 px-4 py-5 text-center text-sm text-serene-neutral-500 hover:bg-serene-neutral-50">
									Add photos to use across the slides, and your logo. The AI places each photo where it fits, and the colours are taken from them.
								</button>
							) : (
								<ul className="space-y-2">
									{pics.map((p) => (
										<li key={p.id} className="flex items-center gap-3 rounded-xl border border-serene-neutral-200 p-2">
											{/* eslint-disable-next-line @next/next/no-img-element */}
											<img src={p.dataUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-serene-neutral-100 object-contain" />
											<div className="min-w-0 flex-1 space-y-1">
												<div className="flex items-center gap-2">
													<span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
													<div className="inline-flex shrink-0 rounded-lg border border-serene-neutral-200 p-0.5 text-xs">
														{(["photo", "logo"] as const).map((k) => <button key={k} type="button" aria-pressed={p.kind === k} onClick={() => patch(p.id, { kind: k })} className={cn("rounded-md px-2 py-0.5 capitalize", p.kind === k ? "bg-sauti-teal font-semibold text-white" : "text-serene-neutral-600")}>{k}</button>)}
													</div>
												</div>
												<div className="flex items-center gap-3">
													<input value={p.note} onChange={(e) => patch(p.id, { note: e.target.value })} placeholder={p.kind === "photo" ? "What is in it? (helps place it)" : "Logo"} className="h-7 min-w-0 flex-1 rounded-md border border-serene-neutral-200 px-2 text-xs outline-none focus:border-sauti-teal" />
													<label className="flex shrink-0 items-center gap-1.5 text-xs text-serene-neutral-600"><input type="checkbox" checked={p.theme} onChange={(e) => patch(p.id, { theme: e.target.checked })} className="accent-[#068297]" /> Use its colours</label>
												</div>
											</div>
											<button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPics((x) => x.filter((y) => y.id !== p.id))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-serene-neutral-500 hover:bg-serene-neutral-100"><X className="h-4 w-4" /></button>
										</li>
									))}
								</ul>
							)}
						</div>

						<div>
							<p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500"><Palette className="h-3.5 w-3.5" /> Colours</p>
							<div className="inline-flex flex-wrap gap-1 rounded-lg border border-serene-neutral-200 p-0.5 text-xs">
								{([["preset", "Ready-made"], ["pictures", "From my pictures"], ["brand", "Organisation brand"], ["custom", "Pick one"]] as const).map(([v, l]) => (
									<button key={v} type="button" aria-pressed={source === v} onClick={() => setSource(v)} className={cn("rounded-md px-2.5 py-1", source === v ? "bg-sauti-teal font-semibold text-white" : "text-serene-neutral-600 hover:bg-serene-neutral-50")}>{l}</button>
								))}
							</div>

							{source === "preset" && (
								<div className="mt-2 flex gap-2">
									{(Object.keys(PRESETS) as DeckTheme[]).map((k) => (
										<button key={k} type="button" aria-label={PRESETS[k].label} aria-pressed={preset === k} onClick={() => setPreset(k)} className={cn("h-9 w-9 overflow-hidden rounded-lg border-2", preset === k ? "border-sauti-teal" : "border-transparent")} style={{ background: `linear-gradient(135deg, ${PRESETS[k].a} 50%, ${PRESETS[k].b} 50%)` }} />
									))}
								</div>
							)}
							{source === "pictures" && (
								<p className="mt-2 text-xs text-serene-neutral-500">{reading ? "Reading the colours…" : themed.length === 0 ? "Add a picture or logo and tick “Use its colours”." : swatches.length ? "Colours found. Click one to make it the main colour." : "No clear colours found in those pictures."}</p>
							)}
							{source === "brand" && <p className="mt-2 text-xs text-serene-neutral-500">{brandColours === null ? "Reading the brand…" : swatches.length ? "From the organisation’s brand. Click one to make it the main colour." : "No brand colours are saved yet."}</p>}
							{swatches.length > 0 && (
								<div className="mt-2 flex flex-wrap items-center gap-2">
									{swatches.map((c) => <button key={c} type="button" aria-label={`Main colour ${c}`} aria-pressed={accent.toUpperCase() === c.toUpperCase()} onClick={() => setAccent(c)} title={c} className={cn("h-8 w-8 rounded-full border border-black/10 shadow-sm", accent.toUpperCase() === c.toUpperCase() && "ring-2 ring-sauti-teal ring-offset-2")} style={{ background: c }} />)}
								</div>
							)}
							{source === "custom" && (
								<label className="mt-2 flex items-center gap-2 text-xs text-serene-neutral-600">Main colour <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-serene-neutral-200" /><span className="font-mono">{accent.toUpperCase()}</span></label>
							)}
							{source !== "preset" && (
								<label className="mt-2 flex items-center gap-2 text-xs text-serene-neutral-600"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} className="accent-[#068297]" /> Dark slides</label>
							)}

							<div className="mt-3 flex items-stretch gap-3">
								<div className="flex h-24 w-40 shrink-0 flex-col justify-between rounded-lg border border-serene-neutral-200 p-2" style={{ background: `#${darkShown ? shown.bg : "FFFFFF"}` }} aria-label="Preview of the look">
									<span className="h-1.5 w-8 rounded" style={{ background: `#${shown.accent}` }} />
									<span className="text-xs font-bold leading-tight" style={{ color: `#${shown.title}` }}>Your title looks like this</span>
									<span className="rounded px-1 py-0.5 text-[10px]" style={{ background: `#${shown.band}`, color: `#${shown.text}` }}>Body text on a band</span>
								</div>
								<div className="grid grid-cols-5 gap-1 self-center text-center text-[10px] text-serene-neutral-500">
									{([["Page", shown.bg], ["Title", shown.title], ["Text", shown.text], ["Main", shown.accent], ["Band", shown.band]] as const).map(([l, c]) => <div key={l}><div className="mx-auto h-6 w-6 rounded-full border border-black/10" style={{ background: `#${c}` }} />{l}</div>)}
								</div>
							</div>
						</div>

						<label className="block max-w-[10rem] text-xs font-medium text-serene-neutral-600">Slides<Input type="number" min={4} max={14} value={slides} onChange={(e) => setSlides(Number(e.target.value))} className="mt-1 h-9" /></label>

						<DialogFooter>
							<Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
							<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy || topic.trim().length < 6} onClick={() => void create()}>
								{busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Writing the slides..." : "Create"}
							</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
