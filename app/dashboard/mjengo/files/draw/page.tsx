"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, FileText, Loader2, Save, Sparkles, Upload } from "lucide-react";
import "@excalidraw/excalidraw/index.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { designFlow, flowToSheet, readForFlow, saveFlow } from "@/app/actions/mjengo-flows";
import { graphToRows, sceneToGraph, sheetToGraph, toSkeletons, type FlowGraph } from "@/lib/mjengo/flow-graph";
import { MjengoLoader } from "../../_components/MjengoLoader";
import { TagEditor } from "../../_components/Facets";
import { VaultPicker } from "../../_components/VaultPicker";
import { getFileUrl } from "../../vault/api";

// The drawing board loads only in the browser.
const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, { ssr: false, loading: () => <MjengoLoader label="Opening the drawing board" className="h-full min-h-0" /> });

type Scene = { elements?: unknown[]; appState?: Record<string, unknown>; files?: Record<string, unknown> };
type Api = { getSceneElements: () => readonly unknown[]; updateScene: (s: Record<string, unknown>) => void; scrollToContent: (t?: unknown, o?: Record<string, unknown>) => void };

const DEFAULT_NAME = "Untitled flow";
const EXAMPLES = [
	"A survivor contacts our hotline, we assess risk, refer to legal aid or a shelter, and follow up in a week",
	"How a grant application moves from idea to approval to submission",
	"Onboarding a new volunteer, from application to first shift",
];

/** A cheap fingerprint of what is on the board, so moving around or selecting things does not count as a change. */
const signature = (els: readonly unknown[], files: Record<string, unknown>) =>
	`${(els as { version?: number; isDeleted?: boolean }[]).reduce((n, e) => n + (e.version ?? 0) + (e.isDeleted ? 1 : 0), 0)}:${els.length}:${Object.keys(files).length}`;

/**
 * Draw flows and diagrams with Excalidraw. Describe a process and the AI draws it; bring one in from a sheet or a document;
 * the board saves itself, names itself from what it says and is labelled like any other file. A flow can go into a new
 * document as a picture with its steps, or into a spreadsheet as a table of steps. It can belong to a grant, opportunity,
 * project or fellowship (open it with "Draw a flow" there), so it sits with that record's other documents.
 */
