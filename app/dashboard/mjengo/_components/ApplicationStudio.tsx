"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Check, ExternalLink, FileText, Link2, Loader2, Paperclip, PenLine, Plus, Sparkles, StickyNote, Trash2, Upload, Wand2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { putToSignedUrl } from "@/lib/client/upload";
import {
	addContext, contextFileSource, getWorkbench, removeContext, runAgent, saveInstructions, suggestContext, updateContext,
	type AgentResult, type ContextItem, type Suggestion, type Workbench,
} from "@/app/actions/mjengo-workbench";
import { searchDrive, type DriveSearch } from "@/app/actions/mjengo-attach";
import { prepareUpload, registerUpload } from "../vault/api";
import { fmtBytes } from "./shared";
import { Markdown } from "./Markdown";
import { VaultPicker } from "./VaultPicker";
import { FilePreviewDialog, PreviewBody, type PreviewSource } from "./FilePreviewDialog";

type Task = "cover_letter" | "cv" | "custom";
type TemplateChoice = undefined | null | { id: string; name: string };

const ICON: Record<ContextItem["kind"], typeof FileText> = { link: Link2, skill: Wrench, note: StickyNote, file: FileText, drive: FileText };
const KIND_LABEL: Record<ContextItem["kind"], string> = { link: "Link", skill: "Skills", note: "Note", file: "File", drive: "Google Drive" };

const snippet = (i: ContextItem) => (i.kind === "file" || i.kind === "drive" ? [i.mime?.split("/").pop()?.toUpperCase(), i.size ? fmtBytes(i.size) : null].filter(Boolean).join(" · ") || "Read in full when the agent works" : i.body.replace(/\s+/g, " ").slice(0, 150) || (i.kind === "link" ? "The page could not be read, so only the address is kept." : ""));

/**
 * The application workspace for an opportunity. Like a project: what the agent should know (instructions, links,
 * skills, notes and files from Files or Google Drive) sits in view, the agent writes from all of it plus the
 * opportunity itself, and what it writes is saved to Files and shown here in full.
 */
