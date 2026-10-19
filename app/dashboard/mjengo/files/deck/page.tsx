"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, FileUp, Loader2, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { putToSignedUrl } from "@/lib/client/upload";
import { MjengoLoader } from "../../_components/MjengoLoader";
import { ShareDialog } from "../../_components/ShareDialog";
import { finishReplace, getFileUrl, prepareReplace, prepareUpload, registerUpload, renameItem } from "../../vault/api";
import { DeckEditor } from "@/components/deck/DeckEditor";
import { SlideView } from "@/components/deck/SlideView";
import { TEMPLATES, THEMES, buildDeck, parseDeck, templateDeck, type Deck, type LayoutSpec } from "@/lib/deck/model";
import { readPptxBasic } from "@/lib/mjengo/pptx-basic";

const MIME = "application/json";
const fileNameFor = (title: string) => `${title.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 80) || "Presentation"}.deck`;

/** A PowerPoint file's text and pictures as the first draft of a deck, one slide each. */
async function fromPptx(buf: ArrayBuffer, name: string): Promise<Deck> {
	const slides = await readPptxBasic(buf);
	const specs: LayoutSpec[] = slides.map((s, i) => {
		const pic = s.images.find((u) => u.length < 220_000);
		if (i === 0 && !s.lines.length) return { kind: "title", title: s.title || name, subtitle: "", notes: s.notes };
		if (i === 0) return { kind: "title", title: s.title || name, subtitle: s.lines.slice(0, 2).join(" "), notes: s.notes };
		if (pic) return { kind: "imageRight", title: s.title, bullets: s.lines.slice(0, 6), image: pic, notes: s.notes };
		return { kind: "bullets", title: s.title, bullets: s.lines.slice(0, 8), notes: s.notes };
	});
	return buildDeck(name.replace(/\.[^.]+$/, ""), THEMES[0], specs.length ? specs : [{ kind: "title", title: name }]);
}

