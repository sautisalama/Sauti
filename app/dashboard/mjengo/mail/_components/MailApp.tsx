"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, isThisWeek, isToday, isYesterday, startOfDay } from "date-fns";
import {
	Archive, ArrowLeft, Command as CommandIcon, Edit3, FileText, Flag, Forward, Inbox, Loader2, Mail, MailOpen, Menu, Paperclip, Pencil, Plus, Reply, ReplyAll, Search, Send, Settings, ShieldAlert, Sparkles, Star, Tag, Trash2, User, X,
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
import { ConnectDialog, SettingsDialog, ViewDialog } from "./Dialogs";

type Detail = Awaited<ReturnType<typeof getMessageDetail>>;
type Layout = "side" | "center" | "full";
type HoverAction = NonNullable<ViewConfig["hoverActions"]>[number];

const BUILT_IN: { key: string; label: string; icon: typeof Inbox; config: ViewConfig }[] = [
	{ key: "inbox", label: "Inbox", icon: Inbox, config: { mailbox: "inbox", group: "date" } },
	{ key: "unread", label: "Unread", icon: Mail, config: { mailbox: "inbox", unread: true, group: "date" } },
	{ key: "starred", label: "Starred", icon: Star, config: { mailbox: "inbox", starred: true, group: "date" } },
	{ key: "sent", label: "Sent", icon: Send, config: { mailbox: "sent", group: "date" } },
	{ key: "drafts", label: "Drafts", icon: FileText, config: { mailbox: "drafts", group: "date" } },
	{ key: "archive", label: "Archive", icon: Archive, config: { mailbox: "archive", group: "date" } },
	{ key: "spam", label: "Spam", icon: ShieldAlert, config: { mailbox: "spam", group: "date" } },
	{ key: "trash", label: "Trash", icon: Trash2, config: { mailbox: "trash", group: "date" } },
];
const ICON: Record<string, typeof Inbox> = { inbox: Inbox, star: Star, paperclip: Paperclip, user: User, tag: Tag, flag: Flag };
const DEFAULT_HOVER: HoverAction[] = ["archive", "trash", "unread", "star"];

const displayName = (m: { name: string; address: string }) => m.name || m.address || "Unknown";

function groupLabel(d: string | null, mode: ViewConfig["group"], from: string): string {
	if (mode === "none") return "";
	if (mode === "sender") return from;
	if (!d) return "Earlier";
	const date = new Date(d);
	if (isToday(date)) return "Today";
	if (isYesterday(date)) return "Yesterday";
	if (isThisWeek(date, { weekStartsOn: 1 })) return "This week";
	return date >= startOfDay(new Date(Date.now() - 30 * 86400000)) ? "This month" : "Earlier";
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
	const [viewKey, setViewKey] = useState("inbox");
	const [q, setQ] = useState("");
	const [debouncedQ, setDebouncedQ] = useState("");

	const [rows, setRows] = useState<MessageRow[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	const [selected, setSelected] = useState<MessageRow | null>(null);
	const [detail, setDetail] = useState<Detail | null>(null);
	const [detailBusy, setDetailBusy] = useState(false);
	const [allowImages, setAllowImages] = useState(false);
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
		const [v, s] = await Promise.all([listViews(), listSnippets()]);
		setViews(v);
		setSnippets(s);
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
		loadAccounts().catch(() => setAccounts([]));
		loadMeta().catch(() => undefined);
	}, [loadAccounts, loadMeta]);

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
		const custom = views.find((v) => `custom:${v.id}` === viewKey);
		if (custom) return { label: custom.name, icon: ICON[custom.icon] ?? Inbox, config: custom.config, view: custom };
		const b = BUILT_IN.find((x) => x.key === viewKey) ?? BUILT_IN[0];
		return { label: b.label, icon: b.icon, config: b.config, view: null as ViewRow | null };
	}, [views, viewKey]);

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
			const res = await listMessages(accountId, mailboxPath, { unread: c.unread, starred: c.starred, hasAttachment: c.hasAttachment, from: c.from, text: debouncedQ }, append ? rows.length : 0, 40);
			if (token !== listToken.current) return;
			setRows((prev) => (append ? [...prev, ...res.items.filter((i) => !prev.some((p) => p.uid === i.uid))] : res.items));
			setTotal(res.total);
		} catch (e) {
			if (token === listToken.current) setLoadError(e instanceof Error ? e.message : "Could not load this folder.");
		} finally {
			if (token === listToken.current) setLoading(false);
		}
	}, [accountId, mailboxPath, active, debouncedQ, rows.length]);

	// Reload when the account, view or search changes.
	useEffect(() => {
		setSelected(null);
		setDetail(null);
		if (accountId && mailboxPath) loadList(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [accountId, mailboxPath, viewKey, debouncedQ, views]);

	/* ---- opening a message */
	const open = useCallback(async (m: MessageRow, images = false) => {
		if (!accountId) return;
		setSelected(m);
		setDetailBusy(true);
		setSummary(null);
		setConversation([]);
		if (!images) setAllowImages(false);
		try {
			const d = await getMessageDetail(accountId, m.mailbox, m.uid, images);
			setDetail(d);
			setRows((prev) => prev.map((r) => (r.uid === m.uid ? { ...r, seen: true } : r)));
			if (!m.seen) setUnread((u) => Math.max(0, u - 1));
			getConversation(accountId, m.mailbox, d.subject).then((c) => setConversation(c.filter((x) => x.uid !== m.uid))).catch(() => undefined);
		} catch (e) {
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
						<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-700"><Mail className="h-7 w-7" /></div>
						<h2 className="text-xl font-bold text-serene-neutral-900">Bring your email here</h2>
						<p className="mt-2 text-sm text-serene-neutral-600">Connect one or more inboxes to read, search and send mail alongside your grants and projects. Make views for the mail that matters.</p>
						<Button onClick={() => setConnectOpen(true)} className="mt-6 gap-2 bg-purple-600 hover:bg-purple-700"><Plus className="h-4 w-4" /> Connect a mailbox</Button>
					</div>
				</div>
				<ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} onConnected={(a) => { setAccounts([a]); setAccountId(a.id); }} />
			</>
		);
	}

	const groups: { label: string; items: MessageRow[] }[] = [];
	for (const r of rows) {
		const label = groupLabel(r.date, active.config.group ?? "date", displayName(r.from));
		const g = groups.find((x) => x.label === label);
		if (g) g.items.push(r); else groups.push({ label, items: [r] });
	}
	const hover = active.config.hoverActions ?? DEFAULT_HOVER;
	const effectiveLayout: Layout = layout;

	const sidebar = (
		<div className="flex h-full flex-col bg-[#f7f7f5]">
			<div className="space-y-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
				<Select value={accountId ?? undefined} onValueChange={(v) => { setAccountId(v); setViewKey("inbox"); }}>
					<SelectTrigger className="h-10 border-0 bg-white shadow-sm"><SelectValue /></SelectTrigger>
					<SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>)}</SelectContent>
				</Select>
				<Button onClick={() => { setCompose({}); setNavOpen(false); }} className="w-full justify-start gap-2 bg-purple-600 hover:bg-purple-700"><Edit3 className="h-4 w-4" /> Compose <span className="ml-auto text-xs opacity-70">C</span></Button>
				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
					<Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search mail" className="h-9 border-0 bg-white pl-9 shadow-sm" />
				</div>
			</div>
			<nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Views">
				<p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-serene-neutral-400">Views</p>
				{BUILT_IN.map((b) => <NavItem key={b.key} active={viewKey === b.key} icon={b.icon} label={b.label} badge={b.key === "inbox" ? unread : 0} onClick={() => { setViewKey(b.key); setNavOpen(false); }} />)}
				{views.length > 0 && <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-serene-neutral-400">Your views</p>}
				{views.map((v) => <NavItem key={v.id} active={viewKey === `custom:${v.id}`} icon={ICON[v.icon] ?? Inbox} label={v.name} onClick={() => { setViewKey(`custom:${v.id}`); setNavOpen(false); }} onEdit={() => setViewEdit(v)} />)}
				<button onClick={() => setViewEdit({})} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-serene-neutral-500 hover:bg-white/70"><Plus className="h-4 w-4" /> New view</button>
			</nav>
			<div className="space-y-px border-t border-serene-neutral-200/70 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
				<button onClick={() => setCmdOpen(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-serene-neutral-600 hover:bg-white/70"><CommandIcon className="h-4 w-4" /> Command menu <kbd className="ml-auto rounded border bg-white px-1.5 text-[10px]">Ctrl K</kbd></button>
				<button onClick={() => setSettingsOpen(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-serene-neutral-600 hover:bg-white/70"><Settings className="h-4 w-4" /> Settings</button>
			</div>
		</div>
	);

	const Pane = (
		<ReadingPane
			selected={selected} detail={detail} busy={detailBusy} accountId={accountId!} conversation={conversation} summary={summary} summaryBusy={summaryBusy} allowImages={allowImages}
			onClose={close} onSummarise={summarise} onOpen={(m) => open(m)} onAct={(a) => selected && act(selected, a)}
			onReply={(all) => detail && startReply(detail, all)} onForward={() => detail && startReply(detail, false, true)}
			onLoadImages={() => { setAllowImages(true); if (selected) open(selected, true); }} full={effectiveLayout === "full"}
		/>
	);

	return (
		<div className="flex h-full min-h-0 bg-white">
			<aside className="hidden w-[248px] shrink-0 border-r border-serene-neutral-200/70 lg:block">{sidebar}</aside>
			<Sheet open={navOpen} onOpenChange={setNavOpen}><SheetContent side="left" className="w-[280px] p-0"><SheetTitle className="sr-only">Mail navigation</SheetTitle>{sidebar}</SheetContent></Sheet>

			<main className={cn("flex min-w-0 flex-1 flex-col", selected && effectiveLayout === "full" && "hidden")}>
				<header className="flex items-center gap-2 border-b border-serene-neutral-100 px-3 py-2">
					<Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
					<active.icon className="h-4 w-4 text-serene-neutral-500" />
					<h2 className="text-sm font-bold text-serene-neutral-900">{active.label}</h2>
					<span className="text-xs text-serene-neutral-400">{total ? `${total}` : ""}</span>
					<div className="flex-1" />
					{debouncedQ && <span className="hidden rounded-full bg-serene-neutral-100 px-2.5 py-1 text-xs text-serene-neutral-600 sm:inline">Searching “{debouncedQ}”</span>}
					{active.view && <Button variant="ghost" size="sm" className="gap-1.5 text-serene-neutral-600" onClick={() => setViewEdit(active.view)}><Pencil className="h-3.5 w-3.5" /> Edit view</Button>}
					<Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={() => setCompose({})} aria-label="Compose"><Edit3 className="h-4 w-4" /></Button>
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto">
					{loadError && <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError} <button className="ml-2 underline" onClick={() => loadList(false)}>Try again</button></div>}
					{!loadError && loading && rows.length === 0 && <div className="space-y-px p-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-serene-neutral-50" />)}</div>}
					{!loadError && !loading && rows.length === 0 && (
						<div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-serene-neutral-500"><MailOpen className="h-10 w-10 text-serene-neutral-300" /><p className="font-medium text-serene-neutral-700">{debouncedQ ? "Nothing matches your search" : "Nothing here"}</p><p className="text-sm">{debouncedQ ? "Try different words." : "New mail will appear as it arrives."}</p></div>
					)}
					{groups.map((g) => (
						<section key={g.label}>
							{g.label && <h3 className="sticky top-0 z-[1] bg-white/95 px-4 py-1.5 text-xs font-semibold text-serene-neutral-400 backdrop-blur">{g.label}</h3>}
							<ul>
								{g.items.map((m) => (
									<li key={m.uid} className="group relative">
										<button onClick={() => open(m)} className={cn("flex w-full touch-manipulation items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-serene-neutral-50", selected?.uid === m.uid && "bg-purple-50/70")}>
											<span className={cn("h-2 w-2 shrink-0 rounded-full", m.seen ? "bg-transparent" : "bg-purple-600")} aria-label={m.seen ? "" : "Unread"} />
											<span className={cn("w-36 shrink-0 truncate text-sm sm:w-44", m.seen ? "text-serene-neutral-700" : "font-semibold text-serene-neutral-900")}>{displayName(m.from)}</span>
											<span className={cn("min-w-0 flex-1 truncate text-sm", m.seen ? "text-serene-neutral-600" : "font-semibold text-serene-neutral-900")}>
												{m.subject}
												{m.thread > 1 && <span className="ml-2 rounded bg-serene-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-serene-neutral-500">{m.thread}</span>}
											</span>
											{m.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-serene-neutral-400" />}
											{m.flagged && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
											<span className="w-14 shrink-0 text-right text-xs text-serene-neutral-400 group-hover:invisible">{rowTime(m.date)}</span>
										</button>
										<div className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg border border-serene-neutral-200 bg-white p-0.5 shadow-sm group-hover:flex">
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
					{rows.length < total && !loading && <div className="flex justify-center p-4"><Button variant="ghost" size="sm" onClick={() => loadList(true)}>Load older ({total - rows.length} more)</Button></div>}
					{loading && rows.length > 0 && <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" /></div>}
				</div>
			</main>

			{/* Reading: side peek / full page, or a centred dialog */}
			{selected && effectiveLayout === "side" && <aside className="fixed inset-0 z-30 bg-white lg:static lg:z-auto lg:w-[46%] lg:max-w-[760px] lg:border-l lg:border-serene-neutral-200/70">{Pane}</aside>}
			{selected && effectiveLayout === "full" && <section className="min-w-0 flex-1">{Pane}</section>}
			{selected && effectiveLayout === "center" && (
				<Dialog open onOpenChange={(o) => !o && close()}><DialogContent className="h-[88vh] max-w-3xl gap-0 overflow-hidden p-0 [&>button]:hidden"><DialogTitle className="sr-only">Message</DialogTitle>{Pane}</DialogContent></Dialog>
			)}

			{compose && accountId && <Composer accounts={accounts} accountId={accountId} seed={compose} snippets={snippets} onClose={() => setCompose(null)} onSent={() => { setCompose(null); if (active.config.mailbox === "sent") loadList(false); }} />}
			<ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} onConnected={(a) => { setAccounts((p) => [...(p ?? []), a]); setAccountId(a.id); }} />
			<SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} accounts={accounts} onAccountsChanged={() => loadAccounts().catch(() => undefined)} onConnect={() => setConnectOpen(true)} snippets={snippets} onSnippetsChanged={() => loadMeta().catch(() => undefined)} layout={layout} onLayout={changeLayout} />
			{viewEdit && (
				<ViewDialog
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

function NavItem({ active, icon: Icon, label, badge, onClick, onEdit }: { active: boolean; icon: typeof Inbox; label: string; badge?: number; onClick: () => void; onEdit?: () => void }) {
	return (
		<div className={cn("group flex items-center rounded-lg", active ? "bg-white shadow-sm" : "hover:bg-white/70")}>
			<button onClick={onClick} aria-current={active ? "page" : undefined} className={cn("flex min-w-0 flex-1 touch-manipulation items-center gap-2 px-2 py-1.5 text-left text-sm", active ? "font-semibold text-serene-neutral-900" : "text-serene-neutral-700")}>
				<Icon className="h-4 w-4 shrink-0 text-serene-neutral-500" />
				<span className="truncate">{label}</span>
				{!!badge && <span className="ml-auto rounded-full bg-purple-600 px-1.5 text-[10px] font-bold text-white">{badge > 99 ? "99+" : badge}</span>}
			</button>
			{onEdit && <button onClick={onEdit} aria-label={`Edit ${label}`} className="mr-1 hidden rounded p-1 text-serene-neutral-400 hover:text-serene-neutral-800 group-hover:block"><Pencil className="h-3.5 w-3.5" /></button>}
		</div>
	);
}

function HoverBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
	return <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={label} aria-label={label} className="rounded-md p-1.5 text-serene-neutral-600 hover:bg-serene-neutral-100">{children}</button>;
}

function ReadingPane({ selected, detail, busy, accountId, conversation, summary, summaryBusy, allowImages, onClose, onSummarise, onOpen, onAct, onReply, onForward, onLoadImages, full }: {
	selected: MessageRow | null; detail: Detail | null; busy: boolean; accountId: string; conversation: MessageRow[]; summary: string | null; summaryBusy: boolean; allowImages: boolean;
	onClose: () => void; onSummarise: () => void; onOpen: (m: MessageRow) => void; onAct: (a: MailAction) => void; onReply: (all: boolean) => void; onForward: () => void; onLoadImages: () => void; full: boolean;
}) {
	const frame = useRef<HTMLIFrameElement>(null);
	const [h, setH] = useState(300);
	const doc = useMemo(
		() =>
			detail
				? `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;word-wrap:break-word}img{max-width:100%;height:auto}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #e5e7eb;color:#6b7280}a{color:#7c3aed}pre{white-space:pre-wrap}table{max-width:100%}</style></head><body>${detail.html ?? `<pre style="font:inherit">${detail.text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`}</body></html>`
				: "",
		[detail]
	);
	const measure = () => {
		const d = frame.current?.contentDocument;
		if (d?.body) setH(Math.max(120, d.documentElement.scrollHeight + 8));
	};

	return (
		<div className="flex h-full min-h-0 flex-col bg-white">
			<header className="flex items-center gap-1 border-b border-serene-neutral-100 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
				<Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose} aria-label={full ? "Back to inbox" : "Close"}>{full ? <ArrowLeft className="h-4 w-4" /> : <X className="h-4 w-4" />}</Button>
				<div className="flex-1" />
				{detail && <>
					<Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onReply(false)} aria-label="Reply" title="Reply (R)"><Reply className="h-4 w-4" /></Button>
					<Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onReply(true)} aria-label="Reply all"><ReplyAll className="h-4 w-4" /></Button>
					<Button variant="ghost" size="icon" className="h-9 w-9" onClick={onForward} aria-label="Forward"><Forward className="h-4 w-4" /></Button>
					<Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onAct("archive")} aria-label="Archive" title="Archive (E)"><Archive className="h-4 w-4" /></Button>
					<Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onAct(selected?.seen ? "unread" : "read")} aria-label="Mark unread" title="Mark unread (U)"><Mail className="h-4 w-4" /></Button>
					<Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onAct(selected?.flagged ? "unstar" : "star")} aria-label="Star" title="Star (S)"><Star className={cn("h-4 w-4", selected?.flagged && "fill-amber-400 text-amber-400")} /></Button>
					<Button variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={() => onAct("trash")} aria-label="Delete" title="Delete (#)"><Trash2 className="h-4 w-4" /></Button>
				</>}
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{busy && !detail && <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>}
				{detail && (
					<article className="mx-auto max-w-3xl p-5">
						<h2 className="text-xl font-bold leading-snug text-serene-neutral-900">{detail.subject}</h2>

						{summary ? (
							<p className="mt-3 flex gap-2 rounded-xl bg-purple-50 p-3 text-sm text-purple-950"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />{summary}</p>
						) : (
							<Button variant="ghost" size="sm" className="mt-2 -ml-2 gap-1.5 text-purple-700" onClick={onSummarise} disabled={summaryBusy}>{summaryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Summarise</Button>
						)}

						<div className="mt-4 flex items-start gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">{displayName(detail.from[0] ?? { name: "", address: "" }).charAt(0).toUpperCase()}</div>
							<div className="min-w-0 flex-1 text-sm">
								<p className="font-semibold text-serene-neutral-900">{displayName(detail.from[0] ?? { name: "", address: "" })} <span className="font-normal text-serene-neutral-500">&lt;{detail.from[0]?.address}&gt;</span></p>
								<p className="truncate text-xs text-serene-neutral-500">to {detail.to.map(displayName).join(", ") || "me"}{detail.cc.length ? `, cc ${detail.cc.map(displayName).join(", ")}` : ""}</p>
							</div>
							<span className="shrink-0 text-xs text-serene-neutral-400">{detail.date ? format(new Date(detail.date), "d MMM yyyy, HH:mm") : ""}</span>
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