export function ApplicationStudio({ kind, id, title, onChange }: { kind: "grant" | "opportunity"; id: string; title: string; onChange?: () => void }) {
	const { toast } = useToast();
	const [wb, setWb] = useState<Workbench | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [suggest, setSuggest] = useState<Suggestion[] | null>(null);
	const [hidden, setHidden] = useState<Set<string>>(new Set());
	const [instr, setInstr] = useState("");
	const instrSaved = useRef("");
	const [adding, setAdding] = useState(false);
	const [detail, setDetail] = useState<ContextItem | null>(null);

	const dismissKey = `ss_ctx_no_${id}`;
	useEffect(() => { try { setHidden(new Set(JSON.parse(localStorage.getItem(dismissKey) ?? "[]") as string[])); } catch { /* none */ } }, [dismissKey]);

	const reload = useCallback(async () => {
		const w = await unwrap(getWorkbench(kind, id));
		setWb(w);
		return w;
	}, [kind, id]);
	useEffect(() => {
		let live = true;
		unwrap(getWorkbench(kind, id)).then((w) => { if (!live) return; setWb(w); setInstr(w.instructions); instrSaved.current = w.instructions; })
			.catch((e) => live && setError(e instanceof Error ? e.message : "The workspace could not be opened."));
		return () => { live = false; };
	}, [kind, id]);
	const loadSuggestions = useCallback(() => unwrap(suggestContext(kind, id)).then(setSuggest).catch(() => setSuggest([])), [kind, id]);
	useEffect(() => { if (wb) void loadSuggestions(); }, [wb === null, loadSuggestions]); // eslint-disable-line react-hooks/exhaustive-deps

	// What the team told the agent is saved as they type.
	useEffect(() => {
		if (!wb || instr === instrSaved.current) return;
		const t = setTimeout(() => { instrSaved.current = instr; unwrap(saveInstructions(kind, id, instr)).catch(() => { instrSaved.current = ""; }); }, 900);
		return () => clearTimeout(t);
	}, [instr, wb, kind, id]);

	const fail = (title: string, e: unknown) => toast({ title, description: e instanceof Error ? e.message : undefined, variant: "destructive" });
	const toggle = (i: ContextItem) => {
		setWb((w) => (w ? { ...w, items: w.items.map((x) => (x.id === i.id ? { ...x, include: !x.include } : x)) } : w));
		unwrap(updateContext(kind, id, i.id, { include: !i.include })).catch((e) => { void reload(); fail("Could not change that", e); });
	};
	const remove = async (i: ContextItem) => {
		setWb((w) => (w ? { ...w, items: w.items.filter((x) => x.id !== i.id) } : w));
		try { await unwrap(removeContext(kind, id, i.id)); void loadSuggestions(); } catch (e) { void reload(); fail("Could not remove it", e); }
	};
	const useSuggestion = async (s: Suggestion) => {
		setSuggest((x) => (x ?? []).filter((y) => y.fileId !== s.fileId));
		try { await unwrap(addContext(kind, id, { type: "file", fileId: s.fileId })); await reload(); } catch (e) { void loadSuggestions(); fail("Could not add it", e); }
	};
	const skipSuggestion = (s: Suggestion) => {
		const next = new Set(hidden).add(s.fileId);
		setHidden(next);
		try { localStorage.setItem(dismissKey, JSON.stringify([...next])); } catch { /* ignore */ }
	};

	if (error) return <div className="rounded-2xl border border-serene-neutral-200 p-4 text-sm text-red-700">{error}</div>;
	if (!wb) return <div className="flex items-center gap-2 rounded-2xl border border-serene-neutral-200 p-4 text-sm text-serene-neutral-600" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Opening the application workspace</div>;

	const included = wb.items.filter((i) => i.include).length + (instr.trim() ? 1 : 0);
	const inContext = new Set(wb.items.map((i) => i.vaultFileId).filter(Boolean));
	const shown = (suggest ?? []).filter((s) => !hidden.has(s.fileId) && !inContext.has(s.fileId));

	return (
		<div className="space-y-5">
			<AgentPanel kind={kind} id={id} title={title} wb={wb} includedCount={included} onDone={onChange} />

			<section aria-label="Context" className="space-y-3">
				<div className="flex items-center justify-between gap-2">
					<div>
						<h2 className="text-sm font-bold text-sauti-dark">Context <span className="font-normal text-serene-neutral-500">({wb.items.length})</span></h2>
						<p className="text-xs text-serene-neutral-600">Everything here, and everything on this opportunity, is read each time the agent writes.</p>
					</div>
					<Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add context</Button>
				</div>

				<div className="rounded-2xl border border-serene-neutral-200 bg-white p-3">
					<label htmlFor="agent-instructions" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500"><PenLine className="h-3.5 w-3.5" /> Instructions</label>
					<Textarea id="agent-instructions" rows={3} value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="How should the agent work on this? For example: write in the first person, keep documents to one page, stress my data protection work, mention that I am based in Nairobi." className="mt-1.5 resize-y border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0" />
				</div>

				{wb.items.length > 0 && (
					<ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
						{wb.items.map((i) => {
							const Icon = ICON[i.kind];
							return (
								<li key={i.id} className={cn("group relative flex flex-col rounded-2xl border bg-white p-3 transition", i.include ? "border-serene-neutral-200" : "border-dashed border-serene-neutral-200 opacity-70")}>
									<button type="button" onClick={() => setDetail(i)} className="flex min-h-[5.5rem] flex-1 flex-col text-left" aria-label={`Open ${i.title}`}>
										<span className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0 text-sauti-teal" aria-hidden /><span className="truncate text-sm font-semibold text-serene-neutral-900">{i.title}</span></span>
										<span className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-serene-neutral-600">{snippet(i)}</span>
									</button>
									<div className="mt-2 flex items-center gap-1 border-t border-serene-neutral-200 pt-2">
										<span className="mr-auto rounded-full bg-serene-neutral-100 px-2 py-0.5 text-[11px] font-medium text-serene-neutral-600">{KIND_LABEL[i.kind]}</span>
										<button type="button" role="switch" aria-checked={i.include} onClick={() => toggle(i)} aria-label={`${i.include ? "Stop using" : "Use"} ${i.title}`} title={i.include ? "The agent reads this" : "The agent skips this"} className={cn("flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium", i.include ? "bg-sauti-teal text-white" : "bg-serene-neutral-100 text-serene-neutral-600")}>{i.include ? <><Check className="h-3 w-3" /> In use</> : "Off"}</button>
										<Button size="icon" variant="ghost" className="h-7 w-7 text-serene-neutral-400 hover:text-red-600" onClick={() => remove(i)} aria-label={`Remove ${i.title}`}><Trash2 className="h-3.5 w-3.5" /></Button>
									</div>
								</li>
							);
						})}
					</ul>
				)}

				{shown.length > 0 && (
					<div className="rounded-2xl border border-dashed border-serene-neutral-200 p-3" role="group" aria-label="Suggested from your files">
						<p className="text-sm font-medium text-serene-neutral-900">Found in your files</p>
						<p className="mb-2 text-xs text-serene-neutral-600">These look useful for this application. Add the ones you want the agent to read.</p>
						<ul className="divide-y divide-serene-neutral-200">
							{shown.map((s) => (
								<li key={s.fileId} className="flex items-center gap-3 py-2">
									<FileText className="h-4 w-4 shrink-0 text-serene-neutral-400" aria-hidden />
									<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-serene-neutral-900">{s.name}</span><span className="block truncate text-xs text-serene-neutral-500">{[s.why, s.folder, fmtBytes(s.size)].filter(Boolean).join(" · ")}</span></span>
									<Button size="sm" variant="outline" className="h-8" onClick={() => useSuggestion(s)}>Add as context</Button>
									<Button size="icon" variant="ghost" className="h-8 w-8 text-serene-neutral-400" onClick={() => skipSuggestion(s)} aria-label={`Not ${s.name}`} title="Not this one"><X className="h-4 w-4" /></Button>
								</li>
							))}
						</ul>
					</div>
				)}
			</section>

			<AddContextDialog open={adding} onClose={() => setAdding(false)} kind={kind} id={id} existing={new Set(wb.items.map((i) => i.vaultFileId).filter(Boolean) as string[])} onAdded={async () => { await reload(); void loadSuggestions(); }} />
			<ContextDetail item={detail} onClose={() => setDetail(null)} onSave={async (item, body, itemTitle) => { await unwrap(updateContext(kind, id, item.id, { body, title: itemTitle })); await reload(); }} />
		</div>
	);
}

