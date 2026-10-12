"use client";

import { ColourInput } from "@/components/mjengo/ColourInput";
import { MjengoLoader } from "../../_components/MjengoLoader";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
	ArrowLeft, ArrowDown, ArrowUp, Check, ChevronDown, Copy, Download, Eye, FileBarChart2, FileSpreadsheet, FileText, GripVertical, ImagePlus, Loader2, Plus, QrCode, Search, Share2, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { QrShare } from "@/components/chat/QrShare";
import { DevicePreview, DeviceToggle, ModeToggle, ThemePanel, ViewEditor, WelcomeEditor } from "./_Design";
import { toPublicForm } from "@/lib/forms/public-view";
import type { Device } from "@/lib/forms/schema";
import { TYPE_LABEL, displayAnswer, hasOptions, newQuestion, type FormSettings, type Question, type QuestionType } from "@/lib/forms/schema";
import { perDay, summarise, toCsv } from "@/lib/forms/analytics";
import { markResponsesSeen, deleteForm, deleteResponse, designSystemsForForms, exportedCsv, formImageUpload, linkPoster, getForm, getResponses, saveForm, setFormStatus, formReport, type FormRow, type ResponseRow } from "@/app/actions/mjengo-forms";
import { putToSignedUrl } from "@/lib/client/upload";
import { unwrap } from "@/lib/action-result";
import { listAssets, type AssetRow } from "@/app/actions/mjengo-ai";
import { PostThis } from "../../_components/PostThis";
import { AvatarStack, useTeam } from "../../_components/People";
import { useUser } from "@/hooks/useUser";
import { useFormLive } from "./_live";
import { Markdown } from "../../_components/Markdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import { searchFiles, prepareUpload, registerUpload, prepareReplace, finishReplace } from "../../vault/api";

type Save = "saved" | "saving" | "error";

