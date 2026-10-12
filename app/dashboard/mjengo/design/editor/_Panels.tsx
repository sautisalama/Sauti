"use client";

import { useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FONT_OPTIONS, ensureFont } from "@/lib/mjengo/fonts";
import { searchFiles, getFileUrl } from "../../vault/api";
import type { AssetRow } from "@/app/actions/mjengo-ai";
import { WEBSITE_PHOTOS, encodeSrc } from "@/lib/mjengo/design-templates";

/* ------------------------------------------------------------------ Text */

export interface TextPreset {
	id: string;
	label: string;
	sample: string;
	font: string;
	size: number;
	bold?: boolean;
	italic?: boolean;
	color?: string;
	spacing?: number;
	caps?: boolean;
	bg?: string;
	align?: "left" | "center" | "right";
	lh?: number;
}

/** Text with a personality: each one is a font, a weight and a finish, ready to place and change. */
export const TEXT_PRESETS: TextPreset[] = [
	{ id: "h-bold", label: "Bold headline", sample: "Add a heading", font: "Inter", size: 0.09, bold: true },
	{ id: "h-serif", label: "Serif headline", sample: "Add a heading", font: "Playfair Display", size: 0.09, bold: true },
	{ id: "h-display", label: "Poster caps", sample: "BIG IDEA", font: "Bebas Neue", size: 0.13, spacing: 60 },
	{ id: "h-heavy", label: "Heavy", sample: "Say it loud", font: "Archivo Black", size: 0.09 },
	{ id: "h-soft", label: "Soft rounded", sample: "Hello there", font: "Outfit", size: 0.09, bold: true },
	{ id: "script", label: "Handwritten", sample: "With love", font: "Caveat", size: 0.1, bold: true },
	{ id: "script-2", label: "Script", sample: "Thank you", font: "Pacifico", size: 0.08 },
	{ id: "kicker", label: "Kicker", sample: "KNOW YOUR RIGHTS", font: "Montserrat", size: 0.032, bold: true, spacing: 300, color: "#7D2AE8" },
	{ id: "label", label: "Label", sample: "NEW", font: "Space Grotesk", size: 0.035, bold: true, color: "#FFFFFF", bg: "#0E1318", spacing: 150 },
	{ id: "sub", label: "Subheading", sample: "Add a subheading", font: "DM Sans", size: 0.055, bold: true },
	{ id: "body", label: "Body text", sample: "A little bit of body text", font: "Inter", size: 0.035 },
	{ id: "quote", label: "Quote", sample: "“The words that matter.”", font: "Fraunces", size: 0.07, italic: true },
	{ id: "mono", label: "Monospace", sample: "sautisalama.org", font: "Space Mono", size: 0.034 },
	{ id: "highlight", label: "Highlighted", sample: "Important", font: "Poppins", size: 0.06, bold: true, bg: "#FFDE59" },
];

