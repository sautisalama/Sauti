"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileText, Loader2, Save, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { draftForFunder, exportApplication, getBrief, readCall, reviewApplicationAction, saveDraft, saveFeedback, type Brief } from "@/app/actions/mjengo-grant-agent";
import { wordCount, type Review, type Section } from "@/lib/mjengo/grant-agent-shared";

/**
 * The application agent for a grant or opportunity: it reads what the funder asks for, writes each section to fit
 * (from the organisation's own record, with [to confirm] where the record is silent), keeps what the funder has said
 * before, and reviews the whole against the scoring before it goes. People edit every word.
 */
export function GrantAgent({ kind, id }: { kind: "grant" | "opportunity"; id: string }) {
	const { toast } = useToast();
	const [brief, setBrief] = useState<Brief | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState<string | null>(null);
	const [text, setText] = useState<Record<string, string>>({});
	const [notes, setNotes] = useState<Record<string, string>>({});
	const [sources, setSources] = useState<Record<string, string[]>>({});
	const [feedback, setFeedback] = useState("");
	const [review, setReview] = useState<Review | null>(null);

	const apply = useCallback((b: Brief) => {
		setBrief(b);
		setText(Object.fromEntries(b.requirements.sections.map((s) => [s.id, b.drafts[s.id]?.text ?? ""])));
		setFeedback(b.funderFeedback);
		setReview(b.review);
	}, []);
	useEffect(() => {
		let on = true;
		unwrap(getBrief(kind, id)).then((b) => on && apply(b)).catch((e) => on && setError(e instanceof Error ? e.message : "The agent could not be opened."));
		return () => { on = false; };
	}, [kind, id, apply]);

	const run = async (what: string, fn: () => Promise<void>) => {
		setBusy(what);
		try { await fn(); } catch (e) { toast({ title: "The agent could not do that", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(null); }
	};

	if (error) return <div className="rounded-xl border border-serene-neutral-100 p-3 text-sm text-red-700">{error}</div>;
	if (!brief) return <div className="rounded-xl border border-serene-neutral-100 p-3"><Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" /></div>;
	const req = brief.requirements;
	const dirty = (s: Section) => (text[s.id] ?? "") !== (brief.drafts[s.id]?.text ?? "");

	const draft = (s: Section) => run(`draft:${s.id}`, async () => {
		const out = await unwrap(draftForFunder(kind, id, s.id, notes[s.id] ?? ""));
		setText((t) => ({ ...t, [s.id]: out.draft.text }));
		setBrief((b) => (b ? { ...b, drafts: { ...b.drafts, [s.id]: out.draft }, review: null } : b));
		setSources((x) => ({ ...x, [s.id]: out.sources }));
		setReview(null);
	});
	const save = (s: Section) => run(`save:${s.id}`, async () => {
		const d = await unwrap(saveDraft(kind, id, s.id, text[s.id] ?? ""));
		setBrief((b) => (b ? { ...b, drafts: { ...b.drafts, [s.id]: d }, review: null } : b));
		setReview(null);
	});
	const openAsDocument = () => run("export", async () => {
		const out = await unwrap(exportApplication(kind, id));
		const key = Math.random().toString(36).slice(2, 10);
		try { sessionStorage.setItem(`ss_draft_${key}`, JSON.stringify({ title: out.title, html: out.html })); } catch { throw new Error("The application is too large to hand over. Copy it section by section."); }
		window.location.assign(`/dashboard/mjengo/documents/editor?draft=${key}`);
	});

	return (
		<div className="rounded-xl border border-serene-neutral-100 p-3">
			<div className="mb-2 flex flex-wrap items-center gap-2">
				<p className="mr-auto flex items-center gap-1.5 text-sm font-semibold text-serene-neutral-900"><Sparkles className="h-4 w-4 text-sauti-teal" /> Application agent</p>
				<Button type="button" size="sm" variant="outline" className="h-8 rounded-full text-xs" disabled={!!busy} onClick={() => void run("read", async () => apply(await unwrap(readCall(kind, id))))}>
					{busy === "read" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}{req.sections.length ? "Read the call again" : "Read the funder's call"}
				</Button>
			</div>

			{!req.sections.length ? (
				<p className="text-sm text-serene-neutral-600">
					{brief.hasLink ? "I will read the funder's page and any guidelines attached under Documents, then list what the application must contain." : "Add the funder's link to this record, or attach their guidelines under Documents, and I will read what the application must contain."}
				</p>
			) : (
				<div className="space-y-4">
					<div className="rounded-lg bg-serene-neutral-50 p-3 text-xs text-serene-neutral-700">
						{req.notes && <p className="mb-2">{req.notes}</p>}
						{req.criteria.length > 0 && <p className="mb-1"><span className="font-semibold">Scored on:</span> {req.criteria.map((c) => `${c.name}${c.weight ? ` ${c.weight}%` : ""}`).join(" · ")}</p>}
						{req.eligibility.length > 0 && <p className="mb-1"><span className="font-semibold">Who may apply:</span> {req.eligibility.join("; ")}</p>}
						{req.attachments.length > 0 && <p><span className="font-semibold">Attach:</span> {req.attachments.join("; ")}</p>}
					</div>

					{req.sections.map((s) => {
						const n = wordCount(text[s.id] ?? "");
						const over = !!s.wordLimit && n > s.wordLimit;
						return (
							<div key={s.id}>
								<div className="mb-1 flex items-baseline gap-2">
									<p className="text-sm font-medium text-serene-neutral-900">{s.title}</p>
									<span className={cn("ml-auto text-xs tabular-nums", over ? "font-semibold text-red-600" : "text-serene-neutral-500")}>{n}{s.wordLimit ? ` / ${s.wordLimit}` : ""} words</span>
								</div>
								{s.guidance && <p className="mb-1.5 text-xs text-serene-neutral-500">{s.guidance}</p>}
								<textarea value={text[s.id] ?? ""} onChange={(e) => setText((t) => ({ ...t, [s.id]: e.target.value }))} rows={Math.min(14, Math.max(4, Math.round((n || 40) / 14)))} aria-label={`${s.title} draft`} placeholder="Not written yet. Draft it with Salama, or write it yourself." className="w-full resize-y rounded-lg border border-serene-neutral-200 p-2.5 text-sm leading-relaxed outline-none focus:border-sauti-teal" />
								<div className="mt-1.5 flex flex-wrap items-center gap-2">
									<Input value={notes[s.id] ?? ""} onChange={(e) => setNotes((x) => ({ ...x, [s.id]: e.target.value }))} placeholder="Optional: a steer, e.g. lead with the Kibera programme" aria-label={`A steer for ${s.title}`} className="h-8 min-w-0 flex-1 text-xs" />
									<Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 rounded-full text-xs" disabled={!!busy} onClick={() => void draft(s)}>{busy === `draft:${s.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-sauti-teal" />}{text[s.id] ? "Redraft" : "Draft"}</Button>
									{dirty(s) && <Button type="button" size="sm" className="h-8 gap-1.5 rounded-full bg-sauti-teal text-xs hover:bg-sauti-dark" disabled={!!busy} onClick={() => void save(s)}>{busy === `save:${s.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save</Button>}
								</div>
								{!!sources[s.id]?.length && <p className="mt-1 text-[11px] text-serene-neutral-500">Written from: {sources[s.id].join("; ")}</p>}
							</div>
						);
					})}

					<div>
						<p className="mb-1 text-sm font-medium text-serene-neutral-900">What this funder has said before</p>
						<textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} onBlur={() => { if (feedback !== brief.funderFeedback) void unwrap(saveFeedback(kind, id, feedback)).then(() => setBrief((b) => (b ? { ...b, funderFeedback: feedback } : b))).catch(() => toast({ title: "Could not save the feedback", variant: "destructive" })); }} rows={3} aria-label="Feedback from the funder" placeholder="Reviewer comments, reasons for a decline, what they liked. Every later draft for this funder takes it into account." className="w-full resize-y rounded-lg border border-serene-neutral-200 p-2.5 text-sm outline-none focus:border-sauti-teal" />
						{brief.earlierFeedback.length > 0 && <p className="mt-1 text-[11px] text-serene-neutral-500">Also on record from earlier applications to {brief.funder}: {brief.earlierFeedback.length}.</p>}
					</div>

					<div className="flex flex-wrap gap-2">
						<Button type="button" variant="outline" className="h-9 gap-1.5 rounded-full text-sm" disabled={!!busy} onClick={() => void run("review", async () => { const r = await unwrap(reviewApplicationAction(kind, id)); setReview(r); })}>{busy === "review" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-sauti-teal" />} Review before sending</Button>
						<Button type="button" className="h-9 gap-1.5 rounded-full bg-sauti-teal text-sm hover:bg-sauti-dark" disabled={!!busy} onClick={() => void openAsDocument()}>{busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Open as a document</Button>
					</div>

					{review && (
						<div className="rounded-lg border border-[#b6e0e6] bg-[#f1fafb] p-3 text-sm">
							<p className="mb-2 font-semibold text-serene-neutral-900">{review.overall !== null ? `Likely score about ${review.overall}%` : "Review"}</p>
							<ul className="mb-3 space-y-1">
								{review.checks.map((c, i) => <li key={i} className="flex gap-2 text-xs">{c.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}<span>{c.text}</span></li>)}
							</ul>
							{review.criteria.map((c) => (
								<div key={c.name} className="mb-2 last:mb-0">
									<div className="flex items-center gap-2 text-xs font-medium text-serene-neutral-900">{c.name}<span className="ml-auto tabular-nums">{c.score}/{c.max}</span></div>
									<div className="my-1 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-sauti-teal" style={{ width: `${(c.score / c.max) * 100}%` }} /></div>
									<p className="text-xs text-serene-neutral-700">{c.feedback}</p>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
