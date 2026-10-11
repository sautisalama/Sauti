"use client";

import { useCallback, useEffect, useState } from "react";
import { FilePlus2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { deleteTemplate, listTemplates, saveTemplate, type TemplateKind, type TemplateRow } from "@/app/actions/mjengo-templates";

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
/** Plain text (blank lines between paragraphs) to the HTML a template keeps. */
export const textToHtml = (t: string) => t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const htmlToText = (h: string) => h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|h\d|li|tr)>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();

/**
 * Pick a starting point, or add and change the team's own. Used for new documents and for posts.
 * `onPick(null)` means start blank.
 */
export function TemplatePicker({ kind, open, onClose, onPick, title, blankLabel }: { kind: TemplateKind; open: boolean; onClose: () => void; onPick: (t: TemplateRow | null) => void; title: string; blankLabel?: string }) {
	const { toast } = useToast();
	const [list, setList] = useState<TemplateRow[] | null>(null);
	const [edit, setEdit] = useState<{ id: string | null; name: string; description: string; body: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => setList(await unwrap(listTemplates(kind)).catch(() => [])), [kind]);
	useEffect(() => { if (open) { setEdit(null); load(); } }, [open, load]);

	return (
		<Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
				<DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Start from a template, or add your own for the whole team.</DialogDescription></DialogHeader>
				{edit ? (
					<div className="space-y-3">
						<Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Template name" autoFocus />
						<Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="What it is for (optional)" />
						<Textarea rows={10} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} placeholder="The text. Leave a blank line between paragraphs." />
						<DialogFooter>
							<Button variant="outline" onClick={() => setEdit(null)} disabled={busy}>Back</Button>
							<Button
								className="gap-2 bg-sauti-teal hover:bg-sauti-dark"
								disabled={busy || !edit.name.trim()}
								onClick={async () => {
									setBusy(true);
									try {
										await unwrap(saveTemplate(edit.id, { kind, name: edit.name, description: edit.description, body: kind === "document" ? textToHtml(edit.body) : edit.body }));
										await load();
										setEdit(null);
									} catch (e) {
										toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
									} finally {
										setBusy(false);
									}
								}}
							>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save template</Button>
						</DialogFooter>
					</div>
				) : (
					<div className="space-y-3">
						<div className="grid gap-2 sm:grid-cols-2">
							{blankLabel && (
								<button onClick={() => onPick(null)} className="flex items-center gap-3 rounded-xl border border-dashed border-serene-neutral-300 p-3 text-left hover:border-sauti-teal/50 hover:bg-sauti-teal-light/20">
									<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-serene-neutral-100"><FilePlus2 className="h-5 w-5 text-serene-neutral-600" /></span>
									<span><span className="block text-sm font-semibold">{blankLabel}</span><span className="block text-xs text-serene-neutral-500">Nothing on the page yet</span></span>
								</button>
							)}
							{list === null && <p className="col-span-full py-6 text-center text-sm text-serene-neutral-500">Loading...</p>}
							{list?.map((t) => (
								<div key={t.id} className="group relative rounded-xl border border-serene-neutral-200 p-3 hover:border-sauti-teal/50">
									<button onClick={() => onPick(t)} className="block w-full text-left">
										<span className="block text-sm font-semibold">{t.name}</span>
										<span className="block text-xs text-serene-neutral-500">{t.description || (t.builtin ? "Built in" : "Your team's")}</span>
									</button>
									{!t.builtin && (
										<span className="absolute right-1.5 top-1.5 hidden gap-0.5 group-hover:flex">
											<button aria-label={`Edit ${t.name}`} onClick={() => setEdit({ id: t.id, name: t.name, description: t.description, body: kind === "document" ? htmlToText(t.body) : t.body })} className="flex h-7 w-7 items-center justify-center rounded-md bg-white shadow hover:bg-serene-neutral-50"><Pencil className="h-3.5 w-3.5" /></button>
											<button aria-label={`Delete ${t.name}`} onClick={async () => { if (window.confirm(`Delete ${t.name}?`)) { await unwrap(deleteTemplate(t.id)).catch(() => undefined); load(); } }} className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-red-600 shadow hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
										</span>
									)}
								</div>
							))}
						</div>
						<Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEdit({ id: null, name: "", description: "", body: "" })}><Plus className="h-4 w-4" /> Add a template</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
