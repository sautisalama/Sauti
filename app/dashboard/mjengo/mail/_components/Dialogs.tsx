"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { confirmAutoLabel, previewAutoLabel, type AutoLabelMatch, type LabelRow } from "./api";
import { clearMailCache } from "@/lib/mail/offline-cache";
import { SignatureSettings } from "./SignatureEditor";
import { addAccount, detectMailbox, oauthAvailability, deleteSnippet, removeAccount, saveSnippet, getAccountServers, updateAccountServers, saveMailPrefs, type AccountView, type AccountServers, type MailPrefs, type SnippetRow, type ViewConfig, type ViewRow } from "./api";

type Found = Awaited<ReturnType<typeof detectMailbox>>;

/**
 * Email first: type the address, we work out the provider and servers. Gmail and Outlook get one-click
 * sign-in; every other mailbox just needs its password. Server names only appear if detection fails.
 */
export function ConnectDialog({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: (a: AccountView) => void }) {
	const { toast } = useToast();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [found, setFound] = useState<Found | null>(null);
	const [detecting, setDetecting] = useState(false);
	const [usePassword, setUsePassword] = useState(false);
	const [advanced, setAdvanced] = useState(false);
	const [protocol, setProtocol] = useState<"imap" | "pop3">("imap");
	const [imapHost, setImapHost] = useState("");
	const [smtpHost, setSmtpHost] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [googleReady, setGoogleReady] = useState<boolean | null>(null);

	useEffect(() => {
		if (!open) return;
		setFound(null);
		setPassword("");
		setError(null);
		setUsePassword(false);
		setAdvanced(false);
		oauthAvailability().then((o) => { setGoogleReady(o.google); setEmail((cur) => cur || o.myEmail); }).catch(() => setGoogleReady(false));
	}, [open]);

	const detect = async () => {
		setDetecting(true);
		setError(null);
		try {
			const d = await detectMailbox(email.trim());
			setFound(d);
			setAdvanced(!d.imap || !d.smtp);
			setUsePassword(d.kind === "password" || !d.oauthReady);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not look that address up.");
		} finally {
			setDetecting(false);
		}
	};

	const connect = async () => {
		setBusy(true);
		setError(null);
		try {
			const manual = advanced && (!found?.imap || imapHost.trim());
			const a = await addAccount({
				preset: manual ? "custom" : "auto",
				protocol: found?.pop || manual ? protocol : "imap",
				email,
				password,
				imapHost,
				smtpHost,
			});
			setPassword("");
			onConnected(a);
			toast({ title: "Mailbox connected", description: a.email });
			onClose();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not connect.");
			// Something went wrong with the guessed servers: let them type their own.
			setAdvanced(true);
		} finally {
			setBusy(false);
		}
	};

	const oneClick = found && found.kind !== "password" && found.oauthReady && !usePassword;
	const brand = found?.kind === "google" ? "Google" : "Microsoft";

	return (
		<Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-h-[92vh] max-w-sm overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Add an email account</DialogTitle>
					<DialogDescription>Sign in with Google, or enter your email address and we take care of the rest.</DialogDescription>
				</DialogHeader>

				{!found && (
					<>
						<a
							href={googleReady ? `/api/mjengo/mail/oauth/google/start${email.includes("@") ? `?email=${encodeURIComponent(email.trim())}` : ""}` : undefined}
							aria-disabled={!googleReady}
							className={cn("flex min-h-11 items-center justify-center gap-3 rounded-xl border px-4 text-sm font-semibold transition", googleReady ? "border-serene-neutral-300 bg-white text-serene-neutral-900 hover:bg-serene-neutral-50" : "cursor-not-allowed border-serene-neutral-200 bg-serene-neutral-50 text-serene-neutral-400")}
						>
							<svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" /><path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" /></svg>
							Continue with Google
						</a>
						{googleReady === false && <p className="-mt-2 text-center text-xs text-serene-neutral-500">Google sign-in is not switched on for this site yet.</p>}
						<div className="flex items-center gap-3 text-xs text-serene-neutral-400"><span className="h-px flex-1 bg-serene-neutral-200" />or<span className="h-px flex-1 bg-serene-neutral-200" /></div>
					</>
				)}

				<form
					className="space-y-4"
					onSubmit={(e) => {
						e.preventDefault();
						if (!found) detect();
						else if (!oneClick) connect();
					}}
				>
					<div className="space-y-1.5">
						<Label htmlFor="mb-email">Email address</Label>
						<Input id="mb-email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setFound(null); }} placeholder="you@example.com" />
					</div>

					{!found && (
						<Button type="submit" disabled={detecting || !email.includes("@")} className="w-full gap-2 bg-sauti-teal hover:bg-sauti-dark">
							{detecting && <Loader2 className="h-4 w-4 animate-spin" />} Continue
						</Button>
					)}

					{found && (
						<>
							<p className="flex items-center gap-2 rounded-lg bg-serene-neutral-50 px-3 py-2 text-sm text-serene-neutral-700">
								<Check className="h-4 w-4 shrink-0 text-emerald-600" />
								<span>{found.label}{found.imap ? <span className="text-serene-neutral-400"> · {found.imap[0]}</span> : null}</span>
							</p>

							{oneClick && (
								<>
									<a
										href={`/api/mjengo/mail/oauth/${found.kind}/start?email=${encodeURIComponent(email.trim())}`}
										className="flex min-h-11 items-center justify-center gap-3 rounded-xl bg-sauti-teal px-4 text-sm font-semibold text-white hover:bg-sauti-dark"
									>
										Continue with {brand}
									</a>
									<button type="button" onClick={() => setUsePassword(true)} className="w-full text-center text-xs text-serene-neutral-500 underline">
										Use an app password instead
									</button>
								</>
							)}

							{!oneClick && (
								<>
									{found.kind !== "password" && !found.oauthReady && (
										<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">One-click {brand} sign-in is not switched on for this site yet. Use an app password. {found.hint}</p>
									)}
									{found.kind !== "password" && found.oauthReady && found.hint && <p className="rounded-lg bg-serene-neutral-50 p-3 text-xs text-serene-neutral-600">{found.hint}</p>}
									{found.kind === "password" && found.hint && <p className="rounded-lg bg-serene-neutral-50 p-3 text-xs text-serene-neutral-600">{found.hint}</p>}
									<div className="space-y-1.5">
										<Label htmlFor="mb-pass">{found.kind === "password" ? "Password" : "App password"}</Label>
										<PasswordInput id="mb-pass" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
									</div>

									<button type="button" onClick={() => setAdvanced((v) => !v)} className="text-xs text-serene-neutral-500 underline">{advanced ? "Hide" : "Show"} server settings</button>
									{advanced && (
										<div className="space-y-3 rounded-xl border border-serene-neutral-200 p-3">
											<div className="flex items-center gap-2 text-sm">
												<span className="text-serene-neutral-600">Read mail with</span>
												{(["imap", "pop3"] as const).map((pr) => (
													<button type="button" key={pr} onClick={() => setProtocol(pr)} aria-pressed={protocol === pr} className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase", protocol === pr ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-200")}>{pr}</button>
												))}
											</div>
											<div className="grid grid-cols-2 gap-3">
												<div className="space-y-1.5"><Label htmlFor="mb-imap">{protocol === "pop3" ? "POP3 server" : "IMAP server"}</Label><Input id="mb-imap" value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder={found.imap?.[0] ?? "mail.example.com"} /></div>
												<div className="space-y-1.5"><Label htmlFor="mb-smtp">SMTP server</Label><Input id="mb-smtp" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder={found.smtp?.[0] ?? "mail.example.com"} /></div>
											</div>
											{found.imap && <p className="text-xs text-serene-neutral-500">Leave these empty to use what we found.</p>}
											<button type="button" onClick={() => { setImapHost("mail.sautisalama.org"); setSmtpHost("mail.sautisalama.org"); }} className="text-xs text-sauti-teal underline">Use the Sauti Salama mail server (mail.sautisalama.org)</button>
										</div>
									)}

									{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
									<Button type="submit" disabled={busy || !password} className="w-full gap-2 bg-sauti-teal hover:bg-sauti-dark">
										{busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Checking your mailbox..." : "Connect"}
									</Button>
								</>
							)}
						</>
					)}

					{!found && error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
				</form>
			</DialogContent>
		</Dialog>
	);
}

const MAILBOXES: { v: ViewConfig["mailbox"]; l: string }[] = [
	{ v: "inbox", l: "Inbox" }, { v: "sent", l: "Sent" }, { v: "drafts", l: "Drafts" }, { v: "archive", l: "Archive" }, { v: "trash", l: "Trash" }, { v: "spam", l: "Spam" },
];
const ICONS = ["inbox", "star", "paperclip", "user", "tag", "flag"];

/** Like Notion Mail's view editor: a name, what to show, how to group it and which hover actions appear. */
export function ViewDialog({ view, labels = [], onClose, onSave, onDelete }: { view: Partial<ViewRow> | null; labels?: LabelRow[]; onClose: () => void; onSave: (v: { id: string | null; name: string; icon: string; config: ViewConfig }) => Promise<void>; onDelete?: (id: string) => Promise<void> }) {
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
					<div className="flex flex-wrap gap-1.5">{ICONS.map((i) => <button key={i} onClick={() => setIcon(i)} aria-pressed={icon === i} className={cn("rounded-lg border px-2.5 py-1 text-xs capitalize", icon === i ? "border-sauti-teal bg-sauti-teal-light/40" : "border-serene-neutral-200")}>{i}</button>)}</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5"><Label>Folder</Label>
							<Select value={cfg.mailbox} onValueChange={(v) => setCfg({ ...cfg, mailbox: v as ViewConfig["mailbox"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MAILBOXES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent></Select>
						</div>
						<div className="space-y-1.5"><Label>Group by</Label>
							<Select value={cfg.group ?? "date"} onValueChange={(v) => setCfg({ ...cfg, group: v as ViewConfig["group"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date">Date</SelectItem><SelectItem value="sender">Sender</SelectItem><SelectItem value="status">Read / unread</SelectItem><SelectItem value="none">No grouping</SelectItem></SelectContent></Select>
						</div>
					</div>
					{labels.length > 0 && (
						<div className="space-y-1.5"><Label>Label</Label>
							<Select value={cfg.labelId ?? "any"} onValueChange={(v) => setCfg({ ...cfg, labelId: v === "any" ? undefined : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">Any</SelectItem>{labels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
						</div>
					)}
					<div className="space-y-1.5"><Label>From contains</Label><Input value={cfg.from ?? ""} onChange={(e) => setCfg({ ...cfg, from: e.target.value })} placeholder="e.g. @fordfoundation.org" /></div>
					<div className="space-y-2.5 rounded-xl border border-serene-neutral-100 p-3">
						{([["unread", "Only unread"], ["starred", "Only starred"], ["hasAttachment", "Only with attachments"]] as const).map(([k, l]) => (
							<label key={k} className="flex items-center justify-between text-sm">{l}<Switch checked={!!cfg[k]} onCheckedChange={(v) => setCfg({ ...cfg, [k]: v })} /></label>
						))}
					</div>
					<div>
						<Label>Hover actions</Label>
						<div className="mt-1.5 flex flex-wrap gap-1.5">{(["archive", "trash", "unread", "star", "reply"] as const).map((a) => <button key={a} onClick={() => toggleAction(a)} aria-pressed={actions.includes(a)} className={cn("rounded-full border px-3 py-1 text-xs capitalize", actions.includes(a) ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-200")}>{a}</button>)}</div>
					</div>
					<div className="flex items-center gap-2">
						{view?.id && onDelete && <Button variant="ghost" className="gap-1.5 text-red-600" onClick={async () => { if (window.confirm("Delete this view? Your mail is not affected.")) { await onDelete(view.id!); onClose(); } }}><Trash2 className="h-4 w-4" /> Delete</Button>}
						<div className="flex-1" />
						<Button variant="ghost" onClick={onClose}>Cancel</Button>
						<Button disabled={busy || !name.trim()} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={async () => { setBusy(true); try { await onSave({ id: view?.id ?? null, name, icon, config: cfg }); onClose(); } finally { setBusy(false); } }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save view</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

type SettingsTab = "general" | "signature" | "labels" | "accounts" | "filters" | "templates";

/** Mail settings, laid out like Gmail's: General, Signature, Labels, Accounts and import, Filters and blocked, Templates. */
export function SettingsDialog({ open, onClose, accounts, onAccountsChanged, onConnect, snippets, onSnippetsChanged, layout, onLayout, signature = "", onSignatureSaved, prefs, onPrefs, labels = [], onEditLabel }: {
	signature?: string; onSignatureSaved?: (html: string) => void;
	open: boolean; onClose: () => void; accounts: AccountView[]; onAccountsChanged: () => void; onConnect: () => void; snippets: SnippetRow[]; onSnippetsChanged: () => void; layout: "side" | "center" | "full"; onLayout: (l: "side" | "center" | "full") => void;
	prefs: MailPrefs; onPrefs: (p: MailPrefs) => void; labels?: LabelRow[]; onEditLabel: (l: Partial<LabelRow>) => void;
}) {
	const { toast } = useToast();
	const [tab, setTab] = useState<SettingsTab>("general");
	const [name, setName] = useState("");
	const [body, setBody] = useState("");
	const [busy, setBusy] = useState(false);
	const [block, setBlock] = useState("");
	const [editing, setEditing] = useState<string | null>(null);

	const TABS: [SettingsTab, string][] = [["general", "General"], ["signature", "Signature"], ["labels", "Labels"], ["accounts", "Accounts and import"], ["filters", "Filters and blocked"], ["templates", "Templates"]];
	const row = "flex items-start justify-between gap-4 border-b border-black/[0.06] py-4";
	const change = async (patch: Partial<MailPrefs>) => {
		const next = { ...prefs, ...patch };
		onPrefs(next);
		try { await saveMailPrefs(next); } catch (e) { toast({ title: "Could not save the setting", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
	};
	const sel = "h-9 rounded-lg border border-black/10 bg-white px-2 text-sm";

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="flex h-[min(86vh,720px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:flex-row">
				<DialogHeader className="sr-only"><DialogTitle>Mail settings</DialogTitle></DialogHeader>
				<nav aria-label="Settings sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-black/[0.06] bg-[#f9f9f8] p-2 sm:w-52 sm:flex-col sm:border-b-0 sm:border-r">
					<p className="hidden px-3 pb-2 pt-3 text-base font-semibold text-[#37352f] sm:block">Settings</p>
					{TABS.map(([k, l]) => (
						<button key={k} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined} className={cn("shrink-0 rounded-lg px-3 py-2 text-left text-sm", tab === k ? "bg-sauti-teal-light/70 font-semibold text-sauti-dark" : "text-[#37352f] hover:bg-black/[0.05]")}>{l}</button>
					))}
				</nav>

				<div className="min-h-0 flex-1 overflow-y-auto p-5">
					{tab === "general" && (
						<div>
							<h3 className="text-lg font-semibold">General</h3>
							<div className={row}><div><p className="text-sm font-medium">Open messages as</p><p className="text-xs text-[#787774]">Where a message opens when you click it.</p></div>
								<select value={layout} onChange={(e) => onLayout(e.target.value as "side" | "center" | "full")} className={sel}><option value="side">Side peek</option><option value="center">Center peek</option><option value="full">Full page</option></select>
							</div>
							<div className={row}><div><p className="text-sm font-medium">Undo send</p><p className="text-xs text-[#787774]">How long you have to take a message back after pressing Send.</p></div>
								<select value={prefs.undoSeconds} onChange={(e) => change({ undoSeconds: Number(e.target.value) as MailPrefs["undoSeconds"] })} className={sel}>{[0, 5, 10, 20, 30].map((n) => <option key={n} value={n}>{n === 0 ? "Off" : `${n} seconds`}</option>)}</select>
							</div>
							<div className={row}><div><p className="text-sm font-medium">Default reply behaviour</p><p className="text-xs text-[#787774]">What the R shortcut and the main reply action do.</p></div>
								<select value={prefs.replyDefault} onChange={(e) => change({ replyDefault: e.target.value as MailPrefs["replyDefault"] })} className={sel}><option value="reply">Reply</option><option value="reply_all">Reply all</option></select>
							</div>
							<div className={row}><div><p className="text-sm font-medium">Conversation view</p><p className="text-xs text-[#787774]">Group messages with the same subject and show the thread count.</p></div>
								<Switch checked={prefs.conversationView} onCheckedChange={(v) => change({ conversationView: v })} />
							</div>
							<div className={row}><div><p className="text-sm font-medium">Density</p><p className="text-xs text-[#787774]">How tightly the message list is spaced.</p></div>
								<select value={prefs.density} onChange={(e) => change({ density: e.target.value as MailPrefs["density"] })} className={sel}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select>
							</div>
						</div>
					)}

					{tab === "signature" && (
						<div><h3 className="mb-2 text-lg font-semibold">Signature</h3>{open && <SignatureSettings initial={signature} onSaved={(h) => onSignatureSaved?.(h)} />}</div>
					)}

					{tab === "labels" && (
						<div className="space-y-3">
							<div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Labels</h3><Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEditLabel({})}><Plus className="h-4 w-4" /> Create new label</Button></div>
							<ul className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08]">
								{labels.map((l) => (
									<li key={l.id} className="flex items-center gap-3 p-3">
										<span className={cn("h-3 w-3 rounded-full", LABEL_COLORS[l.color]?.dot ?? "bg-sauti-teal")} />
										<span className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</span>
										<Button size="sm" variant="ghost" onClick={() => onEditLabel(l)}>Edit</Button>
									</li>
								))}
								{labels.length === 0 && <li className="p-4 text-sm text-[#787774]">No labels yet.</li>}
							</ul>
						</div>
					)}

					{tab === "accounts" && (
						<div className="space-y-3">
							<div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Accounts and import</h3><Button size="sm" variant="outline" className="gap-1.5" onClick={onConnect}><Plus className="h-4 w-4" /> Add a mail account</Button></div>
							<p className="text-xs text-[#787774]">Each mailbox can be read over IMAP or POP3 and sends over SMTP. Change the servers, ports and security here, like Gmail&apos;s Check mail from other accounts.</p>
							<ul className="space-y-2">
								{accounts.map((a) => (
									<li key={a.id} className="rounded-xl border border-black/[0.08]">
										<div className="flex items-center gap-3 p-3">
											<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.email}</p><p className="text-xs text-[#787774]">{a.auth_type === "password" ? a.protocol.toUpperCase() : `Signed in with ${a.auth_type === "google" ? "Google" : "Microsoft"}`}</p></div>
											<Button size="sm" variant="ghost" onClick={() => setEditing(editing === a.id ? null : a.id)}>{editing === a.id ? "Close" : "Edit settings"}</Button>
											<Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { if (window.confirm(`Disconnect ${a.email}? Your email stays in the mailbox.`)) { await removeAccount(a.id); clearMailCache(); onAccountsChanged(); } }}>Disconnect</Button>
										</div>
										{editing === a.id && <ServersForm id={a.id} onSaved={() => { clearMailCache(); onAccountsChanged(); }} />}
									</li>
								))}
								{accounts.length === 0 && <li className="rounded-xl border border-black/[0.08] p-4 text-sm text-[#787774]">None connected.</li>}
							</ul>
						</div>
					)}

					{tab === "filters" && (
						<div className="space-y-3">
							<h3 className="text-lg font-semibold">Filters and blocked addresses</h3>
							<p className="text-sm text-[#787774]">Messages from blocked senders are hidden from your lists. Add an address, or a whole domain such as @example.org.</p>
							<form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = block.trim().toLowerCase(); if (!v) return; setBlock(""); change({ blocked: [...new Set([...prefs.blocked, v])] }); }}>
								<Input value={block} onChange={(e) => setBlock(e.target.value)} placeholder="name@example.org or @example.org" aria-label="Address to block" />
								<Button type="submit" disabled={!block.trim()}>Block</Button>
							</form>
							<ul className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08]">
								{prefs.blocked.map((b) => (
									<li key={b} className="flex items-center gap-3 p-3 text-sm"><span className="min-w-0 flex-1 truncate">{b}</span><Button size="sm" variant="ghost" onClick={() => change({ blocked: prefs.blocked.filter((x) => x !== b) })}>Unblock</Button></li>
								))}
								{prefs.blocked.length === 0 && <li className="p-4 text-sm text-[#787774]">No blocked addresses.</li>}
							</ul>
							<p className="text-xs text-[#787774]">To sort mail automatically, create a label with a plain-language rule under Labels.</p>
						</div>
					)}

					{tab === "templates" && (
						<div className="space-y-2">
							<h3 className="text-lg font-semibold">Templates</h3>
							<p className="text-xs text-[#787774]">Reusable text. In a message, type / and pick the template.</p>
							<ul className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08]">
								{snippets.map((s) => (
									<li key={s.id} className="flex items-center gap-3 p-3"><p className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</p>
										<Button size="icon" variant="ghost" aria-label={`Delete ${s.name}`} onClick={async () => { await deleteSnippet(s.id); onSnippetsChanged(); }}><Trash2 className="h-4 w-4" /></Button>
									</li>
								))}
								{snippets.length === 0 && <li className="p-4 text-sm text-[#787774]">No templates yet.</li>}
							</ul>
							<div className="space-y-2 rounded-xl border border-dashed border-black/15 p-3">
								<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name, e.g. Intro" />
								<Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="The text to insert" />
								<Button size="sm" disabled={busy || !name.trim() || !body.trim()} onClick={async () => {
									setBusy(true);
									try {
										const html = body.split(/\n{2,}/).map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!).replace(/\n/g, "<br>")}</p>`).join("");
										await saveSnippet(null, name, html);
										setName(""); setBody(""); onSnippetsChanged();
									} catch (e) { toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
								}}>Save template</Button>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

/** Editable server settings for one mailbox. Tested before they are kept. */
function ServersForm({ id, onSaved }: { id: string; onSaved: () => void }) {
	const { toast } = useToast();
	const [s, setS] = useState<AccountServers | null>(null);
	const [pw, setPw] = useState("");
	const [busy, setBusy] = useState(false);
	useEffect(() => { getAccountServers(id).then(setS).catch((e) => toast({ title: "Could not load the settings", description: e instanceof Error ? e.message : undefined, variant: "destructive" })); }, [id, toast]);
	if (!s) return <p className="border-t border-black/[0.06] p-4 text-sm text-[#787774]">Loading...</p>;
	const set = (patch: Partial<AccountServers>) => setS({ ...s, ...patch });
	const locked = s.auth_type !== "password";
	const f = "h-9";
	return (
		<div className="space-y-3 border-t border-black/[0.06] p-4">
			<label className="block text-xs font-medium text-[#787774]">Name<Input className={f} value={s.label} onChange={(e) => set({ label: e.target.value })} /></label>
			{locked ? (
				<p className="text-xs text-[#787774]">This mailbox signs in with {s.auth_type === "google" ? "Google" : "Microsoft"}, so its servers are managed for you.</p>
			) : (
				<>
					<div className="grid gap-3 sm:grid-cols-[1fr_90px_120px]">
						<label className="block text-xs font-medium text-[#787774]">Incoming ({s.protocol.toUpperCase()}) server<Input className={f} value={s.imap_host} onChange={(e) => set({ imap_host: e.target.value })} /></label>
						<label className="block text-xs font-medium text-[#787774]">Port<Input className={f} inputMode="numeric" value={s.imap_port} onChange={(e) => set({ imap_port: Number(e.target.value.replace(/\D/g, "")) })} /></label>
						<label className="block text-xs font-medium text-[#787774]">Security<select className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm" value={s.imap_secure ? "ssl" : "starttls"} onChange={(e) => set({ imap_secure: e.target.value === "ssl" })}><option value="ssl">SSL/TLS</option><option value="starttls">STARTTLS</option></select></label>
					</div>
					<div className="grid gap-3 sm:grid-cols-[1fr_90px_120px]">
						<label className="block text-xs font-medium text-[#787774]">Outgoing (SMTP) server<Input className={f} value={s.smtp_host} onChange={(e) => set({ smtp_host: e.target.value })} /></label>
						<label className="block text-xs font-medium text-[#787774]">Port<Input className={f} inputMode="numeric" value={s.smtp_port} onChange={(e) => set({ smtp_port: Number(e.target.value.replace(/\D/g, "")) })} /></label>
						<label className="block text-xs font-medium text-[#787774]">Security<select className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm" value={s.smtp_secure ? "ssl" : "starttls"} onChange={(e) => set({ smtp_secure: e.target.value === "ssl" })}><option value="ssl">SSL/TLS</option><option value="starttls">STARTTLS</option></select></label>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						<label className="block text-xs font-medium text-[#787774]">Username<Input className={f} value={s.username} onChange={(e) => set({ username: e.target.value })} /></label>
						<label className="block text-xs font-medium text-[#787774]">New password <span className="font-normal">(leave empty to keep)</span><Input className={f} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
					</div>
				</>
			)}
			<div className="flex justify-end">
				<Button size="sm" className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy} onClick={async () => {
					setBusy(true);
					try {
						await updateAccountServers(id, { label: s.label, ...(locked ? {} : { username: s.username, password: pw || undefined, imapHost: s.imap_host, imapPort: s.imap_port, imapSecure: s.imap_secure, smtpHost: s.smtp_host, smtpPort: s.smtp_port, smtpSecure: s.smtp_secure }) });
						setPw("");
						toast({ title: "Settings saved", description: locked ? undefined : "Both reading and sending were tested." });
						onSaved();
					} catch (e) {
						toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
					} finally {
						setBusy(false);
					}
				}}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {locked ? "Save" : "Test and save"}</Button>
			</div>
		</div>
	);
}

export const LABEL_COLORS: Record<string, { dot: string; chip: string }> = {
	purple: { dot: "bg-sauti-teal", chip: "bg-sauti-teal-light text-sauti-dark" },
	blue: { dot: "bg-sky-500", chip: "bg-sky-100 text-sky-800" },
	green: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800" },
	amber: { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-900" },
	rose: { dot: "bg-rose-500", chip: "bg-rose-100 text-rose-800" },
};

/** Create or edit a label. A plain-language rule lets AI sort recent mail into it (like Notion Mail's auto label). */
export function LabelDialog({ label, accountId, onClose, onSave, onDelete, onApplied }: {
	label: Partial<LabelRow> | null; accountId: string | null; onClose: () => void;
	onSave: (v: { id: string | null; name: string; color: string; instruction: string }) => Promise<LabelRow>;
	onDelete?: (id: string) => Promise<void>; onApplied?: () => void;
}) {
	const { toast } = useToast();
	const [name, setName] = useState(label?.name ?? "");
	const [color, setColor] = useState(label?.color ?? "purple");
	const [instruction, setInstruction] = useState(label?.instruction ?? "");
	const [busy, setBusy] = useState<"save" | "run" | null>(null);
	// Review step: the messages the AI would label, each of which you can accept or reject.
	const [review, setReview] = useState<{ labelId: string; matches: AutoLabelMatch[]; scanned: number; ok: Set<string> } | null>(null);

	const save = async (andRun = false) => {
		setBusy(andRun ? "run" : "save");
		try {
			const saved = await onSave({ id: label?.id ?? null, name, color, instruction });
			if (andRun && accountId) {
				const r = await previewAutoLabel(accountId, "INBOX", saved.id);
				if (r.matches.length === 0) {
					toast({ title: "No recent messages matched", description: `Looked at the newest ${r.scanned}.` });
					onClose();
				} else {
					setReview({ labelId: saved.id, matches: r.matches, scanned: r.scanned, ok: new Set(r.matches.map((m) => m.messageId)) });
				}
				return;
			}
			onClose();
		} catch (e) {
			toast({ title: "Could not save the label", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(null);
		}
	};

	const finishReview = async () => {
		if (!review || !accountId) return;
		setBusy("save");
		try {
			const accept = review.matches.filter((m) => review.ok.has(m.messageId)).map((m) => m.messageId);
			const reject = review.matches.filter((m) => !review.ok.has(m.messageId)).map((m) => ({ from: m.from, subject: m.subject }));
			const r = await confirmAutoLabel(accountId, review.labelId, accept, reject);
			toast({ title: `Labelled ${r.applied} message${r.applied === 1 ? "" : "s"}`, description: reject.length ? "Your corrections will guide future labelling." : undefined });
			onApplied?.();
			setReview(null);
			onClose();
		} catch (e) {
			toast({ title: "Could not apply the label", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(null);
		}
	};

	if (review) {
		return (
			<Dialog open onOpenChange={(o) => !o && !busy && (setReview(null), onClose())}>
				<DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Teach me how to label future emails</DialogTitle>
						<DialogDescription>Found {review.matches.length} of the newest {review.scanned}. Untick any that do not belong: they are used to improve the rule.</DialogDescription>
					</DialogHeader>
					<ul className="divide-y divide-serene-neutral-100 rounded-xl border border-serene-neutral-100">
						{review.matches.map((m) => {
							const on = review.ok.has(m.messageId);
							return (
								<li key={m.messageId}>
									<button
										onClick={() => { const ok = new Set(review.ok); if (on) ok.delete(m.messageId); else ok.add(m.messageId); setReview({ ...review, ok }); }}
										aria-pressed={on}
										className="flex w-full items-center gap-3 p-3 text-left hover:bg-serene-neutral-50"
									>
										<span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", on ? "border-emerald-600 bg-emerald-600 text-white" : "border-red-300 bg-red-50 text-red-600")}>{on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}</span>
										<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{m.subject}</span><span className="block truncate text-xs text-serene-neutral-500">{m.from}</span></span>
									</button>
								</li>
							);
						})}
					</ul>
					<div className="flex justify-end gap-2">
						<Button variant="ghost" disabled={!!busy} onClick={() => { setReview(null); onClose(); }}>Skip</Button>
						<Button disabled={!!busy} onClick={finishReview} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={!!label} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader><DialogTitle>{label?.id ? "Edit label" : "New label"}</DialogTitle><DialogDescription>Labels are yours: they are the same across every mailbox you connect.</DialogDescription></DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Funders" autoFocus /></div>
					<div className="flex gap-2">{Object.keys(LABEL_COLORS).map((c) => <button key={c} onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} className={cn("h-7 w-7 rounded-full ring-offset-2", LABEL_COLORS[c].dot, color === c && "ring-2 ring-serene-neutral-800")} />)}</div>
					<div className="space-y-1.5">
						<Label>Which emails? (optional)</Label>
						<Textarea rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. Emails from funders, donors or grant programme officers about applications or reporting" />
						<p className="text-xs text-serene-neutral-500">With a description, AI can sort your recent mail into this label. Only senders and subjects are sent, when you ask.</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{label?.id && onDelete && <Button variant="ghost" className="gap-1.5 text-red-600" onClick={async () => { if (window.confirm("Delete this label? Your mail is not affected.")) { await onDelete(label.id!); onClose(); } }}><Trash2 className="h-4 w-4" /> Delete</Button>}
						<div className="flex-1" />
						<Button variant="ghost" onClick={onClose} disabled={!!busy}>Cancel</Button>
						{instruction.trim() && accountId && <Button variant="outline" disabled={!name.trim() || !!busy} onClick={() => save(true)} className="gap-1.5">{busy === "run" && <Loader2 className="h-4 w-4 animate-spin" />} Save and apply to recent mail</Button>}
						<Button disabled={!name.trim() || !!busy} onClick={() => save(false)} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark">{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
