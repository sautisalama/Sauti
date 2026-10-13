"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookMarked, Check, FileText, Loader2, Plus, RefreshCw, Search, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { ColourInput } from "@/components/mjengo/ColourInput";
import { getBrand, rereadBrandGuidelines, saveBrand, tagBrandGuidelines } from "@/app/actions/mjengo-brand";
import type { Brand } from "@/lib/mjengo/brand";
import { searchFiles } from "../vault/api";
import { FontPicker } from "../design/editor/_Panels";
import { MjengoLoader } from "../_components/MjengoLoader";

const ROLES = [["primary", "Titles and main colour"], ["secondary", "Second headings"], ["accent", "Accents and rules"], ["muted", "Quiet text"]] as const;

/** One brand for the whole organisation, used by documents, forms, designs and the assistant. */
export default function BrandPage() {
	const { toast } = useToast();
	const [b, setB] = useState<Brand | null>(null);
	const [busy, setBusy] = useState(false);
	const [picking, setPicking] = useState(false);
	const [q, setQ] = useState("");
	const [hits, setHits] = useState<{ id: string; name: string; folder: string | null }[]>([]);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => { unwrap(getBrand()).then(setB).catch((e) => toast({ title: "Could not load the brand", description: e instanceof Error ? e.message : undefined, variant: "destructive" })); }, [toast]);
	useEffect(() => {
		if (!picking) return;
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => { searchFiles(q).then((r) => setHits(r.filter((f) => /\.(docx|pdf|txt|md)$/i.test(f.name)))).catch(() => setHits([])); }, 200);
	}, [q, picking]);

	if (!b) return <MjengoLoader label="Opening the brand" />;

	const change = async (patch: Partial<Brand>, done?: string) => {
		const prev = b;
		setB({ ...b, ...patch });
		try { setB(await unwrap(saveBrand(patch))); if (done) toast({ title: done }); } catch (e) { setB(prev); toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
	};
	const run = async (fn: () => Promise<Brand>, done: string) => {
		setBusy(true);
		try { setB(await fn()); toast({ title: done }); } catch (e) { toast({ title: "Could not do that", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	const readLogo = (f: File | undefined) => { if (!f) return; const r = new FileReader(); r.onload = () => void change({ logo: String(r.result) }, "Logo updated"); r.readAsDataURL(f); };

	return (
		<div className="mx-auto max-w-4xl space-y-5">
			<header>
				<h1 className="text-2xl font-bold tracking-tight text-sauti-dark">Brand</h1>
				<p className="text-sm text-serene-neutral-500">One brand for everyone. Documents, forms, designs and the assistant all follow it.</p>
			</header>

			<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5">
				<div className="flex flex-wrap items-start gap-4">
					<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sauti-teal-light text-sauti-teal"><BookMarked className="h-5 w-5" /></span>
					<div className="min-w-0 flex-1">
						<h2 className="text-sm font-bold text-sauti-dark">Official brand guidelines</h2>
						{b.guidelines ? (
							<>
								<p className="mt-0.5 flex items-center gap-1.5 text-sm text-serene-neutral-700"><FileText className="h-4 w-4 text-sauti-teal" /> <Link href={`/dashboard/mjengo/vault?open=${b.guidelines.fileId}`} className="truncate font-medium hover:underline">{b.guidelines.name}</Link></p>
								<p className="text-xs text-serene-neutral-500">Read {new Date(b.guidelines.readAt).toLocaleDateString()}. The colours, fonts, letterhead and rules below came from it.</p>
							</>
						) : <p className="mt-0.5 text-sm text-serene-neutral-600">Tag a document in Files as the official guidelines and the assistant reads every feature from it: colours, fonts, the letterhead and where everything goes.</p>}
						<div className="mt-3 flex flex-wrap gap-2">
							<Button size="sm" className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => setPicking((v) => !v)}><Search className="h-4 w-4" /> {b.guidelines ? "Choose another" : "Choose the document"}</Button>
							{b.guidelines && <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => run(() => unwrap(rereadBrandGuidelines()), "Guidelines read again")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Read again</Button>}
							{b.guidelines && <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => unwrap(tagBrandGuidelines(null)), "Guidelines untagged")}>Untag</Button>}
						</div>
						{picking && (
							<div className="mt-3 rounded-xl border border-serene-neutral-200 p-2">
								<Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a Word document, PDF or text file" className="h-9" />
								<ul className="mt-2 max-h-56 overflow-y-auto">
									{hits.length === 0 && <li className="px-2 py-3 text-sm text-serene-neutral-500">No readable documents found.</li>}
									{hits.map((f) => (
										<li key={f.id}><button disabled={busy} onClick={() => { setPicking(false); void run(() => unwrap(tagBrandGuidelines(f.id)), "Guidelines tagged and read"); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-serene-neutral-50"><FileText className="h-4 w-4 shrink-0 text-serene-neutral-400" /><span className="min-w-0 flex-1 truncate">{f.name}</span>{f.folder && <span className="text-xs text-serene-neutral-400">{f.folder}</span>}</button></li>
									))}
								</ul>
							</div>
						)}
					</div>
				</div>
			</section>

			<div className="grid gap-5 md:grid-cols-2">
				<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5">
					<h2 className="mb-3 text-sm font-bold text-sauti-dark">Colours</h2>
					<div className="flex flex-wrap gap-2">
						{b.colours.map((c, i) => (
							<span key={c + i} className="group relative">
								<span className="block h-10 w-10 rounded-full border border-black/10 shadow-sm" style={{ background: c }} title={c} />
								<button aria-label={`Remove ${c}`} onClick={() => void change({ colours: b.colours.filter((_, k) => k !== i) })} className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-white text-serene-neutral-500 shadow group-hover:flex"><X className="h-3 w-3" /></button>
							</span>
						))}
						<span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-serene-neutral-300 text-serene-neutral-400"><Plus className="h-4 w-4" />
							<ColourInput label="Add a brand colour" value="#068297" onCommit={(hex) => { if (!b.colours.some((c) => c.toLowerCase() === hex.toLowerCase())) void change({ colours: [...b.colours, hex] }); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
						</span>
					</div>
					<h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">How they are used</h3>
					<ul className="space-y-2">
						{ROLES.map(([k, label]) => (
							<li key={k} className="flex items-center gap-3 text-sm">
								<span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-black/10" style={{ background: b.palette[k] }}>
									<ColourInput label={label} value={b.palette[k]} onCommit={(hex) => void change({ palette: { ...b.palette, [k]: hex } })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
								</span>
								<span className="flex-1">{label}</span><span className="font-mono text-xs text-serene-neutral-400">{b.palette[k]}</span>
							</li>
						))}
					</ul>
				</section>

				<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5">
					<h2 className="mb-3 text-sm font-bold text-sauti-dark">Fonts and logo</h2>
					<div className="space-y-3">
						<label className="flex items-center justify-between gap-3 text-sm">Headings <FontPicker value={b.fonts.heading} onChange={(f) => void change({ fonts: { ...b.fonts, heading: f } })} /></label>
						<label className="flex items-center justify-between gap-3 text-sm">Body text <FontPicker value={b.fonts.body} onChange={(f) => void change({ fonts: { ...b.fonts, body: f } })} /></label>
						<div className="flex items-center gap-3 border-t border-serene-neutral-100 pt-3">
							<span className="flex h-16 w-16 items-center justify-center rounded-xl border border-serene-neutral-200 bg-white p-1.5">{/* eslint-disable-next-line @next/next/no-img-element */}{b.logo ? <img src={b.logo} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-serene-neutral-400">No logo</span>}</span>
							<label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-sauti-teal hover:underline"><Upload className="h-4 w-4" /> {b.logo ? "Change the logo" : "Upload a logo"}<input type="file" accept="image/*" className="sr-only" onChange={(e) => readLogo(e.target.files?.[0])} /></label>
						</div>
					</div>
				</section>
			</div>

			<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5">
				<h2 className="mb-3 text-sm font-bold text-sauti-dark">Letterhead</h2>
				<div className="grid gap-5 md:grid-cols-2">
					<div className="space-y-2.5">
						{([["name", "Organisation"], ["tagline", "Tagline"], ["contact", "Email, phone, website"], ["address", "Address"]] as const).map(([k, label]) => (
							<label key={k} className="block text-xs font-medium text-serene-neutral-500">{label}
								<Input defaultValue={b[k]} onBlur={(e) => { if (e.target.value !== b[k]) void change({ [k]: e.target.value } as Partial<Brand>); }} className="mt-1 h-9 text-sm" />
							</label>
						))}
						<div className="flex items-center gap-3">
							<span className="text-xs font-medium text-serene-neutral-500">Align</span>
							{(["left", "center", "right"] as const).map((a) => <button key={a} onClick={() => void change({ letterhead: { ...b.letterhead, align: a } })} className={cn("rounded-full border px-3 py-1 text-xs capitalize", b.letterhead.align === a ? "border-sauti-teal bg-sauti-teal-light text-sauti-dark" : "border-serene-neutral-200 text-serene-neutral-600")}>{a}</button>)}
							<label className="ml-auto flex items-center gap-2 text-xs text-serene-neutral-500">Rule <Switch checked={b.letterhead.rule} onCheckedChange={(v) => void change({ letterhead: { ...b.letterhead, rule: v } })} /></label>
						</div>
					</div>
					<div className="rounded-xl border border-serene-neutral-200 bg-white p-5 shadow-inner" aria-label="Letterhead preview">
						<div className={cn("flex items-center gap-3", b.letterhead.align === "center" && "flex-col text-center", b.letterhead.align === "right" && "flex-row-reverse text-right")}>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							{b.logo && <img src={b.logo} alt="" style={{ width: b.letterhead.logoWidth }} className="object-contain" />}
							<div>
								<p className="text-lg font-bold leading-tight" style={{ color: b.palette.primary, fontFamily: `"${b.fonts.heading}", sans-serif` }}>{b.name}</p>
								{b.tagline && <p className="text-xs" style={{ color: b.palette.secondary }}>{b.tagline}</p>}
								<p className="text-[11px]" style={{ color: b.palette.muted }}>{[b.address, b.contact].filter(Boolean).join("  ·  ")}</p>
							</div>
						</div>
						{b.letterhead.rule && <div className="mt-3 h-0.5 w-full" style={{ background: b.palette.accent }} />}
						<div className="mt-4 space-y-1.5" aria-hidden>{[90, 100, 72].map((w) => <i key={w} className="block h-1.5 rounded bg-serene-neutral-200" style={{ width: `${w}%` }} />)}</div>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5">
				<h2 className="mb-1 text-sm font-bold text-sauti-dark">Rules the assistant follows</h2>
				<p className="mb-3 text-xs text-serene-neutral-500">Where the letterhead and logo go, spacing, colour use and tone. They come from the guidelines document, and you can add your own.</p>
				{b.rules.length === 0 ? <p className="text-sm text-serene-neutral-500">None yet.</p> : (
					<ul className="space-y-1.5">
						{b.rules.map((r, i) => (
							<li key={i} className="group flex items-start gap-2 text-sm text-serene-neutral-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-sauti-teal" /><span className="flex-1">{r}</span>
								<button aria-label="Remove rule" onClick={() => void change({ rules: b.rules.filter((_, k) => k !== i) })} className="hidden rounded-full p-0.5 text-serene-neutral-400 hover:bg-black/5 group-hover:block"><X className="h-3.5 w-3.5" /></button>
							</li>
						))}
					</ul>
				)}
				<form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const el = e.currentTarget.elements.namedItem("rule") as HTMLInputElement; const v = el.value.trim(); if (!v) return; el.value = ""; void change({ rules: [...b.rules, v] }); }}>
					<Input name="rule" placeholder="Add a rule, for example: the logo always sits top left with 20 mm clear space" className="h-9" />
					<Button type="submit" size="sm" variant="outline">Add</Button>
				</form>
			</section>
		</div>
	);
}