function Draw() {
	const { toast } = useToast();
	const params = useSearchParams();
	const entity = params.get("entity");
	const [fileId, setFileId] = useState<string | null>(params.get("file"));
	const [name, setName] = useState(DEFAULT_NAME);
	const [initial, setInitial] = useState<Scene | null>(null);
	const [loading, setLoading] = useState(!!params.get("file"));
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [tags, setTags] = useState<string[] | null>(null);
	const [linked, setLinked] = useState<string | null>(null);
	const [api, setApi] = useState<Api | null>(null);
	const [aiOpen, setAiOpen] = useState(false);
	const [prompt, setPrompt] = useState("");
	const [designing, setDesigning] = useState(false);
	const [pick, setPick] = useState(false);
	const [busy, setBusy] = useState<"doc" | "sheet" | "import" | null>(null);
	const scene = useRef<{ elements: readonly unknown[]; appState: Record<string, unknown>; files: Record<string, unknown> }>({ elements: [], appState: {}, files: {} });
	const sig = useRef<string | null>(null);
	const userNamed = useRef(false);
	const savedSig = useRef<string | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);

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
				userNamed.current = true;
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

	const hasContent = () => (scene.current.elements as { isDeleted?: boolean }[]).some((e) => !e.isDeleted);

	const save = useCallback(async (quiet = false) => {
		if (saving || !hasContent()) return;
		setSaving(true);
		try {
			const { serializeAsJSON } = await import("@excalidraw/excalidraw");
			const json = serializeAsJSON(scene.current.elements as never, scene.current.appState as never, scene.current.files as never, "local");
			const at = signature(scene.current.elements, scene.current.files);
			const out = await unwrap(saveFlow({ fileId, name: userNamed.current || fileId ? name : DEFAULT_NAME, json, entity }));
			setFileId(out.id);
			setTags(out.tags);
			setLinked(out.linkedTo);
			if (out.named && !userNamed.current) setName(out.name.replace(/\.excalidraw$/i, ""));
			savedSig.current = at;
			setDirty(signature(scene.current.elements, scene.current.files) !== at);
			window.history.replaceState(null, "", `/dashboard/mjengo/files/draw?file=${out.id}`);
			if (!quiet) toast({ title: "Saved to your vault", description: `${out.name}${out.linkedTo ? `, and added to ${out.linkedTo.split(":").slice(1).join(":")}` : ""}.` });
		} catch (e) {
			if (!quiet) toast({ title: "Could not save the drawing", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setSaving(false);
		}
	}, [saving, fileId, name, entity, toast]);

	// The board saves itself a few seconds after the last change.
	useEffect(() => {
		if (!dirty || saving) return;
		const t = setTimeout(() => { void save(true); }, 3500);
		return () => clearTimeout(t);
	}, [dirty, saving, save, name]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); } };
		const onLeave = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
		window.addEventListener("keydown", onKey);
		window.addEventListener("beforeunload", onLeave);
		return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onLeave); };
	}, [save, dirty]);

	/** Draw a graph on the board, below whatever is already there. */
	const place = useCallback(async (g: FlowGraph) => {
		if (!api) throw new Error("The board is still starting.");
		const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
		const existing = api.getSceneElements() as { y: number; height: number; isDeleted?: boolean }[];
		const below = existing.filter((e) => !e.isDeleted).reduce((m, e) => Math.max(m, e.y + e.height), -140) + 140;
		const fresh = convertToExcalidrawElements(toSkeletons(g, { x: 0, y: below }) as never);
		api.updateScene({ elements: [...existing, ...fresh] });
		api.scrollToContent(fresh, { fitToViewport: true, animate: true });
		if (!userNamed.current && g.title && name === DEFAULT_NAME) setName(g.title.slice(0, 80));
	}, [api, name]);

	const design = async (source = "") => {
		setDesigning(true);
		try {
			const g = await unwrap(designFlow({ prompt, source }));
			await place(g);
			setAiOpen(false);
			setPrompt("");
		} catch (e) {
			toast({ title: "Could not draw that", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setDesigning(false);
		}
	};

	/** Bring in a sheet (steps as rows), a CSV or a text file: a table of steps is drawn as it is, anything else is read by the AI. */
	const importFile = async (f: File) => {
		setBusy("import");
		try {
			const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
			let graph: FlowGraph | null = null;
			let text = "";
			if (["xlsx", "xls", "csv"].includes(ext)) {
				const XLSX = await import("xlsx");
				const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
				for (const sn of wb.SheetNames) {
					const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, blankrows: false });
					graph = sheetToGraph(rows, f.name.replace(/\.[^.]+$/, ""));
					if (graph) break;
				}
				if (!graph) {
					const first = wb.Sheets[wb.SheetNames[0]];
					text = XLSX.utils.sheet_to_csv(first).slice(0, 9000);
				}
			} else if (["txt", "md", "markdown"].includes(ext)) {
				text = (await f.text()).slice(0, 9000);
			} else {
				throw new Error("Choose an Excel or CSV sheet, or a text file. For a Word document or PDF, use \"From a document\".");
			}
			if (!graph) graph = await unwrap(designFlow({ prompt: "", source: text }));
			await place(graph);
			toast({ title: "Flow imported", description: `${graph.nodes.length} steps drawn from ${f.name}.` });
		} catch (e) {
			toast({ title: "Could not import that", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(null);
			if (fileInput.current) fileInput.current.value = "";
		}
	};

	const fromDocument = async (id: string) => {
		setBusy("import");
		try {
			const doc = await unwrap(readForFlow(id));
			const g = await unwrap(designFlow({ prompt: "", source: doc.text }));
			await place(g);
			toast({ title: "Flow drawn", description: `From ${doc.name}.` });
		} catch (e) {
			toast({ title: "Could not draw from that file", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(null);
		}
	};

	/** The flow as a picture and a numbered list of steps in a new document. */
	const toDocument = async () => {
		if (!hasContent()) { toast({ title: "Draw something first" }); return; }
		setBusy("doc");
		try {
			await save(true);
			const { exportToBlob } = await import("@excalidraw/excalidraw");
			const blob = await exportToBlob({
				elements: scene.current.elements as never, appState: { ...scene.current.appState, exportBackground: true } as never, files: scene.current.files as never,
				mimeType: "image/png", exportPadding: 24, getDimensions: (w: number, h: number) => { const k = Math.min(1, 1500 / Math.max(w, h)); return { width: Math.round(w * k), height: Math.round(h * k), scale: 1 }; },
			} as never);
			const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("Could not read the picture.")); r.readAsDataURL(blob); });
			const rows = graphToRows(sceneToGraph(scene.current.elements));
			const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
			const html = `<h1>${esc(name)}</h1><p><img src="${url}" alt="${esc(name)}" /></p>${rows.length ? `<h2>Steps</h2><ol>${rows.map((r) => `<li>${esc(r.label)}${r.condition ? ` (${esc(r.condition)})` : ""}</li>`).join("")}</ol>` : ""}`;
			const key = Math.random().toString(36).slice(2, 10);
			try { sessionStorage.setItem(`ss_draft_${key}`, JSON.stringify({ title: name, html })); } catch { throw new Error("The picture is too large to hand over. Export it as an image instead (menu, Export image)."); }
			window.location.assign(`/dashboard/mjengo/documents/editor?draft=${key}`);
		} catch (e) {
			toast({ title: "Could not make a document", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			setBusy(null);
		}
	};

	/** The steps as a table in a new spreadsheet. */
	const toSheet = async () => {
		const g = sceneToGraph(scene.current.elements);
		if (!g.nodes.length) { toast({ title: "No steps yet", description: "Draw boxes with words in them and join them with arrows." }); return; }
		setBusy("sheet");
		try {
			const out = await unwrap(flowToSheet({ name, rows: graphToRows(g) }));
			window.location.assign(`/dashboard/mjengo/files/sheet?file=${out.id}`);
		} catch (e) {
			toast({ title: "Could not make the spreadsheet", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			setBusy(null);
		}
	};

	if (loading) return <MjengoLoader label="Opening the drawing" className="h-full min-h-0" />;
	return (
		<div className="flex h-full min-h-0 flex-col bg-white">
			<div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-black/10 px-3 py-2">
				<button onClick={() => window.history.back()} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"><ArrowLeft className="h-4 w-4" /></button>
				<Input value={name} onChange={(e) => { userNamed.current = true; setName(e.target.value); setDirty(true); }} aria-label="Name of the drawing" className="h-9 max-w-xs font-semibold" />
				<span className="text-xs text-serene-neutral-500">{saving ? "Saving…" : dirty ? "Saving soon…" : fileId ? "Saved" : "Draw something and it saves itself"}{entity && !linked && !fileId ? " · will be added to the record you came from" : ""}</span>
				<span className="flex-1" />
				{fileId && tags && <div className="hidden min-w-0 max-w-sm lg:block"><TagEditor type="file" id={fileId} tags={tags} onChange={setTags} /></div>}
				<Button variant="outline" onClick={() => setAiOpen(true)} className="gap-1.5 rounded-full"><Sparkles className="h-4 w-4 text-sauti-teal" /> Design with AI</Button>
				<Button variant="outline" disabled={busy !== null} onClick={() => fileInput.current?.click()} className="gap-1.5 rounded-full">{busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import</Button>
				<Button variant="outline" disabled={busy !== null} onClick={() => setPick(true)} className="gap-1.5 rounded-full"><FileText className="h-4 w-4" /> From a document</Button>
				<Button variant="outline" disabled={busy !== null} onClick={() => void toDocument()} className="gap-1.5 rounded-full">{busy === "doc" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} To a document</Button>
				<Button variant="outline" disabled={busy !== null} onClick={() => void toSheet()} className="gap-1.5 rounded-full">{busy === "sheet" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} To Excel</Button>
				<Button onClick={() => void save()} disabled={saving} className="gap-1.5 rounded-full bg-sauti-teal hover:bg-sauti-dark">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
				<input ref={fileInput} type="file" accept=".xlsx,.xls,.csv,.txt,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} />
			</div>
			<div className="relative min-h-0 flex-1">
				<Excalidraw
					excalidrawAPI={(a) => setApi(a as unknown as Api)}
					initialData={initial ? ({ elements: initial.elements, appState: initial.appState, files: initial.files, scrollToContent: true } as never) : undefined}
					onChange={(elements, appState, files) => {
						scene.current = { elements, appState: appState as unknown as Record<string, unknown>, files: files as unknown as Record<string, unknown> };
						const s = signature(elements, files as unknown as Record<string, unknown>);
						if (sig.current === null) { sig.current = s; savedSig.current = s; return; }
						if (s !== sig.current) { sig.current = s; if (s !== savedSig.current) setDirty(true); }
					}}
				/>
			</div>

			<Dialog open={aiOpen} onOpenChange={(o) => !designing && setAiOpen(o)}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-sauti-teal" /> Design a flow with AI</DialogTitle>
						<DialogDescription>Describe the process in your own words, in order. It is drawn on the board, below anything already there, and you can move and change every box.</DialogDescription>
					</DialogHeader>
					<Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} placeholder="For example: a survivor contacts the hotline, we check for immediate danger, then refer to legal aid or a shelter, and follow up after a week." autoFocus />
					<div className="flex flex-wrap gap-1.5">
						{EXAMPLES.map((x) => <button key={x} type="button" onClick={() => setPrompt(x)} className="rounded-full border border-serene-neutral-200 px-2.5 py-1 text-left text-xs text-serene-neutral-700 hover:bg-serene-neutral-50">{x.length > 58 ? `${x.slice(0, 56)}...` : x}</button>)}
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setAiOpen(false)} disabled={designing}>Cancel</Button>
						<Button onClick={() => void design()} disabled={designing || prompt.trim().length < 8} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark">{designing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Draw it</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<VaultPicker open={pick} onClose={() => setPick(false)} max={1} title="Draw a flow from a document" onPick={(items) => { const f = items.find((i) => i.kind === "file"); if (f) void fromDocument(f.id); }} />
		</div>
	);
}

export default function DrawPage() {
	return <Suspense fallback={<MjengoLoader label="Opening the drawing board" className="h-full min-h-0" />}><Draw /></Suspense>;
}
