"use client";

import { SHARE_EMAIL_UI } from "@/lib/client/flags";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { assignRole, deleteRole, listRoles, roleModules, saveRole, type RoleView } from "@/app/actions/roles";

interface Admin { id: string; name: string; email: string | null }

/**
 * Roles and what they can use. Super admins make a role (a name and the parts of the suite it allows),
 * give it to administrators and take it away. Administrators without a role keep full access. Giving or
 * taking a role asks whether to email the person about it.
 */
export function RolesCard({ admins }: { admins: Admin[] }) {
	const { toast } = useToast();
	const [roles, setRoles] = useState<RoleView[] | null>(null);
	const [modules, setModules] = useState<{ key: string; label: string; hint: string }[]>([]);
	const [edit, setEdit] = useState<{ id: string | null; name: string; description: string; permissions: string[] } | null>(null);
	const [assign, setAssign] = useState<{ role: RoleView; userId: string } | null>(null);
	const [pending, setPending] = useState<{ roleId: string; userId: string; on: boolean; label: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		try {
			const [r, m] = await Promise.all([unwrap(listRoles()), unwrap(roleModules())]);
			setRoles(r); setModules(m);
		} catch (e) {
			setRoles([]);
			toast({ title: "Could not load roles", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	}, [toast]);
	useEffect(() => { void load(); }, [load]);

	const fail = (e: unknown) => toast({ title: "That did not work", description: e instanceof Error ? e.message : undefined, variant: "destructive" });

	const confirmAssign = async (notify: boolean) => {
		if (!pending) return;
		setBusy(true);
		try {
			setRoles(await unwrap(assignRole(pending.roleId, pending.userId, pending.on, notify)));
			toast({ title: pending.on ? "Role given" : "Role taken away", description: notify ? "They were emailed." : undefined });
			setPending(null); setAssign(null);
		} catch (e) { fail(e); } finally { setBusy(false); }
	};

	return (
		<Card className="rounded-2xl lg:col-span-2">
			<CardHeader>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-5 w-5 text-sauti-teal" /> Roles and permissions</CardTitle>
					<Button size="sm" className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => setEdit({ id: null, name: "", description: "", permissions: [] })}><Plus className="h-4 w-4" /> New role</Button>
				</div>
				<CardDescription>A role lists the parts of the suite someone may use, for example Grants only for the fundraising team. Administrators without a role can use everything. Super admins always can.</CardDescription>
			</CardHeader>
			<CardContent>
				{!roles ? <Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" /> : roles.length === 0 ? (
					<p className="rounded-xl border border-dashed border-serene-neutral-200 p-6 text-center text-sm text-serene-neutral-500">No roles yet. Create one, then give it to the people who should only see those parts.</p>
				) : (
					<ul className="grid gap-3 md:grid-cols-2">
						{roles.map((r) => (
							<li key={r.id} className="rounded-xl border border-serene-neutral-100 p-4">
								<div className="flex items-start gap-2">
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-semibold text-serene-neutral-900">{r.name}</p>
										{r.description && <p className="text-xs text-serene-neutral-500">{r.description}</p>}
									</div>
									<Button size="sm" variant="ghost" onClick={() => setEdit({ id: r.id, name: r.name, description: r.description ?? "", permissions: r.permissions })}>Edit</Button>
									<button type="button" aria-label={`Delete ${r.name}`} onClick={async () => { if (!window.confirm(`Delete the role "${r.name}"? People who have it keep their other roles, or full access if they have none.`)) return; try { setRoles(await unwrap(deleteRole(r.id))); } catch (e) { fail(e); } }} className="flex h-8 w-8 items-center justify-center rounded-full text-serene-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
								</div>
								<div className="mt-2 flex flex-wrap gap-1">
									{r.permissions.length === 0 ? <span className="text-xs text-amber-700">Allows nothing yet</span> : r.permissions.map((p) => <span key={p} className="rounded-full bg-sauti-teal-light/60 px-2 py-0.5 text-[11px] font-medium text-sauti-dark">{modules.find((m) => m.key === p)?.label ?? p}</span>)}
								</div>
								<div className="mt-3 border-t border-serene-neutral-100 pt-2">
									<p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-serene-neutral-400">Given to</p>
									<div className="flex flex-wrap gap-1.5">
										{r.members.map((m) => (
											<span key={m.id} className="flex items-center gap-1 rounded-full border border-serene-neutral-200 py-0.5 pl-2.5 pr-1 text-xs">
												{m.name}
												<button type="button" aria-label={`Take ${r.name} from ${m.name}`} onClick={() => setPending({ roleId: r.id, userId: m.id, on: false, label: m.name })} className="rounded-full p-0.5 text-serene-neutral-400 hover:bg-serene-neutral-100"><X className="h-3 w-3" /></button>
											</span>
										))}
										<button type="button" onClick={() => setAssign({ role: r, userId: "" })} className="flex items-center gap-1 rounded-full border border-dashed border-serene-neutral-300 px-2.5 py-0.5 text-xs text-serene-neutral-600 hover:border-sauti-teal"><Plus className="h-3 w-3" /> Give</button>
									</div>
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>

			<Dialog open={!!edit} onOpenChange={(o) => !o && !busy && setEdit(null)}>
				<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
					<DialogHeader><DialogTitle>{edit?.id ? "Edit role" : "New role"}</DialogTitle><DialogDescription>Choose what this role can use.</DialogDescription></DialogHeader>
					{edit && (
						<div className="space-y-3">
							<Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Role name, for example Fundraising" autoFocus />
							<Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={2} placeholder="What this role is for (optional)" />
							<ul className="divide-y divide-serene-neutral-100 rounded-xl border border-serene-neutral-100">
								{modules.map((m) => {
									const on = edit.permissions.includes(m.key);
									return (
										<li key={m.key} className="flex items-center justify-between gap-3 p-3">
											<span><span className="block text-sm font-medium">{m.label}</span><span className="block text-xs text-serene-neutral-500">{m.hint}</span></span>
											<Switch checked={on} onCheckedChange={(v) => setEdit({ ...edit, permissions: v ? [...edit.permissions, m.key] : edit.permissions.filter((p) => p !== m.key) })} aria-label={m.label} />
										</li>
									);
								})}
							</ul>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setEdit(null)} disabled={busy}>Cancel</Button>
						<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy || !edit?.name.trim()} onClick={async () => {
							if (!edit) return;
							setBusy(true);
							try { setRoles(await unwrap(saveRole(edit.id, { name: edit.name, description: edit.description, permissions: edit.permissions }))); setEdit(null); toast({ title: "Role saved" }); } catch (e) { fail(e); } finally { setBusy(false); }
						}}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={!!assign && !pending} onOpenChange={(o) => !o && setAssign(null)}>
				<DialogContent className="max-w-md">
					<DialogHeader><DialogTitle>Give “{assign?.role.name}” to</DialogTitle><DialogDescription>Choose an administrator.</DialogDescription></DialogHeader>
					<ul className="max-h-72 space-y-1 overflow-y-auto">
						{admins.filter((a) => !assign?.role.members.some((m) => m.id === a.id)).map((a) => (
							<li key={a.id}>
								<button type="button" onClick={() => setPending({ roleId: assign!.role.id, userId: a.id, on: true, label: a.name })} className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-serene-neutral-50">
									<span className="text-sm font-medium">{a.name}</span><span className="text-xs text-serene-neutral-500">{a.email}</span>
								</button>
							</li>
						))}
					</ul>
				</DialogContent>
			</Dialog>

			<Dialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader><DialogTitle>{pending?.on ? `Give this role to ${pending?.label}?` : `Take this role from ${pending?.label}?`}</DialogTitle><DialogDescription>{pending?.on ? "They will be able to use the parts of the suite this role allows." : "They lose what this role allowed. Other roles they have still apply."}</DialogDescription></DialogHeader>
					<DialogFooter className={cn("gap-2")}>
						<Button variant="outline" disabled={busy} onClick={() => setPending(null)}>Cancel</Button>
						<Button disabled={busy} className="gap-2 bg-sauti-teal hover:bg-sauti-dark" onClick={() => void confirmAssign(SHARE_EMAIL_UI)}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {pending?.on ? "Give the role" : "Take it away"}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
