"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { colourSchemes, inspireImage, inspireSearch, type InspireItem, type Palette } from "@/app/actions/mjengo-inspire";
import { SOURCE_INFO, type InspireSource } from "@/lib/mjengo/inspire-sources";

type Mode = "photos" | "icons" | "stickers" | "colours";
const PHOTO_SOURCES: InspireSource[] = ["unsplash", "pixabay", "openverse"];

/** Photos, icons, stickers and colour schemes from free sources, placed on the page as editable images. */
export function InspirePanel({ onPlace, onColour, baseColour }: { onPlace: (dataUrl: string) => Promise<void>; onColour: (hex: string) => void; baseColour: string }) {
	const { toast } = useToast();
	const [mode, setMode] = useState<Mode>("photos");
	const [photoSource, setPhotoSource] = useState<InspireSource>("unsplash");
	const [query, setQuery] = useState("");
	const [items, setItems] = useState<InspireItem[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [placing, setPlacing] = useState<string | null>(null);
	const [schemes, setSchemes] = useState<Palette[] | null>(null);
	const [base, setBase] = useState(baseColour);

	const source: InspireSource = mode === "photos" ? photoSource : mode === "icons" ? "iconify" : "giphy";

	const run = (q: string) => {
		setItems(null); setError(null);
		unwrap(inspireSearch(source, q)).then(setItems).catch((e) => { setItems([]); setError(e instanceof Error ? e.message : "Could not load that."); });
	};
	useEffect(() => {
		if (mode === "colours") return;
		run(query);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [source, mode]);
	useEffect(() => {
		if (mode !== "colours") return;
		setSchemes(null); setError(null);
		unwrap(colourSchemes(base)).then(setSchemes).catch((e) => { setSchemes([]); setError(e instanceof Error ? e.message : "Could not load colours."); });
	}, [mode, base]);

	const place = async (it: InspireItem) => {
		setPlacing(it.id);
		try {
			const data = await unwrap(inspireImage(it.full, it.track));
			await onPlace(data);
		} catch (e) {
			toast({ title: "Could not place that", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setPlacing(null);
		}
	};

	const tabs: [Mode, string][] = [["photos", "Photos"], ["icons", "Icons"], ["stickers", "Stickers"], ["colours", "Colours"]];

	return (
		<div className="space-y-3">
			<div className="flex gap-1 rounded-lg bg-serene-neutral-100 p-0.5">
				{tabs.map(([k, l]) => <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={cn("flex-1 rounded-md px-2 py-1 text-xs font-medium", mode === k ? "bg-white shadow-sm" : "text-serene-neutral-600")}>{l}</button>)}
			</div>

			{mode === "colours" ? (
				<div className="space-y-3">
					<label className="flex items-center gap-2 text-xs text-serene-neutral-600">Start from
						<input type="color" value={base} onChange={(e) => setBase(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-serene-neutral-200 p-0.5" />
						<span className="font-mono">{base}</span>
					</label>
					{error ? <p className="text-xs text-serene-neutral-500">{error}</p> : !schemes ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-serene-neutral-400" /> : schemes.map((p) => (
						<div key={p.name}>
							<p className="mb-1 text-xs font-medium text-serene-neutral-600">{p.name}</p>
							<div className="flex overflow-hidden rounded-lg border border-serene-neutral-200">
								{p.colors.map((c) => <button key={c} onClick={() => onColour(c)} aria-label={`Use ${c}`} title={c} className="h-10 flex-1" style={{ background: c }} />)}
							</div>
						</div>
					))}
					<p className="text-xs text-serene-neutral-500">Click a colour to fill what is selected on the page.</p>
				</div>
			) : (
				<>
					{mode === "photos" && (
						<div className="flex flex-wrap gap-1">
							{PHOTO_SOURCES.map((s) => <button key={s} onClick={() => setPhotoSource(s)} aria-pressed={photoSource === s} className={cn("rounded-full border px-2.5 py-1 text-xs", photoSource === s ? "border-[#7D2AE8] bg-[#7D2AE8]/10 text-[#7D2AE8]" : "border-serene-neutral-200")}>{SOURCE_INFO[s].label}</button>)}
						</div>
					)}
					<form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); run(query); }}>
						<Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mode === "icons" ? "Search icons" : mode === "stickers" ? "Search stickers" : "Search photos"} aria-label="Search" className="h-9 text-sm" />
						<Button type="submit" size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label="Search"><Search className="h-4 w-4" /></Button>
					</form>
					{error ? <p className="rounded-xl border border-dashed border-serene-neutral-200 p-3 text-xs text-serene-neutral-500">{error}</p> : items === null ? (
						<Loader2 className="mx-auto h-5 w-5 animate-spin text-serene-neutral-400" />
					) : items.length === 0 ? <p className="text-xs text-serene-neutral-500">Nothing found. Try another word.</p> : (
						<div className={cn("grid gap-2", mode === "icons" ? "grid-cols-4" : "grid-cols-2")}>
							{items.map((it) => (
								<button key={it.id} onClick={() => place(it)} disabled={placing !== null} title={it.credit} className="group relative overflow-hidden rounded-lg border border-serene-neutral-200 bg-white hover:border-[#7D2AE8] disabled:opacity-70">
									<img src={it.thumb} alt={it.title} loading="lazy" className={cn("w-full", mode === "icons" ? "aspect-square object-contain p-1.5" : "aspect-square object-cover")} />
									{placing === it.id && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-4 w-4 animate-spin" /></span>}
								</button>
							))}
						</div>
					)}
					<p className="text-xs text-serene-neutral-500">Hover a picture to see who made it. Credit them where the licence asks for it.</p>
				</>
			)}
		</div>
	);
}
