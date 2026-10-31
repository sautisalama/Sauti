"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, ExternalLink, ListPlus, Loader2, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { addEntityTasks, entityTasks, redoEntityTasks, toggleEntityTask, type EntityTasks as Data } from "@/app/actions/mjengo-entity-tasks";
import type { Kind } from "./shared";

const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const today = () => new Date().toISOString().slice(0, 10);

/**
 * The to-dos that belong to one record, right on its page: tick them off, add one, and let the page
 * suggest a chain worked back from the deadline. `version` changes when the link or deadline was
 * refreshed, which reloads the list (and offers to redo the suggested tasks).
 */
export function EntityTasks({ kind, id, version, noun }: { kind: Kind; id: string; version: number; noun: string }) {
	const { toast } = useToast();
	const [data, setData] = useState<Data | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [draft, setDraft] = useState("");
	const [showDone, setShowDone] = useState(false);
	const [staleDeadline, setStaleDeadline] = useState(false);

	const load = useCallback(async () => {
		try {
			setData(await unwrap(entityTasks(kind, id)));
		} catch {
			setData(null);
		}
	}, [kind, id]);

	useEffect(() => {
		void load().then(() => version > 0 && setStaleDeadline(true));
	}, [load, version]);

	const run = async (key: string, fn: () => Promise<Data>, fail: string) => {
		setBusy(key);
		try {
			setData(await fn());
			setStaleDeadline(false);
		} catch (e) {
			toast({ title: fail, description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(null);
		}
	};

	if (!data) return <div className="h-24 animate-pulse rounded-xl bg-serene-neutral-100" aria-hidden />;

	const open = data.tasks.filter((t) => t.status !== "done");
	const done = data.tasks.filter((t) => t.status === "done");
	const hasAuto = data.tasks.some((t) => t.auto && t.status === "todo");

	const toggle = (taskId: string, to: boolean) => {
		// Tick it at once; put it back if it could not be saved.
		const before = data;
		setData({ ...data, tasks: data.tasks.map((t) => (t.id === taskId ? { ...t, status: to ? "done" : "todo" } : t)) });
		unwrap(toggleEntityTask(kind, id, taskId, to)).then(setData).catch(() => { setData(before); toast({ title: "Could not update the task", variant: "destructive" }); });
	};
	const addOwn = () => {
		const t = draft.trim();
		if (!t) return;
		setDraft("");
		void run("add", () => unwrap(addEntityTasks(kind, id, [{ title: t, due: null }])), "Could not add the task");
	};

	return (
		<div className="rounded-xl border border-serene-neutral-100 p-3">
			<div className="mb-2 flex items-center justify-between gap-2">
				<p className="text-sm font-semibold text-serene-neutral-900">To-dos <span className="font-normal text-serene-neutral-500">({open.length} open)</span></p>
				<Link href="/dashboard/mjengo/todos" className="flex items-center gap-1 text-xs text-sauti-teal hover:underline">All to-dos <ExternalLink className="h-3 w-3" /></Link>
			</div>

			{staleDeadline && hasAuto && (
				<div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
					<CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
					<span className="min-w-0 flex-1">The link was refreshed. Redo the suggested to-dos from the current deadline? Ones someone has started stay as they are.</span>
					<Button size="sm" variant="outline" className="h-7 gap-1" disabled={busy !== null} onClick={() => run("redo", () => unwrap(redoEntityTasks(kind, id)), "Could not redo the to-dos")}>
						{busy === "redo" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Redo
					</Button>
				</div>
			)}

			{open.length === 0 && done.length === 0 && <p className="mb-2 text-xs text-serene-neutral-500">Nothing to do yet for this {noun}.</p>}
			<ul className="space-y-1">
				{open.map((t) => {
					const late = !!t.due_date && t.due_date < today();
					return (
						<li key={t.id} className="flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-serene-neutral-50">
							<button type="button" role="checkbox" aria-checked={false} aria-label={`Mark done: ${t.title}`} onClick={() => toggle(t.id, true)} className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-serene-neutral-300 hover:border-sauti-teal" />
							<span className="min-w-0 flex-1 text-sm text-serene-neutral-900">{t.title}</span>
							{t.due_date && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", late ? "bg-red-50 text-red-700" : "bg-serene-neutral-100 text-serene-neutral-600")}>{late ? "Late " : ""}{fmt(t.due_date)}</span>}
						</li>
					);
				})}
			</ul>

			<div className="mt-2 flex items-center gap-2">
				<input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOwn(); } }} placeholder="Add a to-do and press Enter" aria-label="Add a to-do" className="h-9 min-w-0 flex-1 rounded-md border border-serene-neutral-200 bg-white px-3 text-sm" />
				<Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Add" onClick={addOwn} disabled={!draft.trim() || busy !== null}><Plus className="h-4 w-4" /></Button>
			</div>

			{data.suggestions.length > 0 && (
				<div className="mt-3 rounded-lg border border-dashed border-serene-neutral-200 p-2">
					<p className="mb-1 text-xs text-serene-neutral-600">
						{data.deadline ? <>Worked back from the deadline ({fmt(data.deadline)}):</> : <>Suggested first steps (no deadline on this {noun} yet):</>}
					</p>
					<ul className="mb-2 space-y-0.5 text-xs text-serene-neutral-700">
						{data.suggestions.map((s) => <li key={s.title} className="flex justify-between gap-2"><span>{s.title}</span>{s.due && <span className="shrink-0 text-serene-neutral-500">{fmt(s.due)}</span>}</li>)}
					</ul>
					<Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={busy !== null} onClick={() => run("suggest", () => unwrap(addEntityTasks(kind, id, data.suggestions.map((s) => ({ ...s, auto: true })))), "Could not add the to-dos")}>
						{busy === "suggest" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListPlus className="h-3.5 w-3.5" />} Add these {data.suggestions.length}
					</Button>
				</div>
			)}

			{done.length > 0 && (
				<div className="mt-2">
					<button type="button" onClick={() => setShowDone((v) => !v)} className="text-xs text-serene-neutral-600 hover:underline">{showDone ? "Hide" : "Show"} {done.length} done</button>
					{showDone && (
						<ul className="mt-1 space-y-1">
							{done.map((t) => (
								<li key={t.id} className="flex items-start gap-2 px-1 py-0.5 text-sm text-serene-neutral-500">
									<button type="button" role="checkbox" aria-checked aria-label={`Mark not done: ${t.title}`} onClick={() => toggle(t.id, false)} className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sauti-teal text-white"><Check className="h-3 w-3" /></button>
									<span className="line-through">{t.title}</span>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
