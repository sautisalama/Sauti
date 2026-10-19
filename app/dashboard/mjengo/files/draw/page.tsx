"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import "@excalidraw/excalidraw/index.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { saveFlow } from "@/app/actions/mjengo-flows";
import { MjengoLoader } from "../../_components/MjengoLoader";
import { TagEditor } from "../../_components/Facets";
import { getFileUrl } from "../../vault/api";

// The drawing board loads only in the browser.
const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, { ssr: false, loading: () => <MjengoLoader label="Opening the drawing board" className="h-full min-h-0" /> });

type Scene = { elements?: unknown[]; appState?: Record<string, unknown>; files?: Record<string, unknown> };

/**
 * Draw flows and diagrams with Excalidraw. A drawing is saved in the vault as an .excalidraw file, tagged from what it
 * says, and can belong to a grant, opportunity, project or fellowship (open it with "Draw a flow" there), so it sits with
 * that record's other documents.
 */
function Draw() {
	const { toast } = useToast();
	const params = useSearchParams();
	const entity = params.get("entity");
	const [fileId, setFileId] = useState<string | null>(params.get("file"));
	const [name, setName] = useState("Untitled flow");
	const [initial, setInitial] = useState<Scene | null>(null);
	const [loading, setLoading] = useState(!!params.get("file"));
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [tags, setTags] = useState<string[] | null>(null);
	const [linked, setLinked] = useState<string | null>(null);
	const scene = useRef<{ elements: readonly unknown[]; appState: Record<string, unknown>; files: Record<string, unknown> }>({ elements: [], appState: {}, files: {} });
	const first = useRef(true);

	useEffect(() => {
		const id = params.get("file");
		if (!id) return;
		let on = true;
		(async () => {
			try {
				const info = await getFileUrl(id);
				const res = await fetch(info.url);
				if (!res.ok) throw new Error("Could not download the drawing.");
				const json = (await res.json()) as Scene;
				if (!on) return;
				setName(info.name.replace(/\.excalidraw$/i, ""));
				setInitial({ elements: json.elements ?? [], appState: { ...(json.appState ?? {}), collaborators: undefined }, files: json.files ?? {} });
			} catch (e) {
				toast({ title: "Could not open the drawing", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			} finally {
				if (on) setLoading(false);
			}
		})();
		return () => { on = false; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const save = useCallback(async () => {
		if (saving) return;
		setSaving(true);
		try {
			const { serializeAsJSON } = await import("@excalidraw/excalidraw");
			const json = serializeAsJSON(scene.current.elements as never, scene.current.appState as never, scene.current.files as never, "local");
			const out = await unwrap(saveFlow({ fileId, name, json, entity }));
			setFileId(out.id);
			setTags(out.tags);
			setLinked(out.linkedTo);
			setDirty(false);
			window.history.replaceState(null, "", `/dashboard/mjengo/files/draw?file=${out.id}`);
			toast({ title: "Saved to your vault", description: `${out.name}${out.linkedTo ? `, and added to ${out.linkedTo.split(":").slice(1).join(":")}` : ""}.` });
		} catch (e) {
			toast({ title: "Could not save the drawing", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setSaving(false);
		}
	}, [saving, fileId, name, entity, toast]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); } };
		const onLeave = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
		window.addEventListener("keydown", onKey);
		window.addEventListener("beforeunload", onLeave);
		return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onLeave); };
	}, [save, dirty]);

	if (loading) return <MjengoLoader label="Opening the drawing" className="h-full min-h-0" />;
	return (
		<div className="flex h-full min-h-0 flex-col bg-white">
			<div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-black/10 px-3 py-2">
				<button onClick={() => window.history.back()} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"><ArrowLeft className="h-4 w-4" /></button>
				<Input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} aria-label="Name of the drawing" className="h-9 max-w-xs font-semibold" />
				<span className="text-xs text-serene-neutral-500">{saving ? "Saving…" : dirty ? "Unsaved changes" : fileId ? "Saved" : "Not saved yet"}{entity && !linked && !fileId ? " · will be added to the record you came from" : ""}</span>
				<span className="flex-1" />
				{fileId && tags && <div className="hidden min-w-0 max-w-md md:block"><TagEditor type="file" id={fileId} tags={tags} onChange={setTags} /></div>}
				<Button onClick={() => void save()} disabled={saving} className="gap-1.5 rounded-full bg-sauti-teal hover:bg-sauti-dark">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save to the vault</Button>
			</div>
			<div className="relative min-h-0 flex-1">
				<Excalidraw
					initialData={initial ? ({ elements: initial.elements, appState: initial.appState, files: initial.files, scrollToContent: true } as never) : undefined}
					onChange={(elements, appState, files) => {
						scene.current = { elements, appState: appState as unknown as Record<string, unknown>, files: files as unknown as Record<string, unknown> };
						if (first.current) { first.current = false; return; }
						setDirty(true);
					}}
				/>
			</div>
		</div>
	);
}

export default function DrawPage() {
	return <Suspense fallback={<MjengoLoader label="Opening the drawing board" className="h-full min-h-0" />}><Draw /></Suspense>;
}
