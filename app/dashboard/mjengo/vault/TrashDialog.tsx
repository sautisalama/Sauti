"use client";

import { useCallback, useEffect, useState } from "react";
import { Folder, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { unwrap } from "@/lib/action-result";
import { deleteForever, emptyTrash, listTrash, restoreItem, type TrashItem } from "@/app/actions/vault";
import { useToast } from "@/hooks/use-toast";

/** What was deleted in the last 21 days: bring it back, or delete it for good. After 21 days it goes by itself. */
export function TrashDialog({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
	const { toast } = useToast();
	const [items, setItems] = useState<TrashItem[] | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [confirmEmpty, setConfirmEmpty] = useState(false);

	const load = useCallback(async () => {
		try { setItems(await unwrap(listTrash())); } catch (e) { setItems([]); toast({ title: "Could not open the trash", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
	}, [toast]);
	useEffect(() => { if (open) { setItems(null); setConfirmEmpty(false); void load(); } }, [open, load]);

	const run = async (key: string, job: () => Promise<unknown>, done: string) => {
		setBusy(key);
		try { await job(); toast({ title: done }); await load(); onChanged(); }
		catch (e) { toast({ title: "That did not work", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
		setBusy(null);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>Trash</DialogTitle>
					<DialogDescription>Deleted files stay here for 21 days, then they are removed for good.</DialogDescription>
				</DialogHeader>
				{items === null ? (
					<div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" /></div>
				) : items.length === 0 ? (
					<p className="py-10 text-center text-sm text-serene-neutral-500">The trash is empty.</p>
				) : (
					<>
						<ul className="max-h-[50vh] divide-y divide-serene-neutral-100 overflow-y-auto rounded-xl border border-serene-neutral-200">
							{items.map((i) => (
								<li key={`${i.type}-${i.id}`} className="flex items-center gap-3 px-3 py-2.5">
									{i.type === "folder" ? <Folder className="h-4 w-4 shrink-0 text-serene-neutral-500" /> : <span className="h-4 w-4 shrink-0" />}
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-medium text-serene-neutral-900">{i.name}</span>
										<span className="block truncate text-xs text-serene-neutral-500">
											From {i.location}{i.type === "folder" && i.contains ? ` · ${i.contains} item${i.contains === 1 ? "" : "s"} inside` : ""} · {i.daysLeft === 0 ? "removed today" : `${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"} left`}
										</span>
									</span>
									<Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(i.id, () => unwrap(restoreItem(i.type, i.id)), "Restored")}>
										{busy === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}<span className="ml-1.5">Restore</span>
									</Button>
									<Button size="icon" variant="ghost" disabled={!!busy} aria-label={`Delete ${i.name} for good`} title="Delete for good" className="text-red-600 hover:bg-red-50" onClick={() => run(i.id, () => unwrap(deleteForever(i.type, i.id)), "Deleted for good")}>
										<Trash2 className="h-4 w-4" />
									</Button>
								</li>
							))}
						</ul>
						<div className="flex justify-end">
							{confirmEmpty ? (
								<span className="flex items-center gap-2 text-sm">
									<span className="text-serene-neutral-600">Delete everything here for good?</span>
									<Button size="sm" className="bg-red-600 hover:bg-red-700" disabled={!!busy} onClick={() => run("all", () => unwrap(emptyTrash()), "Trash emptied")}>Empty trash</Button>
									<Button size="sm" variant="ghost" onClick={() => setConfirmEmpty(false)}>Keep</Button>
								</span>
							) : (
								<Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmEmpty(true)}>Empty trash</Button>
							)}
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
