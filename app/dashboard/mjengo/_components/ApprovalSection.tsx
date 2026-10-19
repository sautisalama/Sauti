"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Clock, FileSignature, Loader2, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { answerApproval, askApproval, getApproval } from "@/app/actions/mjengo-workflow";
import type { Approval, ApprovalStatus } from "@/lib/mjengo/approvals";
import { useFacets } from "./Facets";

const STATUS: Record<ApprovalStatus, { label: string; tone: string; Icon: typeof Clock }> = {
	pending: { label: "Waiting for approval", tone: "bg-amber-50 text-amber-800", Icon: Clock },
	approved: { label: "Approved", tone: "bg-emerald-50 text-emerald-700", Icon: CheckCircle2 },
	changes_requested: { label: "Changes requested", tone: "bg-rose-50 text-rose-700", Icon: MessageSquareWarning },
	withdrawn: { label: "Withdrawn", tone: "bg-serene-neutral-100 text-serene-neutral-600", Icon: Clock },
};

/**
 * Approval of a file: ask named people to approve it, see who has answered and what they said, and answer when you
 * are the one asked. Anyone asked who cannot open the file yet is given view access.
 */
export function ApprovalSection({ fileId, canAsk }: { fileId: string; canAsk: boolean }) {
	const { toast } = useToast();
	const facets = useFacets();
	const [state, setState] = useState<{ approval: Approval | null; mine: boolean } | null>(null);
	const [asking, setAsking] = useState(false);
	const [who, setWho] = useState<string[]>([]);
	const [note, setNote] = useState("");
	const [comment, setComment] = useState("");
	const [busy, setBusy] = useState<string | null>(null);
	const load = useCallback(async () => { try { setState(await unwrap(getApproval(fileId))); } catch { setState({ approval: null, mine: false }); } }, [fileId]);
	useEffect(() => { setState(null); setAsking(false); void load(); }, [load]);
	const run = async (what: string, fn: () => Promise<unknown>) => {
		setBusy(what);
		try { await fn(); await load(); } catch (e) { toast({ title: "That did not work", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(null); }
	};
	if (!state) return <div className="rounded-xl border border-serene-neutral-100 p-3"><Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" /></div>;
	const ap = state.approval;
	const s = ap ? STATUS[ap.status] : null;
	return (
		<div className="rounded-xl border border-serene-neutral-100 p-3">
			<div className="flex flex-wrap items-center gap-2">
				<p className="mr-auto flex items-center gap-1.5 text-sm font-semibold text-serene-neutral-900"><FileSignature className="h-4 w-4 text-sauti-teal" /> Approval</p>
				{s && <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", s.tone)}><s.Icon className="h-3 w-3" />{s.label}</span>}
				{canAsk && !asking && <Button type="button" size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setAsking(true)}>{ap && ap.status === "pending" ? "Ask again" : "Ask for approval"}</Button>}
			</div>

			{ap && ap.status !== "withdrawn" && (
				<div className="mt-2 space-y-1.5 text-sm">
					<p className="text-xs text-serene-neutral-500">Asked by {ap.requestedBy.name} on {format(parseISO(ap.createdAt), "d MMM yyyy")}{ap.note ? `: ${ap.note}` : ""}</p>
					<ul className="space-y-1">
						{ap.reviewers.map((r) => (
							<li key={r.id} className="flex items-start gap-2 text-xs">
								{r.decision === "approved" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : r.decision === "changes_requested" ? <MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" /> : <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}
								<span><span className="font-medium text-serene-neutral-900">{r.name}</span> {r.decision === "pending" ? "has not answered yet" : r.decision === "approved" ? "approved it" : "asked for changes"}{r.comment ? `: ${r.comment}` : ""}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{state.mine && ap && (
				<div className="mt-3 space-y-2 rounded-lg bg-amber-50/60 p-2.5">
					<p className="text-xs font-semibold text-amber-900">You were asked to approve this.</p>
					<textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} aria-label="Your comment" placeholder="A comment (needed if you ask for changes)" className="w-full resize-y rounded-lg border border-serene-neutral-200 bg-white p-2 text-sm outline-none focus:border-sauti-teal" />
					<div className="flex gap-2">
						<Button type="button" size="sm" className="h-8 gap-1.5 rounded-full bg-emerald-600 text-xs hover:bg-emerald-700" disabled={!!busy} onClick={() => void run("approve", async () => { await unwrap(answerApproval(ap.id, "approved", comment)); setComment(""); })}>{busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve</Button>
						<Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 rounded-full border-rose-200 text-xs text-rose-700 hover:bg-rose-50" disabled={!!busy} onClick={() => void run("changes", async () => { await unwrap(answerApproval(ap.id, "changes_requested", comment)); setComment(""); })}>{busy === "changes" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareWarning className="h-3.5 w-3.5" />} Ask for changes</Button>
					</div>
				</div>
			)}

			{asking && (
				<div className="mt-3 space-y-2">
					<p className="text-xs font-medium text-serene-neutral-700">Who should approve it?</p>
					<div className="flex flex-wrap gap-1.5">
						{(facets?.members ?? []).map((m) => (
							<button key={m.id} type="button" aria-pressed={who.includes(m.id)} onClick={() => setWho((w) => (w.includes(m.id) ? w.filter((x) => x !== m.id) : [...w, m.id]))} className={cn("rounded-full border px-2.5 py-1 text-xs", who.includes(m.id) ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-200 bg-white text-serene-neutral-700 hover:bg-serene-neutral-50")}>{m.name}</button>
						))}
					</div>
					<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder="A note for them (optional)" aria-label="A note for the people asked" className="h-9 w-full rounded-lg border border-serene-neutral-200 px-3 text-sm outline-none focus:border-sauti-teal" />
					<div className="flex gap-2">
						<Button type="button" size="sm" className="h-8 rounded-full bg-sauti-teal text-xs hover:bg-sauti-dark" disabled={!!busy || who.length === 0} onClick={() => void run("ask", async () => { await unwrap(askApproval(fileId, who, note)); setAsking(false); setWho([]); setNote(""); toast({ title: "Asked for approval", description: "They have been notified." }); })}>{busy === "ask" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Send request</Button>
						<Button type="button" size="sm" variant="ghost" className="h-8 rounded-full text-xs" onClick={() => setAsking(false)}>Cancel</Button>
					</div>
				</div>
			)}
		</div>
	);
}
