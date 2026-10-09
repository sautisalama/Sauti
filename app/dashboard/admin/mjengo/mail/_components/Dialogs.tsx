"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addAccount, deleteSnippet, removeAccount, saveSnippet, type AccountView, type SnippetRow, type ViewConfig, type ViewRow } from "@/app/actions/mjengo-mail";

const PROVIDERS = [
	{ id: "gmail", label: "Gmail / Google Workspace", hint: "Use an app password: Google Account > Security > 2-Step Verification > App passwords." },
	{ id: "outlook", label: "Outlook / Microsoft 365", hint: "Your organisation must allow IMAP and SMTP sign-in. Use an app password if 2-step is on." },
	{ id: "zoho", label: "Zoho Mail", hint: "" },
	{ id: "yahoo", label: "Yahoo Mail", hint: "Use an app password." },
	{ id: "custom", label: "Other (IMAP / SMTP)", hint: "Ask your email host for the server names." },
] as const;

export function ConnectDialog({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: (a: AccountView) => void }) {
	const { toast } = useToast();
	const [preset, setPreset] = useState<(typeof PROVIDERS)[number]["id"]>("gmail");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [imapHost, setImapHost] = useState("");
	const [smtpHost, setSmtpHost] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const hint = PROVIDERS.find((p) => p.id === preset)?.hint;

	const connect = async () => {
		setBusy(true);
		setError(null);
		try {
			const a = await addAccount({ preset, email, password, imapHost, smtpHost });
			setPassword("");
			onConnected(a);
			toast({ title: "Mailbox connected", description: a.email });
			onClose();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not connect.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Connect a mailbox</DialogTitle>
					<DialogDescription>We check that you can both read and send before saving. The password is encrypted and only used to reach your mailbox.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
						{PROVIDERS.map((p) => (
							<button key={p.id} onClick={() => setPreset(p.id)} aria-pressed={preset === p.id} className={cn("touch-manipulation rounded-xl border px-3 py-2 text-left text-sm", preset === p.id ? "border-purple-600 bg-purple-50 font-semibold text-purple-900" : "border-serene-neutral-200 hover:bg-serene-neutral-50")}>{p.label}</button>
						))}
					</div>
					<div className="space-y-1.5"><Label htmlFor="mb-email">Email address</Label><Input id="mb-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@sautisalama.org" /></div>
					<div className="space-y-1.5"><Label htmlFor="mb-pass">Password or app password</Label><Input id="mb-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
					{preset === "custom" && (
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5"><Label htmlFor="mb-imap">IMAP server</Label><Input id="mb-imap" value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.example.com" /></div>
							<div className="space-y-1.5"><Label htmlFor="mb-smtp">SMTP server</Label><Input id="mb-smtp" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" /></div>
						</div>
					)}
					{hint && <p className="rounded-lg bg-serene-neutral-50 p-3 text-xs text-serene-neutral-600">{hint}</p>}
					{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
					<Button onClick={connect} disabled={busy || !email || !password} className="w-full gap-2 bg-purple-600 hover:bg-purple-700">{busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Checking your mailbox..." : "Connect"}</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

const MAILBOXES: { v: ViewConfig["mailbox"]; l: string }[] = [
	{ v: "inbox", l: "Inbox" }, { v: "sent", l: "Sent" }, { v: "drafts", l: "Drafts" }, { v: "archive", l: "Archive" }, { v: "trash", l: "Trash" }, { v: "spam", l: "Spam" },
];
const ICONS = ["inbox", "star", "paperclip", "user", "tag", "flag"];

/** Like Notion Mail's view editor: a name, what to show, how to group it and which hover actions appear. */
export function ViewDialog({ view, onClose, onSave, onDelete }: { view: Partial<ViewRow> | null; onClose: () => void; onSave: (v: { id: string | null; name: string; icon: string; config: ViewConfig }) => Promise<void>; onDelete?: (id: string) => Promise<void> }) {
	const [name, setName] = useState(view?.name ?? "");
	const [icon, setIcon] = useState(view?.icon ?? "inbox");
	const [cfg, setCfg] = useState<ViewConfig>({ mailbox: "inbox", group: "date", hoverActions: ["archive", "trash", "unread", "star"], ...(view?.config ?? {}) });
	const [busy, setBusy] = useState(false);
	const actions = cfg.hoverActions ?? [];
	const toggleAction = (a: NonNullable<ViewConfig["hoverActions"]>[number]) => setCfg({ ...cfg, hoverActions: actions.includes(a) ? actions.filter((x) => x !== a) : [...actions, a] });

	return (
		<Dialog open={!!view} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader><DialogTitle>{view?.id ? "Edit view" : "New view"}</DialogTitle><DialogDescription>A view is a saved way of looking at your mail. It applies to existing and new messages.</DialogDescription></DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Funder emails" autoFocus /></div>
					<div className="flex flex-wrap gap-1.5">{ICONS.map((i) => <button key={i} onClick={() => setIcon(i)} aria-pressed={icon === i} className={cn("rounded-lg border px-2.5 py-1 text-xs capitalize", icon === i ? "border-purple-600 bg-purple-50" : "border-serene-neutral-200")}>{i}</button>)}</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5"><Label>Folder</Label>
							<Select value={cfg.mailbox} onValueChange={(v) => setCfg({ ...cfg, mailbox: v as ViewConfig["mailbox"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MAILBOXES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent></Select>
						</div>
						<div className="space-y-1.5"><Label>Group by</Label>
							<Select value={cfg.group ?? "date"} onValueChange={(v) => setCfg({ ...cfg, group: v as ViewConfig["group"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date">Date</SelectItem><SelectItem value="sender">Sender</SelectItem><SelectItem value="none">No grouping</SelectItem></SelectContent></Select>
						</div>
					</div>
					<div className="space-y-1.5"><Label>From contains</Label><Input value={cfg.from ?? ""} onChange={(e) => setCfg({ ...cfg, from: e.target.value })} placeholder="e.g. @fordfoundation.org" /></div>
					<div className="space-y-2.5 rounded-xl border border-serene-neutral-100 p-3">
						{([["unread", "Only unread"], ["starred", "Only starred"], ["hasAttachment", "Only with attachments"]] as const).map(([k, l]) => (
							<label key={k} className="flex items-center justify-between text-sm">{l}<Switch checked={!!cfg[k]} onCheckedChange={(v) => setCfg({ ...cfg, [k]: v })} /></label>
						))}
					</div>
					<div>
						<Label>Hover actions</Label>
						<div className="mt-1.5 flex flex-wrap gap-1.5">{(["archive", "trash", "unread", "star", "reply"] as const).map((a) => <button key={a} onClick={() => toggleAction(a)} aria-pressed={actions.includes(a)} className={cn("rounded-full border px-3 py-1 text-xs capitalize", actions.includes(a) ? "border-purple-600 bg-purple-600 text-white" : "border-serene-neutral-200")}>{a}</button>)}</div>
					</div>
					<div className="flex items-center gap-2">
						{view?.id && onDelete && <Button variant="ghost" className="gap-1.5 text-red-600" onClick={async () => { if (window.confirm("Delete this view? Your mail is not affected.")) { await onDelete(view.id!); onClose(); } }}><Trash2 className="h-4 w-4" /> Delete</Button>}
						<div className="flex-1" />
						<Button variant="ghost" onClick={onClose}>Cancel</Button>
						<Button disabled={busy || !name.trim()} className="gap-1.5 bg-purple-600 hover:bg-purple-700" onClick={async () => { setBusy(true); try { await onSave({ id: view?.id ?? null, name, icon, config: cfg }); onClose(); } finally { setBusy(false); } }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save view</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

/** Accounts, layout of the reading pane and snippets. */
export function SettingsDialog({ open, onClose, accounts, onAccountsChanged, onConnect, snippets, onSnippetsChanged, layout, onLayout }: {
	open: boolean; onClose: () => void; accounts: AccountView[]; onAccountsChanged: () => void; onConnect: () => void; snippets: SnippetRow[]; onSnippetsChanged: () => void; layout: "side" | "center" | "full"; onLayout: (l: "side" | "center" | "full") => void;
}) {
	const { toast } = useToast();
	const [name, setName] = useState("");
	const [body, setBody] = useState("");
	const [busy, setBusy] = useState(false);

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
				<DialogHeader><DialogTitle>Mail settings</DialogTitle></DialogHeader>
				<section className="space-y-2">
					<h3 className="text-sm font-bold">Open messages as</h3>
					<div className="grid grid-cols-3 gap-2">
						{([["side", "Side peek"], ["center", "Center peek"], ["full", "Full page"]] as const).map(([v, l]) => (
							<button key={v} onClick={() => onLayout(v)} aria-pressed={layout === v} className={cn("rounded-xl border px-3 py-2 text-sm", layout === v ? "border-purple-600 bg-purple-50 font-semibold text-purple-900" : "border-serene-neutral-200 hover:bg-serene-neutral-50")}>{l}</button>
						))}
					</div>
				</section>
				<section className="space-y-2">
					<div className="flex items-center justify-between"><h3 className="text-sm font-bold">Mailboxes</h3><Button size="sm" variant="outline" className="gap-1.5" onClick={onConnect}><Plus className="h-4 w-4" /> Connect</Button></div>
					<ul className="divide-y divide-serene-neutral-100 rounded-xl border border-serene-neutral-100">
						{accounts.map((a) => (
							<li key={a.id} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.email}</p></div>
								<Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { if (window.confirm(`Disconnect ${a.email}? Your email stays in the mailbox.`)) { await removeAccount(a.id); onAccountsChanged(); } }}>Disconnect</Button>
							</li>
						))}
						{accounts.length === 0 && <li className="p-3 text-sm text-serene-neutral-500">None connected.</li>}
					</ul>
				</section>
				<section className="space-y-2">
					<h3 className="text-sm font-bold">Snippets</h3>
					<p className="text-xs text-serene-neutral-500">Reusable text. In a message, type / and pick the snippet.</p>
					<ul className="divide-y divide-serene-neutral-100 rounded-xl border border-serene-neutral-100">
						{snippets.map((s) => (
							<li key={s.id} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{s.name}</p><p className="truncate text-xs text-serene-neutral-500" dangerouslySetInnerHTML={{ __html: "" }} /></div>
								<Button size="icon" variant="ghost" aria-label={`Delete ${s.name}`} onClick={async () => { await deleteSnippet(s.id); onSnippetsChanged(); }}><Trash2 className="h-4 w-4" /></Button>
							</li>
						))}
					</ul>
					<div className="space-y-2 rounded-xl border border-dashed border-serene-neutral-200 p-3">
						<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Snippet name, e.g. Intro" />
						<Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="The text to insert" />
						<Button size="sm" disabled={busy || !name.trim() || !body.trim()} onClick={async () => {
							setBusy(true);
							try {
								const html = body.split(/\n{2,}/).map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!).replace(/\n/g, "<br>")}</p>`).join("");
								await saveSnippet(null, name, html);
								setName(""); setBody(""); onSnippetsChanged();
							} catch (e) { toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
						}}>Save snippet</Button>
					</div>
				</section>
			</DialogContent>
		</Dialog>
	);
}
