"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Copy, FileText, History, Link2, Plus, Share2, Tag, Users, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { fileMeta, setFileMeta, type FileMeta } from "../../vault/api";

const initials = (n: string) => n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

/**
 * The top of a document: name, labels, the people who have it as overlapping photos, and Share. The File menu
 * holds access, labels, the meeting it belongs to and version history, so nothing floats over the page.
 */
export function DocBar({ fileId, name, canShare, refreshKey, onShare, onHistory }: { fileId: string; name: string; canShare: boolean; refreshKey: number; onShare: () => void; onHistory: () => void }) {
	const { toast } = useToast();
	const [meta, setMeta] = useState<FileMeta | null>(null);
	const [details, setDetails] = useState(false);
	const [copied, setCopied] = useState(false);
	const [tags, setTags] = useState<string[]>([]);
	const [draft, setDraft] = useState("");
	const [meeting, setMeeting] = useState("");
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		try { const m = await fileMeta(fileId); setMeta(m); setTags(m.tags); setMeeting(m.meetingCode ?? ""); } catch { /* the bar still works without it */ }
	}, [fileId]);
	useEffect(() => { void load(); }, [load, refreshKey]);

	const link = () => `${window.location.origin}/dashboard/mjengo/documents/editor?file=${fileId}`;
	const copy = () => navigator.clipboard.writeText(link()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); toast({ title: "Link copied", description: "People with access who open it edit this same document, live." }); }).catch(() => undefined);
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
			setDetails(false);
			toast({ title: "Details saved" });
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setSaving(false);
		}
	};

	const everyone = meta ? [{ id: meta.owner.id, name: meta.owner.name, avatar: meta.owner.avatar, owner: true }, ...meta.people.map((p) => ({ ...p, owner: false }))] : [];
	const shown = everyone.slice(0, 4);

	return (
		<>
			<div className="hidden h-12 shrink-0 items-center gap-2 border-b border-black/10 bg-white px-3 sm:flex">
				<button onClick={() => window.history.back()} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full text-[#37352f] hover:bg-black/5"><ArrowLeft className="h-4 w-4" /></button>
				<FileText className="h-4 w-4 shrink-0 text-sauti-teal" />
				<span className="min-w-0 max-w-[26rem] truncate text-sm font-semibold text-[#37352f]">{name}</span>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button className="flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium text-[#5f5e5b] hover:bg-black/5">File <ChevronDown className="h-3.5 w-3.5" /></button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-60">
						{canShare && <DropdownMenuItem onClick={onShare}><Users className="mr-2 h-4 w-4" /> Manage access</DropdownMenuItem>}
						<DropdownMenuItem onClick={copy}><Link2 className="mr-2 h-4 w-4" /> Copy link</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => setDetails(true)}><Tag className="mr-2 h-4 w-4" /> Labels and meeting</DropdownMenuItem>
						<DropdownMenuItem onClick={onHistory}><History className="mr-2 h-4 w-4" /> Version history</DropdownMenuItem>
						{meta?.meetingCode && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => window.open(`/meet/${meta.meetingCode}`, "_blank", "noopener")}><Video className="mr-2 h-4 w-4" /> Open the meeting</DropdownMenuItem></>}
					</DropdownMenuContent>
				</DropdownMenu>

				<div className="ml-1 flex min-w-0 items-center gap-1.5 overflow-hidden">
					{(meta?.tags ?? []).slice(0, 4).map((t) => <span key={t} className="shrink-0 rounded-full bg-sauti-teal-light px-2.5 py-0.5 text-xs font-medium text-sauti-teal">{t}</span>)}
					{meta?.meetingCode && (
						<a href={`/meet/${meta.meetingCode}`} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100"><Video className="h-3 w-3" /> Meeting</a>
					)}
					{canEdit && <button onClick={() => setDetails(true)} aria-label="Add a label" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#9b9a97] hover:bg-black/5"><Plus className="h-3.5 w-3.5" /></button>}
				</div>

				<span className="flex-1" />

				{shown.length > 0 && (
					<button onClick={canShare ? onShare : undefined} aria-label={`${everyone.length} ${everyone.length === 1 ? "person has" : "people have"} access`} title={everyone.map((p) => p.name).join(", ")} className="flex items-center rounded-full p-1 hover:bg-black/5">
						<span className="flex -space-x-2">
							{shown.map((p) => (
								<span key={p.id} className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-sauti-teal-light text-[11px] font-bold text-sauti-teal ring-2 ring-white">
									{p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : initials(p.name)}
								</span>
							))}
							{everyone.length > shown.length && <span className="flex h-8 w-8 items-center justify-center rounded-full bg-serene-neutral-100 text-[11px] font-bold text-serene-neutral-600 ring-2 ring-white">+{everyone.length - shown.length}</span>}
						</span>
					</button>
				)}
				<button onClick={copy} aria-label="Copy link" title="Copy link" className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[#37352f] hover:bg-[#f7f7f5]">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
				{canShare && <Button onClick={onShare} className={cn("h-9 gap-1.5 rounded-full bg-sauti-teal px-4 text-sm font-semibold hover:bg-sauti-dark")}><Share2 className="h-4 w-4" /> Share{meta && meta.linkAccess !== "off" ? "" : ""}</Button>}
			</div>

			<Dialog open={details} onOpenChange={setDetails}>
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
						<Button variant="outline" onClick={() => setDetails(false)}>Cancel</Button>
						<Button disabled={!canEdit || saving} onClick={save} className="bg-sauti-teal hover:bg-sauti-dark">Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
