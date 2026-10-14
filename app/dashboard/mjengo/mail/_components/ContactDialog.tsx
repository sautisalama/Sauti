"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { unwrap } from "@/lib/action-result";
import { useToast } from "@/hooks/use-toast";
import { addContactDetailed, suggestOrganisation } from "@/app/actions/mjengo-contacts";

export interface ContactDraft { name: string; email: string; /** The text of the email they wrote, to read the organisation from. */ context?: string }

/**
 * Opened by double-clicking someone in an email: add them to the contacts. Their organisation is worked out
 * from their signature or their email domain and can be changed before saving; "Write an email" goes straight
 * to a new message to them.
 */
export function ContactDialog({ draft, onClose, onWrite }: { draft: ContactDraft | null; onClose: () => void; onWrite: (address: string) => void }) {
	const { toast } = useToast();
	const [name, setName] = useState("");
	const [org, setOrg] = useState("");
	const [title, setTitle] = useState("");
	const [guessing, setGuessing] = useState(false);
	const [guess, setGuess] = useState<"text" | "domain" | "none" | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!draft) return;
		setName(draft.name || ""); setOrg(""); setTitle(""); setGuess(null);
		let live = true;
		setGuessing(true);
		unwrap(suggestOrganisation(draft.name, draft.email, draft.context))
			.then((r) => { if (!live) return; setOrg((cur) => cur || r.organisation); setTitle((cur) => cur || r.title || ""); setGuess(r.source); })
			.catch(() => undefined)
			.finally(() => live && setGuessing(false));
		return () => { live = false; };
	}, [draft]);

	const add = async () => {
		if (!draft) return;
		setBusy(true);
		try {
			const c = await unwrap(addContactDetailed({ name, email: draft.email, organisation: org, title }));
			toast({ title: c.source === "mail" ? "Added to contacts" : "Already in your contacts", description: `${c.name} <${draft.email}>` });
			onClose();
		} catch (e) {
			toast({ title: "Could not add the contact", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={!!draft} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Add to contacts?</DialogTitle>
					<DialogDescription>{draft?.email}</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<label className="block text-xs font-medium text-serene-neutral-600">Name<Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></label>
					<label className="block text-xs font-medium text-serene-neutral-600">
						<span className="flex items-center gap-2">Organisation {guessing && <Loader2 className="h-3 w-3 animate-spin" />}{!guessing && guess === "text" && <span className="font-normal text-serene-neutral-500">found in their email</span>}{!guessing && guess === "domain" && <span className="font-normal text-serene-neutral-500">guessed from their address</span>}</span>
						<Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder={guessing ? "Looking…" : "Organisation"} className="mt-1" />
					</label>
					{(title || guess === "text") && (
						<label className="block text-xs font-medium text-serene-neutral-600">Job title<Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" /></label>
					)}
				</div>
				<DialogFooter className="gap-2 sm:justify-between">
					<Button type="button" variant="outline" className="min-w-0 gap-1.5" onClick={() => { if (draft) { onWrite(draft.email); onClose(); } }}><Mail className="h-4 w-4" /> Write an email</Button>
					<div className="flex gap-2">
						<Button type="button" variant="ghost" className="min-w-0" onClick={onClose} disabled={busy}>Cancel</Button>
						<Button type="button" className="min-w-0 gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => void add()} disabled={busy || !name.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
