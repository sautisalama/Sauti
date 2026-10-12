"use client";

import { MjengoLoader } from "../_components/MjengoLoader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ClipboardList, LayoutGrid, List as ListIcon, Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createForm, createFromTemplate, designSystemsForForms, generateForm, listForms, type FormRow } from "@/app/actions/mjengo-forms";
import { FORM_TEMPLATES } from "@/lib/forms/templates";
import { unwrap } from "@/lib/action-result";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check } from "lucide-react";

const STATUS: Record<FormRow["status"], { label: string; tone: string }> = {
	draft: { label: "Draft", tone: "bg-slate-100 text-slate-700" },
	open: { label: "Accepting responses", tone: "bg-emerald-100 text-emerald-800" },
	closed: { label: "Closed", tone: "bg-rose-100 text-rose-800" },
};

const when = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

export default function FormsPage() {
	const { toast } = useToast();
	const router = useRouter();
	const [forms, setForms] = useState<FormRow[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [view, setView] = useState<"cards" | "list">("cards");
	const [aiOpen, setAiOpen] = useState(false);
	const [aiText, setAiText] = useState("");
	const [aiBusy, setAiBusy] = useState(false);
	const [chooser, setChooser] = useState(false);
	const [tplBusy, setTplBusy] = useState<string | null>(null);
	// Create with AI: optionally start from a template and follow a design system or written guidelines.
	const [aiTemplate, setAiTemplate] = useState<string | null>(null);
	const [aiDesign, setAiDesign] = useState<string | null>(null);
	const [aiGuidelines, setAiGuidelines] = useState("");
	const [systems, setSystems] = useState<{ id: string; name: string; colors: string[] }[]>([]);
	useEffect(() => { designSystemsForForms().then(setSystems).catch(() => setSystems([])); }, []);

	useEffect(() => {
		listForms().then(setForms).catch(() => setForms([]));
		try { const v = localStorage.getItem("ss_forms_view"); if (v === "cards" || v === "list") setView(v); } catch { /* default */ }
	}, []);
	const changeView = (v: "cards" | "list") => { setView(v); try { localStorage.setItem("ss_forms_view", v); } catch { /* ignore */ } };

	const create = async () => {
		setBusy(true);
		try {
			router.push(`/dashboard/mjengo/forms/${await createForm()}`);
		} catch (e) {
			toast({ title: "Could not create the form", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			setBusy(false);
		}
	};

	return (
		<div className="mx-auto max-w-6xl space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-xl font-bold tracking-tight text-sauti-dark">Forms</h2>
					<p className="text-sm text-serene-neutral-500">Build a form, share the link or QR code, and read the responses as a table or as charts.</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5" role="group" aria-label="View">
						<button onClick={() => changeView("cards")} aria-pressed={view === "cards"} aria-label="Cards" className={cn("flex h-7 w-7 items-center justify-center rounded-md", view === "cards" ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}><LayoutGrid className="h-4 w-4" /></button>
						<button onClick={() => changeView("list")} aria-pressed={view === "list"} aria-label="List" className={cn("flex h-7 w-7 items-center justify-center rounded-md", view === "list" ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}><ListIcon className="h-4 w-4" /></button>
					</div>
					<Button onClick={() => setAiOpen(true)} variant="outline" size="sm" className="h-8 gap-1.5 px-3 text-xs"><Sparkles className="h-4 w-4" /> Create with AI</Button>
					<Button onClick={() => setChooser(true)} disabled={busy} size="sm" className="h-8 gap-1.5 bg-sauti-teal px-3 text-xs hover:bg-sauti-dark">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New form</Button>
				</div>
			</div>

			{!forms ? (
				<MjengoLoader label="Loading forms" />
			) : forms.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-12 text-center">
					<span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sauti-teal-light text-sauti-teal"><ClipboardList className="h-6 w-6" /></span>
					<p className="font-semibold text-serene-neutral-900">No forms yet</p>
					<p className="mt-1 text-sm text-serene-neutral-500">Surveys, sign-ups, feedback, applications: create one in a few minutes.</p>
				</div>
			) : view === "cards" ? (
				<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{forms.map((f) => {
						const cover = f.settings?.images?.[0];
						const accent = f.settings?.style?.accent || "#068297";
						return (
							<li key={f.id}>
								<Link href={`/dashboard/mjengo/forms/${f.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-sauti-teal/40 hover:shadow-md">
									{cover ? (
										<img src={cover} alt="" className="h-32 w-full object-cover" />
									) : (
										<div className="flex h-32 items-end p-4" style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}55)` }}>
											<ClipboardList className="h-8 w-8" style={{ color: accent }} />
										</div>
									)}
									<div className="flex flex-1 flex-col p-4">
										<div className="flex items-start justify-between gap-2">
											<h3 className="line-clamp-2 font-semibold text-serene-neutral-900">{f.title}</h3>
											<span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS[f.status].tone)}>{STATUS[f.status].label}</span>
										</div>
										<div className="mt-auto flex items-end justify-between pt-4">
											<div>
												<p className="text-2xl font-bold tabular-nums text-serene-neutral-900">{f.response_count}</p>
												<p className="text-xs text-serene-neutral-500">responses{f.last_response_at ? ` · last ${when(f.last_response_at)}` : ""}</p>
											</div>
											<p className="text-right text-xs text-serene-neutral-400">{f.questions.length} question{f.questions.length === 1 ? "" : "s"}<br />edited {when(f.updated_at)}</p>
										</div>
									</div>
								</Link>
							</li>
						);
					})}
				</ul>
			) : (
				<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white">
					<ul className="divide-y divide-serene-neutral-100">
						{forms.map((f) => (
							<li key={f.id}>
								<Link href={`/dashboard/mjengo/forms/${f.id}`} className="flex items-center gap-3 p-3 hover:bg-serene-neutral-50/70">
									{f.settings?.images?.[0] ? <img src={f.settings.images[0]} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sauti-teal-light text-sauti-teal"><ClipboardList className="h-5 w-5" /></span>}
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold text-serene-neutral-900">{f.title}</span>
										<span className="block truncate text-xs text-serene-neutral-500">{f.questions.length} question{f.questions.length === 1 ? "" : "s"} · edited {when(f.updated_at)}</span>
									</span>
									<span className="hidden text-right sm:block"><span className="block text-sm font-semibold tabular-nums">{f.response_count}</span><span className="block text-xs text-serene-neutral-500">responses</span></span>
									<span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline", STATUS[f.status].tone)}>{STATUS[f.status].label}</span>
								</Link>
							</li>
						))}
					</ul>
				</div>
			)}
			<Dialog open={chooser} onOpenChange={(o) => !tplBusy && setChooser(o)}>
				<DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
					<DialogHeader><DialogTitle>Start a form</DialogTitle><DialogDescription>Pick a template, or start with a blank page. Everything can be changed afterwards.</DialogDescription></DialogHeader>
					<div className="grid gap-3 sm:grid-cols-2">
						<button type="button" disabled={!!tplBusy} onClick={create} className="flex flex-col items-start gap-1 rounded-2xl border border-dashed border-serene-neutral-300 p-4 text-left transition hover:border-sauti-teal/60 hover:bg-sauti-teal-light/20">
							<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-serene-neutral-100"><Plus className="h-4 w-4" /></span>
							<span className="font-semibold">Blank form</span>
							<span className="text-xs text-serene-neutral-500">Start empty and add your own questions.</span>
						</button>
						{FORM_TEMPLATES.map((t) => (
							<button key={t.id} type="button" disabled={!!tplBusy} onClick={async () => {
								setTplBusy(t.id);
								try { router.push(`/dashboard/mjengo/forms/${await unwrap(createFromTemplate(t.id))}`); }
								catch (e) { toast({ title: "Could not create the form", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); setTplBusy(null); }
							}} className="flex flex-col items-start gap-1 rounded-2xl border border-serene-neutral-200 p-4 text-left transition hover:border-sauti-teal/60 hover:bg-sauti-teal-light/20 disabled:opacity-60">
								<span className="flex w-full items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sauti-teal-light text-sauti-teal">{tplBusy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}</span><span className="rounded-full bg-serene-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-serene-neutral-600">{t.kind}</span></span>
								<span className="font-semibold">{t.name}</span>
								<span className="text-xs text-serene-neutral-500">{t.blurb}</span>
								<span className="text-[11px] text-serene-neutral-400">{t.questions.length} questions</span>
							</button>
						))}
					</div>
					<div className="flex items-center justify-between rounded-xl bg-serene-neutral-50 p-3 text-sm">
						<span>Want it written for you?</span>
						<Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setChooser(false); setAiOpen(true); }}><Sparkles className="h-4 w-4" /> Create with AI</Button>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={aiOpen} onOpenChange={(o) => !aiBusy && setAiOpen(o)}>
				<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
					<DialogHeader><DialogTitle>Create a form with AI</DialogTitle><DialogDescription>Say what the form is for and who will fill it in. Start from a template and follow your design if you like. You can change every question afterwards.</DialogDescription></DialogHeader>
					<div className="space-y-4">
						<Textarea rows={4} autoFocus value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="A feedback form for people who attended our legal clinic last week, including how easy it was to reach us and what we should do better." />
						<div>
							<p className="mb-1.5 text-sm font-medium">Start from a template <span className="font-normal text-serene-neutral-500">(optional)</span></p>
							<div className="flex flex-wrap gap-2">
								{FORM_TEMPLATES.map((t) => (
									<button key={t.id} type="button" onClick={() => setAiTemplate((cur) => (cur === t.id ? null : t.id))} aria-pressed={aiTemplate === t.id} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", aiTemplate === t.id ? "border-sauti-teal bg-sauti-teal-light/50 font-medium" : "border-serene-neutral-200 text-serene-neutral-600")}>{aiTemplate === t.id && <Check className="h-3.5 w-3.5" />}{t.name}</button>
								))}
							</div>
						</div>
						<div>
							<p className="mb-1.5 text-sm font-medium">Design <span className="font-normal text-serene-neutral-500">(optional)</span></p>
							{systems.length > 0 && (
								<div className="mb-2 flex flex-wrap gap-2">
									{systems.map((d) => (
										<button key={d.id} type="button" onClick={() => setAiDesign((cur) => (cur === d.id ? null : d.id))} aria-pressed={aiDesign === d.id} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm", aiDesign === d.id ? "border-sauti-teal bg-sauti-teal-light/50 font-medium" : "border-serene-neutral-200 text-serene-neutral-600")}>
											<span className="flex">{d.colors.slice(0, 4).map((c) => <i key={c} className="-ml-1 h-3.5 w-3.5 rounded-full ring-1 ring-white first:ml-0" style={{ background: c }} />)}</span>{d.name}
										</button>
									))}
								</div>
							)}
							<Textarea rows={2} value={aiGuidelines} onChange={(e) => setAiGuidelines(e.target.value)} placeholder="Or paste your brand guidelines, or describe the look: calm teal and warm yellow, friendly." className="text-sm" />
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setAiOpen(false)} disabled={aiBusy}>Cancel</Button>
						<Button
							className="gap-2 bg-sauti-teal hover:bg-sauti-dark"
							disabled={aiBusy || aiText.trim().length < 8}
							onClick={async () => {
								setAiBusy(true);
								try { router.push(`/dashboard/mjengo/forms/${await unwrap(generateForm(aiText, { templateId: aiTemplate, designSystemId: aiDesign, guidelines: aiGuidelines || null }))}`); }
								catch (e) { toast({ title: "Could not create the form", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); setAiBusy(false); }
							}}
						>{aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Create</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
