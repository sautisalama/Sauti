"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, CornerDownRight, MessageSquare, Trash2, Undo2, X } from "lucide-react";
import { addPdfComment, deletePdfComment, listPdfComments, resolvePdfComment, type PdfComment } from "@/app/actions/pdf-comments";
import { unwrap } from "@/lib/action-result";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface Spot { page: number; x: number; y: number }

/** The comments on one PDF, kept on the server so everyone with access sees the same threads. */
export function usePdfComments(fileId: string | null) {
	const { toast } = useToast();
	const [comments, setComments] = useState<PdfComment[]>([]);
	const [ready, setReady] = useState(false);
	const reload = useCallback(async () => {
		if (!fileId) return;
		try { setComments(await unwrap(listPdfComments(fileId))); } catch { /* comments are optional */ } finally { setReady(true); }
	}, [fileId]);
	useEffect(() => { void reload(); }, [reload]);
	// Other people's comments show up without reopening the file.
	useEffect(() => {
		if (!fileId) return;
		const t = setInterval(() => { if (document.visibilityState === "visible") void reload(); }, 20000);
		return () => clearInterval(t);
	}, [fileId, reload]);

	const act = async (fn: () => Promise<unknown>) => {
		try { await fn(); await reload(); } catch (e) { toast({ title: "Could not update the comments", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
	};
	return {
		comments, ready,
		add: (spot: Spot, body: string, parentId?: string) => act(() => unwrap(addPdfComment(fileId!, { ...spot, body, parentId: parentId ?? null }))),
		resolve: (id: string, resolved: boolean) => act(() => unwrap(resolvePdfComment(fileId!, id, resolved))),
		remove: (id: string) => act(() => unwrap(deletePdfComment(fileId!, id))),
	};
}

type Api = ReturnType<typeof usePdfComments>;

/** Numbered pins on one page; in comment mode a click anywhere on the page starts a new comment there. */
export function CommentPins({ page, api, active, commenting, onPick, onSpot, pending }: {
	page: number; api: Api; active: string | null; commenting: boolean;
	onPick: (id: string) => void; onSpot: (s: Spot) => void; pending: Spot | null;
}) {
	const roots = api.comments.filter((c) => !c.parentId);
	return (
		<div className="pointer-events-none absolute inset-0 z-20">
			{commenting && (
				<div
					className="pointer-events-auto absolute inset-0 cursor-crosshair"
					onClick={(e) => {
						const r = e.currentTarget.getBoundingClientRect();
						onSpot({ page, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
					}}
				/>
			)}
			{roots.map((c, n) => c.page === page && (
				<button
					key={c.id}
					onClick={(e) => { e.stopPropagation(); onPick(c.id); }}
					aria-label={`Comment ${n + 1} by ${c.authorName}`}
					className={cn("pointer-events-auto absolute flex h-7 w-7 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none text-xs font-bold text-white shadow-md ring-2 ring-white", c.resolved ? "bg-serene-neutral-400" : "bg-[#f5b017]", active === c.id && "ring-sauti-teal")}
					style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
				>{n + 1}</button>
			))}
			{pending && pending.page === page && (
				<span className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none bg-sauti-teal text-white shadow-md ring-2 ring-white" style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }}>
					<MessageSquare className="h-3.5 w-3.5" />
				</span>
			)}
		</div>
	);
}

const when = (iso: string) => { try { return format(new Date(iso), "d MMM, HH:mm"); } catch { return ""; } };

/** The list of threads: write a new comment at the chosen spot, reply, resolve, delete. */
export function CommentsPanel({ api, active, onPick, pending, onCancelPending, onClose, canResolve }: {
	api: Api; active: string | null; onPick: (id: string | null) => void;
	pending: Spot | null; onCancelPending: () => void; onClose: () => void; canResolve: boolean;
}) {
	const [draft, setDraft] = useState("");
	const [reply, setReply] = useState<Record<string, string>>({});
	const [showResolved, setShowResolved] = useState(false);
	const threads = useMemo(() => {
		const roots = api.comments.filter((c) => !c.parentId);
		return roots.map((r, i) => ({ n: i + 1, root: r, replies: api.comments.filter((c) => c.parentId === r.id) }));
	}, [api.comments]);
	const open = threads.filter((t) => !t.root.resolved);
	const done = threads.filter((t) => t.root.resolved);

	const send = async () => {
		if (!pending || !draft.trim()) return;
		await api.add(pending, draft.trim());
		setDraft(""); onCancelPending();
	};

	const card = (t: (typeof threads)[number]) => (
		<li key={t.root.id} className={cn("rounded-xl border bg-white p-3 text-sm", active === t.root.id ? "border-sauti-teal shadow-sm" : "border-serene-neutral-200", t.root.resolved && "opacity-70")}>
			<button onClick={() => onPick(t.root.id)} className="block w-full text-left">
				<div className="flex items-center gap-2">
					<span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", t.root.resolved ? "bg-serene-neutral-400" : "bg-[#f5b017]")}>{t.n}</span>
					<span className="min-w-0 flex-1 truncate font-semibold">{t.root.authorName}</span>
					<span className="shrink-0 text-[11px] text-serene-neutral-500">p. {t.root.page + 1} · {when(t.root.createdAt)}</span>
				</div>
				<p className="mt-1.5 whitespace-pre-wrap break-words text-serene-neutral-800">{t.root.body}</p>
			</button>
			{t.replies.map((r) => (
				<div key={r.id} className="mt-2 border-l-2 border-serene-neutral-100 pl-2.5">
					<div className="flex items-center gap-2 text-xs"><span className="font-semibold">{r.authorName}</span><span className="text-serene-neutral-500">{when(r.createdAt)}</span>
						{r.mine && <button onClick={() => void api.remove(r.id)} aria-label="Delete reply" className="ml-auto text-serene-neutral-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
					</div>
					<p className="whitespace-pre-wrap break-words text-serene-neutral-800">{r.body}</p>
				</div>
			))}
			{active === t.root.id && (
				<div className="mt-2 space-y-2">
					<div className="flex gap-1.5">
						<input value={reply[t.root.id] ?? ""} onChange={(e) => setReply((s) => ({ ...s, [t.root.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" && (reply[t.root.id] ?? "").trim()) { void api.add({ page: t.root.page, x: t.root.x, y: t.root.y }, reply[t.root.id].trim(), t.root.id); setReply((s) => ({ ...s, [t.root.id]: "" })); } }} placeholder="Reply" className="h-8 min-w-0 flex-1 rounded-lg border border-serene-neutral-200 px-2 text-sm outline-none focus:border-sauti-teal" />
						<button aria-label="Send reply" disabled={!(reply[t.root.id] ?? "").trim()} onClick={() => { void api.add({ page: t.root.page, x: t.root.x, y: t.root.y }, reply[t.root.id].trim(), t.root.id); setReply((s) => ({ ...s, [t.root.id]: "" })); }} className="flex h-8 w-8 items-center justify-center rounded-lg bg-sauti-teal text-white disabled:opacity-40"><CornerDownRight className="h-4 w-4" /></button>
					</div>
					<div className="flex items-center gap-2 text-xs">
						{canResolve && <button onClick={() => void api.resolve(t.root.id, !t.root.resolved)} className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-serene-neutral-700 hover:bg-serene-neutral-100">{t.root.resolved ? <><Undo2 className="h-3.5 w-3.5" /> Reopen</> : <><Check className="h-3.5 w-3.5" /> Resolve</>}</button>}
						{t.root.mine && <button onClick={() => void api.remove(t.root.id)} className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
					</div>
				</div>
			)}
		</li>
	);

	return (
		<aside className="fixed bottom-3 right-3 top-20 z-30 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-serene-neutral-200 bg-serene-neutral-50 shadow-2xl">
			<div className="flex items-center justify-between border-b border-serene-neutral-200 bg-white px-4 py-3">
				<p className="text-sm font-semibold">Comments {open.length > 0 && <span className="font-normal text-serene-neutral-500">({open.length})</span>}</p>
				<button onClick={onClose} aria-label="Close comments" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5"><X className="h-4 w-4" /></button>
			</div>
			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
				{pending && (
					<div className="rounded-xl border border-sauti-teal bg-white p-3">
						<p className="mb-1.5 text-xs font-semibold text-sauti-teal">New comment on page {pending.page + 1}</p>
						<textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send(); }} rows={3} placeholder="Write a comment" aria-label="Comment text" className="w-full resize-none rounded-lg border border-serene-neutral-200 p-2 text-sm outline-none focus:border-sauti-teal" />
						<div className="mt-2 flex justify-end gap-2">
							<button onClick={() => { setDraft(""); onCancelPending(); }} className="rounded-lg px-3 py-1.5 text-xs font-medium text-serene-neutral-600 hover:bg-serene-neutral-100">Cancel</button>
							<button onClick={() => void send()} disabled={!draft.trim()} className="rounded-lg bg-sauti-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Comment</button>
						</div>
					</div>
				)}
				{!pending && open.length === 0 && api.ready && <p className="px-2 py-8 text-center text-sm text-serene-neutral-500">No comments yet. Choose <span className="font-semibold">Comment</span> in the toolbar, then click where you want to say something.</p>}
				<ul className="space-y-2">{open.map(card)}</ul>
				{done.length > 0 && (
					<div>
						<button onClick={() => setShowResolved((v) => !v)} className="text-xs font-medium text-serene-neutral-600 hover:underline">{showResolved ? "Hide" : "Show"} {done.length} resolved</button>
						{showResolved && <ul className="mt-2 space-y-2">{done.map(card)}</ul>}
					</div>
				)}
			</div>
		</aside>
	);
}
