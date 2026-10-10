"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, isThisWeek, isToday, isYesterday, startOfDay } from "date-fns";
import {
	Archive, Check, ArrowLeft, ChevronDown, ChevronUp, ChevronsRight, Clock, ListFilter, MoreHorizontal, RotateCw, SlidersHorizontal, Command as CommandIcon, Edit3, FileText, Flag, Forward, Inbox, Loader2, Mail, MailOpen, Menu, Paperclip, Pencil, Plus, Reply, ReplyAll, Search, Send, Settings, ShieldAlert, Sparkles, Star, Tag, Trash2, User, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { MailboxInfo } from "@/lib/mail/client";
import {
	actOnMessages, deleteView, getConversation, getMailboxes, getMessageDetail, listAccounts, listMessages, listSnippets, listViews, saveView, summariseMessage,
	type AccountView, type MailAction, type MessageRow, type SnippetRow, type ViewConfig, type ViewRow,
} from "./api";
import { Composer, type ComposeSeed } from "./Composer";
import { ConnectDialog, LabelDialog, LABEL_COLORS, SettingsDialog, ViewDialog } from "./Dialogs";
import { getSignature, mailBootstrap, type SignatureState } from "./api";
import { PersonChip } from "./PersonChip";
import { unwrap } from "@/lib/action-result";
import { addContactFromMail } from "@/app/actions/mjengo-contacts";
import { listLabels, saveLabel, deleteLabel, setMessageLabel, type LabelRow } from "./api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AccountSwitcher } from "./AccountSwitcher";
import { cacheDetail, cacheList, readDetail, readList } from "@/lib/mail/offline-cache";

type Detail = Awaited<ReturnType<typeof getMessageDetail>>;
type Layout = "side" | "center" | "full";
type HoverAction = NonNullable<ViewConfig["hoverActions"]>[number];

const BUILT_IN: { key: string; label: string; icon: typeof Inbox; config: ViewConfig; section: "views" | "mail" }[] = [
	{ key: "inbox", label: "Inbox", icon: Inbox, config: { mailbox: "inbox", group: "date" }, section: "views" },
	{ key: "unread", label: "Unread", icon: Mail, config: { mailbox: "inbox", unread: true, group: "date" }, section: "views" },
	{ key: "starred", label: "Starred", icon: Star, config: { mailbox: "inbox", starred: true, group: "date" }, section: "views" },
	{ key: "archive", label: "All Mail", icon: Archive, config: { mailbox: "archive", group: "date" }, section: "mail" },
	{ key: "sent", label: "Sent", icon: Send, config: { mailbox: "sent", group: "date" }, section: "mail" },
	{ key: "drafts", label: "Drafts", icon: FileText, config: { mailbox: "drafts", group: "date" }, section: "mail" },
	{ key: "spam", label: "Spam", icon: ShieldAlert, config: { mailbox: "spam", group: "date" }, section: "mail" },
	{ key: "trash", label: "Trash", icon: Trash2, config: { mailbox: "trash", group: "date" }, section: "mail" },
];
const ICON: Record<string, typeof Inbox> = { inbox: Inbox, star: Star, paperclip: Paperclip, user: User, tag: Tag, flag: Flag };
const DEFAULT_HOVER: HoverAction[] = ["archive", "trash", "unread", "star"];

const displayName = (m: { name: string; address: string }) => m.name || m.address || "Unknown";

function groupLabel(d: string | null, mode: ViewConfig["group"], from: string, seen = true): string {
	if (mode === "none") return "";
	if (mode === "sender") return from;
	if (mode === "status") return seen ? "Read" : "Unread";
	if (!d) return "Earlier";
	const date = new Date(d);
	const days = (Date.now() - date.getTime()) / 86400000;
	if (isToday(date)) return "Today";
	if (isYesterday(date)) return "Yesterday";
	if (days <= 7) return "Last 7 days";
	if (days <= 30) return "Last 30 days";
	return format(date, date.getFullYear() === new Date().getFullYear() ? "MMMM" : "MMMM yyyy");
}

const rowTime = (d: string | null) => (!d ? "" : isToday(new Date(d)) ? format(new Date(d), "HH:mm") : isThisWeek(new Date(d), { weekStartsOn: 1 }) ? format(new Date(d), "EEE") : format(new Date(d), "d MMM"));

export function MailApp() {
	const { toast } = useToast();
	const [accounts, setAccounts] = useState<AccountView[] | null>(null);
	const [accountId, setAccountId] = useState<string | null>(null);
	const [boxes, setBoxes] = useState<MailboxInfo[]>([]);
	const [unread, setUnread] = useState(0);
	const [views, setViews] = useState<ViewRow[]>([]);
	const [snippets, setSnippets] = useState<SnippetRow[]>([]);
	const [signature, setSignature] = useState<SignatureState | null>(null);
		const [labels, setLabels] = useState<LabelRow[]>([]);
	const [labelEdit, setLabelEdit] = useState<Partial<LabelRow> | null>(null);
	const [dropOn, setDropOn] = useState<string | null>(null);
	const [onlyUnread, setOnlyUnread] = useState(false);
	const [viewKey, setViewKey] = useState("inbox");
	const [q, setQ] = useState("");
	const [debouncedQ, setDebouncedQ] = useState("");

	const [rows, setRows] = useState<MessageRow[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	// True while what is on screen came from this device's saved copy.
	const [offline, setOffline] = useState(false);

	const [selected, setSelected] = useState<MessageRow | null>(null);
	const [detail, setDetail] = useState<Detail | null>(null);
	const [detailBusy, setDetailBusy] = useState(false);
	// Remote images always load: this is the team's own mail and the images are part of the message.
	const [allowImages, setAllowImages] = useState(true);
	const [conversation, setConversation] = useState<MessageRow[]>([]);
	const [summary, setSummary] = useState<string | null>(null);
	const [summaryBusy, setSummaryBusy] = useState(false);

	const [layout, setLayout] = useState<Layout>("side");
	const [compose, setCompose] = useState<ComposeSeed | null>(null);
	const [connectOpen, setConnectOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [viewEdit, setViewEdit] = useState<Partial<ViewRow> | null>(null);
	const [cmdOpen, setCmdOpen] = useState(false);
	const [navOpen, setNavOpen] = useState(false);
	const searchRef = useRef<HTMLInputElement>(null);
	const listToken = useRef(0);

	useEffect(() => {
		try {
			const l = localStorage.getItem("ss_mail_layout");
			if (l === "side" || l === "center" || l === "full") setLayout(l);
		} catch {}
	}, []);
	const changeLayout = (l: Layout) => {
		setLayout(l);
		try { localStorage.setItem("ss_mail_layout", l); } catch {}
	};

	/* ---- data loading */
	const loadAccounts = useCallback(async () => {
		const list = await listAccounts();
		setAccounts(list);
		setAccountId((cur) => (cur && list.some((a) => a.id === cur) ? cur : list[0]?.id ?? null));
	}, []);
	const loadMeta = useCallback(async () => {
		const [v, s, l, sig] = await Promise.all([listViews(), listSnippets(), listLabels(), getSignature().catch(() => null)]);
		setViews(v);
		setSnippets(s);
		setLabels(l);
		if (sig) setSignature(sig);
	}, []);
	
	// Opened from the contact book: /mail?to=someone@example.org
	useEffect(() => {
		const to = new URLSearchParams(window.location.search).get("to");
		if (!to) return;
		setCompose({ to: [to] });
		window.history.replaceState(null, "", window.location.pathname);
	}, []);
	// Coming back from "Sign in with Google / Microsoft".
	useEffect(() => {
		const q = new URLSearchParams(window.location.search);
		const ok = q.get("mail_connected");
		const err = q.get("mail_error");
		if (!ok && !err) return;
		if (ok) toast({ title: "Mailbox connected", description: ok });
		if (err) toast({ title: "Could not connect the mailbox", description: err, variant: "destructive" });
		const clean = new URL(window.location.href);
		clean.searchParams.delete("mail_connected");
		clean.searchParams.delete("mail_error");
		window.history.replaceState(null, "", clean.pathname + clean.search);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		mailBootstrap()
			.then((b) => {
				setAccounts(b.accounts);
				setAccountId((cur) => (cur && b.accounts.some((x) => x.id === cur) ? cur : b.accounts[0]?.id ?? null));
				setViews(b.views);
				setSnippets(b.snippets);
				setLabels(b.labels);
				if (b.signature) setSignature(b.signature);
			})
			.catch(() => setAccounts([]));
	}, []);

	useEffect(() => {
		if (!accountId) return;
		setBoxes([]);
		getMailboxes(accountId).then((r) => { setBoxes(r.boxes); setUnread(r.unread); }).catch((e) => setLoadError(e instanceof Error ? e.message : "Could not reach the mailbox."));
	}, [accountId]);

	useEffect(() => {
		const t = setTimeout(() => setDebouncedQ(q), 350);
		return () => clearTimeout(t);
	}, [q]);

	const active = useMemo(() => {
		const lab = viewKey.startsWith("label:") ? labels.find((l) => `label:${l.id}` === viewKey) : null;
		if (lab) return { label: lab.name, icon: Tag, config: { mailbox: "inbox", labelId: lab.id, group: "date" } as ViewConfig, view: null as ViewRow | null };
		const custom = views.find((v) => `custom:${v.id}` === viewKey);
		if (custom) return { label: custom.name, icon: ICON[custom.icon] ?? Inbox, config: custom.config, view: custom };
		const b = BUILT_IN.find((x) => x.key === viewKey) ?? BUILT_IN[0];
		return { label: b.label, icon: b.icon, config: b.config, view: null as ViewRow | null };
	}, [views, viewKey, labels]);

	const mailboxPath = useMemo(() => {
		const hit = boxes.find((b) => b.special === active.config.mailbox);
		return hit?.path ?? (active.config.mailbox === "inbox" ? "INBOX" : null);
	}, [boxes, active]);

	const loadList = useCallback(async (append = false) => {
		if (!accountId || !mailboxPath) return;
		const token = ++listToken.current;
		setLoading(true);
		setLoadError(null);
		try {
			const c = active.config;
			const res = await listMessages(accountId, mailboxPath, { unread: c.unread || onlyUnread, starred: c.starred, hasAttachment: c.hasAttachment, from: c.from, labelId: c.labelId, text: debouncedQ }, append ? rows.length : 0, 40);
			if (token !== listToken.current) return;
			setRows((prev) => (append ? [...prev, ...res.items.filter((i) => !prev.some((p) => p.uid === i.uid))] : res.items));
			setTotal(res.total);
			setOffline(false);
			if (!append && !debouncedQ) cacheList(`${accountId}:${viewKey}`, res);
		} catch (e) {
			if (token === listToken.current) {
				// No connection (or the server is unreachable): fall back to the copy saved on this device.
				const saved = !append && !debouncedQ ? readList<{ items: MessageRow[]; total: number }>(`${accountId}:${viewKey}`) : null;
				if (saved) {
					setRows(saved.items);
					setTotal(saved.total);
					setOffline(true);
				} else setLoadError(e instanceof Error ? e.message : "Could not load this folder.");
			}
		} finally {
			if (token === listToken.current) setLoading(false);
		}
	}, [accountId, mailboxPath, active, debouncedQ, rows.length, onlyUnread]);

	// Reload when the account, view or search changes.
	useEffect(() => {
		setSelected(null);
		setDetail(null);
		if (accountId && mailboxPath) loadList(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [accountId, mailboxPath, viewKey, debouncedQ, views, onlyUnread]);

	/* ---- opening a message */
	const open = useCallback(async (m: MessageRow, images = true) => {
		if (!accountId) return;
		setSelected(m);
		setDetailBusy(true);
		setSummary(null);
		setConversation([]);
		try {
			const d = await getMessageDetail(accountId, m.mailbox, m.uid, images);
			setDetail(d);
			cacheDetail(`${accountId}:${m.mailbox}:${m.uid}`, d);
			setRows((prev) => prev.map((r) => (r.uid === m.uid ? { ...r, seen: true } : r)));
			if (!m.seen) setUnread((u) => Math.max(0, u - 1));
			getConversation(accountId, m.mailbox, d.subject).then((c) => setConversation(c.filter((x) => x.uid !== m.uid))).catch(() => undefined);
		} catch (e) {
			const saved = readDetail<Detail>(`${accountId}:${m.mailbox}:${m.uid}`);
			if (saved) {
				setDetail(saved);
				setOffline(true);
				return;
			}
			toast({ title: "Could not open it", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			setSelected(null);
		} finally {
			setDetailBusy(false);
		}
	}, [accountId, toast]);

	const close = () => { setSelected(null); setDetail(null); };

	/* ---- actions */
	const act = useCallback(async (m: MessageRow, action: MailAction) => {
		if (!accountId) return;
		const removes = action === "archive" || action === "trash" || action === "spam" || action === "delete";
		const before = rows;
		const idx = rows.findIndex((r) => r.uid === m.uid);
		setRows((prev) => (removes ? prev.filter((r) => r.uid !== m.uid) : prev.map((r) => (r.uid === m.uid ? { ...r, seen: action === "read" ? true : action === "unread" ? false : r.seen, flagged: action === "star" ? true : action === "unstar" ? false : r.flagged } : r))));
		if (removes && selected?.uid === m.uid) {
			const next = before[idx + 1] ?? before[idx - 1];
			if (next && layout === "side") open(next); else close();
		}
		try {
			await actOnMessages(accountId, m.mailbox, [m.uid], action);
			if (action === "unread" || action === "read") setUnread((u) => Math.max(0, u + (action === "unread" ? 1 : -1)));
			if (removes) toast({ title: action === "archive" ? "Archived" : action === "trash" ? "Moved to Trash" : action === "spam" ? "Marked as spam" : "Deleted" });
		} catch (e) {
			setRows(before);
			toast({ title: "That did not work", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	}, [accountId, rows, selected, layout, open, toast]);

	/** Add or remove a label on a message; reflected straight away in the list. */
	const toggleLabel = async (messageId: string, labelId: string, on: boolean, uid?: number) => {
		if (!accountId) return;
		const apply = (r: MessageRow) => (r.messageId === messageId ? { ...r, labels: on ? Array.from(new Set([...r.labels, labelId])) : r.labels.filter((x) => x !== labelId) } : r);
		setRows((prev) => prev.map(apply));
		if (selected && selected.messageId === messageId) setSelected((s) => (s ? apply(s) : s));
		try {
			await setMessageLabel(accountId, messageId, labelId, on);
			if (on) toast({ title: `Labelled ${labels.find((l) => l.id === labelId)?.name ?? ""}` });
		} catch (e) {
			toast({ title: "Could not change the label", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			loadList(false);
		}
		void uid;
	};

	const startReply = (d: Detail, all: boolean, forward = false) => {
		const me = accounts?.find((a) => a.id === accountId)?.email.toLowerCase();
		const sender = d.from[0]?.address;
		const quote = `<p></p><blockquote><p>On ${d.date ? format(new Date(d.date), "d MMM yyyy, HH:mm") : ""}, ${displayName(d.from[0] ?? { name: "", address: "" })} wrote:</p>${d.html ?? `<p>${d.text.replace(/\n/g, "<br>")}</p>`}</blockquote>`;
		const subject = d.subject.replace(/^((re|fwd?):\s*)+/i, "");
		setCompose(
			forward
				? { subject: `Fwd: ${subject}`, html: `<p></p><p>---------- Forwarded message ----------</p>${d.html ?? d.text}` }
				: {
					to: sender ? [sender] : [],
					cc: all ? [...d.to, ...d.cc].map((a) => a.address).filter((a) => a && a.toLowerCase() !== me && a !== sender) : [],
					subject: `Re: ${subject}`,
					html: quote,
					inReplyTo: d.messageId,
					references: [...d.references, ...(d.messageId ? [d.messageId] : [])],
					replyTo: selected ? { mailbox: selected.mailbox, uid: selected.uid } : null,
				}
		);
	};

	const summarise = async () => {
		if (!accountId || !selected) return;
		setSummaryBusy(true);
		try { setSummary(await summariseMessage(accountId, selected.mailbox, selected.uid)); } catch (e) { toast({ title: "Could not summarise", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setSummaryBusy(false); }
	};

	/* ---- keyboard */
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((v) => !v); return; }
			const el = e.target as HTMLElement;
			if (el.closest("input, textarea, [contenteditable=true], [role=dialog]") || e.metaKey || e.ctrlKey || e.altKey) return;
			const idx = selected ? rows.findIndex((r) => r.uid === selected.uid) : -1;
			switch (e.key) {
				case "c": e.preventDefault(); setCompose({}); break;
				case "/": e.preventDefault(); searchRef.current?.focus(); break;
				case "Escape": close(); break;
				case "j": if (rows[idx + 1] || idx < 0) open(rows[idx + 1] ?? rows[0]); break;
				case "k": if (idx > 0) open(rows[idx - 1]); break;
				case "e": if (selected) act(selected, "archive"); break;
				case "u": if (selected) act(selected, selected.seen ? "unread" : "read"); break;
				case "s": if (selected) act(selected, selected.flagged ? "unstar" : "star"); break;
				case "#": case "Delete": case "Backspace": if (selected) act(selected, "trash"); break;
				case "r": if (detail) startReply(detail, false); break;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	/* ---- render */
	if (!accounts) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>;

	if (accounts.length === 0) {
		return (
			<>
				<div className="flex h-full items-center justify-center p-6">
					<div className="max-w-md rounded-3xl border border-serene-neutral-100 bg-white p-8 text-center shadow-sm">
						<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sauti-teal-light text-sauti-teal"><Mail className="h-7 w-7" /></div>
						<h2 className="text-xl font-bold text-serene-neutral-900">Bring your email here</h2>
						<p className="mt-2 text-sm text-serene-neutral-600">Connect one or more inboxes to read, search and send mail alongside your grants and projects. Make views for the mail that matters.</p>
						<Button onClick={() => setConnectOpen(true)} className="mt-6 gap-2 bg-sauti-teal hover:bg-sauti-dark"><Plus className="h-4 w-4" /> Connect a mailbox</Button>
					</div>
				</div>
				<ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} onConnected={(a) => { setAccounts([a]); setAccountId(a.id); }} />
			</>
		);
	}

	const groups: { label: string; items: MessageRow[] }[] = [];
	for (const r of rows) {
		const label = groupLabel(r.date, active.config.group ?? "date", displayName(r.from), r.seen);
		const g = groups.find((x) => x.label === label);
		if (g) g.items.push(r); else groups.push({ label, items: [r] });
	}
	const hover = active.config.hoverActions ?? DEFAULT_HOVER;
	const effectiveLayout: Layout = layout;

		const ink = "text-[#37352f]";
	const Heading = ({ children }: { children: React.ReactNode }) => <p className="px-3 pb-1 pt-5 text-[13px] font-medium text-[#9b9a97]">{children}</p>;
	const sidebar = (
		<div className={cn("flex h-full flex-col bg-[#f7f7f5]", ink)}>
			<div className="flex items-center gap-1 px-2 pb-1 pt-[max(0.625rem,env(safe-area-inset-top))]">
				<div className="min-w-0 flex-1"><AccountSwitcher accounts={accounts} accountId={accountId} onSelect={(id) => { setAccountId(id); setViewKey("inbox"); setNavOpen(false); }} onAdd={() => { setNavOpen(false); setConnectOpen(true); }} onSettings={() => { setNavOpen(false); setSettingsOpen(true); }} /></div>
				<button onClick={() => { setCompose({}); setNavOpen(false); }} aria-label="Compose (C)" title="Compose (C)" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#37352f] hover:bg-black/5"><Edit3 className="h-[18px] w-[18px]" /></button>
			</div>
			<div className="px-2">
				<label className="flex h-9 cursor-text items-center gap-3 rounded-md px-3 text-[15px] hover:bg-black/5 focus-within:bg-black/5">
					<Search className="h-[18px] w-[18px] shrink-0 text-[#787774]" />
					<input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search mail" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#37352f]" />
				</label>
			</div>
			<nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Views">
				<Heading>Views</Heading>
				{BUILT_IN.filter((b) => b.section === "views").map((b) => <NavItem key={b.key} active={viewKey === b.key} icon={b.icon} tone={b.key === "inbox" ? "text-red-500" : "text-[#787774]"} label={b.label} badge={b.key === "inbox" ? unread : 0} onClick={() => { setViewKey(b.key); setNavOpen(false); }} />)}
				{views.map((v) => <NavItem key={v.id} active={viewKey === `custom:${v.id}`} icon={ICON[v.icon] ?? Inbox} tone="text-amber-600" label={v.name} onClick={() => { setViewKey(`custom:${v.id}`); setNavOpen(false); }} onEdit={() => setViewEdit(v)} />)}
				<button onClick={() => setViewEdit({})} className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-[15px] text-[#787774] hover:bg-black/5"><Plus className="h-[18px] w-[18px]" /> New view</button>

				<Heading>Labels</Heading>
				{labels.map((l) => (
					<div
						key={l.id}
						onDragOver={(e) => { e.preventDefault(); setDropOn(l.id); }}
						onDragLeave={() => setDropOn((d) => (d === l.id ? null : d))}
						onDrop={(e) => {
							e.preventDefault();
							setDropOn(null);
							const mid = e.dataTransfer.getData("text/x-message-id");
							if (mid && accountId) toggleLabel(mid, l.id, true);
						}}
						className={cn("group flex items-center rounded-md transition", viewKey === `label:${l.id}` ? "bg-black/[0.06]" : "hover:bg-black/5", dropOn === l.id && "ring-2 ring-sauti-teal")}
					>
						<button onClick={() => { setViewKey(`label:${l.id}`); setNavOpen(false); }} className="flex h-9 min-w-0 flex-1 touch-manipulation items-center gap-3 px-3 text-left text-[15px]">
							<span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center"><span className={cn("h-3 w-3 rounded-full", LABEL_COLORS[l.color]?.dot ?? "bg-sauti-teal")} /></span>
							<span className="truncate">{l.name}</span>
						</button>
						<button onClick={() => setLabelEdit(l)} aria-label={`Edit ${l.name}`} className="mr-1 hidden rounded p-1 text-[#787774] hover:text-[#37352f] group-hover:block"><Pencil className="h-3.5 w-3.5" /></button>
					</div>
				))}
				<button onClick={() => setLabelEdit({})} className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-[15px] text-[#787774] hover:bg-black/5"><Plus className="h-[18px] w-[18px]" /> New label</button>

				<Heading>Mail</Heading>
				{BUILT_IN.filter((b) => b.section === "mail").map((b) => <NavItem key={b.key} active={viewKey === b.key} icon={b.icon} tone="text-[#787774]" label={b.label} onClick={() => { setViewKey(b.key); setNavOpen(false); }} />)}
			</nav>
			<div className="space-y-px px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
				<button onClick={() => setSettingsOpen(true)} className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-[15px] hover:bg-black/5"><Settings className="h-[18px] w-[18px] text-[#787774]" /> Settings</button>
				<button onClick={() => setCmdOpen(true)} className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-[15px] hover:bg-black/5"><CommandIcon className="h-[18px] w-[18px] text-[#787774]" /> Command menu <kbd className="ml-auto rounded border border-black/10 bg-white px-1.5 text-[10px] text-[#787774]">Ctrl K</kbd></button>
			</div>
		</div>
	);

const Pane = (
		<ReadingPane
			onWrite={(address) => setCompose({ to: [address] })}
			onAddContact={async (name, address) => {
				try {
					const c = await unwrap(addContactFromMail(name, address));
					toast({ title: c.source === "mail" ? "Added to contacts" : "Already in your contacts", description: `${c.name} <${address}>` });
				} catch (e) {
					toast({ title: "Could not add the contact", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
				}
			}}
			onPrev={() => { const i = rows.findIndex((r) => r.uid === selected?.uid); if (i > 0) open(rows[i - 1]); }}
			onNext={() => { const i = rows.findIndex((r) => r.uid === selected?.uid); if (rows[i + 1]) open(rows[i + 1]); }}
			hasPrev={rows.findIndex((r) => r.uid === selected?.uid) > 0}
			hasNext={rows.findIndex((r) => r.uid === selected?.uid) >= 0 && rows.findIndex((r) => r.uid === selected?.uid) < rows.length - 1}
			onAutoLabelSimilar={() => { const f = detail?.from[0]; setLabelEdit({ name: f ? displayName(f) : "", instruction: f ? `Emails from ${displayName(f)} <${f.address}>` : "" }); }}
			labels={labels} selectedLabels={rows.find((r) => r.uid === selected?.uid)?.labels ?? selected?.labels ?? []} onToggleLabel={(id, on) => selected?.messageId && toggleLabel(selected.messageId, id, on, selected.uid)} onNewLabel={() => setLabelEdit({})} selected={selected} detail={detail} busy={detailBusy} accountId={accountId!} conversation={conversation} summary={summary} summaryBusy={summaryBusy} allowImages={allowImages}
			onClose={close} onSummarise={summarise} onOpen={(m) => open(m)} onAct={(a) => selected && act(selected, a)}
			onReply={(all) => detail && startReply(detail, all)} onForward={() => detail && startReply(detail, false, true)}
			onLoadImages={() => { setAllowImages(true); if (selected) open(selected, true); }} full={effectiveLayout === "full"}
		/>
	);

	return (
		<div className="flex h-full min-h-0 bg-white">
			<aside className="hidden w-[268px] shrink-0 border-r border-black/[0.06] lg:block">{sidebar}</aside>
			<Sheet open={navOpen} onOpenChange={setNavOpen}><SheetContent side="left" className="w-[280px] p-0"><SheetTitle className="sr-only">Mail navigation</SheetTitle>{sidebar}</SheetContent></Sheet>

			<main className={cn("flex min-w-0 flex-1 flex-col", selected && effectiveLayout === "full" && "hidden")}>
				<header className="flex items-center gap-2 px-4 py-3 lg:px-6">
					<Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
					<active.icon className="h-5 w-5 text-[#787774]" />
					<h2 className="truncate text-[17px] font-medium text-[#37352f]">{active.label}</h2>
					{debouncedQ && <span className="hidden truncate rounded-full bg-black/5 px-2.5 py-1 text-xs text-[#787774] sm:inline">Searching “{debouncedQ}”</span>}
					<div className="flex-1" />
					<button
						onClick={() => setLabelEdit(viewKey.startsWith("label:") ? labels.find((l) => `label:${l.id}` === viewKey) ?? {} : {})}
						className="hidden h-8 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-sm text-[#37352f] shadow-sm hover:bg-black/[0.03] sm:flex"
					>
						<Sparkles className="h-4 w-4 text-[#787774]" /> Auto label
					</button>
					<button onClick={() => setOnlyUnread((v) => !v)} aria-pressed={onlyUnread} aria-label="Show unread only" title="Unread only" className={cn("flex h-8 w-8 items-center justify-center rounded-md hover:bg-black/5", onlyUnread ? "text-sauti-teal" : "text-[#787774]")}><ListFilter className="h-[18px] w-[18px]" /></button>
					<button onClick={() => setViewEdit(active.view ?? {})} aria-label="View options" title="View options" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5"><SlidersHorizontal className="h-[18px] w-[18px]" /></button>
					<button onClick={() => loadList(false)} aria-label="Refresh" title="Refresh" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5"><RotateCw className={cn("h-[18px] w-[18px]", loading && "animate-spin")} /></button>
				</header>

				{offline && <div role="status" className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">You are offline, or the mail server cannot be reached. Showing mail saved on this device. <button className="ml-2 underline" onClick={() => loadList(false)}>Try again</button></div>}
				<div className="min-h-0 flex-1 overflow-y-auto">
					{loadError && <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError} <button className="ml-2 underline" onClick={() => loadList(false)}>Try again</button></div>}
					{!loadError && loading && rows.length === 0 && <div className="space-y-px p-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-serene-neutral-50" />)}</div>}
					{!loadError && !loading && rows.length === 0 && (
						<div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-serene-neutral-500"><MailOpen className="h-10 w-10 text-serene-neutral-300" /><p className="font-medium text-serene-neutral-700">{debouncedQ ? "Nothing matches your search" : "Nothing here"}</p><p className="text-sm">{debouncedQ ? "Try different words." : "New mail will appear as it arrives."}</p></div>
					)}
					{groups.map((g) => (
						<section key={g.label} className="px-4 lg:px-6">
							{g.label && <h3 className="border-b border-black/[0.07] pb-2 pt-6 text-[15px] text-[#787774]">{g.label}</h3>}
							<ul>
								{g.items.map((m) => (
									<li key={m.uid} className="group relative" draggable={!!m.messageId} onDragStart={(e) => { if (m.messageId) { e.dataTransfer.setData("text/x-message-id", m.messageId); e.dataTransfer.effectAllowed = "copy"; } }}>
										<button onClick={() => open(m)} className={cn("-mx-2 flex w-[calc(100%+1rem)] touch-manipulation items-center gap-3 rounded-md px-2 py-[11px] text-left text-[15px] transition-colors hover:bg-black/[0.04]", selected?.uid === m.uid && "bg-black/[0.05]")}>
											<span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", m.seen ? "bg-transparent" : "bg-sauti-teal")} aria-label={m.seen ? undefined : "Unread"} />
											<span className={cn("w-[34%] max-w-[300px] shrink-0 truncate text-[#37352f] sm:w-[28%]", !m.seen && "font-semibold")}>{displayName(m.from)}</span>
											<span className={cn("min-w-0 flex-1 truncate text-[#37352f]", !m.seen && "font-medium")}>
												{m.subject}
												{m.thread > 1 && <span className="ml-2 rounded bg-black/[0.05] px-1.5 py-0.5 text-[11px] text-[#787774]">{m.thread}</span>}
											</span>
											{m.labels.slice(0, 2).map((id) => { const l = labels.find((x) => x.id === id); return l ? <span key={id} className="hidden shrink-0 rounded bg-black/[0.05] px-2 py-0.5 text-[13px] text-[#37352f] md:inline">{l.name}</span> : null; })}
											{m.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#9b9a97]" />}
											{m.flagged && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
											<span className="w-[70px] shrink-0 text-right text-[#9b9a97] group-hover:invisible">{rowTime(m.date)}</span>
										</button>
										<div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg border border-black/10 bg-white p-0.5 shadow-sm group-hover:flex">
											{hover.includes("archive") && <HoverBtn label="Archive" onClick={() => act(m, "archive")}><Archive className="h-4 w-4" /></HoverBtn>}
											{hover.includes("trash") && <HoverBtn label="Delete" onClick={() => act(m, "trash")}><Trash2 className="h-4 w-4" /></HoverBtn>}
											{hover.includes("unread") && <HoverBtn label={m.seen ? "Mark unread" : "Mark read"} onClick={() => act(m, m.seen ? "unread" : "read")}>{m.seen ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}</HoverBtn>}
											{hover.includes("star") && <HoverBtn label={m.flagged ? "Unstar" : "Star"} onClick={() => act(m, m.flagged ? "unstar" : "star")}><Star className={cn("h-4 w-4", m.flagged && "fill-amber-400 text-amber-400")} /></HoverBtn>}
											{hover.includes("reply") && <HoverBtn label="Reply" onClick={async () => { await open(m); }}><Reply className="h-4 w-4" /></HoverBtn>}
										</div>
									</li>
								))}
							</ul>
						</section>
					))}
{rows.length < total && !loading && <div className="px-4 pb-8 pt-3 lg:px-6"><button onClick={() => loadList(true)} className="flex items-center gap-3 text-[15px] text-[#9b9a97] hover:text-[#37352f]"><ArrowLeft className="h-4 w-4 -rotate-90" /> Load more</button></div>}
					{loading && rows.length > 0 && <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" /></div>}
				</div>
			</main>

			{/* Reading: side peek / full page, or a centred dialog */}
			{selected && effectiveLayout === "side" && <aside className="fixed inset-0 z-30 bg-white lg:static lg:z-auto lg:w-[52%] lg:max-w-[820px] lg:border-l lg:border-black/[0.07]">{Pane}</aside>}
			{selected && effectiveLayout === "full" && <section className="min-w-0 flex-1">{Pane}</section>}
			{selected && effectiveLayout === "center" && (
				<Dialog open onOpenChange={(o) => !o && close()}><DialogContent className="h-[88vh] max-w-3xl gap-0 overflow-hidden p-0 [&>button]:hidden"><DialogTitle className="sr-only">Message</DialogTitle>{Pane}</DialogContent></Dialog>
			)}

			{compose && accountId && <Composer accounts={accounts} accountId={accountId} seed={compose} snippets={snippets} signature={signature?.html ?? ""} onClose={() => setCompose(null)} onSent={() => { setCompose(null); if (active.config.mailbox === "sent") loadList(false); }} />}
			<ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} onConnected={(a) => { setAccounts((p) => [...(p ?? []), a]); setAccountId(a.id); }} />
			<SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} accounts={accounts} onAccountsChanged={() => loadAccounts().catch(() => undefined)} onConnect={() => setConnectOpen(true)} snippets={snippets} onSnippetsChanged={() => loadMeta().catch(() => undefined)} layout={layout} onLayout={changeLayout} signature={signature?.html ?? ""} onSignatureSaved={(html) => setSignature({ html, configured: !!html, dismissed: true })} />
			{labelEdit && (
				<LabelDialog
					label={labelEdit}
					accountId={accountId}
					onClose={() => setLabelEdit(null)}
					onSave={async (v) => { const saved = await saveLabel(v.id, { name: v.name, color: v.color, instruction: v.instruction }); await loadMeta(); return saved; }}
					onDelete={async (id) => { await deleteLabel(id); await loadMeta(); if (viewKey === `label:${id}`) setViewKey("inbox"); }}
					onApplied={() => loadList(false)}
				/>
			)}
			{viewEdit && (
				<ViewDialog
					labels={labels}
					view={viewEdit}
					onClose={() => setViewEdit(null)}
					onSave={async (v) => { const saved = await saveView(v.id, { name: v.name, icon: v.icon, config: v.config }); await loadMeta(); setViewKey(`custom:${saved.id}`); }}
					onDelete={async (id) => { await deleteView(id); await loadMeta(); setViewKey("inbox"); }}
				/>
			)}

			<CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
				<CommandInput placeholder="Search for an action or a view" />
				<CommandList>
					<CommandEmpty>No results.</CommandEmpty>
					<CommandGroup heading="Actions">
						<CommandItem onSelect={() => { setCmdOpen(false); setCompose({}); }}><Edit3 className="mr-2 h-4 w-4" /> Compose<CommandShortcut>C</CommandShortcut></CommandItem>
						{selected && detail && <>
							<CommandItem onSelect={() => { setCmdOpen(false); startReply(detail, false); }}><Reply className="mr-2 h-4 w-4" /> Reply<CommandShortcut>R</CommandShortcut></CommandItem>
							<CommandItem onSelect={() => { setCmdOpen(false); act(selected, "archive"); }}><Archive className="mr-2 h-4 w-4" /> Archive<CommandShortcut>E</CommandShortcut></CommandItem>
							<CommandItem onSelect={() => { setCmdOpen(false); act(selected, selected.seen ? "unread" : "read"); }}><Mail className="mr-2 h-4 w-4" /> Mark {selected.seen ? "unread" : "read"}<CommandShortcut>U</CommandShortcut></CommandItem>
							<CommandItem onSelect={() => { setCmdOpen(false); act(selected, "trash"); }}><Trash2 className="mr-2 h-4 w-4" /> Delete<CommandShortcut>#</CommandShortcut></CommandItem>
							<CommandItem onSelect={() => { setCmdOpen(false); summarise(); }}><Sparkles className="mr-2 h-4 w-4" /> Summarise this message</CommandItem>
						</>}
						<CommandItem onSelect={() => { setCmdOpen(false); setViewEdit({}); }}><Plus className="mr-2 h-4 w-4" /> New view</CommandItem>
						<CommandItem onSelect={() => { setCmdOpen(false); setConnectOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Connect a mailbox</CommandItem>
						<CommandItem onSelect={() => { setCmdOpen(false); setSettingsOpen(true); }}><Settings className="mr-2 h-4 w-4" /> Settings</CommandItem>
					</CommandGroup>
					<CommandGroup heading="Go to">
						{BUILT_IN.map((b) => <CommandItem key={b.key} onSelect={() => { setCmdOpen(false); setViewKey(b.key); }}><b.icon className="mr-2 h-4 w-4" /> {b.label}</CommandItem>)}
						{views.map((v) => <CommandItem key={v.id} onSelect={() => { setCmdOpen(false); setViewKey(`custom:${v.id}`); }}><Tag className="mr-2 h-4 w-4" /> {v.name}</CommandItem>)}
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</div>
	);
}

function NavItem({ active, icon: Icon, label, badge, tone, onClick, onEdit }: { active: boolean; icon: typeof Inbox; label: string; badge?: number; tone?: string; onClick: () => void; onEdit?: () => void }) {
	return (
		<div className={cn("group flex items-center rounded-md", active ? "bg-black/[0.06]" : "hover:bg-black/5")}>
			<button onClick={onClick} aria-current={active ? "page" : undefined} className="flex h-9 min-w-0 flex-1 touch-manipulation items-center gap-3 px-3 text-left text-[15px] text-[#37352f]">
				<Icon className={cn("h-[18px] w-[18px] shrink-0", tone ?? "text-[#787774]")} />
				<span className="truncate">{label}</span>
				{!!badge && <span className="ml-auto text-[13px] text-[#9b9a97]">{badge > 99 ? "99+" : badge}</span>}
			</button>
			{onEdit && <button onClick={onEdit} aria-label={`Edit ${label}`} className="mr-1 hidden rounded p-1 text-[#787774] hover:text-[#37352f] group-hover:block"><Pencil className="h-3.5 w-3.5" /></button>}
		</div>
	);
}

function HoverBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
	return <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={label} aria-label={label} className="rounded-md p-1.5 text-serene-neutral-600 hover:bg-serene-neutral-100">{children}</button>;
}

function ReadingPane({ onWrite, onAddContact, onPrev, onNext, hasPrev, hasNext, onAutoLabelSimilar, labels, selectedLabels, onToggleLabel, onNewLabel, selected, detail, busy, accountId, conversation, summary, summaryBusy, allowImages, onClose, onSummarise, onOpen, onAct, onReply, onForward, onLoadImages, full }: {
	onWrite: (address: string) => void; onAddContact: (name: string, address: string) => void;
	onPrev: () => void; onNext: () => void; hasPrev: boolean; hasNext: boolean; onAutoLabelSimilar: () => void;
	labels: LabelRow[]; selectedLabels: string[]; onToggleLabel: (id: string, on: boolean) => void; onNewLabel: () => void;
	selected: MessageRow | null; detail: Detail | null; busy: boolean; accountId: string; conversation: MessageRow[]; summary: string | null; summaryBusy: boolean; allowImages: boolean;
	onClose: () => void; onSummarise: () => void; onOpen: (m: MessageRow) => void; onAct: (a: MailAction) => void; onReply: (all: boolean) => void; onForward: () => void; onLoadImages: () => void; full: boolean;
}) {
	const frame = useRef<HTMLIFrameElement>(null);
	const [h, setH] = useState(300);
	const doc = useMemo(
		() =>
			detail
				? `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;word-wrap:break-word}img{max-width:100%;height:auto}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #e5e7eb;color:#6b7280}a{color:#068297}pre{white-space:pre-wrap}table{max-width:100%}</style></head><body>${detail.html ?? `<pre style="font:inherit">${detail.text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`}</body></html>`
				: "",
		[detail]
	);
	const measure = () => {
		const d = frame.current?.contentDocument;
		if (d?.body) setH(Math.max(120, d.documentElement.scrollHeight + 8));
	};

	return (
		<div className="flex h-full min-h-0 flex-col bg-white">
			<header className="flex items-center gap-1 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
				<button onClick={onClose} aria-label={full ? "Back to inbox" : "Close"} className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5">{full ? <ArrowLeft className="h-[18px] w-[18px]" /> : <ChevronsRight className="h-[18px] w-[18px]" />}</button>
				<button onClick={onPrev} disabled={!hasPrev} aria-label="Previous message (K)" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 disabled:opacity-30"><ChevronUp className="h-[18px] w-[18px]" /></button>
				<button onClick={onNext} disabled={!hasNext} aria-label="Next message (J)" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 disabled:opacity-30"><ChevronDown className="h-[18px] w-[18px]" /></button>
				{detail && <>
					<span className="mx-1 hidden h-5 w-px bg-black/10 sm:block" />
					<button onClick={() => onAct("archive")} aria-label="Archive (E)" title="Archive (E)" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Archive className="h-[18px] w-[18px]" /></button>
					<button onClick={() => onAct("spam")} aria-label="Report spam" title="Report spam" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><ShieldAlert className="h-[18px] w-[18px]" /></button>
					<button onClick={() => onAct("trash")} aria-label="Delete (#)" title="Delete (#)" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Trash2 className="h-[18px] w-[18px]" /></button>
					<span className="mx-1 h-5 w-px bg-black/10" />
					<button onClick={() => onReply(false)} aria-label="Reply (R)" title="Reply (R)" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Reply className="h-[18px] w-[18px]" /></button>
					<button onClick={() => onReply(true)} aria-label="Reply all" title="Reply all" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><ReplyAll className="h-[18px] w-[18px]" /></button>
					<button onClick={onForward} aria-label="Forward" title="Forward" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Forward className="h-[18px] w-[18px]" /></button>
					<span className="mx-1 h-5 w-px bg-black/10" />
					<button onClick={() => onAct(selected?.seen ? "unread" : "read")} aria-label={selected?.seen ? "Mark unread (U)" : "Mark read"} title={selected?.seen ? "Mark unread (U)" : "Mark read"} className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]">{selected?.seen ? <Mail className="h-[18px] w-[18px]" /> : <MailOpen className="h-[18px] w-[18px]" />}</button>
					<button onClick={() => onAct(selected?.flagged ? "unstar" : "star")} aria-label={selected?.flagged ? "Remove star" : "Star (S)"} title={selected?.flagged ? "Remove star" : "Star (S)"} className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Star className={cn("h-[18px] w-[18px]", selected?.flagged && "fill-amber-400 text-amber-400")} /></button>
					<Popover>
						<PopoverTrigger asChild><button aria-label="Labels" title="Label" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Tag className="h-[18px] w-[18px]" /></button></PopoverTrigger>
						<PopoverContent align="end" className="w-60 p-1.5">
							{labels.map((l) => { const on = selectedLabels.includes(l.id); return (
								<button key={l.id} onClick={() => onToggleLabel(l.id, !on)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5">
									<span className={cn("h-2.5 w-2.5 rounded-full", LABEL_COLORS[l.color]?.dot ?? "bg-sauti-teal")} /><span className="flex-1 truncate">{l.name}</span>{on && <Check className="h-4 w-4 text-sauti-teal" />}
								</button>
							); })}
							<button onClick={onNewLabel} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[#787774] hover:bg-black/5"><Plus className="h-4 w-4" /> New label</button>
						</PopoverContent>
					</Popover>
					<span className="flex-1" />
					<button onClick={onAutoLabelSimilar} className="mr-1 hidden h-8 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-sm text-[#37352f] shadow-sm hover:bg-black/[0.03] lg:flex"><Sparkles className="h-4 w-4 text-[#787774]" /> Auto label similar</button>
					<button onClick={onSummarise} aria-label="Summarise" title="Summarise" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Sparkles className="h-[18px] w-[18px]" /></button>
				</>}
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{busy && !detail && <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>}
				{detail && (
					<article className="mx-auto max-w-3xl px-6 pb-10 pt-3">
						<h2 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-[#37352f]">{detail.subject}</h2>
						<div className="mt-3 flex flex-wrap items-center gap-2 text-[15px]">
							{selectedLabels.length === 0 && <span className="text-[#9b9a97]">Add label</span>}
							{selectedLabels.map((id) => { const l = labels.find((x) => x.id === id); return l ? <span key={id} className={cn("rounded px-2 py-0.5", LABEL_COLORS[l.color]?.chip ?? "bg-black/5")}>{l.name}</span> : null; })}
						</div>
						<hr className="-mx-6 mt-4 border-black/[0.07]" />

						{summary ? (
							<p className="mt-4 flex gap-2 rounded-lg bg-black/[0.04] p-3 text-sm text-[#37352f]"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#787774]" />{summary}</p>
						) : summaryBusy ? (
							<p className="mt-4 flex items-center gap-2 text-sm text-[#787774]"><Loader2 className="h-4 w-4 animate-spin" /> Summarising...</p>
						) : null}

						<div className="mt-4 flex items-start gap-3">
							<div className="min-w-0 flex-1">
								<p className="text-[15px] text-[#37352f]">
									{detail.from[0] ? <PersonChip name={detail.from[0].name} address={detail.from[0].address} onWrite={onWrite} onAddContact={onAddContact} className="font-medium" /> : null}{" "}
									<span className="text-[13px] text-[#9b9a97]">&lt;{detail.from[0]?.address}&gt;</span>
								</p>
								<p className="flex flex-wrap items-center gap-x-1 text-[15px] text-[#9b9a97]">
									<span>To</span>
									{detail.to.length === 0 ? <span>me</span> : detail.to.map((t, k) => <span key={t.address + k} className="inline-flex items-center"><PersonChip name={t.name} address={t.address} onWrite={onWrite} onAddContact={onAddContact} className="text-[#787774]" />{k < detail.to.length - 1 ? "," : ""}</span>)}
									{detail.cc.length > 0 && <span>, Cc</span>}
									{detail.cc.map((t, k) => <span key={t.address + k} className="inline-flex items-center"><PersonChip name={t.name} address={t.address} onWrite={onWrite} onAddContact={onAddContact} className="text-[#787774]" />{k < detail.cc.length - 1 ? "," : ""}</span>)}
								</p>
							</div>
							<span className="shrink-0 text-[15px] text-[#9b9a97]">{detail.date ? format(new Date(detail.date), "MMM d") : ""}</span>
						</div>

{detail.hasRemoteImages && !allowImages && (
							<div className="mt-4 flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Images are hidden to protect your privacy.<Button size="sm" variant="outline" className="ml-auto" onClick={onLoadImages}>Show images</Button></div>
						)}

						<iframe ref={frame} title="Message" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} onLoad={measure} style={{ height: h }} className="mt-4 w-full border-0" />

						{detail.attachments.filter((a) => !a.inline).length > 0 && (
							<ul className="mt-4 flex flex-wrap gap-2">
								{detail.attachments.filter((a) => !a.inline).map((a) => (
									<li key={a.index}>
										<a href={`/api/mjengo/mail/attachment?account=${accountId}&mailbox=${encodeURIComponent(selected?.mailbox ?? "")}&uid=${detail.uid}&i=${a.index}`} className="flex items-center gap-2 rounded-xl border border-serene-neutral-200 px-3 py-2 text-sm hover:bg-serene-neutral-50">
											<Paperclip className="h-4 w-4 text-serene-neutral-500" /><span className="max-w-[200px] truncate">{a.filename}</span><span className="text-xs text-serene-neutral-400">{a.size > 1048576 ? `${(a.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(a.size / 1024))} KB`}</span>
										</a>
									</li>
								))}
							</ul>
						)}

						{conversation.length > 0 && (
							<section className="mt-6 border-t border-serene-neutral-100 pt-4">
								<h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-serene-neutral-400">In this conversation</h3>
								<ul className="divide-y divide-serene-neutral-50">
									{conversation.map((c) => (
										<li key={c.uid}><button onClick={() => onOpen(c)} className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-serene-neutral-50"><span className="w-32 shrink-0 truncate font-medium">{displayName(c.from)}</span><span className="min-w-0 flex-1 truncate text-serene-neutral-500">{c.subject}</span><span className="shrink-0 text-xs text-serene-neutral-400">{rowTime(c.date)}</span></button></li>
									))}
								</ul>
							</section>
						)}

						<div className="mt-6 flex gap-2">
							<Button variant="outline" className="gap-2" onClick={() => onReply(false)}><Reply className="h-4 w-4" /> Reply</Button>
							<Button variant="outline" className="gap-2" onClick={onForward}><Forward className="h-4 w-4" /> Forward</Button>
						</div>
					</article>
				)}
			</div>
		</div>
	);
}
