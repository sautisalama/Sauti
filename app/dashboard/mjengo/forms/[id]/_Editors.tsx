"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, Loader2, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { SHARE_EMAIL_UI } from "@/lib/client/flags";
import { RecipientField } from "../../mail/_components/RecipientField";
import { ManageAccess } from "../../_components/ManageAccess";
import { addFormEditors, getFormSharing, removeFormEditor, setFormEditLink, setFormEditorLevel, setFormRestricted, type FormSharing } from "@/app/actions/form-share";

const LEVELS = [["edit", "Can edit"], ["view", "Can view responses"]] as const;

/**
 * Who made the form and who else works on it, the way Files does it: add people with a level, change or remove
 * them with Manage, limit the form to the people added, and give an edit link to people outside the organisation.
 */
export function FormEditors({ formId }: { formId: string }) {
	const { toast } = useToast();
	const [s, setS] = useState<FormSharing | null>(null);
	const [adding, setAdding] = useState("");
	const [level, setLevel] = useState<"edit" | "view">("edit");
	const [notify, setNotify] = useState(SHARE_EMAIL_UI);
	const [busy, setBusy] = useState(false);

	useEffect(() => { unwrap(getFormSharing(formId)).then(setS).catch(() => setS(null)); }, [formId]);

	const run = async (fn: () => Promise<FormSharing>, done?: string) => {
		setBusy(true);
		try { setS(await fn()); if (done) toast({ title: done }); } catch (e) { toast({ title: "Could not update sharing", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};

	if (!s) return null;
	return (
		<div className="mt-3 space-y-4 border-t border-serene-neutral-100 pt-3">
			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">Add people</p>
				<RecipientField value={adding} onChange={setAdding} placeholder="Add people by email" />
				{adding.trim() && (
					<div className="mt-2 space-y-2 rounded-xl bg-serene-neutral-50 p-2.5">
						<div className="flex flex-wrap items-center gap-2">
							<select value={level} onChange={(e) => setLevel(e.target.value as "edit" | "view")} aria-label="What they can do" className="h-8 rounded-lg border border-serene-neutral-200 bg-white px-2 text-xs">
								{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
							</select>
							{SHARE_EMAIL_UI && level === "edit" && <label className="flex items-center gap-1.5 text-xs"><Switch checked={notify} onCheckedChange={setNotify} aria-label="Email them" /> Email them</label>}
						</div>
						<Button size="sm" className="w-full gap-1.5 bg-sauti-teal hover:bg-sauti-dark" disabled={busy} onClick={() => run(async () => { const r = await unwrap(addFormEditors(formId, adding.split(/[,;\s]+/).filter(Boolean), undefined, level, notify)); setAdding(""); return r; }, "Added")}>
							{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /> Add</>}
						</Button>
					</div>
				)}
			</div>

			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">People with access</p>
				<ul className="divide-y divide-serene-neutral-100">
					{s.owner && <li className="flex items-center gap-2 py-1.5 text-sm"><span className="min-w-0 flex-1 truncate"><span className="font-medium">{s.owner.name}</span><span className="block truncate text-xs text-serene-neutral-500">{s.owner.email}</span></span><span className="shrink-0 text-xs text-serene-neutral-500">Owner</span></li>}
					{s.editors.map((e) => (
						<li key={e.email} className="flex items-center gap-2 py-1.5 text-sm">
							<span className="min-w-0 flex-1 truncate">{e.email}</span>
							<ManageAccess
								name={e.email}
								level={e.level}
								levels={LEVELS}
								disabled={busy}
								onChange={(v) => run(() => (v ? unwrap(setFormEditorLevel(formId, e.email, v as "edit" | "view")) : unwrap(removeFormEditor(formId, e.email))), v ? undefined : "Access removed")}
							/>
						</li>
					))}
					{s.editors.length === 0 && <li className="py-1.5 text-xs text-serene-neutral-500">Nobody else has been added yet.</li>}
				</ul>
			</div>

			<div className="space-y-3 rounded-xl bg-serene-neutral-50 p-3">
				<label className="flex items-center justify-between gap-2 text-sm">
					<span className="flex items-start gap-1.5"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-serene-neutral-500" /><span><span className="block font-medium">Only the people above</span><span className="block text-xs text-serene-neutral-500">{s.restricted ? "Other administrators cannot open this form." : "Every administrator with Forms can open and edit it."}</span></span></span>
					<Switch checked={s.restricted} disabled={busy} onCheckedChange={(on) => run(() => unwrap(setFormRestricted(formId, on)), on ? "The form is limited to the people added" : "The form is open to the team again")} />
				</label>
				<div>
					<label className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-1.5"><Link2 className="h-4 w-4 text-serene-neutral-500" /> Anyone with the link can edit</span>
						<Switch checked={!!s.editUrl} disabled={busy} onCheckedChange={(on) => run(() => unwrap(setFormEditLink(formId, on)), on ? "Edit link is on" : "Edit link is off")} />
					</label>
					{s.editUrl && (
						<Button size="sm" variant="outline" className="mt-2 w-full min-w-0 gap-1.5" onClick={() => navigator.clipboard.writeText(s.editUrl!).then(() => toast({ title: "Edit link copied" }))}><Copy className="h-4 w-4" /> Copy the edit link</Button>
					)}
				</div>
			</div>
		</div>
	);
}