export default function FormEditorPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const { toast } = useToast();

	const [form, setForm] = useState<FormRow | null | undefined>(undefined);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [questions, setQuestions] = useState<Question[]>([]);
	const [settings, setSettings] = useState<FormSettings>({});
	const [save, setSave] = useState<Save>("saved");
	const [responses, setResponses] = useState<ResponseRow[] | null>(null);
	const [preview, setPreview] = useState(false);
	const [device, setDevice] = useState<Device>("desktop");
	const [activeId, setActiveId] = useState<string | null>(null);
	const [share, setShare] = useState(false);
	const [postTogether, setPostTogether] = useState(false);
	const loaded = useRef(false);
	const team = useTeam();
	const me = useUser();
	const meName = [(me?.profile as { first_name?: string | null } | null | undefined)?.first_name, (me?.profile as { last_name?: string | null } | null | undefined)?.last_name].filter(Boolean).join(" ") || me?.email || "Someone";
	const { peers } = useFormLive({
		formId: id,
		me: me?.id ? { id: me.id, name: meName } : null,
		ready: !!form,
		state: { title, description, questions, settings },
		apply: (p) => {
			if (p.title !== undefined) setTitle(p.title);
			if (p.description !== undefined) setDescription(p.description);
			if (p.questions) setQuestions(p.questions);
			if (p.settings) setSettings(p.settings);
		},
	});

	useEffect(() => {
		getForm(id).then((f) => {
			setForm(f);
			if (f) {
				setTitle(f.title);
				setDescription(f.description ?? "");
				setQuestions(f.questions);
				setSettings(f.settings ?? {});
			}
		}).catch(() => setForm(null));
	}, [id]);

	// Opening the form is looking at its responses: the counter in the navigation stops counting them.
	useEffect(() => { markResponsesSeen(id).catch(() => undefined); }, [id]);

	const loadResponses = useCallback(() => getResponses(id).then(setResponses).catch(() => setResponses([])), [id]);
	useEffect(() => {
		loadResponses();
	}, [loadResponses]);

	// Autosave: any edit is written about a second after the last keystroke.
	useEffect(() => {
		if (!loaded.current) {
			if (form) loaded.current = true;
			return;
		}
		setSave("saving");
		const t = setTimeout(async () => {
			try {
				await saveForm(id, { title, description, questions, settings });
				setSave("saved");
			} catch {
				setSave("error");
			}
		}, 900);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [title, description, questions, settings]);

	const publicUrl = useMemo(() => (form && typeof window !== "undefined" ? `${window.location.origin}/f/${form.slug}` : ""), [form]);

	const changeStatus = async (status: FormRow["status"]) => {
		try {
			await saveForm(id, { title, description, questions, settings }); // never publish a stale copy
			await setFormStatus(id, status);
			setForm((f) => (f ? { ...f, status } : f));
			toast({ title: status === "open" ? "Form is live" : status === "closed" ? "Form closed" : "Moved back to draft" });
			if (status === "open") setShare(true);
		} catch (e) {
			toast({ title: "Could not change the status", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	};

	if (form === undefined) return <MjengoLoader label="Loading the form" />;
	if (form === null) return <p className="py-20 text-center text-serene-neutral-500">That form no longer exists. <Link href="/dashboard/mjengo/forms" className="text-sauti-teal underline">Back to forms</Link></p>;

	const previewSource = { slug: form.slug, title, description: description || null, questions, settings };

	return (
		<div className="space-y-4">
			{/* One quiet row, like the mail toolbar: icon buttons, one clear primary action. */}
			<div className="flex items-center gap-1 border-b border-black/[0.07] pb-2">
				<Link href="/dashboard/mjengo/forms" aria-label="All forms" title="All forms" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#787774] hover:bg-black/5"><ArrowLeft className="h-[18px] w-[18px]" /></Link>
				<Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Form title" className="h-8 min-w-0 flex-1 border-transparent bg-transparent px-2 text-[15px] font-semibold shadow-none hover:border-black/10 focus-visible:border-sauti-teal focus-visible:ring-0" />
									<Popover>
						<PopoverTrigger asChild>
							<button aria-label="Who has access" className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-black/5">
								<AvatarStack ids={team.map((t) => t.id)} team={team} max={4} size="md" />
								{peers.length > 1 && <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />{peers.length} here</span>}
							</button>
						</PopoverTrigger>
						<PopoverContent align="end" className="w-72 p-3">
							<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">Who has access</p>
							<p className="mb-2 text-xs text-serene-neutral-500">Every Mjengo administrator can edit this form and read its responses.</p>
							<ul className="max-h-60 space-y-1 overflow-y-auto">
								{team.map((t) => {
									const here = peers.some((p) => p.id === t.id);
									return (
										<li key={t.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm">
											<AvatarStack ids={[t.id]} team={team} size="md" />
											<span className="min-w-0 flex-1 truncate">{t.name}</span>
											{t.id === form.created_by && <span className="rounded-full bg-sauti-teal-light px-2 py-0.5 text-[10px] font-semibold text-sauti-dark">Owner</span>}
											{here && <span className="flex items-center gap-1 text-[11px] text-emerald-700"><i className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> editing now</span>}
										</li>
									);
								})}
							</ul>
						</PopoverContent>
					</Popover>
					<span className="hidden shrink-0 px-1 text-xs text-[#9b9a97] sm:inline" aria-live="polite">{save === "saving" ? "Saving..." : save === "error" ? "Not saved" : "Saved"}</span>
				<button onClick={() => { void saveForm(id, { title, description, questions, settings }).catch(() => undefined).finally(() => window.open(`/dashboard/mjengo/forms/${id}/preview`, "_blank")); }} aria-label="Preview" title="Preview" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#787774] hover:bg-black/5"><Eye className="h-[18px] w-[18px]" /></button>
				<button onClick={() => setShare(true)} disabled={form.status === "draft"} aria-label="Share" title={form.status === "draft" ? "Publish first to share" : "Share"} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 disabled:opacity-40"><Share2 className="h-[18px] w-[18px]" /></button>
				<span className="mx-1 h-5 w-px shrink-0 bg-black/10" />
				{form.status === "open" ? (
					<button onClick={() => changeStatus("closed")} className="h-8 shrink-0 whitespace-nowrap rounded-lg border border-black/10 px-3 text-[13px] font-medium text-[#37352f] hover:bg-black/[0.03]">Stop responses</button>
				) : (
					<button onClick={() => changeStatus("open")} className="h-8 shrink-0 whitespace-nowrap rounded-lg bg-sauti-teal px-3.5 text-[13px] font-semibold text-white hover:bg-sauti-dark">{form.status === "closed" ? "Reopen" : "Publish"}</button>
				)}
			</div>

			<Tabs defaultValue="questions">
				<TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-black/[0.07] bg-transparent p-0">
					<TabsTrigger value="questions" className="h-9 rounded-none border-b-2 border-transparent px-3 text-sm data-[state=active]:border-sauti-teal data-[state=active]:bg-transparent data-[state=active]:text-sauti-dark data-[state=active]:shadow-none">Questions</TabsTrigger>
					<TabsTrigger value="design" className="h-9 rounded-none border-b-2 border-transparent px-3 text-sm data-[state=active]:border-sauti-teal data-[state=active]:bg-transparent data-[state=active]:text-sauti-dark data-[state=active]:shadow-none">Design</TabsTrigger>
					<TabsTrigger value="responses" className="h-9 rounded-none border-b-2 border-transparent px-3 text-sm data-[state=active]:border-sauti-teal data-[state=active]:bg-transparent data-[state=active]:text-sauti-dark data-[state=active]:shadow-none">Responses{responses ? ` (${responses.length})` : ""}</TabsTrigger>
					<TabsTrigger value="analytics" className="h-9 rounded-none border-b-2 border-transparent px-3 text-sm data-[state=active]:border-sauti-teal data-[state=active]:bg-transparent data-[state=active]:text-sauti-dark data-[state=active]:shadow-none">Analytics</TabsTrigger>
					<TabsTrigger value="settings" className="h-9 rounded-none border-b-2 border-transparent px-3 text-sm data-[state=active]:border-sauti-teal data-[state=active]:bg-transparent data-[state=active]:text-sauti-dark data-[state=active]:shadow-none">Settings</TabsTrigger>
				</TabsList>

				<TabsContent value="questions" className="mt-4">
					<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
						<div className="min-w-0 space-y-3">
							<ViewBar settings={settings} onSettings={setSettings} device={device} onDevice={setDevice} onPreview={() => setPreview(true)} />
							<QuestionsTab formId={id} description={description} onDescription={setDescription} questions={questions} onChange={setQuestions} settings={settings} onSettings={setSettings} device={device} onActive={setActiveId} />
						</div>
						<aside className="hidden xl:block">
							<div className="sticky top-4"><DevicePreview form={previewSource} device={device} focusId={activeId} /></div>
						</aside>
					</div>
				</TabsContent>
				<TabsContent value="design" className="mt-4">
					<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
						<div className="min-w-0 space-y-3">
							<ViewBar settings={settings} onSettings={setSettings} device={device} onDevice={setDevice} onPreview={() => setPreview(true)} />
							<ThemePanel formId={id} settings={settings} onChange={setSettings} />
						</div>
						<aside className="hidden xl:block">
							<div className="sticky top-4"><DevicePreview form={previewSource} device={device} focusId={activeId} /></div>
						</aside>
					</div>
				</TabsContent>
				<TabsContent value="responses" className="mt-4">
					<ResponsesTab formId={id} title={title} questions={questions} collectEmail={!!settings.collectEmail} responses={responses} onChanged={loadResponses} />
				</TabsContent>
				<TabsContent value="analytics" className="mt-4">
					<AnalyticsTab questions={questions} responses={responses} />
				</TabsContent>
				<TabsContent value="settings" className="mt-4">
					<SettingsTab formId={id} settings={settings} onChange={setSettings} onDelete={async () => { if (window.confirm("Delete this form and all of its responses? This cannot be undone.")) { await deleteForm(id); router.push("/dashboard/mjengo/forms"); } }} />
				</TabsContent>
			</Tabs>

			<Dialog open={preview} onOpenChange={setPreview}>
				<DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
					<DialogHeader><DialogTitle>Preview (nothing is submitted)</DialogTitle></DialogHeader>
					<div className="flex justify-center"><DeviceToggle device={device} onChange={setDevice} /></div>
					<DevicePreview form={previewSource} device={device} focusId={activeId} />
				</DialogContent>
			</Dialog>

			<PostThis open={postTogether} assetId={(settings as FormSettings & { poster?: string | null }).poster ?? null} about={title} extraLink={publicUrl} onClose={() => setPostTogether(false)} />
			<Dialog open={share} onOpenChange={setShare}>
				<DialogContent className="max-w-md">
					<DialogHeader><DialogTitle>Share this form</DialogTitle></DialogHeader>
					<div className="space-y-4">
						<div className="flex gap-2">
							<Input readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} />
							<Button variant="outline" className="gap-1.5" onClick={() => navigator.clipboard.writeText(publicUrl).then(() => toast({ title: "Link copied" }))}><Copy className="h-4 w-4" /> Copy</Button>
						</div>
						<div className="flex justify-center"><QrShare value={publicUrl} caption="Anyone can scan this to open the form." filename={`form-${form.slug}`} /></div>
						{form.status !== "open" && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">The form is {form.status}, so the link will not accept responses.</p>}
						{(settings as FormSettings & { poster?: string | null }).poster && (
							<div className="flex items-center gap-3 rounded-xl border border-serene-neutral-200 p-3">
								<img src={(settings.images ?? [])[0]} alt="" className="h-16 w-16 rounded-lg object-cover" />
								<p className="min-w-0 flex-1 text-sm text-serene-neutral-700">This form has a poster. Share the poster and the link together.</p>
								<Button size="sm" className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => { setShare(false); setPostTogether(true); }}>Post together</Button>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

/* ------------------------------------------------------------- Questions */

function ViewBar({ settings, onSettings, device, onDevice, onPreview }: { settings: FormSettings; onSettings: (s: FormSettings) => void; device: Device; onDevice: (d: Device) => void; onPreview: () => void }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-serene-neutral-200/70 bg-white p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
			<div className="flex flex-wrap items-center gap-2">
				<ModeToggle mode={settings.layout === "page" ? "page" : "single"} onChange={(m) => onSettings({ ...settings, layout: m })} />
				<DeviceToggle device={device} onChange={onDevice} />
			</div>
			<Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs xl:hidden" onClick={onPreview}><Eye className="h-3.5 w-3.5" /> Preview</Button>
		</div>
	);
}

function QuestionsTab({ formId, description, onDescription, questions, onChange, settings, onSettings, device, onActive }: { formId: string; description: string; onDescription: (v: string) => void; questions: Question[]; onChange: (q: Question[]) => void; settings: FormSettings; onSettings: (s: FormSettings) => void; device: Device; onActive: (id: string | null) => void }) {
	const { toast } = useToast();
	const [uploading, setUploading] = useState(false);
	const pick = useRef<HTMLInputElement>(null);
	const images = settings.images ?? [];
	const addImages = async (files: FileList | null) => {
		if (!files?.length) return;
		setUploading(true);
		try {
			const added: string[] = [];
			for (const f of Array.from(files).slice(0, 4 - images.length)) {
				if (!f.type.startsWith("image/") || f.size > 8 * 1024 * 1024) continue;
				const { signedUrl, publicUrl } = await formImageUpload(formId, f.name);
				await putToSignedUrl(signedUrl, f);
				added.push(publicUrl);
			}
			if (added.length) onSettings({ ...settings, images: [...images, ...added] });
		} catch (e) {
			toast({ title: "Could not add the picture", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setUploading(false);
			if (pick.current) pick.current.value = "";
		}
	};
	const [type, setType] = useState<QuestionType>("short");
	// Drag a question by its handle to a new place; the arrows do the same for keyboards and touch.
	const [dragFrom, setDragFrom] = useState<number | null>(null);
	const [dragOver, setDragOver] = useState<number | null>(null);
	const moveTo = (from: number, to: number) => {
		if (from === to || from < 0 || to < 0 || from >= questions.length || to >= questions.length) return;
		const next = [...questions];
		const [item] = next.splice(from, 1);
		next.splice(to, 0, item);
		onChange(next);
	};
	const update = (i: number, patch: Partial<Question>) => onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
	const move = (i: number, d: -1 | 1) => {
		const j = i + d;
		if (j < 0 || j >= questions.length) return;
		const next = [...questions];
		[next[i], next[j]] = [next[j], next[i]];
		onChange(next);
	};

	return (
		<div className="mx-auto max-w-3xl space-y-3">
			<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
				<div className="h-1.5" style={{ background: settings.style?.accent || "#068297" }} />
				<div className="space-y-3 p-4">
					<Label className="text-xs font-semibold text-serene-neutral-600">Description (optional)</Label>
					<Textarea value={description} onChange={(e) => onDescription(e.target.value)} rows={2} placeholder="Tell people what this form is for" />
					<div className="flex flex-wrap items-center gap-2">
						{images.map((u) => (
							<span key={u} className="group relative h-16 w-24 overflow-hidden rounded-lg border border-serene-neutral-200">
								<img src={u} alt="" className="h-full w-full object-cover" />
								<button type="button" aria-label="Remove picture" onClick={() => onSettings({ ...settings, images: images.filter((x) => x !== u) })} className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex"><X className="h-3 w-3" /></button>
							</span>
						))}
						{images.length < 4 && (
							<>
								<Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={uploading} onClick={() => pick.current?.click()}>{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Add pictures</Button>
								<input ref={pick} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
							</>
						)}
					</div>
					{images.length > 0 && <p className="text-xs text-serene-neutral-500">The first picture is also the preview on the form card.</p>}
				</div>
			</div>

			<WelcomeEditor formId={formId} welcome={settings.welcome} onChange={(w) => onSettings({ ...settings, welcome: w })} device={device} onFocus={() => onActive("welcome")} />

			{questions.map((q, i) => (
				<section
					key={q.id}
					onFocusCapture={() => onActive(q.id)}
					onClick={() => onActive(q.id)}
					onDragOver={(e) => { if (dragFrom === null) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== i) setDragOver(i); }}
					onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) moveTo(dragFrom, i); setDragFrom(null); setDragOver(null); }}
					className={cn("rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition", dragFrom === i && "opacity-50", dragOver === i && dragFrom !== null && dragFrom !== i ? "border-sauti-teal ring-2 ring-sauti-teal/30" : "border-serene-neutral-200/70")}
				>
					<div className="flex items-start gap-2">
						<span
							draggable
							role="button"
							tabIndex={0}
							aria-label={`Drag question ${i + 1} to move it. Arrow keys also move it.`}
							onDragStart={(e) => {
								const card = (e.currentTarget as HTMLElement).closest("section");
								if (card) e.dataTransfer.setDragImage(card, 24, 24);
								e.dataTransfer.effectAllowed = "move";
								e.dataTransfer.setData("text/plain", String(i));
								setDragFrom(i);
							}}
							onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
							onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); move(i, -1); } else if (e.key === "ArrowDown") { e.preventDefault(); move(i, 1); } }}
							className="mt-1.5 flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-serene-neutral-400 hover:bg-serene-neutral-100 active:cursor-grabbing"
						><GripVertical className="h-4 w-4" aria-hidden /></span>
						<div className="min-w-0 flex-1 space-y-3">
							<div className="flex flex-col gap-2 sm:flex-row">
								<Input value={q.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Question" className="flex-1 bg-serene-neutral-50 font-medium" aria-label={`Question ${i + 1}`} />
								<Select value={q.type} onValueChange={(t) => update(i, { type: t as QuestionType, ...(hasOptions(t as QuestionType) ? { options: q.options?.length ? q.options : ["Option 1", "Option 2"] } : {}), ...(t === "scale" && !q.scale ? { scale: { min: 1, max: 5 } } : {}) })}>
									<SelectTrigger className="sm:w-[170px]"><SelectValue /></SelectTrigger>
									<SelectContent>{(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
								</Select>
							</div>
							<Input value={q.help ?? ""} onChange={(e) => update(i, { help: e.target.value })} placeholder="Help text (optional)" className="h-9 text-sm" />

							{hasOptions(q.type) && (
								<div className="space-y-1.5">
									{(q.options ?? []).map((o, k) => (
										<div key={k} className="flex items-center gap-2">
											<span className={cn("h-4 w-4 shrink-0 border-2 border-serene-neutral-300", q.type === "checkbox" ? "rounded" : "rounded-full")} />
											<Input value={o} onChange={(e) => update(i, { options: (q.options ?? []).map((x, m) => (m === k ? e.target.value : x)) })} className="h-9" aria-label={`Option ${k + 1}`} />
											<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => update(i, { options: (q.options ?? []).filter((_, m) => m !== k) })} aria-label="Remove option"><X className="h-4 w-4" /></Button>
										</div>
									))}
									<div className="flex flex-wrap items-center gap-3">
										<Button variant="ghost" size="sm" className="gap-1.5 text-sauti-teal" onClick={() => update(i, { options: [...(q.options ?? []), `Option ${(q.options?.length ?? 0) + 1}`] })}><Plus className="h-4 w-4" /> Add option</Button>
										<label className="flex items-center gap-2 text-sm text-serene-neutral-600"><Switch checked={!!q.allowOther} onCheckedChange={(v) => update(i, { allowOther: v })} /> Add &quot;Other&quot; (people type their own)</label>
									</div>
								</div>
							)}

							{q.type === "scale" && (
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
									<div><Label className="text-xs">From</Label><Select value={String(q.scale?.min ?? 1)} onValueChange={(v) => update(i, { scale: { ...(q.scale ?? { max: 5 }), min: Number(v) } as Question["scale"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">0</SelectItem><SelectItem value="1">1</SelectItem></SelectContent></Select></div>
									<div><Label className="text-xs">To</Label><Select value={String(q.scale?.max ?? 5)} onValueChange={(v) => update(i, { scale: { ...(q.scale ?? { min: 1 }), max: Number(v) } as Question["scale"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></div>
									<div><Label className="text-xs">Low label</Label><Input value={q.scale?.minLabel ?? ""} onChange={(e) => update(i, { scale: { ...(q.scale ?? { min: 1, max: 5 }), minLabel: e.target.value } })} className="h-9" /></div>
									<div><Label className="text-xs">High label</Label><Input value={q.scale?.maxLabel ?? ""} onChange={(e) => update(i, { scale: { ...(q.scale ?? { min: 1, max: 5 }), maxLabel: e.target.value } })} className="h-9" /></div>
								</div>
							)}

							<details className="group rounded-xl border border-serene-neutral-100" open={!!q.media || !!q.view?.desktop?.media || !!q.view?.mobile?.media}>
								<summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-serene-neutral-600 hover:bg-serene-neutral-50">
									<ImagePlus className="h-3.5 w-3.5" /> Picture or video
									{(q.media || q.view?.desktop?.media || q.view?.mobile?.media) && <span className="rounded-full bg-sauti-teal-light px-1.5 py-0.5 text-[10px] text-sauti-dark">added</span>}
								</summary>
								<div className="p-3 pt-0">
									<ViewEditor formId={formId} item={q} device={device} onChange={(patch) => update(i, patch as Partial<Question>)} />
								</div>
							</details>

							<div className="flex items-center justify-between border-t border-serene-neutral-100 pt-3">
								<label className="flex items-center gap-2 text-sm"><Switch checked={q.required} onCheckedChange={(v) => update(i, { required: v })} /> Required</label>
								<div className="flex items-center">
									<Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
									<Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === questions.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
									<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange([...questions.slice(0, i + 1), { ...q, id: Math.random().toString(36).slice(2, 10) }, ...questions.slice(i + 1)])} aria-label="Duplicate"><Copy className="h-4 w-4" /></Button>
									<Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => onChange(questions.filter((_, j) => j !== i))} aria-label="Delete question"><Trash2 className="h-4 w-4" /></Button>
								</div>
							</div>
						</div>
					</div>
				</section>
			))}

			<div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-serene-neutral-300 bg-white p-3">
				<Select value={type} onValueChange={(t) => setType(t as QuestionType)}>
					<SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
					<SelectContent>{(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
				</Select>
				<Button onClick={() => onChange([...questions, newQuestion(type)])} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark"><Plus className="h-4 w-4" /> Add question</Button>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------- Responses */

function ResponsesTab({ formId, title, questions, collectEmail, responses, onChanged }: { formId: string; title: string; questions: Question[]; collectEmail: boolean; responses: ResponseRow[] | null; onChanged: () => void }) {
	const { toast } = useToast();
		const [q, setQ] = useState("");
	const [reportOpen, setReportOpen] = useState(false);
	const [report, setReport] = useState<{ title: string; markdown: string } | null>(null);
	const [reportBusy, setReportBusy] = useState(false);
	const [sheetBusy, setSheetBusy] = useState(false);

	const rowsFor = () => {
		const head = ["Submitted", ...(collectEmail ? ["Email"] : []), ...questions.map((qq) => qq.label || TYPE_LABEL[qq.type])];
		const body = (responses ?? []).map((r) => [format(new Date(r.created_at), "yyyy-MM-dd HH:mm"), ...(collectEmail ? [r.respondent_email ?? ""] : []), ...questions.map((qq) => displayAnswer(qq, r.answers[qq.id]))]);
		return [head, ...body];
	};
	const workbook = () => {
		const ws = XLSX.utils.aoa_to_sheet(rowsFor());
		ws["!cols"] = rowsFor()[0].map((h) => ({ wch: Math.min(40, Math.max(12, String(h).length + 4)) }));
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Responses");
		return wb;
	};
	const fileName = `${(title || "Form").replace(/[\\/:*?"<>|]+/g, " ").trim()} responses.xlsx`;
	const downloadXlsx = () => {
		const out = XLSX.write(workbook(), { type: "array", bookType: "xlsx" }) as ArrayBuffer;
		const a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
		a.download = fileName;
		a.click();
		URL.revokeObjectURL(a.href);
		exportedCsv(formId).catch(() => undefined);
	};
	/** Keeps one spreadsheet for this form in Files: updated in place when it is already there, then opened. */
	const openSpreadsheet = async () => {
		setSheetBusy(true);
		try {
			const out = new Uint8Array(XLSX.write(workbook(), { type: "array", bookType: "xlsx" }) as ArrayBuffer);
			const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
			const blob = new File([out], fileName, { type: mime });
			const hit = (await searchFiles(fileName)).find((f) => f.name === fileName && f.level === "edit");
			let id: string;
			if (hit) {
				const { signedUrl } = await prepareReplace(hit.id);
				await putToSignedUrl(signedUrl, blob);
				await finishReplace(hit.id, blob.size);
				id = hit.id;
			} else {
				const { path, signedUrl } = await prepareUpload(null, fileName, blob.size);
				await putToSignedUrl(signedUrl, blob);
				id = (await registerUpload(null, path, fileName, blob.size, mime)).id;
			}
			window.location.assign(`/dashboard/mjengo/files/sheet?file=${id}`);
		} catch (e) {
			toast({ title: "Could not open the spreadsheet", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			setSheetBusy(false);
		}
	};
	const makeReport = async () => {
		setReportBusy(true);
		try { setReport(await formReport(formId)); } catch (e) { toast({ title: "Could not write the report", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setReportBusy(false); }
	};
	useEffect(() => { if (reportOpen && !report && !reportBusy) void makeReport(); }, [reportOpen]); // eslint-disable-line react-hooks/exhaustive-deps

	const shown = useMemo(() => {
		const term = q.trim().toLowerCase();
		if (!responses) return [];
		return term ? responses.filter((r) => questions.some((qq) => displayAnswer(qq, r.answers[qq.id]).toLowerCase().includes(term)) || (r.respondent_email ?? "").toLowerCase().includes(term)) : responses;
	}, [responses, q, questions]);

	const download = async () => {
		if (!responses) return;
		const blob = new Blob([toCsv(questions, responses, collectEmail)], { type: "text/csv;charset=utf-8" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `${(title || "form").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-responses.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
		exportedCsv(formId).catch(() => undefined);
	};

	if (!responses) return <MjengoLoader label="Loading responses" compact />;
	if (responses.length === 0) return <div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-12 text-center text-sm text-serene-neutral-500">No responses yet. Publish the form and share the link.</div>;

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative min-w-[200px] flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search answers" className="pl-9" />
				</div>
				<span className="text-sm text-serene-neutral-500">{shown.length} of {responses.length}</span>
								<Button size="sm" className="gap-1.5 bg-sauti-teal text-white hover:bg-sauti-dark" onClick={() => setReportOpen(true)}><FileBarChart2 className="h-4 w-4" /> <span className="hidden sm:inline">Report</span></Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild><Button size="sm" className="gap-1.5 bg-[#37352f] text-white hover:bg-black"><Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-60">
						<DropdownMenuItem onClick={openSpreadsheet} disabled={sheetBusy}><FileSpreadsheet className="mr-2 h-4 w-4" /> Open as a spreadsheet in Files</DropdownMenuItem>
						<DropdownMenuItem onClick={downloadXlsx}><FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel (.xlsx)</DropdownMenuItem>
						<DropdownMenuItem onClick={download}><Download className="mr-2 h-4 w-4" /> Download CSV</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
						<Dialog open={reportOpen} onOpenChange={(o) => { setReportOpen(o); if (!o) setReport(null); }}>
				<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
					<DialogHeader><DialogTitle>{report?.title ?? "Report"}</DialogTitle></DialogHeader>
					{reportBusy || !report ? <MjengoLoader label="Writing the report" compact /> : (
						<div className="space-y-4">
							<div className="rounded-xl bg-[#FAFAF8] p-4 text-sm leading-relaxed"><Markdown text={report.markdown} /></div>
							<div className="flex flex-wrap justify-end gap-2">
								<Button variant="outline" className="gap-1.5" onClick={() => navigator.clipboard.writeText(report.markdown).then(() => toast({ title: "Copied" }))}><Copy className="h-4 w-4" /> Copy</Button>
								<Button variant="outline" className="gap-1.5" onClick={makeReport}>Write again</Button>
								<Button className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => {
									const html = `<h1>${report.title.replace(/[<>&]/g, "")}</h1>${report.markdown.replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^- (.*)$/gm, "<li>$1</li>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").split(/\n{2,}/).map((b) => (b.startsWith("<h2>") || b.startsWith("<li>") ? b : `<p>${b.replace(/\n/g, "<br>")}</p>`)).join("")}`;
									const key = Math.random().toString(36).slice(2, 10);
									try { sessionStorage.setItem(`ss_draft_${key}`, JSON.stringify({ title: report.title, html })); } catch { /* too large */ }
									window.location.assign(`/dashboard/mjengo/documents/editor?draft=${key}`);
								}}><FileText className="h-4 w-4" /> Open as a document</Button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
			<div className="overflow-x-auto rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
				<table className="w-full min-w-[640px] text-sm">
					<thead className="bg-serene-neutral-50 text-left text-xs uppercase tracking-wide text-serene-neutral-500">
						<tr>
							<th className="sticky left-0 whitespace-nowrap bg-serene-neutral-50 px-3 py-2.5">Submitted</th>
							{collectEmail && <th className="px-3 py-2.5">Email</th>}
							{questions.map((qq) => <th key={qq.id} className="max-w-[220px] truncate px-3 py-2.5" title={qq.label}>{qq.label || TYPE_LABEL[qq.type]}</th>)}
							<th className="w-10" />
						</tr>
					</thead>
					<tbody className="divide-y divide-serene-neutral-50">
						{shown.map((r) => (
							<tr key={r.id} className="hover:bg-serene-neutral-50/60">
								<td className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 text-serene-neutral-500">{format(new Date(r.created_at), "d MMM yyyy, HH:mm")}</td>
								{collectEmail && <td className="px-3 py-2">{r.respondent_email}</td>}
								{questions.map((qq) => <td key={qq.id} className="max-w-[260px] truncate px-3 py-2" title={displayAnswer(qq, r.answers[qq.id])}>{displayAnswer(qq, r.answers[qq.id]) || <span className="text-serene-neutral-300">-</span>}</td>)}
								<td className="px-1">
									<Button variant="ghost" size="icon" className="h-8 w-8 text-serene-neutral-400 hover:text-red-600" aria-label="Delete response" onClick={async () => { if (window.confirm("Delete this response?")) { try { await deleteResponse(formId, r.id); onChanged(); } catch { toast({ title: "Could not delete", variant: "destructive" }); } } }}><Trash2 className="h-4 w-4" /></Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------- Analytics */

function AnalyticsTab({ questions, responses }: { questions: Question[]; responses: ResponseRow[] | null }) {
	const summaries = useMemo(() => (responses ? summarise(questions, responses) : []), [questions, responses]);
	const days = useMemo(() => (responses ? perDay(responses, 30) : []), [responses]);
	if (!responses) return <MjengoLoader label="Loading responses" compact />;
	if (responses.length === 0) return <div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-12 text-center text-sm text-serene-neutral-500">Charts appear once the first response arrives.</div>;

	const week = responses.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 86400000).length;
	const required = questions.filter((q) => q.required).length;

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Stat label="Responses" value={responses.length} />
				<Stat label="Last 7 days" value={week} />
				<Stat label="Questions" value={questions.length} hint={`${required} required`} />
				<Stat label="Latest" value={format(new Date(responses[0].created_at), "d MMM")} />
			</div>

			<section className="rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-4">
				<h3 className="mb-2 text-sm font-bold text-sauti-dark">Responses per day, last 30 days</h3>
				<div className="h-44" role="img" aria-label="Responses per day">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart data={days} margin={{ left: -20, right: 8, top: 6 }}>
							<CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
							<XAxis dataKey="date" tickFormatter={(d: string) => format(new Date(d), "d MMM")} tick={{ fontSize: 11 }} minTickGap={24} />
							<YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
							<Tooltip labelFormatter={(d) => format(new Date(String(d)), "EEE d MMM")} formatter={(v: number) => [v, "Responses"]} />
							<Area type="monotone" dataKey="count" stroke="#056e80" fill="#068297" fillOpacity={0.25} />
						</AreaChart>
					</ResponsiveContainer>
				</div>
			</section>

			<div className="grid gap-4 lg:grid-cols-2">
				{summaries.map((s) => (
					<section key={s.question.id} className="rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-4">
						<div className="mb-3 flex items-start justify-between gap-2">
							<h3 className="text-sm font-bold text-sauti-dark">{s.question.label || "Untitled question"}</h3>
							<Badge variant="secondary" className="shrink-0">{s.answered} answered</Badge>
						</div>

						{s.tallies ? (
							<ul className="space-y-2">
								{s.tallies.map((t) => (
									<li key={t.value}>
										<div className="mb-0.5 flex justify-between text-xs text-serene-neutral-700"><span className="truncate pr-2">{t.label}</span><span className="shrink-0 tabular-nums">{t.count} · {t.pct}%</span></div>
										<div className="h-2.5 overflow-hidden rounded-full bg-serene-neutral-100"><div className="h-full rounded-full bg-sauti-teal" style={{ width: `${t.pct}%` }} /></div>
									</li>
								))}
							</ul>
						) : null}

						{s.stats && (
							<p className="mt-3 text-sm text-serene-neutral-700">
								Average <b>{s.stats.avg.toFixed(1)}</b> · lowest {s.stats.min} · highest {s.stats.max}
							</p>
						)}

						{s.samples && (
							s.samples.length === 0 ? <p className="text-sm text-serene-neutral-400">No answers yet.</p> : (
								<ul className="space-y-1.5">
									{s.samples.map((v, i) => <li key={i} className="line-clamp-2 rounded-lg bg-serene-neutral-50 px-3 py-1.5 text-sm text-serene-neutral-700">{v}</li>)}
									{s.answered > s.samples.length && <li className="text-xs text-serene-neutral-400">+ {s.answered - s.samples.length} more in the Responses tab</li>}
								</ul>
							)
						)}
					</section>
				))}
			</div>
		</div>
	);
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
	return (
		<div className="rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-4">
			<p className="text-2xl font-bold tabular-nums text-serene-neutral-900">{value}</p>
			<p className="text-xs font-semibold text-serene-neutral-700">{label}</p>
			{hint && <p className="text-xs text-serene-neutral-500">{hint}</p>}
		</div>
	);
}

/* -------------------------------------------------------------- Settings */

function SettingsTab({ formId, settings, onChange, onDelete }: { formId: string; settings: FormSettings; onChange: (s: FormSettings) => void; onDelete: () => void }) {
	const { toast } = useToast();
	const [systems, setSystems] = useState<{ id: string; name: string; colors: string[] }[]>([]);
	useEffect(() => { designSystemsForForms().then(setSystems).catch(() => setSystems([])); }, []);
	const [assets, setAssets] = useState<AssetRow[]>([]);
	useEffect(() => { unwrap(listAssets()).then(setAssets).catch(() => setAssets([])); }, []);
	const accents = ["#068297", "#7c3aed", "#2563eb", "#16a34a", "#ea580c", "#db2777", "#111827"];
	const palette = systems.find((d) => d.id === settings.style?.designSystem)?.colors ?? [];
	return (
		<div className="mx-auto max-w-2xl space-y-4">
			<section className="space-y-4 rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5">
				<div className="space-y-1.5">
					<Label>Message after someone submits</Label>
					<Textarea rows={2} value={settings.confirmation ?? ""} onChange={(e) => onChange({ ...settings, confirmation: e.target.value })} />
				</div>
				<label className="flex items-center justify-between gap-4 text-sm">
					<span><span className="font-medium">Collect email addresses</span><span className="block text-xs text-serene-neutral-500">Respondents must enter an email before submitting.</span></span>
					<Switch checked={!!settings.collectEmail} onCheckedChange={(v) => onChange({ ...settings, collectEmail: v })} />
				</label>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-1.5">
						<Label>Stop accepting responses at</Label>
						<Input type="datetime-local" value={settings.closeAt ? settings.closeAt.slice(0, 16) : ""} onChange={(e) => onChange({ ...settings, closeAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
					</div>
					<div className="space-y-1.5">
						<Label>Maximum responses</Label>
						<Input type="number" min={1} inputMode="numeric" placeholder="No limit" value={settings.limit ?? ""} onChange={(e) => onChange({ ...settings, limit: e.target.value ? Number(e.target.value) : null })} />
					</div>
				</div>
			</section>
			<section className="space-y-4 rounded-2xl border border-serene-neutral-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
				<h3 className="text-sm font-bold text-sauti-dark">How it is answered</h3>
				<div className="space-y-1.5">
					<Label>Layout</Label>
					<div className="grid grid-cols-2 gap-2">
						{([["page", "Whole page", "Every question on one page"], ["single", "One at a time", "Full page per question, like Typeform"]] as const).map(([v, l, d]) => (
							<button key={v} type="button" onClick={() => onChange({ ...settings, layout: v })} aria-pressed={(settings.layout ?? "page") === v} className={cn("rounded-xl border p-3 text-left", (settings.layout ?? "page") === v ? "border-sauti-teal bg-sauti-teal-light/40" : "border-serene-neutral-200 hover:bg-serene-neutral-50")}>
								<span className="block text-sm font-semibold">{l}</span><span className="block text-xs text-serene-neutral-500">{d}</span>
							</button>
						))}
					</div>
					<p className="text-xs text-serene-neutral-500">People answering can switch between the two.</p>
				</div>
				<label className="flex items-center justify-between gap-4 text-sm">
					<span><span className="font-medium">Allow anonymous answers</span><span className="block text-xs text-serene-neutral-500">People signed in to Sauti Salama are recorded with their email unless they choose to be anonymous.</span></span>
					<Switch checked={settings.allowAnonymous !== false} onCheckedChange={(v) => onChange({ ...settings, allowAnonymous: v })} />
				</label>
			</section>

			<section className="space-y-4 rounded-2xl border border-serene-neutral-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
				<h3 className="text-sm font-bold text-sauti-dark">Look</h3>
				<div className="space-y-1.5">
					<Label>Accent colour</Label>
					<div className="flex flex-wrap items-center gap-2">
						{[...accents, ...palette].map((c) => (
							<button key={c} type="button" aria-label={`Accent ${c}`} aria-pressed={settings.style?.accent === c} onClick={() => onChange({ ...settings, style: { ...settings.style, accent: c } })} className={cn("h-7 w-7 rounded-full ring-offset-2", settings.style?.accent === c && "ring-2 ring-sauti-teal")} style={{ background: c }} />
						))}
						<ColourInput label="Custom colour" value={settings.style?.accent || "#068297"} onCommit={(hex) => onChange({ ...settings, style: { ...settings.style, accent: hex } })} className="h-7 w-9 cursor-pointer rounded border border-serene-neutral-200 bg-white p-0.5" />
					</div>
				</div>
				{systems.length > 0 && (
					<div className="space-y-1.5">
						<Label>Use colours from a design system</Label>
						<Select value={settings.style?.designSystem ?? "none"} onValueChange={(v) => { const d = systems.find((x) => x.id === v); onChange({ ...settings, style: { ...settings.style, designSystem: v === "none" ? null : v, ...(d?.colors[0] ? { accent: d.colors[0] } : {}) } }); }}>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent><SelectItem value="none">None</SelectItem>{systems.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
						</Select>
						<p className="text-xs text-serene-neutral-500">Design systems are set up in the Assistant, with their colours, fonts and documents.</p>
					</div>
				)}
			</section>

			<section className="space-y-3 rounded-2xl border border-serene-neutral-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
				<h3 className="text-sm font-bold text-sauti-dark">Poster</h3>
				<p className="text-xs text-serene-neutral-500">Pick a poster made in Design or the Assistant. It shows at the top of the form, and can be posted together with the link.</p>
				{assets.length === 0 ? <p className="text-xs text-serene-neutral-500">No images in Studio yet.</p> : (
					<div className="flex gap-2 overflow-x-auto pb-1">
						{assets.slice(0, 20).map((a) => {
							const on = (settings as FormSettings & { poster?: string | null }).poster === a.id;
							return (
								<button key={a.id} type="button" aria-pressed={on} onClick={async () => {
									try {
										const r = await unwrap(linkPoster(formId, on ? null : a.id));
										const imgs = (settings.images ?? []).filter((u) => !u.includes("/poster-"));
										onChange({ ...settings, images: r.url ? [r.url, ...imgs] : imgs, ...({ poster: on ? null : a.id } as object) } as FormSettings);
									} catch (e) { toast({ title: "Could not link the poster", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
								}} className={cn("relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2", on ? "border-sauti-teal" : "border-transparent")}>
									{a.url && <img src={a.url} alt="" className="h-full w-full object-cover" />}
									{on && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sauti-teal text-white"><Check className="h-3 w-3" /></span>}
								</button>
							);
						})}
					</div>
				)}
			</section>

			<section className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
				<h3 className="text-sm font-bold text-red-800">Delete this form</h3>
				<p className="mt-1 text-sm text-red-700">The form, its link and every response are removed for good.</p>
				<Button variant="outline" className="mt-3 gap-1.5 border-red-200 text-red-700 hover:bg-red-100" onClick={onDelete}><Trash2 className="h-4 w-4" /> Delete form</Button>
			</section>
		</div>
	);
}
