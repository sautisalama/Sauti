"use client";

import { useState } from "react";
import { KeyRound, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { deleteMyAccount } from "@/app/actions/account";

/** Change password: asks for the current one first, so a borrowed phone cannot lock the owner out. */
export function ChangePasswordRow({ email }: { email: string | null }) {
	const { toast } = useToast();
	const [open, setOpen] = useState(false);
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [again, setAgain] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const reset = () => { setCurrent(""); setNext(""); setAgain(""); setError(null); };

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (next.length < 8) return setError("Use at least 8 characters.");
		if (next !== again) return setError("The new passwords do not match.");
		if (next === current) return setError("Choose a password you have not used here before.");
		if (!email) return setError("This account has no password to change (you sign in with Google).");
		setBusy(true);
		const supabase = createClient();
		const check = await supabase.auth.signInWithPassword({ email, password: current });
		if (check.error) { setBusy(false); return setError("Your current password is not right."); }
		const { error: updateError } = await supabase.auth.updateUser({ password: next });
		setBusy(false);
		if (updateError) return setError(updateError.message);
		toast({ title: "Password changed", description: "Use your new password next time you sign in." });
		setOpen(false);
		reset();
	}

	return (
		<>
			<button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors duration-150 hover:bg-serene-neutral-50">
				<span className="space-y-0.5">
					<span className="flex items-center gap-2 text-sm font-medium"><KeyRound className="size-4 text-neutral-500" /> Change password</span>
					<span className="block text-xs text-neutral-500">Update your password. You will need your current one.</span>
				</span>
				<span className="text-xs font-semibold text-sauti-teal">Change</span>
			</button>
			<Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
				<DialogContent className="rounded-2xl sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Change your password</DialogTitle>
						<DialogDescription>Choose a strong password you will remember. Nobody at Sauti Salama can see it.</DialogDescription>
					</DialogHeader>
					<form onSubmit={submit} className="space-y-4">
						<div className="space-y-1.5"><Label htmlFor="cp-current">Current password</Label><Input id="cp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
						<div className="space-y-1.5"><Label htmlFor="cp-new">New password</Label><Input id="cp-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
						<div className="space-y-1.5"><Label htmlFor="cp-again">Repeat new password</Label><Input id="cp-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></div>
						{error && <p role="alert" className="rounded-xl bg-sauti-red-light p-3 text-sm text-sauti-red">{error}</p>}
						<DialogFooter className="gap-2 sm:gap-2">
							<Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
							<Button type="submit" disabled={busy || !current || !next || !again} className="bg-sauti-teal text-white hover:bg-sauti-dark">{busy ? <><Loader2 className="mr-2 size-4 animate-spin" /> Saving…</> : "Change password"}</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}

/** Permanent account deletion. Needs the word DELETE so it cannot happen by a stray tap. */
export function DeleteAccountCard({ isAnonymous, isProvider }: { isAnonymous: boolean; isProvider: boolean }) {
	const { toast } = useToast();
	const [open, setOpen] = useState(false);
	const [word, setWord] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function remove() {
		setBusy(true);
		setError(null);
		const res = await deleteMyAccount(word);
		if (!res.ok) { setBusy(false); return setError(res.error); }
		await createClient().auth.signOut().catch(() => undefined);
		try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
		toast({ title: "Your account has been deleted" });
		window.location.replace("/?account=deleted");
	}

	return (
		<>
			<div className="rounded-2xl border border-sauti-red/20 bg-sauti-red-light/40 p-5">
				<h3 className="flex items-center gap-2 text-sm font-semibold text-sauti-red"><TriangleAlert className="size-4" /> Delete my account</h3>
				<p className="mt-1 text-sm text-serene-neutral-600">
					{isAnonymous ? "This removes your private account, your reports, voice notes and messages for good." : "This removes your account, reports, voice notes, appointments, learning progress and certificates for good."} It cannot be undone.
				</p>
				<Button variant="outline" onClick={() => setOpen(true)} className="mt-3 border-sauti-red/30 text-sauti-red transition-[transform,background-color] duration-150 ease-out hover:bg-sauti-red-light active:scale-[0.98]">
					<Trash2 className="mr-2 size-4" /> Delete account
				</Button>
			</div>
			<Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setWord(""); setError(null); } }}>
				<DialogContent className="rounded-2xl sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete your account?</DialogTitle>
						<DialogDescription>
							This is permanent. {isProvider ? "Cases you are handling will be cancelled, and the survivors will be told and matched with someone else. " : "Anyone helping you will no longer be able to see your case. "}
							You can always report again later with a new account.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-1.5">
						<Label htmlFor="del-word">Type <b>DELETE</b> to confirm</Label>
						<Input id="del-word" autoComplete="off" value={word} onChange={(e) => setWord(e.target.value)} placeholder="DELETE" />
					</div>
					{error && <p role="alert" className="rounded-xl bg-sauti-red-light p-3 text-sm text-sauti-red">{error}</p>}
					<DialogFooter className="gap-2 sm:gap-2">
						<Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Keep my account</Button>
						<Button onClick={remove} disabled={busy || word.trim().toUpperCase() !== "DELETE"} className="bg-sauti-red text-white hover:bg-sauti-red/90">
							{busy ? <><Loader2 className="mr-2 size-4 animate-spin" /> Deleting…</> : "Delete everything"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
