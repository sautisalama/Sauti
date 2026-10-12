"use client";

import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ImagePlus, Link2, Loader2, Monitor, Smartphone, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { putToSignedUrl } from "@/lib/client/upload";
import { formImageUpload } from "@/app/actions/mjengo-forms";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { THEME_PRESETS, toPublicForm } from "@/lib/forms/public-view";
import { layoutFor, mediaFor, type Device, type FormSettings, type FormTheme, type Media, type Question, type QuestionView, type ViewLayout, type Welcome } from "@/lib/forms/schema";

type Views = { desktop?: QuestionView; mobile?: QuestionView };
type Item = { media?: Media | null; view?: Views };

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

/** Upload a picture or video to the form's public folder, or take a link (YouTube and Vimeo work). */
export function MediaPicker({ formId, value, onChange, accept = "both", compact }: { formId: string; value: Media | null; onChange: (m: Media | null) => void; accept?: "image" | "both"; compact?: boolean }) {
	const { toast } = useToast();
	const input = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [link, setLink] = useState("");
	const [linking, setLinking] = useState(false);

	const upload = async (f: File | undefined) => {
		if (!f) return;
		const isVideo = f.type.startsWith("video/");
		if (!f.type.startsWith("image/") && !(isVideo && accept === "both")) { toast({ title: "That file type is not supported", description: accept === "both" ? "Use a picture, or an MP4 or WebM video." : "Use a picture.", variant: "destructive" }); return; }
		if (f.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) { toast({ title: "That file is too big", description: isVideo ? "Videos up to 50 MB can be uploaded. For longer ones, paste a YouTube or Vimeo link." : "Pictures up to 8 MB.", variant: "destructive" }); return; }
		setBusy(true);
		try {
			const { signedUrl, publicUrl } = await formImageUpload(formId, f.name);
			await putToSignedUrl(signedUrl, f);
			onChange({ kind: isVideo ? "video" : "image", url: publicUrl, alt: value?.alt });
		} catch (e) {
			toast({ title: "Could not upload that", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
			if (input.current) input.current.value = "";
		}
	};

	const addLink = () => {
		const u = link.trim();
		if (!/^https:\/\/\S+$/i.test(u)) { toast({ title: "Paste a link that starts with https://", variant: "destructive" }); return; }
		const video = /youtu\.be|youtube\.com|vimeo\.com|\.(mp4|webm|mov)(\?|$)/i.test(u);
		if (video && accept !== "both") { toast({ title: "Only pictures can go here", variant: "destructive" }); return; }
		onChange({ kind: video ? "video" : "image", url: u, alt: value?.alt });
		setLink(""); setLinking(false);
	};

	return (
		<div className="space-y-2">
			{value ? (
				<div className="flex items-start gap-3">
					<div className={cn("relative shrink-0 overflow-hidden rounded-lg border border-serene-neutral-200 bg-black/5", compact ? "h-14 w-20" : "h-20 w-32")}>
						{value.kind === "image" ? <img src={value.url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-black text-white"><Video className="h-6 w-6" /></div>}
					</div>
					<div className="min-w-0 flex-1 space-y-1.5">
						<p className="truncate text-xs text-serene-neutral-500">{value.kind === "video" ? "Video" : "Picture"}: {value.url.replace(/^https:\/\//, "").slice(0, 48)}</p>
						<Input value={value.alt ?? ""} onChange={(e) => onChange({ ...value, alt: e.target.value })} placeholder="Describe it for screen readers" className="h-8 text-xs" aria-label="Description for screen readers" />
						<div className="flex gap-1.5">
							<Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Replace"}</Button>
							<Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs text-red-600" onClick={() => onChange(null)}><Trash2 className="h-3 w-3" /> Remove</Button>
						</div>
					</div>
				</div>
			) : (
				<div className="flex flex-wrap items-center gap-2">
					<Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} {accept === "both" ? "Upload picture or video" : "Upload picture"}</Button>
					<Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setLinking((v) => !v)}><Link2 className="h-3.5 w-3.5" /> Use a link</Button>
				</div>
			)}
			{linking && !value && (
				<div className="flex gap-1.5">
					<Input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} placeholder={accept === "both" ? "https:// picture, YouTube or Vimeo link" : "https:// picture link"} className="h-8 text-xs" />
					<Button type="button" size="sm" className="h-8 text-xs" onClick={addLink}>Add</Button>
				</div>
			)}
			<input ref={input} type="file" accept={accept === "both" ? "image/*,video/mp4,video/webm,video/quicktime" : "image/*"} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
		</div>
	);
}

const LAYOUTS: { id: ViewLayout; label: string; desktopOnly?: boolean }[] = [
	{ id: "stack", label: "Above" },
	{ id: "split-left", label: "Left", desktopOnly: true },
	{ id: "split-right", label: "Right", desktopOnly: true },
	{ id: "wallpaper", label: "Background" },
];

function LayoutGlyph({ id }: { id: ViewLayout }) {
	const box = "flex h-7 w-10 rounded border border-current p-0.5 opacity-80";
	if (id === "split-left") return <span className={box}><i className="w-1/2 rounded-sm bg-current opacity-60" /></span>;
	if (id === "split-right") return <span className={cn(box, "justify-end")}><i className="w-1/2 rounded-sm bg-current opacity-60" /></span>;
	if (id === "wallpaper") return <span className={box}><i className="h-full w-full rounded-sm bg-current opacity-35" /></span>;
	return <span className={cn(box, "flex-col gap-0.5")}><i className="h-2/5 w-full rounded-sm bg-current opacity-60" /><i className="h-1 w-3/4 rounded-sm bg-current opacity-30" /></span>;
}

/**
 * Picture or video for one question (or the welcome screen) and how it sits on the device being edited.
 * Content is shared; a view can override it. Nothing is lost by switching views or layouts.
 */
export function ViewEditor({ formId, item, device, onChange }: { formId: string; item: Item; device: Device; onChange: (patch: Partial<Item>) => void }) {
	const own = item.view?.[device];
	const sameMedia = own?.media === undefined;
	const shownMedia = mediaFor(item, device);
	const currentLayout = layoutFor(item, device);
	const other: Device = device === "desktop" ? "mobile" : "desktop";

	const setView = (d: Device, patch: Partial<QuestionView>) => onChange({ view: { ...(item.view ?? {}), [d]: { ...(item.view?.[d] ?? {}), ...patch } } });
	const setMedia = (m: Media | null) => {
		if (sameMedia) onChange({ media: m });
		else setView(device, { media: m });
	};

	return (
		<div className="space-y-3 rounded-xl border border-serene-neutral-200 bg-serene-neutral-50/60 p-3">
			<p className="flex items-center gap-1.5 text-xs font-semibold text-serene-neutral-700">{device === "desktop" ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />} Picture or video on {device === "desktop" ? "desktop" : "mobile"}</p>
			<MediaPicker formId={formId} value={shownMedia} onChange={setMedia} compact />
			<label className="flex items-center gap-2 text-xs text-serene-neutral-600">
				<Switch checked={sameMedia} onCheckedChange={(v) => {
					if (v) setView(device, { media: undefined });
					else setView(device, { media: shownMedia ?? null });
				}} />
				Same picture on desktop and mobile
			</label>
			{shownMedia && (
				<div className="space-y-1.5">
					<Label className="text-xs">Layout on {device === "desktop" ? "desktop" : "mobile"}</Label>
					<div className="flex flex-wrap gap-2">
						{LAYOUTS.filter((l) => device === "desktop" || !l.desktopOnly).map((l) => (
							<button key={l.id} type="button" aria-pressed={currentLayout === l.id} onClick={() => setView(device, { layout: l.id })}
								className={cn("flex flex-col items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium", currentLayout === l.id ? "border-sauti-teal bg-sauti-teal-light/50 text-sauti-dark" : "border-serene-neutral-200 text-serene-neutral-600 hover:bg-white")}>
								<LayoutGlyph id={l.id} />{l.label}
							</button>
						))}
					</div>
				</div>
			)}
			<button type="button" className="text-xs font-medium text-sauti-teal hover:underline" onClick={() => {
				const src = item.view?.[device];
				onChange({ view: { ...(item.view ?? {}), [other]: { layout: layoutFor(item, device), ...(src?.media !== undefined ? { media: src.media } : shownMedia ? { media: shownMedia } : {}) } } });
			}}>
				Copy this {device} view to {other}
			</button>
		</div>
	);
}

/** The welcome screen: title, text, button and media. Off by default. */
export function WelcomeEditor({ formId, welcome, onChange, device, onFocus }: { formId: string; welcome: Welcome | undefined; onChange: (w: Welcome) => void; device: Device; onFocus?: () => void }) {
	const w = welcome ?? {};
	return (
		<section onFocusCapture={onFocus} onClick={onFocus} className="space-y-3 rounded-2xl border border-serene-neutral-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
			<label className="flex items-center justify-between gap-3 text-sm">
				<span><span className="font-medium">Welcome screen</span><span className="block text-xs text-serene-neutral-500">A first page with a title, a picture and a start button.</span></span>
				<Switch checked={!!w.enabled} onCheckedChange={(v) => onChange({ ...w, enabled: v })} />
			</label>
			{w.enabled && (
				<div className="space-y-3">
					<Input value={w.title ?? ""} onChange={(e) => onChange({ ...w, title: e.target.value })} placeholder="Title (defaults to the form title)" />
					<Textarea value={w.description ?? ""} onChange={(e) => onChange({ ...w, description: e.target.value })} rows={2} placeholder="A sentence or two about this form" />
					<Input value={w.button ?? ""} onChange={(e) => onChange({ ...w, button: e.target.value })} maxLength={24} placeholder="Button label, for example Start" className="sm:w-60" />
					<ViewEditor formId={formId} item={w} device={device} onChange={(p) => onChange({ ...w, ...p })} />
				</div>
			)}
		</section>
	);
}

/* ------------------------------------------------------------------ Preview */

/** The form on a phone or a desktop screen, live. The frame scales to fit, so what is shown is what people get. */
export function DevicePreview({ form, device, focusId, layout, className }: { form: { slug: string; title: string; description: string | null; questions: Question[]; settings: FormSettings }; device: Device; focusId?: string | null; layout?: "page" | "single"; className?: string }) {
	const wrap = useRef<HTMLDivElement>(null);
	const [w, setW] = useState(360);
	useEffect(() => {
		const el = wrap.current;
		if (!el) return;
		const ro = new ResizeObserver(() => setW(el.clientWidth));
		ro.observe(el);
		setW(el.clientWidth);
		return () => ro.disconnect();
	}, []);
	const [fw, fh] = device === "desktop" ? [1280, 800] : [390, 800];
	const bezel = device === "mobile" ? 20 : 0;
	const scale = Math.min(1, Math.max(0.2, (w - bezel) / fw));
	const bar = device === "desktop" ? 28 : 0;
	const pub = toPublicForm(form);
	return (
		<div ref={wrap} className={cn("w-full", className)}>
			<div className={cn("mx-auto overflow-hidden", device === "mobile" ? "rounded-[2.2rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl" : "rounded-xl border border-serene-neutral-300 bg-white shadow-lg")}
				style={{ width: fw * scale + bezel, height: fh * scale + bezel + bar }}>
				{device === "desktop" && (
					<div className="flex h-7 items-center gap-1.5 border-b border-serene-neutral-200 bg-serene-neutral-100 px-3" style={{ width: fw * scale }}>
						<i className="h-2 w-2 rounded-full bg-red-300" /><i className="h-2 w-2 rounded-full bg-amber-300" /><i className="h-2 w-2 rounded-full bg-emerald-300" />
						<span className="ml-2 truncate rounded bg-white px-2 py-0.5 text-[10px] text-serene-neutral-500">sautisalama.org/f/{form.slug}</span>
					</div>
				)}
				<div style={{ width: fw, height: fh, transform: `scale(${scale})`, transformOrigin: "top left" }}>
					<FormRenderer form={pub} preview embedded device={device} focusId={focusId} layoutOverride={layout} />
				</div>
			</div>
		</div>
	);
}

export function DeviceToggle({ device, onChange }: { device: Device; onChange: (d: Device) => void }) {
	return (
		<div className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5" role="group" aria-label="Edit view">
			{([["desktop", Monitor, "Desktop"], ["mobile", Smartphone, "Mobile"]] as const).map(([d, Icon, l]) => (
				<button key={d} type="button" aria-pressed={device === d} onClick={() => onChange(d)} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", device === d ? "bg-sauti-teal text-white" : "text-serene-neutral-600 hover:bg-serene-neutral-50")}><Icon className="h-3.5 w-3.5" />{l}</button>
			))}
		</div>
	);
}

export function ModeToggle({ mode, onChange }: { mode: "page" | "single"; onChange: (m: "page" | "single") => void }) {
	return (
		<div className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5" role="group" aria-label="Form layout">
			{([["single", "Full page"], ["page", "Classic list"]] as const).map(([m, l]) => (
				<button key={m} type="button" aria-pressed={mode === m} onClick={() => onChange(m)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium", mode === m ? "bg-sauti-teal text-white" : "text-serene-neutral-600 hover:bg-serene-neutral-50")}>{l}</button>
			))}
		</div>
	);
}

/* -------------------------------------------------------------------- Theme */

const FONTS: { id: NonNullable<FormTheme["font"]>; label: string; family: string }[] = [
	{ id: "sans", label: "Clean", family: "ui-sans-serif, system-ui, sans-serif" },
	{ id: "serif", label: "Editorial", family: "Georgia, serif" },
	{ id: "rounded", label: "Friendly", family: 'ui-rounded, "Nunito", system-ui, sans-serif' },
	{ id: "mono", label: "Technical", family: "ui-monospace, Menlo, monospace" },
];

function ColourRow({ label, value, fallback, onChange }: { label: string; value: string | undefined; fallback: string; onChange: (v: string | undefined) => void }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<Label className="text-xs">{label}</Label>
			<div className="flex items-center gap-2">
				{value && <button type="button" className="text-[11px] text-serene-neutral-500 hover:underline" onClick={() => onChange(undefined)}>Auto</button>}
				<input type="color" aria-label={label} value={value ?? fallback} onChange={(e) => onChange(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-serene-neutral-200 bg-white p-0.5" />
			</div>
		</div>
	);
}

const SECTION = "space-y-3 rounded-2xl border border-serene-neutral-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

/** Logo, font, colours, corners and background: the theme panel. */
export function ThemePanel({ formId, settings, onChange }: { formId: string; settings: FormSettings; onChange: (s: FormSettings) => void }) {
	const t: FormTheme = settings.theme ?? {};
	const setTheme = (patch: Partial<FormTheme>) => onChange({ ...settings, theme: { ...t, ...patch } });
	const accent = settings.style?.accent || "#068297";
	const bg = t.background;

	return (
		<div className="space-y-4">
			<section className={SECTION}>
				<h3 className="text-sm font-bold text-sauti-dark">Themes</h3>
				<div className="grid grid-cols-3 gap-2">
					{THEME_PRESETS.map((p) => (
						<button key={p.id} type="button" onClick={() => onChange({ ...settings, style: { ...settings.style, accent: p.accent, background: p.background }, theme: { ...p.theme, logo: t.logo } })}
							className="overflow-hidden rounded-xl border border-serene-neutral-200 text-left transition hover:border-sauti-teal">
							<span className="block p-2.5" style={{ background: p.theme.background?.value ?? p.background, color: p.theme.questionColor ?? "#111827", fontFamily: FONTS.find((f) => f.id === p.theme.font)?.family }}>
								<span className="block text-[11px] font-semibold">Question</span>
								<span className="mt-1 block h-4 w-10" style={{ background: p.theme.buttonColor ?? p.accent, borderRadius: p.theme.radius === "full" ? 9999 : p.theme.radius === "none" ? 0 : 6 }} />
							</span>
							<span className="block bg-white px-2.5 py-1 text-[11px] font-medium text-serene-neutral-700">{p.name}</span>
						</button>
					))}
				</div>
			</section>

			<section className={SECTION}>
				<h3 className="text-sm font-bold text-sauti-dark">Logo</h3>
				<MediaPicker formId={formId} accept="image" compact value={t.logo ? { kind: "image", url: t.logo.url, alt: t.logo.alt } : null}
					onChange={(m) => setTheme({ logo: m ? { url: m.url, size: t.logo?.size ?? "md", align: t.logo?.align ?? "left", alt: m.alt } : undefined })} />
				{t.logo && (
					<div className="flex flex-wrap items-center gap-4">
						<div className="inline-flex rounded-lg border border-serene-neutral-200 p-0.5" role="group" aria-label="Logo size">
							{(["sm", "md", "lg"] as const).map((s) => <button key={s} type="button" aria-pressed={(t.logo!.size ?? "md") === s} onClick={() => setTheme({ logo: { ...t.logo!, size: s } })} className={cn("rounded-md px-2.5 py-1 text-xs font-medium uppercase", (t.logo!.size ?? "md") === s ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}>{s}</button>)}
						</div>
						<div className="inline-flex rounded-lg border border-serene-neutral-200 p-0.5" role="group" aria-label="Logo alignment">
							{([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => <button key={a} type="button" aria-label={`Align ${a}`} aria-pressed={(t.logo!.align ?? "left") === a} onClick={() => setTheme({ logo: { ...t.logo!, align: a } })} className={cn("rounded-md px-2 py-1", (t.logo!.align ?? "left") === a ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}><Icon className="h-4 w-4" /></button>)}
						</div>
					</div>
				)}
			</section>

			<section className={SECTION}>
				<h3 className="text-sm font-bold text-sauti-dark">Type, colour and shape</h3>
				<div className="grid grid-cols-2 gap-2">
					{FONTS.map((f) => (
						<button key={f.id} type="button" aria-pressed={(t.font ?? "sans") === f.id} onClick={() => setTheme({ font: f.id })} className={cn("rounded-xl border px-3 py-2 text-left", (t.font ?? "sans") === f.id ? "border-sauti-teal bg-sauti-teal-light/40" : "border-serene-neutral-200 hover:bg-serene-neutral-50")}>
							<span className="block text-base" style={{ fontFamily: f.family }}>Aa Sauti</span>
							<span className="block text-[11px] text-serene-neutral-500">{f.label}</span>
						</button>
					))}
				</div>
				<ColourRow label="Questions" value={t.questionColor} fallback="#111827" onChange={(v) => setTheme({ questionColor: v })} />
				<ColourRow label="Answers" value={t.answerColor} fallback={accent} onChange={(v) => setTheme({ answerColor: v })} />
				<ColourRow label="Buttons" value={t.buttonColor ?? accent} fallback={accent} onChange={(v) => setTheme({ buttonColor: v })} />
				<ColourRow label="Button text" value={t.buttonText} fallback="#ffffff" onChange={(v) => setTheme({ buttonText: v })} />
				<div className="space-y-1.5">
					<Label className="text-xs">Corners</Label>
					<div className="inline-flex rounded-lg border border-serene-neutral-200 p-0.5" role="group">
						{([["none", "Square"], ["md", "Soft"], ["full", "Round"]] as const).map(([r, l]) => <button key={r} type="button" aria-pressed={(t.radius ?? "md") === r} onClick={() => setTheme({ radius: r })} className={cn("rounded-md px-3 py-1 text-xs font-medium", (t.radius ?? "md") === r ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}>{l}</button>)}
					</div>
				</div>
			</section>

			<section className={SECTION}>
				<h3 className="text-sm font-bold text-sauti-dark">Background</h3>
				<div className="inline-flex rounded-lg border border-serene-neutral-200 p-0.5" role="group">
					{([["color", "Colour"], ["image", "Picture"]] as const).map(([k, l]) => (
						<button key={k} type="button" aria-pressed={(bg?.kind ?? "color") === k}
							onClick={() => (k === "color" ? setTheme({ background: { kind: "color", value: settings.style?.background || "#f4f7f8" } }) : setTheme({ background: bg?.kind === "image" ? bg : undefined }))}
							className={cn("rounded-md px-3 py-1 text-xs font-medium", (bg?.kind ?? "color") === k ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}>{l}</button>
					))}
				</div>
				{(bg?.kind ?? "color") === "color" ? (
					<ColourRow label="Background colour" value={bg?.kind === "color" ? bg.value : settings.style?.background} fallback="#f4f7f8"
						onChange={(v) => onChange({ ...settings, style: { ...settings.style, background: v ?? "#f4f7f8" }, theme: { ...t, background: { kind: "color", value: v ?? "#f4f7f8" } } })} />
				) : (
					<div className="space-y-3">
						<MediaPicker formId={formId} accept="image" compact value={bg?.kind === "image" ? { kind: "image", url: bg.value } : null}
							onChange={(m) => setTheme({ background: m ? { kind: "image", value: m.url, overlay: bg?.kind === "image" ? bg.overlay ?? 30 : 30 } : undefined })} />
						{bg?.kind === "image" && (
							<label className="block space-y-1 text-xs">
								<span className="flex justify-between"><span>Darken for readability</span><span className="tabular-nums">{bg.overlay ?? 0}%</span></span>
								<input type="range" min={0} max={70} value={bg.overlay ?? 0} onChange={(e) => setTheme({ background: { ...bg, overlay: Number(e.target.value) } })} className="w-full accent-[#068297]" />
							</label>
						)}
					</div>
				)}
			</section>
		</div>
	);
}