export function TextPanel({ onPreset, onFont, current }: { onPreset: (p: TextPreset) => void; onFont: (family: string) => void; current: string | null }) {
	const [group, setGroup] = useState<"All" | "Sans" | "Serif" | "Display" | "Script" | "Mono">("All");
	const fonts = FONT_OPTIONS.filter((f) => group === "All" || f.group === group);
	useEffect(() => { TEXT_PRESETS.forEach((p) => void ensureFont(p.font)); }, []);
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<h3 className="text-sm font-semibold">Text styles</h3>
				{TEXT_PRESETS.map((p) => (
					<button key={p.id} onClick={() => onPreset(p)} className="block w-full rounded-xl border border-serene-neutral-200 bg-white px-3 py-2.5 text-left transition hover:border-[#7D2AE8]">
						<span
							className="block truncate"
							style={{ fontFamily: `"${p.font}", Inter, sans-serif`, fontWeight: p.bold ? 700 : 400, fontStyle: p.italic ? "italic" : "normal", letterSpacing: p.spacing ? `${p.spacing / 1000}em` : undefined, color: p.color && p.bg ? p.color : p.color ?? "#0E1318", background: p.bg, padding: p.bg ? "2px 8px" : undefined, display: p.bg ? "inline-block" : undefined, fontSize: Math.min(26, Math.max(14, p.size * 260)) }}
						>{p.sample}</span>
						<span className="mt-0.5 block text-[11px] text-serene-neutral-500">{p.label}</span>
					</button>
				))}
			</div>
			<div>
				<h3 className="mb-2 text-sm font-semibold">Fonts</h3>
				<div className="mb-2 flex flex-wrap gap-1">
					{(["All", "Sans", "Serif", "Display", "Script", "Mono"] as const).map((g) => <button key={g} onClick={() => setGroup(g)} aria-pressed={group === g} className={cn("rounded-full border px-2.5 py-0.5 text-xs", group === g ? "border-[#7D2AE8] bg-[#7D2AE8]/10 text-[#7D2AE8]" : "border-serene-neutral-200")}>{g}</button>)}
				</div>
				<ul className="max-h-72 space-y-0.5 overflow-y-auto">
					{fonts.map((f) => (
						<li key={f.family}>
							<button onMouseEnter={() => void ensureFont(f.family)} onClick={() => onFont(f.family)} className={cn("flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-base hover:bg-serene-neutral-100", current === f.family && "bg-sauti-teal-light")} style={{ fontFamily: `"${f.family}", sans-serif` }}>
								<span>{f.family}</span>
							</button>
						</li>
					))}
				</ul>
				<p className="mt-2 text-xs text-serene-neutral-500">Select text on the page, then pick a font to change it.</p>
			</div>
		</div>
	);
}

/* --------------------------------------------------------------- Elements */

export type ShapeKind = "rect" | "rounded" | "circle" | "triangle" | "star" | "heart" | "arrow" | "bubble" | "line" | "dashed";

