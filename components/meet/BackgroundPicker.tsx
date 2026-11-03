"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Settings2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { addBackgroundPhoto, COLOR_PRESETS, DEFAULT_PREFS, loadBackgroundPrefs, optimiseBackgroundPhoto, saveBackgroundPrefs, type BackgroundMode, type BackgroundPrefs } from "@/lib/client/meet-background";

type Section = "photo" | "blur" | "color";

const css = (c: { a: string; b?: string }) => (c.b ? `linear-gradient(135deg, ${c.a}, ${c.b})` : c.a);

/**
 * What is behind you: a photo (first), one blur with its own amount, or a colour that can be single or a gradient.
 * The gear on each choice opens its settings. Every choice, the amount, the colours and the pictures you add are
 * remembered on this device, and pictures are shrunk when added so they load fast next time.
 */
export function BackgroundPicker({ bg, busy, note, onPick, light }: { bg: BackgroundMode; busy: boolean; note: string; onPick: (m: BackgroundMode) => void; light?: boolean }) {
	const [prefs, setPrefs] = useState<BackgroundPrefs>(DEFAULT_PREFS);
	const [ready, setReady] = useState(false);
	const [open, setOpen] = useState<Section | null>(null);
	const [local, setLocal] = useState("");
	const [adding, setAdding] = useState(false);

	useEffect(() => {
		const p = loadBackgroundPrefs();
		setPrefs(p);
		setReady(true);
	}, []);

	// Whatever is currently in use is what is remembered as the choice for next time.
	const bgKey = JSON.stringify(bg);
	useEffect(() => {
		if (!ready) return;
		setPrefs((cur) => {
			const next = { ...cur, mode: bg };
			saveBackgroundPrefs(next);
			return next;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [bgKey, ready]);

	const update = (patch: Partial<BackgroundPrefs>) => setPrefs((cur) => { const next = { ...cur, ...patch }; saveBackgroundPrefs(next); return next; });

	const pickBlur = (amount = prefs.blur) => { setOpen("blur"); onPick({ kind: "blur", amount }); };
	const pickColor = (c = prefs.color) => { setOpen("color"); onPick({ kind: "color", a: c.a, b: c.gradient ? c.b : undefined }); };
	const pickPhoto = (src: string) => onPick({ kind: "image", src });

	const upload = async (files: FileList | null) => {
		const file = files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/") || file.size > 20_000_000) { setLocal("Choose a picture under 20 MB."); return; }
		setLocal("");
		setAdding(true);
		try {
			const photo = await optimiseBackgroundPhoto(file);
			const photos = addBackgroundPhoto(prefs.photos, photo);
			update({ photos });
			setOpen("photo");
			onPick({ kind: "image", src: photo });
		} catch { setLocal("That picture could not be read. Try another."); }
		setAdding(false);
	};
	const removePhoto = (src: string) => {
		update({ photos: prefs.photos.filter((p) => p !== src) });
		if (bg.kind === "image" && bg.src === src) onPick({ kind: "none" });
	};

	const tile = (active: boolean) => cn("relative flex h-14 w-20 shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border text-[11px] font-medium transition", active ? "border-[#068297] ring-2 ring-[#068297]" : light ? "border-[#dadce0] hover:border-[#068297]" : "border-white/20 hover:border-white/60", busy && "opacity-60");
	const base = light ? "bg-white text-[#3c4043]" : "bg-white/10 text-white";
	const gear = (s: Section, label: string) => (
		<button type="button" onClick={() => setOpen((o) => (o === s ? null : s))} aria-label={`${label} settings`} aria-expanded={open === s} className={cn("absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75", open === s && "bg-[#068297]")}><Settings2 className="h-3 w-3" /></button>
	);
	const label = cn("text-[11px] font-medium", light ? "text-[#5f6368]" : "text-white/70");
	const panel = cn("mt-2 rounded-xl border p-3", light ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/15 bg-white/5");
	const isPhoto = bg.kind === "image";
	const isBlur = bg.kind === "blur";
	const isColor = bg.kind === "color";

	return (
		<div>
			<span className={cn("mb-1 flex items-center gap-1.5 text-xs", light ? "text-[#5f6368]" : "text-white/70")}><Sparkles className="h-3.5 w-3.5" /> Background {(busy || adding) && <Loader2 className="h-3 w-3 animate-spin" />}</span>
			<div className="flex gap-2 overflow-x-auto pb-1">
				<div className="relative shrink-0">
					<button type="button" disabled={busy} onClick={() => { setOpen("photo"); if (prefs.photos[0] && !isPhoto) pickPhoto(prefs.photos[0]); }} className={cn(tile(isPhoto), base)}><ImagePlus className="h-4 w-4" />Photo</button>
					{gear("photo", "Photo")}
				</div>
				<div className="relative shrink-0">
					<button type="button" disabled={busy} onClick={() => pickBlur()} className={cn(tile(isBlur), light ? "bg-[#e8eaed] text-[#3c4043]" : "bg-white/20 text-white")}>Blur</button>
					{gear("blur", "Blur")}
				</div>
				<div className="relative shrink-0">
					<button type="button" disabled={busy} onClick={() => pickColor()} className={cn(tile(isColor), "text-white")} style={{ background: css({ a: prefs.color.a, b: prefs.color.gradient ? prefs.color.b : undefined }) }}><span className="rounded bg-black/40 px-1">Colour</span></button>
					{gear("color", "Colour")}
				</div>
				<button type="button" disabled={busy} onClick={() => { setOpen(null); onPick({ kind: "none" }); }} className={cn(tile(bg.kind === "none"), base)}>None</button>
			</div>

			{open === "blur" && (
				<div className={panel}>
					<label className="block">
						<span className={cn(label, "flex justify-between")}><span>Amount of blur</span><span>{prefs.blur}%</span></span>
						<input type="range" min={0} max={100} step={5} value={prefs.blur} aria-label="Amount of blur" className="mt-1 w-full accent-[#068297]" onChange={(e) => { const v = Number(e.target.value); update({ blur: v }); if (isBlur) onPick({ kind: "blur", amount: v }); }} />
					</label>
					{!isBlur && <button type="button" onClick={() => pickBlur()} className="mt-2 rounded-full bg-[#068297] px-3 py-1 text-xs font-medium text-white">Use blur</button>}
				</div>
			)}

			{open === "color" && (
				<div className={panel}>
					<div className="mb-2 inline-flex rounded-full border border-[#dadce0] p-0.5 text-xs" role="group" aria-label="Colour style">
						{[false, true].map((g) => (
							<button key={String(g)} type="button" onClick={() => { const c = { ...prefs.color, gradient: g }; update({ color: c }); pickColor(c); }} className={cn("rounded-full px-3 py-1 font-medium", prefs.color.gradient === g ? "bg-[#068297] text-white" : light ? "text-[#3c4043]" : "text-white/80")}>{g ? "Gradient" : "Single colour"}</button>
						))}
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<label className={cn(label, "flex items-center gap-1.5")}>{prefs.color.gradient ? "From" : "Colour"}<input type="color" value={prefs.color.a} aria-label="First colour" className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" onChange={(e) => { const c = { ...prefs.color, a: e.target.value }; update({ color: c }); pickColor(c); }} /></label>
						{prefs.color.gradient && <label className={cn(label, "flex items-center gap-1.5")}>To<input type="color" value={prefs.color.b} aria-label="Second colour" className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" onChange={(e) => { const c = { ...prefs.color, b: e.target.value }; update({ color: c }); pickColor(c); }} /></label>}
					</div>
					<div className="mt-2 flex flex-wrap gap-1.5">
						{COLOR_PRESETS.filter((p) => (prefs.color.gradient ? !!p.b : !p.b || true)).map((p) => {
							const sel = isColor && bg.a === p.a && (prefs.color.gradient ? bg.b === p.b : !bg.b);
							return <button key={p.label} type="button" aria-label={`${p.label} colour`} title={p.label} onClick={() => { const c = { a: p.a, b: p.b ?? prefs.color.b, gradient: prefs.color.gradient && !!p.b }; update({ color: c }); pickColor(c); }} className={cn("h-7 w-7 rounded-full border", sel ? "border-[#068297] ring-2 ring-[#068297]" : "border-black/10")} style={{ background: css({ a: p.a, b: prefs.color.gradient ? p.b : undefined }) }} />;
						})}
					</div>
				</div>
			)}

			{open === "photo" && (
				<div className={panel}>
					<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
						<label className={cn("flex aspect-video cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-[11px] font-medium", light ? "border-[#9aa0a6] bg-white text-[#068297]" : "border-white/40 text-white", adding && "opacity-60")}>
							{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}Add photo
							<input type="file" accept="image/*" className="sr-only" disabled={adding} onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
						</label>
						{prefs.photos.map((p, i) => (
							<div key={p.slice(-24) + i} className="group relative aspect-video">
								<button type="button" disabled={busy} aria-label={`Photo ${i + 1}`} onClick={() => pickPhoto(p)} className={cn("h-full w-full rounded-lg border bg-cover bg-center", bg.kind === "image" && bg.src === p ? "border-[#068297] ring-2 ring-[#068297]" : "border-black/10")} style={{ backgroundImage: `url(${p})` }} />
								<button type="button" onClick={() => removePhoto(p)} aria-label={`Remove photo ${i + 1}`} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 focus:opacity-100 group-hover:opacity-100 max-md:opacity-100"><X className="h-3 w-3" /></button>
							</div>
						))}
					</div>
					<p className={cn("mt-2 text-[11px]", light ? "text-[#5f6368]" : "text-white/60")}>{prefs.photos.length ? "Your pictures are kept on this device, ready next time." : "Add a picture. It is shrunk and kept on this device for next time."}</p>
				</div>
			)}

			<p className={cn("mt-1 text-[11px]", light ? "text-[#5f6368]" : "text-white/50")}>{note || local || "The effect is made on your device, before anyone sees your camera."}</p>
		</div>
	);
}