/* ------------------------------------------------------------------ the agent */

function AgentPanel({ kind, id, title, wb, includedCount, onDone }: { kind: "grant" | "opportunity"; id: string; title: string; wb: Workbench; includedCount: number; onDone?: () => void }) {
	const { toast } = useToast();
	const [task, setTask] = useState<Task | null>(null);
	const [label, setLabel] = useState("");
	const [template, setTemplate] = useState<TemplateChoice>(undefined);
	const [picking, setPicking] = useState(false);
	const [prompt, setPrompt] = useState("");
	const [model, setModel] = useState(wb.ai.defaultModel);
	const [busy, setBusy] = useState(false);
	const [step, setStep] = useState(0);
	const [result, setResult] = useState<AgentResult | null>(null);
	const [change, setChange] = useState("");
	const [viewing, setViewing] = useState(false);

	useEffect(() => {
		if (!busy) return;
		setStep(0);
		const t = setInterval(() => setStep((s) => Math.min(s + 1, 3)), 4500);
		return () => clearInterval(t);
	}, [busy]);

	const name = task === "cover_letter" ? "cover letter" : task === "cv" ? "CV" : label.trim().toLowerCase() || "document";
	const ready = !!task && template !== undefined && (task !== "custom" || label.trim().length > 1);

	const choose = (t: Task) => { setTask(t); setTemplate(undefined); setResult(null); };
	const go = async (refine?: { docId: string; instruction: string }) => {
		if (!task || busy) return;
		setBusy(true);
		try {
			const r = await unwrap(runAgent(kind, id, { task, label, prompt, templateFileId: template ? template.id : null, model, refine }));
			setResult(r);
			setChange("");
			onDone?.();
		} catch (e) {
			toast({ title: "The agent could not finish", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally { setBusy(false); }
	};
	const source = useCallback(async (): Promise<PreviewSource> => {
		if (!result) throw new Error("Nothing to show yet.");
		return unwrap(contextFileSource(result.fileId));
	}, [result]);

	const STEPS = ["Reading the opportunity and its page", `Reading ${includedCount} piece${includedCount === 1 ? "" : "s"} of context and the files on it`, template ? `Following the template "${template.name}"` : "Matching your evidence to what they ask for", `Writing your ${name}`];

	return (
		<section aria-label="Application agent" className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
			<div className="flex items-center gap-2 border-b border-serene-neutral-200 px-4 py-3">
				<span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sauti-teal text-white"><Sparkles className="h-4 w-4" aria-hidden /></span>
				<div className="min-w-0 flex-1">
					<h2 className="text-sm font-bold text-sauti-dark">Application agent</h2>
					<p className="truncate text-xs text-serene-neutral-600">Writes from this opportunity, your context and your files. Nothing is invented; gaps are marked.</p>
				</div>
				{wb.ai.available && wb.ai.models.length > 1 && (
					<Select value={model} onValueChange={setModel}>
						<SelectTrigger aria-label="AI model" className="h-8 w-auto gap-2 rounded-full px-3 text-xs"><SelectValue /></SelectTrigger>
						<SelectContent>{wb.ai.models.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}</SelectContent>
					</Select>
				)}
			</div>

			{!wb.ai.available ? (
				<p className="p-4 text-sm text-serene-neutral-700" role="status">The AI agent is switched off because no OpenRouter key is set on this site. Your context is kept, and the agent works as soon as an administrator adds the key.</p>
			) : (
				<div className="space-y-3 p-4">
					<div>
						<p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500">What should it write for “{title || "this opportunity"}”?</p>
						<div className="flex flex-wrap gap-2" role="group" aria-label="Document to write">
							{([["cover_letter", "Cover letter"], ["cv", "CV"], ["custom", "Another document"]] as const).map(([t, l]) => (
								<button key={t} type="button" aria-pressed={task === t} onClick={() => choose(t)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition", task === t ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-200 bg-white text-serene-neutral-800 hover:border-sauti-teal/50 hover:bg-serene-neutral-50")}>
									{t === "custom" ? <Plus className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />} {l}
								</button>
							))}
						</div>
					</div>

					{task === "custom" && <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Which document? For example: Motivation statement, Project budget, Writing sample" aria-label="Which document" autoFocus />}

					{task && (
						<div className="rounded-xl bg-serene-neutral-50 p-3" role="group" aria-label="Template">
							{template === undefined ? (
								<>
									<p className="text-sm font-medium text-serene-neutral-900">Do you want to use a template for your {name}?</p>
									<p className="mb-2 text-xs text-serene-neutral-600">The agent follows its layout and headings, and fills it with your real details.</p>
									<div className="flex flex-wrap gap-2">
										<Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setPicking(true)}><Paperclip className="h-3.5 w-3.5" /> Choose a template from Files</Button>
										<Button size="sm" variant="ghost" className="h-8" onClick={() => setTemplate(null)}>No template, write it fresh</Button>
									</div>
								</>
							) : template === null ? (
								<p className="flex items-center gap-2 text-sm text-serene-neutral-800"><Check className="h-4 w-4 text-emerald-600" aria-hidden /> No template. <button type="button" className="font-medium text-sauti-teal hover:underline" onClick={() => setPicking(true)}>Use one instead</button></p>
							) : (
								<p className="flex items-center gap-2 text-sm text-serene-neutral-800"><Paperclip className="h-4 w-4 text-sauti-teal" aria-hidden /> Template: <span className="truncate font-medium">{template.name}</span> <button type="button" className="font-medium text-sauti-teal hover:underline" onClick={() => setPicking(true)}>Change</button> <button type="button" className="text-serene-neutral-500 hover:underline" onClick={() => setTemplate(null)}>Remove</button></p>
							)}
						</div>
					)}

					<Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={busy} placeholder={task ? `Anything specific for the ${name}? For example: keep it to one page, open with my work on data protection, address the German requirement honestly.` : "Pick what to write first, then tell the agent anything specific."} aria-label="Prompt" />
					<div className="flex flex-wrap items-center gap-3">
						<Button disabled={!ready || busy} onClick={() => void go()} className="gap-2 bg-sauti-teal text-white hover:bg-sauti-dark">
							{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} {busy ? "Writing" : `Create ${name}`}
						</Button>
						<span className="text-xs text-serene-neutral-500">Reads {includedCount} piece{includedCount === 1 ? "" : "s"} of context plus the files on this opportunity.</span>
					</div>
					{busy && (
						<ol className="space-y-1 text-sm" aria-live="polite" aria-label="Progress">
							{STEPS.map((s, i) => <li key={s} className={cn("flex items-center gap-2", i < step ? "text-serene-neutral-500" : i === step ? "font-medium text-serene-neutral-900" : "text-serene-neutral-400")}>{i < step ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : i === step ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5" />}{s}</li>)}
						</ol>
					)}
				</div>
			)}

			{result && (
				<div className="border-t border-serene-neutral-200 bg-serene-neutral-50/60 p-4" role="region" aria-label="What the agent wrote">
					<div className="mb-2 flex flex-wrap items-center gap-2">
						<h3 className="mr-auto flex items-center gap-1.5 text-sm font-bold text-serene-neutral-900"><BookOpen className="h-4 w-4 text-sauti-teal" aria-hidden /> {result.name}</h3>
						<span className="text-xs text-serene-neutral-600">Saved to Files and to this opportunity</span>
						<Button size="sm" variant="outline" className="h-8" onClick={() => setViewing(true)}>Open full size</Button>
					</div>
					{result.gaps > 0 && <p className="mb-2 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900">{result.gaps} thing{result.gaps === 1 ? "" : "s"} to confirm. They are marked [to confirm: ...] in the text. Fill them in, or add the missing facts as context and ask again.</p>}
					<div className="max-h-[26rem] overflow-y-auto rounded-xl border border-serene-neutral-200 bg-white p-5 text-sm" style={{ color: "#111827" }}><Markdown text={result.text} /></div>
					<details className="mt-2 text-xs text-serene-neutral-600"><summary className="cursor-pointer font-medium">What it read ({result.usedContext.length})</summary><ul className="mt-1 list-disc pl-5">{result.usedContext.map((u) => <li key={u}>{u}</li>)}</ul></details>
					<div className="mt-3 flex gap-2">
						<Input value={change} onChange={(e) => setChange(e.target.value)} disabled={busy} onKeyDown={(e) => { if (e.key === "Enter" && change.trim()) void go({ docId: result.docId, instruction: change }); }} placeholder="Ask for a change, e.g. shorter, warmer, mention Fundación Avina" aria-label="Ask for a change" />
						<Button variant="outline" disabled={!change.trim() || busy} onClick={() => void go({ docId: result.docId, instruction: change })}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change it"}</Button>
					</div>
					<FilePreviewDialog open={viewing} onClose={() => setViewing(false)} load={source} label={result.name} />
				</div>
			)}

			<VaultPicker open={picking} onClose={() => setPicking(false)} max={1} title={`Choose a template for your ${name}`} onPick={(items) => { const f = items.find((x) => x.kind === "file"); if (f) setTemplate({ id: f.id, name: f.name }); setPicking(false); }} />
		</section>
	);
}

/* ------------------------------------------------------------------ add context */

function AddContextDialog({ open, onClose, kind, id, existing, onAdded }: { open: boolean; onClose: () => void; kind: "grant" | "opportunity"; id: string; existing: Set<string>; onAdded: () => Promise<void> | void }) {
	const { toast } = useToast();
	const [tab, setTab] = useState("link");
	const [url, setUrl] = useState("");
	const [skill, setSkill] = useState("");
	const [noteTitle, setNoteTitle] = useState("");
	const [note, setNote] = useState("");
	const [drive, setDrive] = useState<DriveSearch | null>(null);
	const [driveLink, setDriveLink] = useState("");
	const [picking, setPicking] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	const file = useRef<HTMLInputElement>(null);

	useEffect(() => { if (open) { setTab("link"); setUrl(""); setSkill(""); setNote(""); setNoteTitle(""); setDriveLink(""); } }, [open]);
	useEffect(() => {
		if (!open || tab !== "drive" || drive) return;
		unwrap(searchDrive("")).then(setDrive).catch(() => setDrive({ connected: false, available: true, files: [], error: "Could not search Google Drive." }));
	}, [open, tab, drive]);

	const run = async (key: string, fn: () => Promise<void>, ok: string) => {
		setBusy(key);
		try { await fn(); await onAdded(); toast({ title: "Added", description: ok }); onClose(); }
		catch (e) { toast({ title: "Could not add it", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
		finally { setBusy(null); }
	};
	const upload = (f: File) => run("upload", async () => {
		const up = await prepareUpload(null, f.name, f.size);
		await putToSignedUrl(up.signedUrl, f);
		const made = await registerUpload(null, up.path, f.name, f.size, f.type || "application/octet-stream");
		await unwrap(addContext(kind, id, { type: "file", fileId: made.id }));
	}, f.name);

	return (
		<>
			<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
				<DialogContent className="max-h-[88vh] w-[96vw] max-w-xl overflow-y-auto">
					<DialogHeader><DialogTitle>Add context</DialogTitle><DialogDescription>Anything the agent should know when it writes: where you have worked, what you can do, what the funder cares about.</DialogDescription></DialogHeader>
					<Tabs value={tab} onValueChange={setTab}>
						<TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
							<TabsTrigger value="link">Link</TabsTrigger><TabsTrigger value="skill">Skills</TabsTrigger><TabsTrigger value="note">Note</TabsTrigger>
							<TabsTrigger value="files">Files</TabsTrigger><TabsTrigger value="drive">Drive</TabsTrigger><TabsTrigger value="upload">Upload</TabsTrigger>
						</TabsList>
						<TabsContent value="link" className="mt-3 space-y-2">
							<Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-portfolio.org or the organisation's about page" aria-label="Web address" />
							<p className="text-xs text-serene-neutral-600">The page is read now and kept as text for the agent.</p>
							<DialogFooter><Button disabled={!/^https?:\/\//i.test(url.trim()) || busy === "link"} onClick={() => run("link", async () => { await unwrap(addContext(kind, id, { type: "link", url })); }, url)}>{busy === "link" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add link"}</Button></DialogFooter>
						</TabsContent>
						<TabsContent value="skill" className="mt-3 space-y-2">
							<Textarea rows={5} value={skill} onChange={(e) => setSkill(e.target.value)} placeholder={"One per line, with where you used it.\nWordPress and Sanity CMS, qwerise.org and two real estate sites\nGoogle Tag Manager, Microsoft Clarity, Meta Ads\nKenya Data Protection Act, data handler on WHRD Hub"} aria-label="Skills" />
							<DialogFooter><Button disabled={skill.trim().length < 2 || busy === "skill"} onClick={() => run("skill", async () => { await unwrap(addContext(kind, id, { type: "skill", body: skill })); }, "Skills")}>{busy === "skill" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add skills"}</Button></DialogFooter>
						</TabsContent>
						<TabsContent value="note" className="mt-3 space-y-2">
							<Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Title (optional)" aria-label="Note title" />
							<Textarea rows={6} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else: a project they should hear about, a gap to explain, what the interviewer asked last time." aria-label="Note" />
							<DialogFooter><Button disabled={note.trim().length < 2 || busy === "note"} onClick={() => run("note", async () => { await unwrap(addContext(kind, id, { type: "note", title: noteTitle, body: note })); }, "Note")}>{busy === "note" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add note"}</Button></DialogFooter>
						</TabsContent>
						<TabsContent value="files" className="mt-3 space-y-2">
							<p className="text-sm text-serene-neutral-700">Pick files from Files: your CV, past applications, a project report. Only a link is kept; the file stays where it is.</p>
							<Button variant="outline" className="gap-1.5" onClick={() => setPicking(true)}><FileText className="h-4 w-4" /> Choose from Files</Button>
						</TabsContent>
						<TabsContent value="drive" className="mt-3 space-y-2">
							{drive === null ? <p className="flex items-center gap-2 text-sm text-serene-neutral-600"><Loader2 className="h-4 w-4 animate-spin" /> Looking</p> : !drive.connected ? (
								<p className="text-sm text-serene-neutral-700">{drive.error ?? "Connect Google Drive to pick files from it."}{drive.available && <> <a className="font-medium text-sauti-teal hover:underline" href={`/api/mjengo/drive/google/start?kind=connect&return=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`}>Connect Google Drive</a></>}</p>
							) : (
								<ul className="max-h-48 divide-y divide-serene-neutral-200 overflow-y-auto">
									{drive.files.map((f) => <li key={f.id} className="flex items-center gap-2 py-1.5"><span className="min-w-0 flex-1 truncate text-sm">{f.name}</span><Button size="sm" variant="outline" disabled={busy === f.id} onClick={() => run(f.id, async () => { await unwrap(addContext(kind, id, { type: "drive", driveId: f.id, name: f.name })); }, f.name)}>Add</Button></li>)}
									{drive.files.length === 0 && <li className="py-2 text-sm text-serene-neutral-600">No files to show yet.</li>}
								</ul>
							)}
							<form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (driveLink.trim()) void run("dlink", async () => { await unwrap(addContext(kind, id, { type: "drive", link: driveLink })); }, "Google Drive file"); }}>
								<Input value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="Or paste a Google Drive link" aria-label="Google Drive link" />
								<Button type="submit" variant="outline" disabled={!driveLink.trim() || busy === "dlink"}>Add link</Button>
							</form>
						</TabsContent>
						<TabsContent value="upload" className="mt-3 space-y-2">
							<p className="text-sm text-serene-neutral-700">Upload a file from this device. It is saved in Files and used as context.</p>
							<Button variant="outline" className="gap-1.5" disabled={busy === "upload"} onClick={() => file.current?.click()}>{busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Choose a file</Button>
							<input ref={file} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>
			<VaultPicker open={picking} onClose={() => setPicking(false)} max={6} already={[...existing]} title="Choose files for the agent to read" onPick={(items) => { setPicking(false); const files = items.filter((x) => x.kind === "file"); if (files.length) void run("files", async () => { for (const f of files) await unwrap(addContext(kind, id, { type: "file", fileId: f.id })); }, `${files.length} file${files.length === 1 ? "" : "s"}`); }} />
		</>
	);
}

/* ------------------------------------------------------------------ one item, in full */

function ContextDetail({ item, onClose, onSave }: { item: ContextItem | null; onClose: () => void; onSave: (item: ContextItem, body: string, title: string) => Promise<void> }) {
	const [src, setSrc] = useState<PreviewSource | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const [body, setBody] = useState("");
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);
	const editable = item?.kind === "note" || item?.kind === "skill";

	useEffect(() => {
		setSrc(null); setErr(null);
		if (!item) return;
		setBody(item.body); setName(item.title);
		if (item.vaultFileId) unwrap(contextFileSource(item.vaultFileId)).then(setSrc).catch((e) => setErr(e instanceof Error ? e.message : "Could not open the file."));
		else if (item.kind === "drive" && item.driveFileId) setSrc({ name: item.title, mime: null, embed: `https://drive.google.com/file/d/${encodeURIComponent(item.driveFileId)}/preview`, link: item.url });
	}, [item]);

	return (
		<Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="flex max-h-[90vh] w-[96vw] max-w-4xl flex-col gap-3">
				<DialogHeader>
					<DialogTitle className="truncate pr-6">{item?.title}</DialogTitle>
					<DialogDescription>{item ? KIND_LABEL[item.kind] : ""}{item?.url ? <> · <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sauti-teal hover:underline">Open <ExternalLink className="h-3 w-3" /></a></> : null}</DialogDescription>
				</DialogHeader>
				{editable ? (
					<>
						<Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Title" />
						<Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Text" className="min-h-[14rem] flex-1" />
						<DialogFooter><Button disabled={saving || body.trim().length < 2} onClick={async () => { setSaving(true); try { await onSave(item!, body, name); onClose(); } finally { setSaving(false); } }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></DialogFooter>
					</>
				) : item?.kind === "link" ? (
					<div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-serene-neutral-200 bg-white p-4 text-sm text-serene-neutral-800">{item.body || "The page could not be read, so the agent only knows its address."}</div>
				) : (
					<div className="relative flex h-[65vh] items-center justify-center overflow-hidden rounded-xl border border-serene-neutral-200 bg-serene-neutral-100/70"><PreviewBody src={src} error={err} /></div>
				)}
			</DialogContent>
		</Dialog>
	);
}