function DeckScreen() {
	const { toast } = useToast();
	const params = useSearchParams();
	const initialFile = params.get("file");
	const from = params.get("from");
	const folderParam = params.get("folder");
	const embed = params.get("embed") === "1";
	const user = useUser();
	const me = useMemo(() => {
		if (!user) return null;
		const p = user.profile as { first_name?: string | null; last_name?: string | null; avatar_url?: string | null } | null | undefined;
		return { id: user.id, name: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || user.email || "Someone", avatar: p?.avatar_url ?? null };
	}, [user]);

	const [fileId, setFileId] = useState<string | null>(initialFile);
	const [fileName, setFileName] = useState("");
	const [level, setLevel] = useState<"view" | "share" | "edit">("edit");
	const [folderId, setFolderId] = useState<string | null>(folderParam);
	const [seed, setSeed] = useState<Deck | null>(null);
	const [start, setStart] = useState<"templates" | "ai" | null>(null);
	const [loading, setLoading] = useState(!!initialFile || !!from);
	const [creating, setCreating] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const [state, setState] = useState<"saved" | "saving" | "error">("saved");
	const latest = useRef<Deck | null>(null);
	const lastSaved = useRef<string>("");
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const nameRef = useRef("");
	const fileRef = useRef<string | null>(initialFile);
	fileRef.current = fileId;
	nameRef.current = fileName;

	/** Make the file in Files so that sharing and live editing work from the first moment. */
	const createFile = useCallback(async (d: Deck, target: string | null) => {
		const name = fileNameFor(d.title);
		const json = JSON.stringify(d);
		const blob = new File([json], name, { type: MIME });
		const { path, signedUrl } = await prepareUpload(target, name, blob.size);
		await putToSignedUrl(signedUrl, blob);
		const created = await registerUpload(target, path, name, blob.size, MIME);
		lastSaved.current = json;
		setFileId(created.id); setFileName(name); setLevel("edit");
		window.history.replaceState(null, "", `/dashboard/mjengo/files/deck?file=${created.id}${embed ? "&embed=1" : ""}`);
		return created.id;
	}, [embed]);

	// Opening: a saved deck, a PowerPoint to edit as slides, or the start screen.
	useEffect(() => {
		let dead = false;
		(async () => {
			try {
				if (initialFile) {
					const info = await getFileUrl(initialFile);
					const res = await fetch(info.url);
					if (!res.ok) throw new Error("Could not download the presentation.");
					const text = await res.text();
					const d = parseDeck(text);
					if (!d) throw new Error("This file is not a presentation made here.");
					if (dead) return;
					lastSaved.current = text;
					setSeed(d); setFileName(info.name); setLevel(info.level); setFolderId(info.folderId);
				} else if (from) {
					const info = await getFileUrl(from);
					const res = await fetch(info.url);
					if (!res.ok) throw new Error("Could not download the PowerPoint file.");
					const d = await fromPptx(await res.arrayBuffer(), info.name);
					if (dead) return;
					setFolderId(info.folderId);
					setSeed(d);
					await createFile(d, info.folderId);
					toast({ title: "Ready to edit", description: "Text and pictures were brought across. Check the layout." });
				}
			} catch (e) {
				toast({ title: "Could not open it", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			} finally {
				if (!dead) setLoading(false);
			}
		})();
		return () => { dead = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialFile, from]);

	const begin = async (d: Deck, panel: "templates" | "ai" | null = null) => {
		setCreating(true);
		try {
			setSeed(d); setStart(panel);
			await createFile(d, folderId);
		} catch (e) { toast({ title: "Could not start the presentation", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); setSeed(null); } finally { setCreating(false); }
	};

	const persist = useCallback(async () => {
		const d = latest.current, id = fileRef.current;
		if (!d || !id || level !== "edit") return;
		const json = JSON.stringify(d);
		if (json === lastSaved.current) { setState("saved"); return; }
		setState("saving");
		try {
			const blob = new File([json], nameRef.current || fileNameFor(d.title), { type: MIME });
			const { signedUrl } = await prepareReplace(id);
			await putToSignedUrl(signedUrl, blob);
			await finishReplace(id, blob.size);
			lastSaved.current = json;
			// The file takes the presentation's title.
			const want = fileNameFor(d.title);
			if (want !== nameRef.current) { await renameItem("file", id, want).catch(() => undefined); setFileName(want); }
			setState("saved");
		} catch { setState("error"); }
	}, [level]);

	const onDeck = useCallback((d: Deck) => {
		latest.current = d;
		if (!fileRef.current || level !== "edit") return;
		if (JSON.stringify(d) === lastSaved.current) return;
		setState("saving");
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => { void persist(); }, 2500);
	}, [persist, level]);
	useEffect(() => () => { if (timer.current) clearTimeout(timer.current); void persist(); }, [persist]);

	if (loading) return <MjengoLoader label="Opening the presentation" className="h-full min-h-0" />;

	// Start screen: nothing open yet.
	if (!seed) {
		return (
			<div className="mx-auto h-full max-w-6xl overflow-y-auto p-4 sm:p-8">
				{!embed && <Button asChild variant="ghost" size="sm" className="mb-2 gap-1.5"><Link href="/dashboard/mjengo/vault"><ArrowLeft className="h-4 w-4" /> Files</Link></Button>}
				<h1 className="text-2xl font-bold tracking-tight text-sauti-dark">New presentation</h1>
				<p className="mt-1 text-sm text-serene-neutral-600">Start from a template, let AI write it, or begin empty. Everyone you share it with edits the same slides, live.</p>
				<div className="mt-5 flex flex-wrap gap-3">
					<Button disabled={creating} onClick={() => begin(templateDeck(TEMPLATES[0]), "ai")} className="gap-2 bg-[#7c3aed] hover:bg-[#6d28d9]"><Sparkles className="h-4 w-4" /> Write it with AI</Button>
					<Button disabled={creating} variant="outline" onClick={() => begin(templateDeck(TEMPLATES[0]))}>Blank presentation</Button>
					<Button asChild variant="outline" className="gap-2"><Link href="/dashboard/mjengo/vault"><FileUp className="h-4 w-4" /> Bring a PowerPoint or Canva file</Link></Button>
				</div>
				<p className="mt-1.5 text-xs text-serene-neutral-500">Made one in Canva? Download it as PowerPoint, add it to Files, open it and choose “Edit as slides”.</p>
				<h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-serene-neutral-500">Templates</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{TEMPLATES.filter((t) => t.id !== "blank").map((t) => {
						const d = templateDeck(t);
						return (
							<button key={t.id} disabled={creating} onClick={() => begin(d)} className="group overflow-hidden rounded-2xl border border-serene-neutral-200 bg-white text-left shadow-sm transition hover:border-sauti-teal hover:shadow-md">
								<div className="flex gap-px bg-serene-neutral-100">
									<SlideView slide={d.slides[0]} theme={d.theme} width={200} />
									<div className="hidden flex-1 flex-col gap-px sm:flex">{d.slides.slice(1, 3).map((s) => <SlideView key={s.id} slide={s} theme={d.theme} width={100} />)}</div>
								</div>
								<div className="p-3"><p className="text-sm font-semibold text-serene-neutral-900">{t.name}</p><p className="text-xs text-serene-neutral-500">{t.blurb} {d.slides.length} slides.</p></div>
							</button>
						);
					})}
				</div>
				{creating && <p className="mt-4 flex items-center gap-2 text-sm text-serene-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Starting</p>}
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col bg-white">
			<ShareDialog item={shareOpen && fileId ? ({ type: "file", id: fileId, name: fileName } as never) : null} onClose={() => setShareOpen(false)} />
			<div className="flex shrink-0 items-center gap-2 border-b border-black/[0.07] px-3 py-1.5">
				{!embed && <Button asChild variant="ghost" size="icon" aria-label="Back to Files"><Link href="/dashboard/mjengo/vault"><ArrowLeft className="h-[18px] w-[18px]" /></Link></Button>}
				{level !== "edit" && <span className="hidden text-xs text-[#787774] sm:inline">View only</span>}
				<span className="flex-1" />
				<span className="flex items-center gap-1 text-xs text-serene-neutral-500" aria-live="polite">{state === "saving" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving</> : state === "error" ? <button onClick={() => void persist()} className="text-red-600 underline">Not saved. Try again</button> : <><Check className="h-3.5 w-3.5 text-emerald-600" /> Saved</>}</span>
				{fileId && level !== "view" && <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setShareOpen(true)}><Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span></Button>}
			</div>
			<div className="min-h-0 flex-1">
				<DeckEditor roomId={fileId} seed={seed} me={me} canEdit={level === "edit"} onDeck={onDeck} start={start} />
			</div>
		</div>
	);
}

export default function DeckPage() {
	return (
		<Suspense fallback={<MjengoLoader label="Opening the presentation" className="h-full min-h-0" />}>
			<DeckScreen />
		</Suspense>
	);
}