const SHAPES: { k: ShapeKind; label: string; d: string }[] = [
	{ k: "rect", label: "Square", d: "M4 4h16v16H4z" },
	{ k: "rounded", label: "Rounded", d: "M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" },
	{ k: "circle", label: "Circle", d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" },
	{ k: "triangle", label: "Triangle", d: "M12 4l9 16H3z" },
	{ k: "star", label: "Star", d: "M12 2l3 7 7.5.6-5.7 4.9 1.8 7.4L12 18l-6.6 3.9 1.8-7.4L1.5 9.6 9 9z" },
	{ k: "heart", label: "Heart", d: "M12 21s-8-5.4-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.600-8 11-8 11z" },
	{ k: "arrow", label: "Arrow", d: "M3 11h13l-4-4 1.4-1.4L20 12l-6.6 6.4L12 17l4-4H3z" },
	{ k: "bubble", label: "Speech", d: "M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" },
	{ k: "line", label: "Line", d: "M3 12h18" },
	{ k: "dashed", label: "Dashed", d: "M3 12h3M9 12h3M15 12h3" },
];

export function ElementsPanel({ onShape, onQr, onSvg }: { onShape: (k: ShapeKind) => void; onQr: (dataUrl: string) => void; onSvg: (dataUrl: string) => void }) {
	const [text, setText] = useState("https://www.sautisalama.org");
	const [fg, setFg] = useState("#0E1318");
	const [bg, setBg] = useState("#FFFFFF");
	const [level, setLevel] = useState<"L" | "M" | "Q" | "H">("M");
	const [q, setQ] = useState("");
	const [icons, setIcons] = useState<{ name: string; url: string }[] | null>(null);

	const svg = useMemo(() => renderToStaticMarkup(<QRCodeSVG value={text || " "} size={512} fgColor={fg} bgColor={bg} level={level} marginSize={2} />).replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'), [text, fg, bg, level]);
	const qrUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

	const searchIcons = async (term: string) => {
		setIcons(null);
		try {
			const r = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(term || "star")}&limit=36`);
			const j = (await r.json()) as { icons?: string[] };
			setIcons((j.icons ?? []).map((n) => { const [p, i] = n.split(":"); return { name: i, url: `https://api.iconify.design/${p}/${i}.svg` }; }));
		} catch { setIcons([]); }
	};
	useEffect(() => { void searchIcons("heart"); }, []);

	return (
		<div className="space-y-5">
			<div>
				<h3 className="mb-2 text-sm font-semibold">Shapes</h3>
				<div className="grid grid-cols-5 gap-1.5">
					{SHAPES.map((s) => (
						<button key={s.k} onClick={() => onShape(s.k)} title={s.label} aria-label={s.label} className="flex aspect-square items-center justify-center rounded-lg border border-serene-neutral-200 bg-white text-serene-neutral-700 transition hover:border-[#7D2AE8] hover:text-[#7D2AE8]">
							<svg viewBox="0 0 24 24" className="h-6 w-6" fill={s.k === "line" || s.k === "dashed" ? "none" : "currentColor"} stroke="currentColor" strokeWidth={s.k === "line" || s.k === "dashed" ? 2 : 0} strokeLinecap="round"><path d={s.d} /></svg>
						</button>
					))}
				</div>
			</div>

			<div className="rounded-2xl border border-serene-neutral-200 bg-[#FAFAF8] p-3">
				<h3 className="mb-2 text-sm font-semibold">QR code</h3>
				<Input value={text} onChange={(e) => setText(e.target.value)} placeholder="A link, phone number or text" aria-label="QR code content" className="h-9 text-sm" />
				<div className="mt-2 flex items-start gap-3">
					<div className="shrink-0 rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-black/5"><img src={qrUrl} alt="QR code preview" className="h-20 w-20" /></div>
					<div className="min-w-0 space-y-1.5 text-xs text-serene-neutral-600">
						<label className="flex items-center gap-2">Colour <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-6 w-8 cursor-pointer rounded border p-0.5" /></label>
						<label className="flex items-center gap-2">Back <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-6 w-8 cursor-pointer rounded border p-0.5" /></label>
						<label className="flex items-center gap-1.5">Level
							<select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className="h-7 w-12 rounded border bg-white px-1">{["L", "M", "Q", "H"].map((l) => <option key={l}>{l}</option>)}</select>
						</label>
					</div>
				</div>
				<Button className="mt-3 w-full bg-[#7D2AE8] hover:bg-[#6a22c9]" disabled={!text.trim()} onClick={() => onQr(qrUrl)}>Add QR code to the page</Button>
				<p className="mt-1.5 text-[11px] text-serene-neutral-500">Dark code on a light back scans best. Test it with a phone before you post.</p>
			</div>

			<div>
				<h3 className="mb-2 text-sm font-semibold">Icons and graphics</h3>
				<form className="mb-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void searchIcons(q); }}>
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons" aria-label="Search icons" className="h-9 text-sm" />
					<Button type="submit" size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label="Search"><Search className="h-4 w-4" /></Button>
				</form>
				{icons === null ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-serene-neutral-400" /> : (
					<div className="grid grid-cols-5 gap-1.5">
						{icons.map((i) => (
							<button key={i.url} onClick={() => onSvg(`${i.url}?height=512`)} title={i.name} className="flex aspect-square items-center justify-center rounded-lg border border-serene-neutral-200 bg-white p-1.5 hover:border-[#7D2AE8]">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={i.url} alt={i.name} className="h-full w-full object-contain" loading="lazy" />
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

/* ---------------------------------------------------------------- Uploads */

const IMG = /\.(png|jpe?g|webp|gif|svg|avif)$/i;

/** Everything you can put on the page: pictures from this device, from Files, and what was made in Studio. */
export function UploadsPanel({ onPick, onUploadClick, assets }: { onPick: (url: string) => void; onUploadClick: () => void; assets: AssetRow[] }) {
	const [q, setQ] = useState("");
	const [files, setFiles] = useState<{ id: string; name: string; url?: string }[] | null>(null);
	const [busy, setBusy] = useState<string | null>(null);

	useEffect(() => {
		let on = true;
		const t = setTimeout(() => {
			searchFiles(q).then(async (list) => {
				const imgs = list.filter((f) => IMG.test(f.name)).slice(0, 24).map((f) => ({ id: f.id, name: f.name } as { id: string; name: string; url?: string }));
				if (!on) return;
				setFiles(imgs);
				// Thumbnails arrive as their addresses are resolved.
				for (const f of imgs) {
					if (!on) return;
					try { const u = await getFileUrl(f.id); f.url = u.url; setFiles((cur) => (cur ? [...cur] : cur)); } catch { /* no preview */ }
				}
			}).catch(() => on && setFiles([]));
		}, 200);
		return () => { on = false; clearTimeout(t); };
	}, [q]);

	const pick = async (f: { id: string; url?: string }) => {
		setBusy(f.id);
		try { onPick(f.url ?? (await getFileUrl(f.id)).url); } finally { setBusy(null); }
	};

	return (
		<div className="space-y-4">
			<Button className="w-full gap-2 bg-[#7D2AE8] hover:bg-[#6a22c9]" onClick={onUploadClick}><Upload className="h-4 w-4" /> Upload from this device</Button>
			<div>
				<h3 className="mb-2 text-sm font-semibold">From Files</h3>
				<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your pictures" aria-label="Search files" className="mb-2 h-9 text-sm" />
				{files === null ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-serene-neutral-400" /> : files.length === 0 ? (
					<p className="rounded-xl border border-dashed border-serene-neutral-200 p-3 text-xs text-serene-neutral-500">No pictures found in Files you can use. Upload some there and they appear here.</p>
				) : (
					<div className="grid grid-cols-3 gap-1.5">
						{files.map((f) => (
							<button key={f.id} onClick={() => pick(f)} title={f.name} className="relative aspect-square overflow-hidden rounded-lg border border-serene-neutral-200 bg-serene-neutral-100 hover:border-[#7D2AE8]">
								{f.url ? <img src={f.url} alt={f.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="mj-skel absolute inset-0" />}
								{busy === f.id && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-4 w-4 animate-spin" /></span>}
							</button>
						))}
					</div>
				)}
			</div>
			<div>
				<h3 className="mb-2 text-sm font-semibold">From the Sauti Salama website</h3>
				<div className="grid grid-cols-3 gap-1.5">
					{WEBSITE_PHOTOS.map((p) => (
						<button key={p.src} onClick={() => onPick(window.location.origin + encodeSrc(p.src))} title={p.label} className="overflow-hidden rounded-lg border border-serene-neutral-200 hover:border-[#7D2AE8]">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={encodeSrc(p.src)} alt={p.label} loading="lazy" className="aspect-square w-full object-cover" />
						</button>
					))}
				</div>
			</div>
			<div>
				<h3 className="mb-2 text-sm font-semibold">Made in Studio</h3>
				{assets.filter((a) => a.url).length === 0 ? <p className="text-xs text-serene-neutral-500">Images made in the assistant or saved from here show up in Studio.</p> : (
					<div className="grid grid-cols-3 gap-1.5">
						{assets.filter((a) => a.url).map((a) => <button key={a.id} onClick={() => a.url && onPick(a.url)} className="overflow-hidden rounded-lg border border-serene-neutral-200 hover:border-[#7D2AE8]"><img src={a.url!} alt={a.name} className="aspect-square w-full object-cover" loading="lazy" /></button>)}
					</div>
				)}
			</div>
		</div>
	);
}

/** A font list where every name is drawn in its own typeface, so what you see is what you get. */
export function FontPicker({ value, onChange }: { value: string; onChange: (family: string) => void }) {
	const [open, setOpen] = useState(false);
	useEffect(() => { if (open) FONT_OPTIONS.slice(0, 24).forEach((f) => void ensureFont(f.family)); }, [open]);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button aria-label="Font" className="flex h-8 min-w-[9rem] items-center justify-between gap-2 rounded-md border border-serene-neutral-200 bg-white px-2.5 text-sm hover:bg-serene-neutral-50" style={{ fontFamily: `"${value}", sans-serif` }}>
					<span className="truncate">{value}</span>
					<span className="text-xs text-serene-neutral-400">▾</span>
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-64 p-1">
				<ul className="max-h-72 overflow-y-auto">
					{FONT_OPTIONS.map((f) => (
						<li key={f.family}>
							<button onMouseEnter={() => void ensureFont(f.family)} onClick={() => { onChange(f.family); setOpen(false); }} className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[17px] hover:bg-serene-neutral-100", value === f.family && "bg-sauti-teal-light")} style={{ fontFamily: `"${f.family}", sans-serif` }}>
								<span>{f.family}</span><span className="text-[10px] text-serene-neutral-400" style={{ fontFamily: "Inter, sans-serif" }}>{f.group}</span>
							</button>
						</li>
					))}
				</ul>
			</PopoverContent>
		</Popover>
	);
}
