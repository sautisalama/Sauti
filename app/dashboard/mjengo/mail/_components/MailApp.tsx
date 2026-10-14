"use client";

import { MjengoLoader } from "../../_components/MjengoLoader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, isThisWeek, isToday, isYesterday, startOfDay } from "date-fns";
import {
	Archive, Check, ArrowLeft, ChevronDown, ChevronUp, ChevronsRight, Clock, ListFilter, MoreHorizontal, RotateCw, SlidersHorizontal, Command as CommandIcon, Edit3, FileText, Flag, Forward, Inbox, Loader2, Mail, MailOpen, Menu, Paperclip, Pencil, Plus, Reply, ReplyAll, Search, Send, Settings, ShieldAlert, FolderKanban, Sparkles, Star, Tag, Trash2, User, X,
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
	actOnMessages, deleteView, getThread, getMailboxes, getMessageDetail, listAccounts, listMessages, listSnippets, listViews, saveView, summariseMessage,
	type AccountView, type MailAction, type MessageRow, type SnippetRow, type ViewConfig, type ViewRow,
} from "./api";
import { Composer, type ComposeSeed, type ThreadMsg } from "./Composer";
import { ConnectDialog, LabelDialog, LABEL_COLORS, SettingsDialog, ViewDialog } from "./Dialogs";
import { getMailPrefs, getSignature, mailBootstrap, type MailPrefs, type SignatureState } from "./api";
import { PersonChip } from "./PersonChip";
import { AiSummary, ThreadMessage } from "./Thread";
import { MeetingChips } from "./MeetingChips";
import { unwrap } from "@/lib/action-result";
import { addContactFromMail } from "@/app/actions/mjengo-contacts";
import { listLabels, saveLabel, deleteLabel, setMessageLabel, projectLabel, listGrantsLite, linkToWork, mailTriage, type LabelRow, type ProjectLite, type GrantLite } from "./api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AccountSwitcher } from "./AccountSwitcher";
import { detailKey, listKey, mailStore, mergeFresh, prefetchDetails, setMailUnread } from "./mail-store";
import { AvatarStack, useTeam } from "../../_components/People";
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
	const team = useTeam();
	const teamIds = (addresses: string[]) => addresses.map((a) => team.find((t) => t.email === a.toLowerCase())?.id);
	const [accounts, setAccounts] = useState<AccountView[] | null>(null);
	const [accountId, setAccountId] = useState<string | null>(null);
	const [boxes, setBoxes] = useState<MailboxInfo[]>([]);
	const [unread, setUnread] = useState(0);
	const [views, setViews] = useState<ViewRow[]>([]);
	const [snippets, setSnippets] = useState<SnippetRow[]>([]);
	const [signature, setSignature] = useState<SignatureState | null>(null);
	const [prefs, setPrefs] = useState<MailPrefs>({ undoSeconds: 5, replyDefault: "reply", conversationView: true, density: "comfortable", blocked: [] });
		const [labels, setLabels] = useState<LabelRow[]>([]);
	const [labelEdit, setLabelEdit] = useState<Partial<LabelRow> | null>(null);
	const [projects, setProjects] = useState<ProjectLite[]>([]);
	useEffect(() => { try { localStorage.setItem("ss_mail_used", "1"); } catch { /* no storage */ } }, []);
	// A link in an email that was tagged as a grant or an opportunity: offered a place in the suite.
	const [workPrompt, setWorkPrompt] = useState<{ url: string; subject: string; links: string[] } | null>(null);
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
	const selectedRef = useRef<MessageRow | null>(null);
	selectedRef.current = selected;
	const [detail, setDetail] = useState<Detail | null>(null);
	const [detailBusy, setDetailBusy] = useState(false);
	// Remote images always load: this is the team's own mail and the images are part of the message.
	const [allowImages, setAllowImages] = useState(true);
	const [conversation, setConversation] = useState<MessageRow[]>([]);
	const [summary, setSummary] = useState<string | null>(null);
	const [summaryBusy, setSummaryBusy] = useState(false);

	const [layout, setLayout] = useState<Layout>("side");
	const [compose, setCompose] = useState<ComposeSeed | null>(null);
	// A reply is written in the conversation itself, under the messages it answers.
	const [reply, setReply] = useState<ComposeSeed | null>(null);
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
		(mailStore.boot ??= mailBootstrap().catch((e) => { mailStore.boot = null; throw e; }))
			.then((b) => {
				setAccounts(b.accounts);
				setAccountId((cur) => (cur && b.accounts.some((x) => x.id === cur) ? cur : b.accounts[0]?.id ?? null));
				setViews(b.views);
				setSnippets(b.snippets);
				setLabels(b.labels);
				setProjects((b as { projects?: ProjectLite[] }).projects ?? []);
				if (b.signature) setSignature(b.signature);
			})
			.catch(() => setAccounts([]));
	}, []);

	useEffect(() => { getMailPrefs().then(setPrefs).catch(() => undefined); }, []);

	useEffect(() => {
		if (!accountId) return;
		const have = mailStore.boxes.get(accountId);
		setBoxes(have?.boxes ?? []);
		if (have) setUnread(have.unread);
		// Already fetched (by the preload or an earlier visit): only ask again once it is a little old.
		if (have && Date.now() - have.at < 60_000) return;
		getMailboxes(accountId)
			.then((r) => { mailStore.boxes.set(accountId, { ...r, at: Date.now() }); setBoxes(r.boxes); setUnread(r.unread); setMailUnread(r.unread); })
			.catch((e) => { if (!have) setLoadError(e instanceof Error ? e.message : "Could not reach the mailbox."); });
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

	const loadList = useCallback(async (append = false, silent = false) => {
		if (!accountId || !mailboxPath) return;
		const token = ++listToken.current;
		if (!silent) setLoading(true);
		setLoadError(null);
		try {
			const c = active.config;
			const res = await listMessages(accountId, mailboxPath, { unread: c.unread || onlyUnread, starred: c.starred, hasAttachment: c.hasAttachment, from: c.from, labelId: c.labelId, text: debouncedQ }, append ? rows.length : 0, 40);
			if (token !== listToken.current) return;
			setRows((prev) => {
				const next = append ? [...prev, ...res.items.filter((i) => !prev.some((p) => p.uid === i.uid))] : silent ? mergeFresh(prev, res.items) : res.items;
				if (!debouncedQ) mailStore.lists.set(listKey(accountId, viewKey, onlyUnread), { items: next, total: res.total, at: Date.now() });
				return next;
			});
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
		if (!accountId || !mailboxPath) return;
		// Paint what we already have straight away; then fetch only if it is old, and fold in what is new.
		const hit = !debouncedQ ? mailStore.lists.get(listKey(accountId, viewKey, onlyUnread)) : undefined;
		if (hit) {
			setRows(hit.items);
			setTotal(hit.total);
			if (Date.now() - hit.at > 30_000) loadList(false, true);
		} else loadList(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [accountId, mailboxPath, viewKey, debouncedQ, views, onlyUnread]);

	// The browser tab shows how many unread messages there are.
	useEffect(() => {
		document.title = unread > 0 ? `(${unread}) Mail` : "Mail";
		return () => { document.title = "Mail"; };
	}, [unread]);

	// New mail shows up by itself: check quietly when the tab regains focus and once a minute.
	useEffect(() => {
		if (!accountId || !mailboxPath) return;
		const tick = () => {
			if (document.hidden || debouncedQ) return;
			loadList(false, true);
			getMailboxes(accountId).then((r) => { mailStore.boxes.set(accountId, { ...r, at: Date.now() }); setUnread(r.unread); setMailUnread(r.unread); }).catch(() => undefined);
		};
		const t = setInterval(tick, 60_000);
		window.addEventListener("focus", tick);
		return () => { clearInterval(t); window.removeEventListener("focus", tick); };
	}, [accountId, mailboxPath, debouncedQ, loadList]);

	/* ---- opening a message */
	const open = useCallback(async (m: MessageRow, images = true) => {
		if (!accountId) return;
		const key = detailKey(accountId, m.mailbox, m.uid);
		const cached = mailStore.details.get(key);
		setSelected(m);
		setSummary(null);
		// What we already have is shown at once; the rest streams in behind it.
		const convoKey = `${accountId}:${m.mailbox}:${cached?.subject ?? m.subject}`;
		setConversation((mailStore.convos.get(convoKey) ?? []).filter((x) => x.uid !== m.uid));
		if (cached) {
			setDetail(cached);
			setDetailBusy(false);
			setRows((prev) => prev.map((r) => (r.uid === m.uid ? { ...r, seen: true } : r)));
			if (!m.seen) {
				setUnread((u) => Math.max(0, u - 1));
				actOnMessages(accountId, m.mailbox, [m.uid], "read").catch(() => undefined);
			}
		} else {
			setDetail(null);
			setDetailBusy(true);
		}
		try {
			if (!cached) {
				const d = await getMessageDetail(accountId, m.mailbox, m.uid, images);
				mailStore.details.set(key, d);
				// The person may have moved on while this loaded.
				if (selectedRef.current?.uid !== m.uid) return;
				setDetail(d);
				cacheDetail(`${accountId}:${m.mailbox}:${m.uid}`, d);
				setRows((prev) => prev.map((r) => (r.uid === m.uid ? { ...r, seen: true } : r)));
				if (!m.seen) setUnread((u) => Math.max(0, u - 1));
			}
			const subject = (mailStore.details.get(key) ?? cached)?.subject ?? m.subject;
			const ck = `${accountId}:${m.mailbox}:${subject}`;
			getThread(accountId, m.mailbox, subject).then((t) => {
				// Bodies first, then the list that points at them, so every row can show its text at once.
				for (const d of t.details) mailStore.details.set(detailKey(accountId, d.mailbox, d.uid), d as never);
				mailStore.convos.set(ck, t.rows);
				if (selectedRef.current?.uid === m.uid) setConversation(t.rows.filter((x) => !(x.uid === m.uid && x.mailbox === m.mailbox)));
			}).catch(() => undefined);
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

	// The message list keeps the next messages' bodies ready, so flipping between emails has no wait.
	useEffect(() => {
		if (!accountId || rows.length === 0) return;
		const idx = selected ? rows.findIndex((r) => r.uid === selected.uid) : 0;
		const from = Math.max(0, idx - 2);
		const near = rows.slice(from, from + 14);
		const t = setTimeout(() => { prefetchDetails(accountId, near).catch(() => undefined); }, 350);
		return () => clearTimeout(t);
	}, [accountId, rows, selected?.uid]);

	const close = () => { setSelected(null); setDetail(null); setReply(null); };
	useEffect(() => { setReply(null); }, [selected?.uid]);

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

	/** Tag a message with a project: the project's own label is made the first time. */
	const toggleProject = async (messageId: string, projectId: string, on: boolean, uid?: number) => {
		try {
			const label = await projectLabel(projectId);
			setLabels((cur) => (cur.some((l) => l.id === label.id) ? cur : [...cur, label]));
			await toggleLabel(messageId, label.id, on, uid);
		} catch (e) {
			toast({ title: "Could not tag the project", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	};

	/** Add or remove a label on a message; reflected straight away in the list. */
	const toggleLabel = async (messageId: string, labelId: string, on: boolean, uid?: number) => {
		if (!accountId) return;
		const apply = (r: MessageRow) => (r.messageId === messageId ? { ...r, labels: on ? Array.from(new Set([...r.labels, labelId])) : r.labels.filter((x) => x !== labelId) } : r);
		setRows((prev) => prev.map(apply));
		if (selected && selected.messageId === messageId) setSelected((s) => (s ? apply(s) : s));
		try {
			await setMessageLabel(accountId, messageId, labelId, on);
			const lab = labels.find((l) => l.id === labelId);
			if (on) toast({ title: `Labelled ${lab?.name ?? ""}` });
			// Tagged as something that comes with a link (a grant, an opportunity): offer to put the link to work.
			if (on && lab && (lab.project_id ? false : /grant|opportunit|fund|tender|fellowship|call for|proposal/i.test(lab.name)) && detail && selected?.messageId === messageId) {
				const links = linksIn(detail.html ?? "", detail.text ?? "");
				if (links.length) setWorkPrompt({ url: links[0], subject: detail.subject, links });
			}
		} catch (e) {
			toast({ title: "Could not change the label", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			loadList(false);
		}
		void uid;
	};

	const startReply = (d: Detail, all: boolean, forward = false) => {
		const me = accounts?.find((a) => a.id === accountId)?.email.toLowerCase();
		const sender = d.from[0]?.address;
		const bodyHtml = d.html ?? `<p>${d.text.replace(/\n/g, "<br>")}</p>`;
		const quote = `<br><blockquote><p>On ${d.date ? format(new Date(d.date), "d MMM yyyy, HH:mm") : ""}, ${displayName(d.from[0] ?? { name: "", address: "" })} wrote:</p>${bodyHtml}</blockquote>`;
		const subject = d.subject.replace(/^((re|fwd?):\s*)+/i, "");
		// The conversation, newest first, each message with its own colour in the composer.
		const here = selected;
		const thread: ThreadMsg[] = [
			...(here ? [{ key: `cur-${here.uid}`, mailbox: here.mailbox, uid: here.uid, name: displayName(d.from[0] ?? { name: "", address: "" }), address: d.from[0]?.address ?? "", date: d.date, html: bodyHtml, mine: d.from[0]?.address.toLowerCase() === me } as ThreadMsg] : []),
			...conversation.map((c) => ({
				key: `${c.mailbox}-${c.uid}`, mailbox: c.mailbox, uid: c.uid, name: displayName(c.from), address: c.from.address, date: c.date,
				html: mailStore.details.get(detailKey(accountId!, c.mailbox, c.uid))?.html ?? undefined,
				mine: c.from.address.toLowerCase() === me,
			})),
		];
		const seed: ComposeSeed = forward
				? { subject: `Fwd: ${subject}`, html: `<p></p><p>---------- Forwarded message ----------</p>${d.html ?? d.text}` }
				: {
					to: sender ? [sender] : [],
					cc: all ? [...d.to, ...d.cc].map((a) => a.address).filter((a) => a && a.toLowerCase() !== me && a !== sender) : [],
					subject: `Re: ${subject}`,
					quoteHtml: quote,
					thread,
					inReplyTo: d.messageId,
					references: [...d.references, ...(d.messageId ? [d.messageId] : [])],
					replyTo: selected ? { mailbox: selected.mailbox, uid: selected.uid } : null,
				};
		if (forward) setCompose(seed);
		else setReply({ ...seed, thread });
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
				case "r": if (detail) startReply(detail, prefs.replyDefault === "reply_all"); break;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	/* ---- render */
	if (!accounts) return <MjengoLoader label="Opening your mail" className="h-full min-h-0" />;

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

	const isBlocked = (address: string) => {
		const a = address.toLowerCase();
		return prefs.blocked.some((b) => (b.startsWith("@") ? a.endsWith(b) : a === b));
	};
	const groups: { label: string; items: MessageRow[] }[] = [];
	for (const r of rows.filter((x) => !isBlocked(x.from.address))) {
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
				{labels.filter((l) => !l.project_id).map((l) => (
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

				{labels.some((l) => l.project_id) && (
					<>
						<Heading>Projects</Heading>
						{labels.filter((l) => l.project_id).map((l) => (
							<button key={l.id} onClick={() => { setViewKey(`label:${l.id}`); setNavOpen(false); }} className={cn("flex h-9 w-full touch-manipulation items-center gap-3 rounded-md px-3 text-left text-[15px]", viewKey === `label:${l.id}` ? "bg-black/[0.06]" : "hover:bg-black/5")}>
								<FolderKanban className="h-[18px] w-[18px] shrink-0 text-[#787774]" />
								<span className="truncate">{l.name}</span>
							</button>
						))}
					</>
				)}

				<Heading>Mail</Heading>
				{BUILT_IN.filter((b) => b.section === "mail").map((b) => <NavItem key={b.key} active={viewKey === b.key} icon={b.icon} tone="text-[#787774]" label={b.label} onClick={() => { setViewKey(b.key); setNavOpen(false); }} />)}
			</nav>
			<div className="space-y-px px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
				<button onClick={() => setSettingsOpen(true)} className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-[15px] hover:bg-black/5"><Settings className="h-[18px] w-[18px] text-[#787774]" /> Settings</button>
				<button onClick={() => setCmdOpen(true)} className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-[15px] hover:bg-black/5"><CommandIcon className="h-[18px] w-[18px] text-[#787774]" /> Command menu <kbd className="ml-auto rounded border border-black/10 bg-white px-1.5 text-[10px] text-[#787774]">Ctrl K</kbd></button>
			</div>
		</div>
	);

	const inlineReply = reply && accountId ? (
		<Composer
			key={`reply-${reply.replyTo?.uid ?? "x"}`}
			inline
			accounts={accounts}
			accountId={accountId}
			seed={reply}
			snippets={snippets}
			signature={signature?.html ?? ""}
			undoSeconds={prefs.undoSeconds}
			onReopen={(seed) => setReply(seed)}
			onPopOut={() => { setCompose(reply); setReply(null); }}
			onClose={() => setReply(null)}
			onSent={() => { setReply(null); if (active.config.mailbox === "sent") loadList(false); }}
		/>
	) : null;

const Pane = (
		<ReadingPane
			teamIds={teamIds} team={team}
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
			labels={labels} selectedLabels={rows.find((r) => r.uid === selected?.uid)?.labels ?? selected?.labels ?? []} onToggleLabel={(id, on) => selected?.messageId && toggleLabel(selected.messageId, id, on, selected.uid)} projects={projects} onOpportunity={(links, subject) => setWorkPrompt({ url: links[0], subject, links })} onToggleProject={(id, on) => selected?.messageId && toggleProject(selected.messageId, id, on, selected.uid)} onNewLabel={() => setLabelEdit({})} selected={selected} detail={detail} busy={detailBusy} accountId={accountId!} conversation={conversation} summary={summary} summaryBusy={summaryBusy} allowImages={allowImages}
			onClose={close} onSummarise={summarise} onOpen={(m) => open(m)} onAct={(a) => selected && act(selected, a)}
			onReply={(all) => detail && startReply(detail, all)} onForward={() => detail && startReply(detail, false, true)}
			onLoadImages={() => { setAllowImages(true); if (selected) open(selected, true); }} full={effectiveLayout === "full"}
				meAddress={(accounts.find((a) => a.id === accountId)?.email ?? "").toLowerCase()}
				inlineReply={inlineReply}
		/>
	);

	return (
		<div className="flex h-full min-h-0 bg-white">
			<aside className="hidden w-[268px] shrink-0 border-r border-black/[0.06] lg:block">{sidebar}</aside>
			<Sheet open={navOpen} onOpenChange={setNavOpen}><SheetContent side="left" className="w-[280px] p-0"><SheetTitle className="sr-only">Mail navigation</SheetTitle>{sidebar}</SheetContent></Sheet>

			<WorkPrompt prompt={workPrompt} onClose={() => setWorkPrompt(null)} />
			<main className={cn("flex min-w-0 flex-1 flex-col", selected && effectiveLayout === "full" && "hidden")}>
				<header className="flex items-center gap-2 px-4 py-3 lg:px-6">
					<Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
					<active.icon className="h-5 w-5 text-[#787774]" />
					<h2 className="truncate text-[17px] font-medium text-[#37352f]">{active.label}</h2>
					{debouncedQ && <span className="hidden truncate rounded-full bg-black/5 px-2.5 py-1 text-xs text-[#787774] sm:inline">Searching “{debouncedQ}”</span>}
					<label className="mx-2 hidden h-9 min-w-[180px] max-w-md flex-1 cursor-text items-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-sm focus-within:border-sauti-teal md:flex">
						<Search className="h-4 w-4 shrink-0 text-[#787774]" />
						<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this mailbox" aria-label="Search mail" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#9b9a97]" />
						{q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="text-[#787774] hover:text-[#37352f]"><X className="h-3.5 w-3.5" /></button>}
					</label>
					<div className="flex-1 md:hidden" />
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
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
					{loadError && <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError} <button className="ml-2 underline" onClick={() => loadList(false)}>Try again</button></div>}
					{!loadError && loading && rows.length === 0 && <MjengoLoader label="Loading your mail" compact />}
					{!loadError && !loading && rows.length === 0 && (
						<div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-serene-neutral-500"><MailOpen className="h-10 w-10 text-serene-neutral-300" /><p className="font-medium text-serene-neutral-700">{debouncedQ ? "Nothing matches your search" : "Nothing here"}</p><p className="text-sm">{debouncedQ ? "Try different words." : "New mail will appear as it arrives."}</p></div>
					)}
					{groups.map((g) => (
						<section key={g.label} className="px-4 lg:px-6">
							{g.label && <h3 className="border-b border-black/[0.07] pb-2 pt-6 text-[15px] text-[#787774]">{g.label}</h3>}
							<ul>
								{g.items.map((m) => (
									<SwipeRow key={m.uid} seen={m.seen} onArchive={() => act(m, "archive")} onToggleRead={() => act(m, m.seen ? "unread" : "read")}>
<li className="group relative" draggable={!!m.messageId} onDragStart={(e) => { if (m.messageId) { e.dataTransfer.setData("text/x-message-id", m.messageId); e.dataTransfer.effectAllowed = "copy"; } }}>
										<button onClick={() => open(m)} className={cn("-mx-2 flex w-[calc(100%+1rem)] touch-manipulation items-center gap-3 rounded-md px-2 text-left text-[15px]", prefs.density === "compact" ? "py-1.5" : "py-[11px]", " transition-colors hover:bg-black/[0.04]", selected?.uid === m.uid && "bg-black/[0.05]")}>
											<span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", m.seen ? "bg-transparent" : "bg-sauti-teal")} aria-label={m.seen ? undefined : "Unread"} />
											<span className={cn("w-[34%] max-w-[300px] shrink-0 truncate text-[#37352f] sm:w-[28%]", !m.seen && "font-semibold")}>{displayName(m.from)}</span>
											<span className={cn("min-w-0 flex-1 truncate text-[#37352f]", !m.seen && "font-medium")}>
												{m.subject}
												{prefs.conversationView && m.thread > 1 && <span className="ml-2 rounded bg-black/[0.05] px-1.5 py-0.5 text-[11px] text-[#787774]">{m.thread}</span>}
											</span>
											{m.labels.slice(0, 2).map((id) => { const l = labels.find((x) => x.id === id); return l ? <span key={id} className="hidden shrink-0 rounded bg-black/[0.05] px-2 py-0.5 text-[13px] text-[#37352f] md:inline">{l.name}</span> : null; })}
											<AvatarStack ids={teamIds([m.from.address])} team={team} className="hidden sm:flex" />
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
</SwipeRow>
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

			{compose && accountId && <Composer accounts={accounts} accountId={accountId} seed={compose} snippets={snippets} signature={signature?.html ?? ""} undoSeconds={prefs.undoSeconds} onReopen={(seed) => setCompose(seed)} onClose={() => setCompose(null)} onSent={() => { setCompose(null); if (active.config.mailbox === "sent") loadList(false); }} />}
			<ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} onConnected={(a) => { setAccounts((p) => [...(p ?? []), a]); setAccountId(a.id); }} />
			<SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} accounts={accounts} onAccountsChanged={() => loadAccounts().catch(() => undefined)} onConnect={() => setConnectOpen(true)} snippets={snippets} onSnippetsChanged={() => loadMeta().catch(() => undefined)} layout={layout} onLayout={changeLayout} signature={signature?.html ?? ""} onSignatureSaved={(html) => setSignature({ html, configured: !!html, dismissed: true })} prefs={prefs} onPrefs={setPrefs} labels={labels} onEditLabel={(l) => { setSettingsOpen(false); setLabelEdit(l); }} />
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

							{/* Phones: the compose button sits bottom right, as in Apple Mail */}
				{!selected && !compose && (
					<button onClick={() => setCompose({})} aria-label="New message" className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-sauti-teal text-white shadow-lg active:scale-95 lg:hidden"><Edit3 className="h-6 w-6" /></button>
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

/**
 * Swipe a row on a phone: left to archive, right to mark read or unread, as in Apple Mail. A short drag
 * reveals the action; letting go past the threshold does it. Mice and keyboards are unaffected.
 */
function SwipeRow({ children, onArchive, onToggleRead, seen }: { children: React.ReactNode; onArchive: () => void; onToggleRead: () => void; seen: boolean }) {
	const [dx, setDx] = useState(0);
	const st = useRef<{ x: number; y: number; lock: "h" | "v" | null } | null>(null);
	const T = 96;
	const down = (e: React.TouchEvent) => { const t = e.touches[0]; st.current = { x: t.clientX, y: t.clientY, lock: null }; };
	const move = (e: React.TouchEvent) => {
		const f = st.current;
		if (!f) return;
		const t = e.touches[0];
		const mx = t.clientX - f.x, my = t.clientY - f.y;
		if (!f.lock) {
			if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
			f.lock = Math.abs(mx) > Math.abs(my) * 1.4 ? "h" : "v";
		}
		if (f.lock === "h") setDx(Math.max(-160, Math.min(160, mx)));
	};
	const up = () => {
		const f = st.current;
		st.current = null;
		if (f?.lock === "h") {
			if (dx <= -T) onArchive();
			else if (dx >= T) onToggleRead();
		}
		setDx(0);
	};
	return (
		<div className="relative overflow-hidden lg:overflow-visible" onTouchStart={down} onTouchMove={move} onTouchEnd={up} onTouchCancel={up}>
			<div aria-hidden className={cn("absolute inset-0 flex items-center justify-between px-5 text-sm font-medium text-white lg:hidden", dx > 0 ? "bg-[#068297]" : dx < 0 ? "bg-[#8E8E93]" : "bg-transparent")}>
				<span className={cn("flex items-center gap-2 transition-opacity", dx > 12 ? "opacity-100" : "opacity-0")}><MailOpen className="h-5 w-5" /> {seen ? "Unread" : "Read"}</span>
				<span className={cn("flex items-center gap-2 transition-opacity", dx < -12 ? "opacity-100" : "opacity-0")}>Archive <Archive className="h-5 w-5" /></span>
			</div>
			<div className={cn("relative bg-white", dx === 0 && "transition-transform duration-200")} style={{ transform: dx ? `translateX(${dx}px)` : undefined, backgroundColor: undefined }}>
				{children}
			</div>
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

function ReadingPane({ teamIds, team, onWrite, onAddContact, onPrev, onNext, hasPrev, hasNext, onAutoLabelSimilar, labels, selectedLabels, onToggleLabel, projects, onToggleProject, onOpportunity, onNewLabel, selected, detail, busy, accountId, conversation, summary, summaryBusy, allowImages, onClose, onSummarise, onOpen, onAct, onReply, onForward, onLoadImages, full, meAddress, inlineReply }: {
	teamIds: (a: string[]) => (string | undefined)[]; team: ReturnType<typeof useTeam>;
	onWrite: (address: string) => void; onAddContact: (name: string, address: string) => void;
	onPrev: () => void; onNext: () => void; hasPrev: boolean; hasNext: boolean; onAutoLabelSimilar: () => void;
	labels: LabelRow[]; selectedLabels: string[]; onToggleLabel: (id: string, on: boolean) => void; projects: ProjectLite[]; onToggleProject: (id: string, on: boolean) => void; onOpportunity: (links: string[], subject: string) => void; onNewLabel: () => void;
	selected: MessageRow | null; detail: Detail | null; busy: boolean; accountId: string; conversation: MessageRow[]; summary: string | null; summaryBusy: boolean; allowImages: boolean;
	onClose: () => void; onSummarise: () => void; onOpen: (m: MessageRow) => void; onAct: (a: MailAction) => void; onReply: (all: boolean) => void; onForward: () => void; onLoadImages: () => void; full: boolean;
	meAddress: string; inlineReply: React.ReactNode | null;
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
					<button onClick={() => onAct("spam")} aria-label="Report spam" title="Report spam" className="max-sm:hidden flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><ShieldAlert className="h-[18px] w-[18px]" /></button>
					<button onClick={() => onAct("trash")} aria-label="Delete (#)" title="Delete (#)" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Trash2 className="h-[18px] w-[18px]" /></button>
					<span className="mx-1 h-5 w-px bg-black/10 max-sm:hidden" />
					<button onClick={() => onReply(false)} aria-label="Reply (R)" title="Reply (R)" className="max-sm:hidden flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Reply className="h-[18px] w-[18px]" /></button>
					<button onClick={() => onReply(true)} aria-label="Reply all" title="Reply all" className="max-sm:hidden flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><ReplyAll className="h-[18px] w-[18px]" /></button>
					<button onClick={onForward} aria-label="Forward" title="Forward" className="max-sm:hidden flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Forward className="h-[18px] w-[18px]" /></button>
					<span className="mx-1 h-5 w-px bg-black/10 max-sm:hidden" />
					<button onClick={() => onAct(selected?.seen ? "unread" : "read")} aria-label={selected?.seen ? "Mark unread (U)" : "Mark read"} title={selected?.seen ? "Mark unread (U)" : "Mark read"} className="max-sm:hidden flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]">{selected?.seen ? <Mail className="h-[18px] w-[18px]" /> : <MailOpen className="h-[18px] w-[18px]" />}</button>
					<button onClick={() => onAct(selected?.flagged ? "unstar" : "star")} aria-label={selected?.flagged ? "Remove star" : "Star (S)"} title={selected?.flagged ? "Remove star" : "Star (S)"} className="max-sm:hidden flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Star className={cn("h-[18px] w-[18px]", selected?.flagged && "fill-amber-400 text-amber-400")} /></button>
					<Popover>
						<PopoverTrigger asChild><button aria-label="Labels" title="Label" className="max-sm:hidden flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Tag className="h-[18px] w-[18px]" /></button></PopoverTrigger>
						<PopoverContent align="end" className="w-60 p-1.5">
							{labels.filter((l) => !l.project_id).map((l) => { const on = selectedLabels.includes(l.id); return (
								<button key={l.id} onClick={() => onToggleLabel(l.id, !on)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5">
									<span className={cn("h-2.5 w-2.5 rounded-full", LABEL_COLORS[l.color]?.dot ?? "bg-sauti-teal")} /><span className="flex-1 truncate">{l.name}</span>{on && <Check className="h-4 w-4 text-sauti-teal" />}
								</button>
							); })}
							<button onClick={onNewLabel} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[#787774] hover:bg-black/5"><Plus className="h-4 w-4" /> New label</button>
							{projects.length > 0 && (
								<>
									<p className="mt-1 border-t border-black/[0.06] px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#9b9a97]">Projects</p>
									<div className="max-h-48 overflow-y-auto">
										{projects.map((pr) => {
											const lab = labels.find((l) => l.project_id === pr.id);
											const on = !!lab && selectedLabels.includes(lab.id);
											return (
												<button key={pr.id} onClick={() => onToggleProject(pr.id, !on)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5">
													<FolderKanban className="h-3.5 w-3.5 shrink-0 text-[#787774]" /><span className="flex-1 truncate">{pr.name}</span>{on && <Check className="h-4 w-4 text-sauti-teal" />}
												</button>
											);
										})}
									</div>
								</>
							)}
						</PopoverContent>
					</Popover>
					<span className="flex-1" />
					<button onClick={onAutoLabelSimilar} className="mr-1 hidden h-8 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-sm text-[#37352f] shadow-sm hover:bg-black/[0.03] lg:flex"><Sparkles className="h-4 w-4 text-[#787774]" /> Auto label similar</button>
					<button onClick={onSummarise} aria-label="Summarise" title="Summarise" className="max-sm:hidden flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Sparkles className="h-[18px] w-[18px]" /></button>
				
					<span className="flex-1 sm:hidden" />
					<Popover>
						<PopoverTrigger asChild><button aria-label="More actions" title="More" className="flex h-9 w-9 items-center justify-center rounded-md text-[#37352f] hover:bg-black/5 sm:hidden"><MoreHorizontal className="h-5 w-5" /></button></PopoverTrigger>
						<PopoverContent align="end" className="w-64 p-1.5 sm:hidden">
							{([
								[selected?.flagged ? "Remove star" : "Star", <Star key="s" className="h-4 w-4" />, () => onAct(selected?.flagged ? "unstar" : "star")],
								[selected?.seen ? "Mark unread" : "Mark read", selected?.seen ? <Mail key="u" className="h-4 w-4" /> : <MailOpen key="u" className="h-4 w-4" />, () => onAct(selected?.seen ? "unread" : "read")],
								["Report spam", <ShieldAlert key="sp" className="h-4 w-4" />, () => onAct("spam")],
								["Summarise", <Sparkles key="sm" className="h-4 w-4" />, onSummarise],
								["Auto label similar", <Tag key="al" className="h-4 w-4" />, onAutoLabelSimilar],
							] as [string, React.ReactNode, () => void][]).map(([label, icon, run]) => (
								<button key={label} onClick={run} className="flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left text-[15px] hover:bg-black/5"><span className="text-[#787774]">{icon}</span>{label}</button>
							))}
							<p className="mt-1 border-t border-black/[0.06] px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#9b9a97]">Labels</p>
							<div className="max-h-40 overflow-y-auto">
								{labels.filter((l) => !l.project_id).map((l) => { const on = selectedLabels.includes(l.id); return (
									<button key={l.id} onClick={() => onToggleLabel(l.id, !on)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-black/5">
										<span className={cn("h-2.5 w-2.5 rounded-full", LABEL_COLORS[l.color]?.dot ?? "bg-sauti-teal")} /><span className="flex-1 truncate">{l.name}</span>{on && <Check className="h-4 w-4 text-sauti-teal" />}
									</button>
								); })}
								{projects.map((pr) => { const lab = labels.find((l) => l.project_id === pr.id); const on = !!lab && selectedLabels.includes(lab.id); return (
									<button key={pr.id} onClick={() => onToggleProject(pr.id, !on)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-black/5">
										<FolderKanban className="h-3.5 w-3.5 shrink-0 text-[#787774]" /><span className="flex-1 truncate">{pr.name}</span>{on && <Check className="h-4 w-4 text-sauti-teal" />}
									</button>
								); })}
							</div>
						</PopoverContent>
					</Popover>
</>}
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
				{busy && !detail && <MjengoLoader label="Opening message" compact />}
				{detail && (
					<article className="mx-auto max-w-3xl px-6 pb-10 pt-3">
						<h2 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-[#37352f]">{detail.subject}</h2>
						<div className="mt-3 flex flex-wrap items-center gap-2 text-[15px]">
							{selectedLabels.length === 0 && <span className="text-[#9b9a97]">Add label</span>}
							{selectedLabels.map((id) => { const l = labels.find((x) => x.id === id); return l ? <span key={id} className={cn("rounded px-2 py-0.5", LABEL_COLORS[l.color]?.chip ?? "bg-black/5")}>{l.name}</span> : null; })}
						</div>
						<hr className="-mx-6 mt-4 border-black/[0.07]" />

						<OpportunityChip
							key={`${accountId}:${selected?.mailbox}:${detail.uid}`}
							subject={detail.subject}
							from={detail.from[0] ? `${detail.from[0].name || ""} <${detail.from[0].address}>` : ""}
							text={detail.text || (detail.html ?? "").replace(/<[^>]+>/g, " ")}
							onOffer={() => { const links = linksIn(detail.html ?? "", detail.text ?? ""); if (links.length) onOpportunity(links, detail.subject); }}
						/>

						<div className="flex flex-wrap items-start gap-2">
						<AiSummary
							accountId={accountId}
							mailbox={selected?.mailbox ?? ""}
							uid={detail.uid}
							subject={detail.subject}
							from={detail.from[0] ? `${detail.from[0].name || ""} <${detail.from[0].address}>` : ""}
							text={detail.text || (detail.html ?? "").replace(/<[^>]+>/g, " ")}
							earlier={[...conversation].sort((x, y) => (x.date ?? "").localeCompare(y.date ?? "")).slice(-3).map((c) => ({ from: c.from.name || c.from.address, text: (mailStore.details.get(detailKey(accountId, c.mailbox, c.uid))?.text ?? "").slice(0, 600) })).filter((e) => e.text)}
						/>
						<MeetingChips
							key={`mc:${accountId}:${selected?.mailbox}:${detail.uid}`}
							subject={detail.subject}
							text={detail.text || ""}
							html={detail.html}
							sent={detail.date ?? null}
							from={detail.from[0] ? (detail.from[0].name || detail.from[0].address) : ""}
						/>
						</div>

						{/* The conversation, the way Apple Mail lays it out: one message after another, each message once,
						    older ones folded to a line, the quoted history folded under "See more". */}
						<ThreadStack
							selected={selected}
							detail={detail}
							conversation={conversation}
							accountId={accountId}
							meAddress={meAddress}
							onReply={onReply}
							onForward={onForward}
							inlineReply={inlineReply}
							attachments={detail.attachments.filter((x) => !x.inline).length > 0 ? (
								<ul className="mt-3 flex flex-wrap gap-2">
									{detail.attachments.filter((x) => !x.inline).map((att) => (
										<li key={att.index}>
											<a href={`/api/mjengo/mail/attachment?account=${accountId}&mailbox=${encodeURIComponent(selected?.mailbox ?? "")}&uid=${detail.uid}&i=${att.index}`} className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/[0.03]">
												<Paperclip className="h-4 w-4 text-[#787774]" /><span className="max-w-[200px] truncate">{att.filename}</span><span className="text-xs text-[#9b9a97]">{att.size > 1048576 ? `${(att.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(att.size / 1024))} KB`}</span>
											</a>
										</li>
									))}
								</ul>
							) : null}
						/>

					</article>
				)}
			</div>
		</div>
	);
}

/**
 * The conversation in reading order. The message being read is open; the one just before it is open too, as
 * context; everything else is a single line. More than two older messages fold under "N earlier messages".
 * A bar at the bottom starts a reply right there.
 */
function ThreadStack({ selected, detail, conversation, accountId, meAddress, onReply, onForward, inlineReply, attachments }: {
	selected: MessageRow | null; detail: Detail; conversation: MessageRow[]; accountId: string; meAddress: string;
	onReply: (all: boolean) => void; onForward: () => void; inlineReply: React.ReactNode | null; attachments: React.ReactNode;
}) {
	const [newestFirst, setNewestFirst] = useState(false);
	const [opened, setOpened] = useState<Record<string, boolean>>({});
	const [showOlder, setShowOlder] = useState(false);
	const current = useRef<HTMLDivElement>(null);
	useEffect(() => { try { setNewestFirst(localStorage.getItem("ss_mail_newest_first") === "1"); } catch { /* default */ } }, []);
	const flip = () => { const n = !newestFirst; setNewestFirst(n); try { localStorage.setItem("ss_mail_newest_first", n ? "1" : "0"); } catch { /* ignore */ } };

	const curKey = selected ? `${selected.mailbox}:${selected.uid}` : "cur";
	const asc = useMemo(() => {
		const rows = conversation.filter((c) => !selected || !(c.mailbox === selected.mailbox && c.uid === selected.uid));
		return rows.sort((x, y) => (x.date ?? "").localeCompare(y.date ?? ""));
	}, [conversation, selected]);
	const when = detail.date ?? selected?.date ?? "";
	const before = asc.filter((c) => (c.date ?? "") <= when);
	const after = asc.filter((c) => (c.date ?? "") > when);
	const previous = before[before.length - 1];
	const hidden = before.length > 2 && !showOlder ? before.slice(0, before.length - 2) : [];
	const visibleBefore = before.filter((c) => !hidden.includes(c));

	const key = (c: MessageRow) => `${c.mailbox}:${c.uid}`;
	const isOpen = (c: MessageRow) => opened[key(c)] ?? (previous ? key(c) === key(previous) : false);
	const me = (c: MessageRow) => c.from.address.toLowerCase() === meAddress;

	// The message being read comes into view, with the earlier lines folded above it.
	useEffect(() => { current.current?.scrollIntoView({ block: "start" }); }, [curKey]);

	const row = (c: MessageRow) => (
		<ThreadMessage key={key(c)} m={c} accountId={accountId} mine={me(c)} open={isOpen(c)} onOpenChange={(o) => setOpened((cur) => ({ ...cur, [key(c)]: o }))} />
	);
	const currentRow = selected ? (
		<div key="current" ref={current}>
			<ul>
				<ThreadMessage
					m={{ ...selected, from: detail.from[0] ?? selected.from }}
					accountId={accountId}
					mine={(detail.from[0]?.address ?? "").toLowerCase() === meAddress}
					open
					isCurrent
					detail={detail}
					onOpenChange={() => undefined}
					onReply={() => onReply(false)}
					onReplyAll={() => onReply(true)}
					onForward={onForward}
				>{attachments}</ThreadMessage>
			</ul>
		</div>
	) : null;

	const older = hidden.length > 0 && (
		<button onClick={() => setShowOlder(true)} className="my-2 flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left text-[13px] font-medium text-[#068297] hover:bg-black/[0.03]">
			<span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F4F6] text-xs">{hidden.length}</span>
			{hidden.length} earlier message{hidden.length === 1 ? "" : "s"}
		</button>
	);

	const stack = newestFirst
		? [<ul key="after">{[...after].reverse().map(row)}</ul>, currentRow, <ul key="before">{[...visibleBefore].reverse().map(row)}</ul>, older]
		: [older, <ul key="before">{visibleBefore.map(row)}</ul>, currentRow, <ul key="after">{after.map(row)}</ul>];

	const total = asc.length + 1;
	const names = Array.from(new Set([detail.from[0], ...asc.map((c) => c.from)].filter(Boolean).map((a) => (a!.address.toLowerCase() === meAddress ? "You" : a!.name || a!.address))));

	return (
		<div className="mt-3">
			{total > 1 && (
				<div className="flex items-center gap-2 border-b border-black/[0.06] pb-2 text-[13px] text-[#787774]">
					<span className="font-medium text-[#37352f]">{total} messages</span>
					<span className="truncate">{names.slice(0, 4).join(", ")}{names.length > 4 ? ` +${names.length - 4}` : ""}</span>
					<span className="flex-1" />
					<button onClick={flip} className="rounded-md px-2 py-1 text-xs hover:bg-black/5">{newestFirst ? "Newest at the top" : "Newest at the bottom"}</button>
				</div>
			)}
			{stack}

			<div className="sticky bottom-0 z-10 mt-5 bg-white/90 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:static lg:bg-transparent lg:pb-8 lg:backdrop-blur-none">
				{inlineReply ?? (
					<div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#FAFAF8] p-2">
						<button onClick={() => onReply(false)} className="flex h-10 flex-1 items-center gap-2 rounded-xl px-3 text-left text-sm text-[#787774] hover:bg-white">
							<Reply className="h-4 w-4" /> Reply to {detail.from[0] ? (detail.from[0].name || detail.from[0].address) : "sender"}
						</button>
						<button onClick={() => onReply(true)} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-[#37352f] hover:bg-white"><ReplyAll className="h-4 w-4" /> <span className="hidden sm:inline">Reply all</span></button>
						<button onClick={onForward} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-[#37352f] hover:bg-white"><Forward className="h-4 w-4" /> <span className="hidden sm:inline">Forward</span></button>
					</div>
				)}
			</div>
		</div>
	);
}


/** Links in a message, newest first from the body: tracking and unsubscribe links are left out. */
function linksIn(html: string, text: string): string[] {
	const found: string[] = [];
	const add = (u: string) => {
		const url = u.replace(/[)>.,;]+$/, "");
		if (!/^https?:\/\//i.test(url)) return;
		if (/unsubscribe|optout|opt-out|preferences|mailto:|\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url)) return;
		if (!found.includes(url)) found.push(url);
	};
	for (const m of html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) add(m[1].replace(/&amp;/g, "&"));
	for (const m of text.matchAll(/https?:\/\/[^\s<>"]+/gi)) add(m[0]);
	return found.slice(0, 8);
}

/** "This email has a link. Where should it go?": an opportunity, a new grant, or the link of a grant that exists. */
function WorkPrompt({ prompt, onClose }: { prompt: { url: string; subject: string; links: string[] } | null; onClose: () => void }) {
	const { toast } = useToast();
	const [url, setUrl] = useState("");
	const [grants, setGrants] = useState<GrantLite[]>([]);
	const [grantId, setGrantId] = useState("");
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		if (!prompt) return;
		setUrl(prompt.url);
		setGrantId("");
		listGrantsLite().then(setGrants).catch(() => setGrants([]));
	}, [prompt]);
	if (!prompt) return null;
	const go = async (kind: "opportunity" | "grant", id?: string) => {
		setBusy(true);
		try {
			const r = await linkToWork({ kind, grantId: id ?? null }, url, prompt.subject);
			toast({ title: kind === "opportunity" ? "Added to Opportunities" : id ? "Link added to the grant" : "Added to Grants", description: r.title });
			onClose();
		} catch (e) {
			toast({ title: "Could not add it", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};
	return (
		<Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-w-md">
				<DialogTitle>This email has a link. Add it to your work?</DialogTitle>
				<div className="space-y-3 text-sm">
					<p className="text-[#5f5e5b]">You tagged it as a grant or an opportunity. Pick the link, then where it belongs, and the details are filled in from the page.</p>
					{prompt.links.length > 1 ? (
						<Select value={url} onValueChange={setUrl}>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent>{prompt.links.map((l) => <SelectItem key={l} value={l}><span className="block max-w-[320px] truncate">{l}</span></SelectItem>)}</SelectContent>
						</Select>
					) : <p className="break-all rounded-lg bg-black/[0.04] p-2 text-xs">{url}</p>}
					<div className="flex flex-col gap-2">
						<Button disabled={busy} onClick={() => void go("opportunity")} className="justify-start gap-2 bg-sauti-teal hover:bg-sauti-dark">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Add as a new opportunity</Button>
						<Button disabled={busy} variant="outline" onClick={() => void go("grant")} className="justify-start">Add as a new grant</Button>
						{grants.length > 0 && (
							<div className="flex gap-2">
								<Select value={grantId} onValueChange={setGrantId}>
									<SelectTrigger className="flex-1"><SelectValue placeholder="Or add it to a grant that exists" /></SelectTrigger>
									<SelectContent>{grants.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}</SelectContent>
								</Select>
								<Button disabled={busy || !grantId} variant="outline" onClick={() => void go("grant", grantId)}>Add</Button>
							</div>
						)}
					</div>
					<div className="flex justify-end"><Button variant="ghost" onClick={onClose} disabled={busy}>Not now</Button></div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

/** A quiet line under the subject when the message looks like a funding call: one tap offers it to Opportunities. */
function OpportunityChip({ subject, from, text, onOffer }: { subject: string; from: string; text: string; onOffer: () => void }) {
	const [looks, setLooks] = useState(false);
	useEffect(() => {
		let on = true;
		if (text.length < 200) return;
		mailTriage(subject, from, text).then((t) => { if (on && t.kind === "opportunity" && t.confidence >= 0.55) setLooks(true); }).catch(() => undefined);
		return () => { on = false; };
	}, [subject, from, text]);
	if (!looks) return null;
	return (
		<button onClick={onOffer} className="mt-3 flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 hover:bg-amber-100">
			<Sparkles className="h-4 w-4 shrink-0" />
			<span className="min-w-0 flex-1">This looks like a funding or partnership opportunity.</span>
			<span className="shrink-0 font-semibold">Add to Opportunities</span>
		</button>
	);
}
