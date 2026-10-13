"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { RecipientField } from "../../mail/_components/RecipientField";
import { addFormEditors, getFormSharing, removeFormEditor, setFormEditLink, type FormSharing } from "@/app/actions/form-share";

/** Who made the form, and who else can edit it (including people outside the organisation) through an edit link. */
export function FormEditors({ formId }: { formId: string }) {
	const { toast } = useToast();
	const [s, setS] = useState<FormSharing | null>(null);
	const [adding, setAdding] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => { unwrap(getFormSharing(formId)).then(setS).catch(() => setS(null)); }, [formId]);

	const run = async (fn: () => Promise<FormSharing>, done?: string) => {
		setBusy(true);
		try { setS(await fn()); if (done) toast({ title: done }); } catch (e) { toast({ title: "Could not update sharing", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};

	if (!s) return null;
	return (
		<div className="mt-3 space-y-3 border-t border-serene-neutral-100 pt-3">
			{s.owner && <p className="text-xs text-serene-neutral-500">Created by <span className="font-medium text-serene-neutral-800">{s.owner.name}</span></p>}
			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">Can edit</p>
				<p className="mb-2 text-xs text-serene-neutral-500">Different from sharing the form for filling in. Editors change the form and read its responses.</p>
				<RecipientField value={adding} onChange={setAdding} placeholder="Add people by email" />
				<Button size="sm" className="mt-2 w-full bg-sauti-teal hover:bg-sauti-dark" disabled={busy || !adding.trim()} onClick={() => run(async () => { const r = await unwrap(addFormEditors(formId, adding.split(/[,;\s]+/).filter(Boolean))); setAdding(""); return r; }, "Added as editors")}>
					{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add as editors"}
				</Button>
				{s.editors.length > 0 && (
					<ul className="mt-2 space-y-1">
						{s.editors.map((e) => (
							<li key={e.email} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{e.email}</span>
								<button aria-label={`Remove ${e.email}`} onClick={() => run(() => unwrap(removeFormEditor(formId, e.email)))} className="rounded-full p-1 text-serene-neutral-400 hover:bg-black/5"><X className="h-3.5 w-3.5" /></button>
							</li>
						))}
					</ul>
				)}
			</div>
			<div>
				<label className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-1.5"><Link2 className="h-4 w-4 text-serene-neutral-500" /> Anyone with the edit link</span>
					<Switch checked={!!s.editUrl} disabled={busy} onCheckedChange={(on) => run(() => unwrap(setFormEditLink(formId, on)), on ? "Edit link is on" : "Edit link is off")} />
				</label>
				{s.editUrl && (
					<Button size="sm" variant="outline" className="mt-2 w-full gap-1.5" onClick={() => navigator.clipboard.writeText(s.editUrl!).then(() => toast({ title: "Edit link copied" }))}><Copy className="h-4 w-4" /> Copy edit link</Button>
				)}
			</div>
		</div>
	);
}
