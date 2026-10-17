"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fileMeta, setFileMeta, type FileMeta } from "../../vault/api";

/**
 * The document's labels and meeting. The top bar, the people, Share and the File menu all belong to the editor
 * now; this is only the dialog behind File › Labels and meeting, and it hands the details up for the menu.
 */
export function DocDetails({ fileId, refreshKey, open, onOpenChange, onMeta }: { fileId: string; refreshKey: number; open: boolean; onOpenChange: (open: boolean) => void; onMeta: (meta: FileMeta | null) => void }) {
	const { toast } = useToast();
	const [meta, setMeta] = useState<FileMeta | null>(null);
	const [tags, setTags] = useState<string[]>([]);
	const [draft, setDraft] = useState("");
	const [meeting, setMeeting] = useState("");
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		try {
			const m = await fileMeta(fileId);
			setMeta(m);
			setTags(m.tags);
			setMeeting(m.meetingCode ?? "");
			onMeta(m);
		} catch { /* the menu still works without it */ }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileId]);
	useEffect(() => { void load(); }, [load, refreshKey]);

	const canEdit = meta?.level === "edit";
	const addTag = () => {
		const t = draft.trim().slice(0, 30);
		if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) setTags([...tags, t]);
		setDraft("");
	};
	const save = async () => {
		setSaving(true);
		try {
			await setFileMeta(fileId, { tags, meetingCode: meeting.trim() || null });
			await load();
			onOpenChange(false);
			toast({ title: "Details saved" });
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Labels and meeting</DialogTitle>
					<DialogDescription>Labels help you find this document. Tag a meeting so it sits with that call and its notes.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<p className="mb-1.5 text-sm font-medium">Labels</p>
						<div className="mb-2 flex flex-wrap gap-1.5">
							{tags.map((t) => (
								<span key={t} className="flex items-center gap-1 rounded-full bg-sauti-teal-light py-0.5 pl-2.5 pr-1 text-xs font-medium text-sauti-teal">{t}<button aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} disabled={!canEdit} className="rounded-full p-0.5 hover:bg-black/10"><X className="h-3 w-3" /></button></span>
							))}
							{tags.length === 0 && <span className="text-xs text-serene-neutral-500">No labels yet.</span>}
						</div>
						<div className="flex gap-2">
							<Input value={draft} disabled={!canEdit} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }} placeholder="Add a label, for example Grant report" />
							<Button type="button" variant="outline" disabled={!canEdit || !draft.trim()} onClick={addTag}>Add</Button>
						</div>
					</div>
					<div>
						<p className="mb-1.5 text-sm font-medium">Meeting link</p>
						<Input value={meeting} disabled={!canEdit} onChange={(e) => setMeeting(e.target.value)} placeholder="Paste a meeting link or code, like abc-defg-hij" />
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button disabled={!canEdit || saving} onClick={save} className="bg-sauti-teal hover:bg-sauti-dark">Save</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
