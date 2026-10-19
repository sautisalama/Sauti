"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderPlus, ListChecks, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { deletePlaybook, listPlaybooks, savePlaybook } from "@/app/actions/mjengo-workflow";
import type { Playbook, PlaybookStep } from "@/lib/mjengo/playbooks";
import { KIND_LABEL, STATUSES, type Kind } from "../_components/shared";
import { MjengoLoader } from "../_components/MjengoLoader";

const KINDS: Kind[] = ["grant", "opportunity", "project", "fellowship"];
const statusLabel = (kind: Kind, value: string) => STATUSES[kind].find((s) => s.value === value)?.label ?? value.replace(/_/g, " ");
type Draft = { id: string | null; name: string; entityType: Kind; triggerStatus: string; steps: PlaybookStep[]; active: boolean; builtIn: boolean };

const describe = (s: PlaybookStep) => (s.kind === "folder" ? `Make a folder${s.name ? ` "${s.name}"` : " for it in your vault"}` : `${s.title}${s.offsetDays ? `, ${s.offsetDays} days later` : ", at once"}`);

/**
 * Playbooks: when a grant, opportunity, project or fellowship reaches a status, its steps are set up by themselves
 * (to-dos for whoever is responsible, with due dates, and a folder in their vault). Each runs once per record.
 */
