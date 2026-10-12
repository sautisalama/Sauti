"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { paletteFromImage } from "@/lib/client/palette";
import { paletteFromText } from "@/app/actions/mjengo-palette";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/**
 * Colours that come from something the person already has: a picture (a logo, a photo, a page of the brand
 * guidelines), or words (a mood, or the guideline text itself). Used by the design brand kit and the form
 * theme so every tool can match the organisation's look without hunting for hex codes.
 */
export function PaletteSources({ imageUrl, onPick, onPickAll, className }: { imageUrl?: string | null; onPick: (hex: string) => void; onPickAll?: (hexes: string[]) => void; className?: string }) {
	const [colours, setColours] = useState<string[]>([]);
	const [busy, setBusy] = useState<"" | "image" | "text">("");
	const [error, setError] = useState("");
	const [text, setText] = useState("");
	const [open, setOpen] = useState(false);
	const file = useRef<HTMLInputElement>(null);

	const fromImage = async (src: string | Blob) => {
		setBusy("image"); setError("");
		try {
			const c = await paletteFromImage(src);
			if (!c.length) throw new Error("No clear colours in that picture.");
			setColours(c);
		} catch (e) { setError(e instanceof Error ? e.message : "Could not read the picture."); } finally { setBusy(""); }
	};
	const fromText = async () => {
		setBusy("text"); setError("");
		try { setColours(await unwrap(paletteFromText(text))); } catch (e) { setError(e instanceof Error ? e.message : "Could not make a palette."); } finally { setBusy(""); }
	};

	return (
		<div className={cn("space-y-2", className)}>
			<div className="flex flex-wrap gap-2">
				<button type="button" onClick={() => file.current?.click()} className="flex h-8 items-center gap-1.5 rounded-lg border border-serene-neutral-200 bg-white px-2.5 text-xs font-medium hover:bg-serene-neutral-50">
					{busy === "image" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} From a picture
				</button>
				{imageUrl && <button type="button" onClick={() => void fromImage(imageUrl)} className="h-8 rounded-lg border border-serene-neutral-200 bg-white px-2.5 text-xs font-medium hover:bg-serene-neutral-50">From the logo</button>}
				<button type="button" onClick={() => setOpen((v) => !v)} className="flex h-8 items-center gap-1.5 rounded-lg border border-serene-neutral-200 bg-white px-2.5 text-xs font-medium hover:bg-serene-neutral-50"><Sparkles className="h-3.5 w-3.5" /> From a description</button>
				<input ref={file} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void fromImage(f); }} />
			</div>
			{open && (
				<div className="space-y-1.5">
					<textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Describe the look, or paste the colour section of your brand guidelines" className="w-full rounded-lg border border-serene-neutral-200 bg-white p-2 text-sm outline-none focus:border-sauti-teal" />
					<button type="button" disabled={busy === "text" || text.trim().length < 3} onClick={() => void fromText()} className="flex h-8 items-center gap-1.5 rounded-lg bg-sauti-teal px-3 text-xs font-semibold text-white disabled:opacity-40">{busy === "text" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Suggest colours</button>
				</div>
			)}
			{error && <p role="alert" className="text-xs text-red-600">{error}</p>}
			{colours.length > 0 && (
				<div>
					<div className="flex flex-wrap items-center gap-2">
						{colours.map((c) => <button key={c} type="button" onClick={() => onPick(c)} title={`${c}. Click to use.`} aria-label={`Use ${c}`} className="h-8 w-8 rounded-full border border-black/10 shadow-sm hover:scale-110" style={{ background: c }} />)}
						{onPickAll && <button type="button" onClick={() => onPickAll(colours)} className="ml-1 text-xs font-medium text-sauti-teal hover:underline">Use all</button>}
					</div>
				</div>
			)}
		</div>
	);
}
