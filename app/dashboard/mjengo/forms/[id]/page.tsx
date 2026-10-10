"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
	ArrowLeft, ArrowDown, ArrowUp, Check, Copy, Download, Eye, GripVertical, Loader2, Plus, QrCode, Search, Share2, Trash2, X,
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
import { FormRenderer } from "@/components/forms/FormRenderer";
import { TYPE_LABEL, displayAnswer, hasOptions, newQuestion, type FormSettings, type Question, type QuestionType } from "@/lib/forms/schema";
import { perDay, summarise, toCsv } from "@/lib/forms/analytics";
import { deleteForm, deleteResponse, exportedCsv, getForm, getResponses, saveForm, setFormStatus, type FormRow, type ResponseRow } from "@/app/actions/mjengo-forms";

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
	const [share, setShare] = useState(false);
	const loaded = useRef(false);

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

	if (form === undefined) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>;
	if (form === null) return <p className="py-20 text-center text-serene-neutral-500">That form no longer exists. <Link href="/dashboard/mjengo/forms" className="text-sauti-teal underline">Back to forms</Link></p>;

	const previewForm = { slug: form.slug, title: title || "Untitled form", description: description || null, questions, collectEmail: !!settings.collectEmail, unavailable: null, confirmation: settings.confirmation || "Thank you." } as const;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<Button asChild variant="ghost" size="icon" className="h-9 w-9"><Link href="/dashboard/mjengo/forms" aria-label="All forms"><ArrowLeft className="h-4 w-4" /></Link></Button>
				<Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Form title" className="h-10 min-w-0 flex-1 border-transparent bg-transparent text-lg font-bold shadow-none hover:border-serene-neutral-200 focus-visible:border-sauti-teal" />
				<span className="text-xs text-serene-neutral-400" aria-live="polite">{save === "saving" ? "Saving..." : save === "error" ? "Not saved" : "Saved"}</span>
				<Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPreview(true)}><Eye className="h-4 w-4" /> Preview</Button>
				<Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShare(true)} disabled={form.status === "draft"}><Share2 className="h-4 w-4" /> Share</Button>
				{form.status === "open" ? (
					<Button size="sm" variant="outline" onClick={() => changeStatus("closed")}>Stop responses</Button>
				) : (
					<Button size="sm" className="bg-sauti-teal hover:bg-sauti-dark" onClick={() => changeStatus("open")}>{form.status === "closed" ? "Reopen" : "Publish"}</Button>
				)}
			</div>

			<Tabs defaultValue="questions">
				<TabsList>
					<TabsTrigger value="questions">Questions</TabsTrigger>
					<TabsTrigger value="responses">Responses{responses ? ` (${responses.length})` : ""}</TabsTrigger>
					<TabsTrigger value="analytics">Analytics</TabsTrigger>
					<TabsTrigger value="settings">Settings</TabsTrigger>
				</TabsList>

				<TabsContent value="questions" className="mt-4">
					<QuestionsTab description={description} onDescription={setDescription} questions={questions} onChange={setQuestions} />
				</TabsContent>
				<TabsContent value="responses" className="mt-4">
					<ResponsesTab formId={id} title={title} questions={questions} collectEmail={!!settings.collectEmail} responses={responses} onChanged={loadResponses} />
				</TabsContent>
				<TabsContent value="analytics" className="mt-4">
					<AnalyticsTab questions={questions} responses={responses} />
				</TabsContent>
				<TabsContent value="settings" className="mt-4">
					<SettingsTab settings={settings} onChange={setSettings} onDelete={async () => { if (window.confirm("Delete this form and all of its responses? This cannot be undone.")) { await deleteForm(id); router.push("/dashboard/mjengo/forms"); } }} />
				</TabsContent>
			</Tabs>

			<Dialog open={preview} onOpenChange={setPreview}>
				<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-sauti-teal-light/60">
					<DialogHeader><DialogTitle>Preview (nothing is submitted)</DialogTitle></DialogHeader>
					<FormRenderer form={previewForm} preview />
				</DialogContent>
			</Dialog>

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
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

/* ------------------------------------------------------------- Questions */

function QuestionsTab({ description, onDescription, questions, onChange }: { description: string; onDescription: (v: string) => void; questions: Question[]; onChange: (q: Question[]) => void }) {
	const [type, setType] = useState<QuestionType>("short");
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
			<div className="rounded-2xl border border-serene-neutral-100 border-t-8 border-t-purple-600 bg-white p-4">
				<Label className="text-xs font-semibold text-serene-neutral-600">Description (optional)</Label>
				<Textarea value={description} onChange={(e) => onDescription(e.target.value)} rows={2} placeholder="Tell people what this form is for" className="mt-1.5" />
			</div>

			{questions.map((q, i) => (
				<section key={q.id} className="rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-4 shadow-sm">
					<div className="flex items-start gap-2">
						<GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-serene-neutral-300" aria-hidden />
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

	if (!responses) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" /></div>;
	if (responses.length === 0) return <div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-12 text-center text-sm text-serene-neutral-500">No responses yet. Publish the form and share the link.</div>;

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative min-w-[200px] flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search answers" className="pl-9" />
				</div>
				<span className="text-sm text-serene-neutral-500">{shown.length} of {responses.length}</span>
				<Button variant="outline" size="sm" className="gap-1.5" onClick={download}><Download className="h-4 w-4" /> Export CSV</Button>
			</div>
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
								{questions.map((qq) => <td key={qq.id} className="max-w-[260px] truncate px-3 py-2" title={displayAnswer(qq, r.answers[qq.id])}>{displayAnswer(qq, r.answers[qq.id]) || <span className="text-serene-neutral-300">—</span>}</td>)}
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
	if (!responses) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" /></div>;
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

function SettingsTab({ settings, onChange, onDelete }: { settings: FormSettings; onChange: (s: FormSettings) => void; onDelete: () => void }) {
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
			<section className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
				<h3 className="text-sm font-bold text-red-800">Delete this form</h3>
				<p className="mt-1 text-sm text-red-700">The form, its link and every response are removed for good.</p>
				<Button variant="outline" className="mt-3 gap-1.5 border-red-200 text-red-700 hover:bg-red-100" onClick={onDelete}><Trash2 className="h-4 w-4" /> Delete form</Button>
			</section>
		</div>
	);
}