export default function PlaybooksPage() {
	const { toast } = useToast();
	const [data, setData] = useState<{ playbooks: Playbook[]; canEditBuiltIn: boolean } | null>(null);
	const [edit, setEdit] = useState<Draft | null>(null);
	const [busy, setBusy] = useState(false);
	const load = useCallback(async () => { try { setData(await unwrap(listPlaybooks())); } catch (e) { toast({ title: "Could not load the playbooks", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); setData({ playbooks: [], canEditBuiltIn: false }); } }, [toast]);
	useEffect(() => { void load(); }, [load]);
	if (!data) return <MjengoLoader label="Loading playbooks" />;

	const run = async (fn: () => Promise<unknown>, ok?: string) => {
		setBusy(true);
		try { await fn(); await load(); if (ok) toast({ title: ok }); } catch (e) { toast({ title: "That did not work", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	const toDraft = (p: Playbook): Draft => ({ id: p.id, name: p.name, entityType: p.entity_type, triggerStatus: p.trigger_status, steps: p.steps, active: p.active, builtIn: p.built_in });
	const canChange = (d: Draft) => !d.builtIn || data.canEditBuiltIn;

	return (
		<div className="mx-auto max-w-4xl space-y-5">
			<header className="flex flex-wrap items-start gap-3">
				<div className="min-w-0 flex-1">
					<h2 className="text-2xl font-bold tracking-tight text-sauti-dark">Playbooks</h2>
					<p className="text-sm text-serene-neutral-500">When a grant, opportunity, project or fellowship reaches a status, its next steps are set up for whoever is responsible, once per record.</p>
				</div>
				<Button className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => setEdit({ id: null, name: "", entityType: "grant", triggerStatus: STATUSES.grant[0].value, steps: [{ kind: "todo", title: "", offsetDays: 0 }], active: true, builtIn: false })}><Plus className="h-4 w-4" /> New playbook</Button>
			</header>

			{KINDS.map((kind) => {
				const list = data.playbooks.filter((p) => p.entity_type === kind);
				if (!list.length) return null;
				return (
					<section key={kind}>
						<h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-serene-neutral-400">{KIND_LABEL[kind as Kind]}s</h3>
						<ul className="space-y-2">
							{list.map((p) => (
								<li key={p.id} className={cn("rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]", p.active ? "border-serene-neutral-200/70" : "border-dashed border-serene-neutral-200 opacity-70")}>
									<div className="flex flex-wrap items-center gap-2">
										<div className="min-w-0 flex-1">
											<p className="text-sm font-semibold text-serene-neutral-900">{p.name}{p.built_in && <span className="ml-2 rounded-full bg-serene-neutral-100 px-2 py-0.5 text-[10px] font-medium text-serene-neutral-600">Built in</span>}</p>
											<p className="text-xs text-serene-neutral-500">When a {KIND_LABEL[kind as Kind].toLowerCase()} becomes <span className="font-medium text-serene-neutral-700">{statusLabel(kind as Kind, p.trigger_status)}</span></p>
										</div>
										<label className="flex items-center gap-2 text-xs text-serene-neutral-600"><input type="checkbox" checked={p.active} disabled={busy} onChange={(e) => void run(() => unwrap(savePlaybook(p.id, { name: p.name, entityType: p.entity_type, triggerStatus: p.trigger_status, steps: p.steps, active: e.target.checked })))} className="h-4 w-4 accent-[#068297]" /> On</label>
										<Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setEdit(toDraft(p))}>{p.built_in && !data.canEditBuiltIn ? "View" : "Edit"}</Button>
									</div>
									<ol className="mt-2 space-y-1 text-xs text-serene-neutral-600">
										{p.steps.map((s, i) => <li key={i} className="flex items-start gap-1.5">{s.kind === "folder" ? <FolderPlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sauti-teal" /> : <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sauti-teal" />}<span>{describe(s)}</span></li>)}
									</ol>
								</li>
							))}
						</ul>
					</section>
				);
			})}

			{edit && (
				<div role="dialog" aria-label="Playbook" className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
					<div className="my-8 w-full max-w-xl space-y-4 rounded-2xl bg-white p-5 shadow-xl">
						<div className="flex items-center"><h3 className="mr-auto text-lg font-semibold text-sauti-dark">{edit.id ? "Playbook" : "New playbook"}</h3><button onClick={() => setEdit(null)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5"><X className="h-4 w-4" /></button></div>
						<Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} disabled={!canChange(edit)} placeholder="Name, for example Grant awarded: set it up" aria-label="Playbook name" />
						<div className="grid grid-cols-2 gap-2">
							<label className="space-y-1 text-xs font-medium text-serene-neutral-700">For<select value={edit.entityType} disabled={!canChange(edit)} onChange={(e) => { const k = e.target.value as Kind; setEdit({ ...edit, entityType: k, triggerStatus: STATUSES[k][0].value }); }} className="h-10 w-full rounded-lg border border-serene-neutral-200 bg-white px-2 text-sm">{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
							<label className="space-y-1 text-xs font-medium text-serene-neutral-700">When it becomes<select value={edit.triggerStatus} disabled={!canChange(edit)} onChange={(e) => setEdit({ ...edit, triggerStatus: e.target.value })} className="h-10 w-full rounded-lg border border-serene-neutral-200 bg-white px-2 text-sm">{STATUSES[edit.entityType].map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
						</div>
						<div className="space-y-2">
							<p className="text-xs font-semibold text-serene-neutral-700">Steps</p>
							{edit.steps.map((s, i) => (
								<div key={i} className="flex items-center gap-2">
									{s.kind === "folder" ? (
										<><FolderPlus className="h-4 w-4 shrink-0 text-sauti-teal" /><Input value={s.name ?? ""} disabled={!canChange(edit)} onChange={(e) => setEdit({ ...edit, steps: edit.steps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Folder name (empty: the record's name)" aria-label="Folder name" className="h-9" /></>
									) : (
										<><ListChecks className="h-4 w-4 shrink-0 text-sauti-teal" /><Input value={s.title ?? ""} disabled={!canChange(edit)} onChange={(e) => setEdit({ ...edit, steps: edit.steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="To-do" aria-label="To-do" className="h-9 flex-1" /><Input type="number" min={0} max={730} value={s.offsetDays ?? 0} disabled={!canChange(edit)} onChange={(e) => setEdit({ ...edit, steps: edit.steps.map((x, j) => (j === i ? { ...x, offsetDays: Number(e.target.value) } : x)) })} aria-label="Days later" className="h-9 w-20" /><span className="text-xs text-serene-neutral-500">days</span></>
									)}
									{canChange(edit) && <button onClick={() => setEdit({ ...edit, steps: edit.steps.filter((_, j) => j !== i) })} aria-label="Remove the step" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-serene-neutral-400 hover:bg-black/5"><Trash2 className="h-4 w-4" /></button>}
								</div>
							))}
							{canChange(edit) && <div className="flex gap-2"><Button type="button" size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setEdit({ ...edit, steps: [...edit.steps, { kind: "todo", title: "", offsetDays: 0 }] })}><Plus className="mr-1 h-3.5 w-3.5" /> To-do</Button><Button type="button" size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setEdit({ ...edit, steps: [...edit.steps, { kind: "folder" }] })}><FolderPlus className="mr-1 h-3.5 w-3.5" /> Folder</Button></div>}
						</div>
						<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4 accent-[#068297]" /> Switched on</label>
						<div className="flex justify-between gap-2 pt-1">
							{edit.id && !edit.builtIn ? <Button type="button" variant="ghost" className="gap-1.5 text-red-600" disabled={busy} onClick={() => { if (window.confirm("Delete this playbook?")) void run(async () => { await unwrap(deletePlaybook(edit.id!)); setEdit(null); }, "Playbook deleted"); }}><Trash2 className="h-4 w-4" /> Delete</Button> : <span />}
							<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setEdit(null)}>Close</Button>
								<Button type="button" className="bg-sauti-teal hover:bg-sauti-dark" disabled={busy} onClick={() => void run(async () => { await unwrap(savePlaybook(edit.id, { name: edit.name, entityType: edit.entityType, triggerStatus: edit.triggerStatus, steps: edit.steps, active: edit.active })); setEdit(null); }, "Playbook saved")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
