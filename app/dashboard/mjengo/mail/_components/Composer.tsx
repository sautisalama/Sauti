"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Bold, CalendarClock, ChevronDown, Code2, FileText, HardDrive, Heading1, Heading2, Heading3, Italic, Link2, List, ListChecks, ListOrdered, Loader2, Maximize2, Minimize2, Minus, Paperclip, Quote, Redo2, Send, Sparkles, Strikethrough, Text, Type, Underline as UnderlineIcon, Undo2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FRAME_CSS, fitFrame } from "@/lib/mail/frame";
import { draftReply, getMessageDetail, rewriteText, sendMail, suggestReplies, type AccountView, type ReplySuggestion, type RewriteMode, type SnippetRow } from "./api";
import { looksLikeMarkdown, markdownToHtml } from "@/lib/mail/markdown";
import { createClient } from "@/utils/supabase/client";
import { RecipientField } from "./RecipientField";
import { ToastAction } from "@/components/ui/toast";
import { checkRecipients, grantViewTo, searchFiles, type RecipientCheck } from "../../vault/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** One message of the conversation being answered, shown beside the reply with its own colour. */
export interface ThreadMsg {
	key: string;
	mailbox: string;
	uid: number;
	name: string;
	address: string;
	date: string | null;
	/** Filled in when known; otherwise fetched when the card is opened. */
	html?: string;
	mine?: boolean;
}

export interface ComposeSeed {
	to?: string[];
	cc?: string[];
	subject?: string;
	html?: string;
	/** The message being answered, added under the reply when it is sent (the editor itself stays clean). */
	quoteHtml?: string;
	thread?: ThreadMsg[];
	inReplyTo?: string | null;
	references?: string[];
	/** For "write a reply with AI". */
	replyTo?: { mailbox: string; uid: number } | null;
}

interface SlashItem {
	id: string;
	label: string;
	hint: string;
	icon: typeof Text;
	run: (e: Editor) => void;
	snippet?: SnippetRow;
}

const BLOCKS: SlashItem[] = [
	{ id: "text", label: "Text", hint: "Plain paragraph", icon: Text, run: (e) => e.chain().focus().setParagraph().run() },
	{ id: "h1", label: "Heading 1", hint: "Big heading", icon: Heading1, run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
	{ id: "h2", label: "Heading 2", hint: "Medium heading", icon: Heading2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
	{ id: "h3", label: "Heading 3", hint: "Small heading", icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
	{ id: "bullets", label: "Bulleted list", hint: "A simple list", icon: List, run: (e) => e.chain().focus().toggleBulletList().run() },
	{ id: "numbers", label: "Numbered list", hint: "Steps in order", icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run() },
	{ id: "todo", label: "To-do list", hint: "Checkboxes", icon: ListChecks, run: (e) => e.chain().focus().toggleTaskList().run() },
	{ id: "quote", label: "Quote", hint: "Call out a passage", icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run() },
	{ id: "code", label: "Code", hint: "Monospaced block", icon: Code2, run: (e) => e.chain().focus().toggleCodeBlock().run() },
	{ id: "divider", label: "Divider", hint: "A horizontal line", icon: Minus, run: (e) => e.chain().focus().setHorizontalRule().run() },
	{ id: "schedule", label: "Scheduling link", hint: "Let them book a time", icon: CalendarClock, run: () => document.dispatchEvent(new Event("ss-insert-scheduling")) },
];

const splitAddresses = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
const toBase64 = (f: File) =>
	new Promise<string>((res, rej) => {
		const r = new FileReader();
		r.onload = () => res(String(r.result).split(",")[1] ?? "");
		r.onerror = () => rej(r.error);
		r.readAsDataURL(f);
	});

const TONES: { mode: RewriteMode; label: string; hint: string }[] = [
	{ mode: "improve", label: "Improve", hint: "Clearer, keeps your voice" },
	{ mode: "formal", label: "Formal", hint: "For senior contacts and funders" },
	{ mode: "official", label: "Official", hint: "Letter style, precise" },
	{ mode: "warm", label: "Warm", hint: "Caring and human" },
	{ mode: "friendlier", label: "Friendly", hint: "Relaxed but professional" },
	{ mode: "persuasive", label: "Persuasive", hint: "Leads with the benefit" },
	{ mode: "simpler", label: "Simpler", hint: "Plain words, short sentences" },
	{ mode: "shorter", label: "Shorter", hint: "Trim to the point" },
	{ mode: "longer", label: "Longer", hint: "Add helpful detail" },
	{ mode: "revamp", label: "Revamp", hint: "Restructure and tighten" },
	{ mode: "fix", label: "Fix spelling", hint: "Grammar only" },
];

/** A colour for each person in the conversation, so who said what is clear at a glance. */
const SHADES = [
	{ bar: "border-[#CDBDF0]", bg: "bg-[#FBF9FF]", dot: "bg-[#B79CEB]", text: "text-[#5B3E99]" },
	{ bar: "border-[#F0D8AE]", bg: "bg-[#FFFCF6]", dot: "bg-[#E8B866]", text: "text-[#8A5A12]" },
	{ bar: "border-[#F0C4D6]", bg: "bg-[#FFFAFC]", dot: "bg-[#E58DB0]", text: "text-[#A23B68]" },
	{ bar: "border-[#BFD3F3]", bg: "bg-[#FAFCFF]", dot: "bg-[#86A9E8]", text: "text-[#2F5DA8]" },
	{ bar: "border-[#B5E0CD]", bg: "bg-[#F8FDFA]", dot: "bg-[#6CC3A0]", text: "text-[#2A7A5A]" },
];
const MINE = { bar: "border-[#A9D6DE]", bg: "bg-[#F6FBFC]", dot: "bg-[#5FB7C4]", text: "text-[#0B6272]" };
const initialsOf = (n: string) => n.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "?";
const plain = (html: string) => (typeof window === "undefined" ? html : new DOMParser().parseFromString(html, "text/html").body.textContent ?? "");
const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!).replace(/\n/g, "<br>")}</p>`).join("");

const cardFrame = (html: string) => `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font:14px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;word-wrap:break-word}img{max-width:100%;height:auto}blockquote{margin:6px 0;padding-left:10px;border-left:3px solid #d1d5db;color:#6b7280}${FRAME_CSS}table{max-width:100%}</style></head><body>${html}</body></html>`;

/** One message of the conversation: a coloured card that opens in place. */
function ThreadCard({ m, accountId, shade, defaultOpen }: { m: ThreadMsg; accountId: string; shade: (typeof SHADES)[number]; defaultOpen?: boolean }) {
	const [open, setOpen] = useState(!!defaultOpen);
	const [html, setHtml] = useState<string | null>(m.html ?? null);
	const [busy, setBusy] = useState(false);
	const frame = useRef<HTMLIFrameElement>(null);
	const [h, setH] = useState(120);
	useEffect(() => {
		if (!open || html !== null) return;
		let on = true;
		setBusy(true);
		getMessageDetail(accountId, m.mailbox, m.uid, true)
			.then((d) => on && setHtml(d.html ?? `<pre style="font:inherit;white-space:pre-wrap">${d.text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`))
			.catch(() => on && setHtml("<p>Could not load this message.</p>"))
			.finally(() => on && setBusy(false));
		return () => { on = false; };
	}, [open, html, accountId, m.mailbox, m.uid]);
	const snippet = html ? plain(html).replace(/\s+/g, " ").trim().slice(0, 110) : "";
	return (
		<li className={cn("overflow-hidden rounded-xl border-l-2", shade.bar, shade.bg)}>
			<button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left">
				<span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white", shade.dot)}>{initialsOf(m.name || m.address)}</span>
				<span className="min-w-0 flex-1">
					<span className={cn("block truncate text-xs font-semibold", shade.text)}>{m.mine ? "You" : m.name || m.address}</span>
					{!open && snippet && <span className="block truncate text-xs text-serene-neutral-500">{snippet}</span>}
				</span>
				<span className="shrink-0 text-[11px] text-serene-neutral-500">{m.date ? new Date(m.date).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""}</span>
				<ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-serene-neutral-400 transition-transform", !open && "-rotate-90")} />
			</button>
			{open && (
				<div className="px-3 pb-3">
					{busy || html === null ? <p className="flex items-center gap-2 py-2 text-xs text-serene-neutral-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening...</p> : (
						<iframe ref={frame} title={`Message from ${m.name || m.address}`} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={cardFrame(html)} onLoad={() => { if (frame.current) fitFrame(frame.current, setH, { min: 60, max: 420 }); }} style={{ height: h }} className="w-full border-0" />
					)}
				</div>
			)}
		</li>
	);
}

/**
 * Compose window with a block editor: type "/" for headings, lists, to-dos, quotes, dividers and your
 * saved snippets. Cmd/Ctrl+Enter sends.
 */
export function Composer({ accounts, accountId, seed, snippets, signature = "", undoSeconds = 0, onReopen, onClose, onSent, inline = false, onPopOut }: { accounts: AccountView[]; accountId: string; seed: ComposeSeed; snippets: SnippetRow[]; signature?: string; undoSeconds?: number; onReopen?: (seed: ComposeSeed) => void; onClose: () => void; onSent: () => void; inline?: boolean; onPopOut?: () => void }) {
	const { toast } = useToast();
	const [from, setFrom] = useState(accountId);
	const [to, setTo] = useState((seed.to ?? []).join(", "));
	const [cc, setCc] = useState((seed.cc ?? []).join(", "));
	const [bcc, setBcc] = useState("");
	const [showCc, setShowCc] = useState(!!seed.cc?.length);
	const [subject, setSubject] = useState(seed.subject ?? "");
	const [files, setFiles] = useState<File[]>([]);
	// Documents from the Mjengo vault: sent as a link (recipients need access) or as a copy (needs share rights).
	const [vault, setVault] = useState<{ id: string; name: string; mode: "link" | "attach"; canShare: boolean }[]>([]);
	const [vaultQ, setVaultQ] = useState("");
	const [vaultHits, setVaultHits] = useState<{ id: string; name: string; size: number; level: string; folder: string | null }[]>([]);
	const [issues, setIssues] = useState<RecipientCheck[] | null>(null);
	const [sending, setSending] = useState(false);
	const [aiBusy, setAiBusy] = useState(false);
	const [aiPrompt, setAiPrompt] = useState("");
	const [minimised, setMinimised] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [rich, setRich] = useState(false);
	const [threadOpen, setThreadOpen] = useState(!!seed.thread?.length);
	const [suggestions, setSuggestions] = useState<ReplySuggestion[] | null>(null);
	const [tone, setTone] = useState<RewriteMode | null>(null);
	const [dragging, setDragging] = useState(false);
	const [showFields, setShowFields] = useState(!inline);
	const [withQuote, setWithQuote] = useState(true);
	const [drafting, setDrafting] = useState(false);
	const [drafted, setDrafted] = useState(false);
	const [guide, setGuide] = useState("");
	const draftCtl = useRef<AbortController | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);
	const editorRef = useRef<Editor | null>(null);
	const thread = seed.thread ?? [];

	// ---- slash menu
	const [slash, setSlash] = useState<{ query: string; from: number; x: number; y: number; kind: "slash" | "mention" } | null>(null);
	const [mentionHits, setMentionHits] = useState<{ id: string; name: string; level: string; folder: string | null }[]>([]);
	// Highlighted text: offer to improve it with AI.
	const [sel, setSel] = useState<{ from: number; to: number; x: number; y: number } | null>(null);
	const [rewriting, setRewriting] = useState(false);
	const [active, setActive] = useState(0);
	const items = useMemo(() => {
		if (!slash) return [];
		if (slash.kind === "mention") {
				return mentionHits.slice(0, 8).map<SlashItem>((f) => ({
					id: `vault-${f.id}`,
					label: f.name,
					hint: `${f.folder ? `${f.folder} · ` : ""}Vault file`,
					icon: HardDrive,
					run: (e) => {
						e.chain().focus().insertContent(`<a href="${window.location.origin}/dashboard/mjengo/vault?open=${f.id}">${f.name.replace(/[&<>"]/g, "")}</a> `).run();
						addVault(f);
					},
				}));
			}
			const all: SlashItem[] = [
			...BLOCKS,
			...snippets.map<SlashItem>((s) => ({ id: `snip-${s.id}`, label: s.name, hint: "Snippet", icon: Sparkles, snippet: s, run: () => undefined })),
		];
		const q = slash.query.toLowerCase();
		return all.filter((i) => !q || i.label.toLowerCase().includes(q) || i.id.includes(q)).slice(0, 8);
	}, [slash, snippets, mentionHits]);
	const slashRef = useRef({ slash, items, active });
	slashRef.current = { slash, items, active };

	const editor = useEditor({
		immediatelyRender: false,
		content: signature ? `<p></p>${seed.html ?? ""}${signature}` : (seed.html || "<p></p>"),
		extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), Placeholder.configure({ placeholder: "Write something, or press / for blocks" }), TaskList, TaskItem.configure({ nested: true })],
		editorProps: {
			attributes: { class: "prose prose-sm max-w-none min-h-[260px] focus:outline-none px-1 py-2 text-[15px] leading-7 [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2 [&_blockquote]:border-l-4 [&_blockquote]:border-sauti-teal/40 [&_blockquote]:pl-3 [&_blockquote]:text-serene-neutral-600" },
			// Pasted Markdown (notes, an .md file's text) becomes real headings, lists and links.
			handlePaste: (_view, event) => {
				const cd = event.clipboardData;
				if (!cd) return false;
				const text = cd.getData("text/plain");
				const html = cd.getData("text/html");
				const bare = !html || !/<(h[1-6]|ul|ol|li|strong|b|em|a|table)\b/i.test(html);
				if (bare && looksLikeMarkdown(text)) {
					editorRef.current?.chain().focus().insertContent(markdownToHtml(text)).run();
					return true;
				}
				return false;
			},
			handleKeyDown: (_view, e) => {
				const { slash: s, items: list, active: a } = slashRef.current;
				if (!s || !list.length) return false;
				if (e.key === "ArrowDown") { setActive((a + 1) % list.length); return true; }
				if (e.key === "ArrowUp") { setActive((a - 1 + list.length) % list.length); return true; }
				if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(list[a]); return true; }
				if (e.key === "Escape") { setSlash(null); return true; }
				return false;
			},
		},
		onCreate: ({ editor: ed }) => { editorRef.current = ed; },
		onUpdate: ({ editor: ed }) => detectSlash(ed),
		onSelectionUpdate: ({ editor: ed }) => detectSlash(ed),
	});

	const detectSlash = useCallback((ed: Editor) => {
		const { from: pos, to, empty } = ed.state.selection;
		if (!empty) {
			setSlash(null);
			const text = ed.state.doc.textBetween(pos, to, " ");
			if (text.trim().length > 3) {
				const r = ed.view.coordsAtPos(pos);
				setSel({ from: pos, to, x: r.left, y: r.top });
			} else setSel(null);
			return;
		}
		setSel(null);
		const before = ed.state.doc.textBetween(Math.max(0, pos - 30), pos, "\n", "\0");
		const m = /(?:^|\s)\/([\w-]*)$/.exec(before);
			const at = /(?:^|\s)@([\w.-]*)$/.exec(before);
			const hit = m ?? at;
			if (!hit) return setSlash(null);
			const rect = ed.view.coordsAtPos(pos);
			setSlash({ query: hit[1], from: pos - hit[1].length - 1, x: rect.left, y: rect.bottom + 6, kind: m ? "slash" : "mention" });
		setActive(0);
	}, []);

	const pick = (item: SlashItem) => {
		if (!editor || !slashRef.current.slash) return;
		const range = { from: slashRef.current.slash.from, to: editor.state.selection.from };
		editor.chain().focus().deleteRange(range).run();
		if (item.snippet) editor.chain().focus().insertContent(item.snippet.body_html).run();
		else item.run(editor);
		setSlash(null);
	};

	useEffect(() => {
		const h = () => insertScheduling();
		document.addEventListener("ss-insert-scheduling", h);
		return () => document.removeEventListener("ss-insert-scheduling", h);
	});

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				send();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	useEffect(() => {
		const t = setTimeout(() => searchFiles(vaultQ).then(setVaultHits).catch(() => setVaultHits([])), 200);
		return () => clearTimeout(t);
	}, [vaultQ]);

	useEffect(() => {
		if (slash?.kind !== "mention") return;
		const t = setTimeout(() => searchFiles(slash.query).then(setMentionHits).catch(() => setMentionHits([])), 150);
		return () => clearTimeout(t);
	}, [slash?.kind, slash?.query]);

	const addVault = (f: { id: string; name: string; level: string }) => {
		if (vault.some((v) => v.id === f.id)) return;
		setVault([...vault, { id: f.id, name: f.name, mode: "link", canShare: f.level !== "view" }]);
	};

	/** Before sending: who among the recipients cannot open the linked vault files? Tell the sender. */
	const send = async (opts: { skipCheck?: boolean; acknowledge?: boolean; vault?: typeof vault } = {}) => {
		if (!editor || sending) return;
		const vlist = opts.vault ?? vault;
		const everyone = [...splitAddresses(to), ...splitAddresses(cc), ...splitAddresses(bcc)];
		const linked = vlist.filter((v) => v.mode === "link").map((v) => v.id);
		if (!opts.skipCheck && linked.length && everyone.length) {
			try {
				const checks = await checkRecipients(linked, everyone);
				if (checks.some((c) => c.recipients.some((r) => !r.level))) return setIssues(checks);
			} catch (e) {
				return toast({ title: "Could not check access", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			}
		}
		await doSend(vlist, !!opts.acknowledge);
	};

	const doSend = async (vlist: typeof vault, acknowledgeNoAccess: boolean) => {
		if (!editor) return;
		const recipients = splitAddresses(to);
		if (!recipients.length) return toast({ title: "Add a recipient", variant: "destructive" });
		if (!subject.trim() && !window.confirm("Send without a subject?")) return;
		setSending(true);
		try {
			const payload = {
				accountId: from,
				to: recipients,
				cc: splitAddresses(cc),
				bcc: splitAddresses(bcc),
				subject,
				html: editor.getHTML() + (withQuote ? seed.quoteHtml ?? "" : ""),
				inReplyTo: seed.inReplyTo,
				references: seed.references,
				attachments: await Promise.all(files.map(async (f) => ({ filename: f.name, contentBase64: await toBase64(f), contentType: f.type || "application/octet-stream" }))),
					vaultLinks: vlist.filter((v) => v.mode === "link").map((v) => v.id),
					vaultAttach: vlist.filter((v) => v.mode === "attach").map((v) => v.id),
					acknowledgeNoAccess,
			};
			// Undo send: hold the message for a few seconds; Undo puts it back in the composer.
			if (undoSeconds > 0 && onReopen) {
				let cancelled = false;
				const back: ComposeSeed = { to: recipients, cc: splitAddresses(cc), subject, html: editor.getHTML(), quoteHtml: seed.quoteHtml, thread: seed.thread, inReplyTo: seed.inReplyTo, references: seed.references, replyTo: seed.replyTo };
				const timer = setTimeout(async () => {
					if (cancelled) return;
					try {
						await sendMail(payload);
						toast({ title: "Sent" });
					} catch (e) {
						toast({ title: "Not sent", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
						onReopen(back);
					}
				}, undoSeconds * 1000);
				toast({
					title: "Sending",
					duration: undoSeconds * 1000,
					action: <ToastAction altText="Undo send" onClick={() => { cancelled = true; clearTimeout(timer); onReopen(back); }}>Undo</ToastAction>,
				});
				onSent();
				return;
			}
			await sendMail(payload);
			toast({ title: "Sent" });
			onSent();
		} catch (e) {
			toast({ title: "Not sent", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setSending(false);
		}
	};

	/** Put your public booking page in the message so people can pick a time. */
	const insertScheduling = async () => {
		const { data } = await createClient().auth.getUser();
		if (!data.user || !editor) return;
		const url = `${window.location.origin}/schedule/${data.user.id}`;
		editor.chain().focus().insertContent(`<p>Pick a time that suits you: <a href="${url}">${url}</a></p>`).run();
	};

	/** Rewrite the highlighted text, or the whole message (the signature is left alone). */
	const rewrite = async (mode: RewriteMode, whole = false) => {
		if (!editor) return;
		const useSel = !whole && sel;
		let text = useSel ? editor.state.doc.textBetween(sel!.from, sel!.to, "\n") : editor.getText({ blockSeparator: "\n\n" });
		if (!useSel && signature) {
			const d = new DOMParser().parseFromString(signature, "text/html");
			const first = (d.body.querySelector("p,div,h1,h2,h3,li")?.textContent ?? d.body.textContent ?? "").trim();
			const cut = first ? text.lastIndexOf(first) : -1;
			if (cut > 0) text = text.slice(0, cut).trim();
		}
		if (!text.trim()) return toast({ title: "Write something first", description: "The tone tools rewrite what you have written." });
		setRewriting(true);
		setTone(mode);
		try {
			const out = await rewriteText(text, mode);
			if (useSel) editor.chain().focus().insertContentAt({ from: sel!.from, to: sel!.to }, out).run();
			else editor.commands.setContent(`${paragraphs(out)}${signature ? `<p></p>${signature}` : ""}`, { emitUpdate: true });
			setSel(null);
		} catch (e) {
			toast({ title: "Could not rewrite that", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setRewriting(false);
			setTone(null);
		}
	};

	// Suggested replies that fit the email, ready before the person has typed anything.
	useEffect(() => {
		if (!seed.replyTo) return;
		let on = true;
		suggestReplies(from, seed.replyTo.mailbox, seed.replyTo.uid).then((r) => on && setSuggestions(r)).catch(() => on && setSuggestions([]));
		return () => { on = false; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seed.replyTo?.uid]);

	/** Files dropped on the window are attached; a dropped Markdown file becomes the message text. */
	const onDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		setDragging(false);
		const dropped = Array.from(e.dataTransfer.files ?? []);
		if (!dropped.length) return;
		const md = dropped.filter((f) => /\.(md|markdown)$/i.test(f.name));
		const rest = dropped.filter((f) => !md.includes(f));
		for (const f of md) editor?.chain().focus().insertContent(markdownToHtml(await f.text())).run();
		if (rest.length) setFiles((cur) => [...cur, ...rest]);
	};

	/** Stream text from the mail AI route into the message, signature kept below. */
	const streamInto = async (body: Record<string, unknown>) => {
		if (!editor) return;
		draftCtl.current?.abort();
		const c = new AbortController();
		draftCtl.current = c;
		setDrafting(true);
		try {
			const res = await fetch("/api/mjengo/mail/ai", { method: "POST", signal: c.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
			if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || "The AI service is unavailable.");
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			let acc = "";
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				acc += dec.decode(value, { stream: true });
				editor.commands.setContent(`${paragraphs(acc.trim())}${signature ? `<p></p>${signature}` : ""}`, { emitUpdate: false });
			}
			setDrafted(true);
			setSuggestions(null);
		} catch (e) {
			if (!c.signal.aborted) toast({ title: "Could not write that", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			if (draftCtl.current === c) setDrafting(false);
		}
	};

	const sourceText = () => plain(seed.quoteHtml ?? "").replace(/\s+/g, " ").trim();
	const earlierText = () => thread.slice(1).reverse().map((t) => ({ from: t.name || t.address, text: plain(t.html ?? "").replace(/\s+/g, " ").trim().slice(0, 600) })).filter((e) => e.text);

	/** One tap and the reply starts appearing: no prompt to fill in first. */
	const writeWithAi = (instruction?: string) => {
		void streamInto({ task: "reply", subject, from: to.split(",")[0]?.trim(), text: sourceText(), earlier: earlierText(), instruction: instruction || undefined });
	};

	const currentBody = () => {
		let text = editor?.getText({ blockSeparator: "\n\n" }) ?? "";
		if (signature) {
			const d = new DOMParser().parseFromString(signature, "text/html");
			const first = (d.body.querySelector("p,div,h1,h2,h3,li")?.textContent ?? d.body.textContent ?? "").trim();
			const cut = first ? text.lastIndexOf(first) : -1;
			if (cut > 0) text = text.slice(0, cut).trim();
		}
		return text.trim();
	};
	const refine = (tone: "formalize" | "elaborate" | "shorten" | "recreate") => {
		const draft = currentBody();
		if (!draft) return toast({ title: "Write something first" });
		void streamInto({ task: "refine", tone, draft, text: sourceText() });
	};

	const size = files.reduce((n, f) => n + f.size, 0);
	const me = accounts.find((a) => a.id === from)?.email.toLowerCase();
	const people = Array.from(new Set(thread.map((t) => t.address.toLowerCase())));
	const shadeFor = (t: ThreadMsg) => (t.mine || t.address.toLowerCase() === me ? MINE : SHADES[Math.max(0, people.indexOf(t.address.toLowerCase())) % SHADES.length]);
	const empty = !editor || !editor.getText().replace(/\s+/g, "").length || (!!signature && editor.getText().replace(/\s+/g, "").length <= plain(signature).replace(/\s+/g, "").length + 2);

	const toolBtn = "h-8 w-8 shrink-0";
	const fmt = (active: boolean) => cn(toolBtn, active && "bg-sauti-teal-light text-sauti-dark");
	const threadList = (
		<ul className="space-y-2">
			{thread.map((t, i) => <ThreadCard key={t.key} m={t} accountId={accountId} shade={shadeFor(t)} defaultOpen={i === 0} />)}
		</ul>
	);

	return (
		<>
			{expanded && <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setExpanded(false)} aria-hidden />}
			<div
				role={inline ? "form" : "dialog"}
				aria-label={inline ? "Reply" : "New message"}
				onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
				onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
				onDrop={onDrop}
				className={inline
					? "relative flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
					: cn(
						"fixed z-50 flex flex-col overflow-hidden bg-[#FBFAF7] shadow-2xl ring-1 ring-black/10 transition-[width,height] duration-200",
						"inset-0 sm:inset-auto sm:rounded-2xl",
						expanded ? "sm:inset-x-[max(1rem,calc(50vw-640px))] sm:bottom-6 sm:top-6" : "sm:bottom-4 sm:right-4 sm:w-[720px]",
						!expanded && (minimised ? "sm:h-12" : "sm:h-[min(86vh,780px)]")
					)}
			>
				<header className="flex items-center gap-2 border-b border-black/[0.06] bg-white px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
					{inline ? (
						<p className="min-w-0 flex-1 truncate text-sm text-serene-neutral-700"><span className="text-serene-neutral-400">Reply to </span><span className="font-semibold">{to.split(",")[0]?.trim() || "sender"}</span>{splitAddresses(to).length > 1 ? <span className="text-serene-neutral-400"> +{splitAddresses(to).length - 1}</span> : null}</p>
					) : (
						<p className="min-w-0 flex-1 truncate text-sm font-semibold text-serene-neutral-800">{subject || "New message"}</p>
					)}
					{inline && <Button variant="ghost" size="sm" className="h-8 text-xs text-serene-neutral-600" onClick={() => setShowFields((v) => !v)}>{showFields ? "Hide details" : "Details"}</Button>}
					{inline && onPopOut && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPopOut} aria-label="Open in a window" title="Open in a window"><Maximize2 className="h-4 w-4" /></Button>}
					{thread.length > 0 && !expanded && !inline && (
						<button onClick={() => setThreadOpen((v) => !v)} aria-expanded={threadOpen} className="flex items-center gap-1.5 rounded-full border border-black/10 px-2.5 py-1 text-xs font-medium text-serene-neutral-700 hover:bg-black/5">
							Conversation <span className="rounded-full bg-black/5 px-1.5">{thread.length}</span>
						</button>
					)}
					{!inline && <Button variant="ghost" size="icon" className="hidden h-8 w-8 sm:inline-flex" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Make smaller" : "Expand"} title={expanded ? "Make smaller" : "Expand"}>{expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>}
					{!expanded && !inline && <Button variant="ghost" size="icon" className="hidden h-8 w-8 sm:inline-flex" onClick={() => setMinimised((v) => !v)} aria-label="Minimise" title="Minimise"><Minus className="h-4 w-4" /></Button>}
					<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => (!editor?.getText().trim() && !subject && !to) || inline || window.confirm("Discard this message?") ? onClose() : undefined} aria-label={inline ? "Discard reply" : "Close"}><X className="h-4 w-4" /></Button>
				</header>

				{!minimised && (
					<>
						<div className={cn("space-y-px border-b border-black/[0.06] bg-white text-sm", inline && !showFields && "hidden")}>
							<Row label="From">
								<select value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-transparent py-2 outline-none">
									{accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
								</select>
							</Row>
							<Row label="To" extra={!showCc && <button onClick={() => setShowCc(true)} className="px-2 text-xs text-serene-neutral-500 hover:text-serene-neutral-800">Cc / Bcc</button>}>
								<RecipientField value={to} onChange={setTo} placeholder="Add recipient" autoFocus={!seed.to?.length} />
							</Row>
							{showCc && (
								<>
									<Row label="Cc"><RecipientField value={cc} onChange={setCc} placeholder="Add Cc" /></Row>
									<Row label="Bcc"><RecipientField value={bcc} onChange={setBcc} placeholder="Add Bcc" /></Row>
								</>
							)}
							<Row label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="h-9 border-0 px-0 shadow-none focus-visible:ring-0" /></Row>
						</div>

						<div className="relative flex min-h-0 flex-1">
							{/* The writing area: a sheet of paper on a soft dotted desk */}
							<div className={cn("min-w-0 flex-1", inline ? "bg-white p-3" : "overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,rgba(6,130,151,0.10)_1px,transparent_0)] [background-size:20px_20px] p-3 sm:p-4")}>
								{suggestions && suggestions.length > 0 && empty && (
									<div className="mb-3">
										<p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-serene-neutral-600"><Sparkles className="h-3.5 w-3.5 text-sauti-teal" /> Suggested replies</p>
										<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
											{suggestions.map((r, i) => (
												<button key={i} onClick={() => { editor?.chain().focus().insertContentAt(0, paragraphs(r.body)).run(); setSuggestions(null); }} className="w-56 shrink-0 rounded-xl border border-black/10 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sauti-teal/60">
													<span className="mb-1 block text-xs font-semibold text-sauti-teal">{r.label}</span>
													<span className="line-clamp-3 text-xs text-serene-neutral-700">{r.body}</span>
												</button>
											))}
										</div>
									</div>
								)}
								{suggestions === null && seed.replyTo && empty && <p className="mb-3 flex items-center gap-2 text-xs text-serene-neutral-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the email to suggest replies...</p>}

																{(drafted || drafting) && (
									<div className="mb-3 flex flex-wrap items-center gap-1.5">
										<span className="mr-1 flex items-center gap-1.5 text-xs font-semibold text-serene-neutral-600">{drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-sauti-teal" /> : <Sparkles className="h-3.5 w-3.5 text-sauti-teal" />} {drafting ? "Writing" : "Refine"}</span>
										{([["formalize", "Formalize"], ["elaborate", "Elaborate"], ["shorten", "Shorten"], ["recreate", "Recreate"]] as const).map(([k, l]) => (
											<button key={k} disabled={drafting} onClick={() => refine(k)} className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-serene-neutral-700 hover:border-sauti-teal/60 disabled:opacity-50">{l}</button>
										))}
									</div>
								)}
{thread.length > 0 && threadOpen && !expanded && !inline && <div className="mb-3 max-h-56 overflow-y-auto rounded-xl border border-black/[0.06] bg-white/80 p-2"><p className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-serene-neutral-500">Conversation<span className="flex">{people.map((a, i) => <i key={a} className={cn("-ml-0.5 h-2.5 w-2.5 rounded-full ring-1 ring-white first:ml-0", (a === me ? MINE : SHADES[i % SHADES.length]).dot)} />)}</span></p>{threadList}</div>}

								<div className={cn("bg-white px-4 py-3", !inline && "rounded-xl shadow-sm ring-1 ring-black/[0.06]")}>
									{rich && (
										<div className="-mx-2 -mt-1 mb-2 flex flex-wrap items-center gap-0.5 border-b border-black/[0.06] px-1 pb-2">
											<Button variant="ghost" size="icon" className={toolBtn} onClick={() => editor?.chain().focus().undo().run()} aria-label="Undo"><Undo2 className="h-4 w-4" /></Button>
											<Button variant="ghost" size="icon" className={toolBtn} onClick={() => editor?.chain().focus().redo().run()} aria-label="Redo"><Redo2 className="h-4 w-4" /></Button>
											<span className="mx-1 h-5 w-px bg-black/10" />
											<Button variant="ghost" size="icon" className={fmt(!!editor?.isActive("heading", { level: 1 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} aria-label="Heading 1"><Heading1 className="h-4 w-4" /></Button>
											<Button variant="ghost" size="icon" className={fmt(!!editor?.isActive("heading", { level: 2 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Heading 2"><Heading2 className="h-4 w-4" /></Button>
											<span className="mx-1 h-5 w-px bg-black/10" />
											<Button variant="ghost" size="icon" className={fmt(!!editor?.isActive("bold"))} onClick={() => editor?.chain().focus().toggleBold().run()} aria-label="Bold"><Bold className="h-4 w-4" /></Button>
											<Button variant="ghost" size="icon" className={fmt(!!editor?.isActive("italic"))} onClick={() => editor?.chain().focus().toggleItalic().run()} aria-label="Italic"><Italic className="h-4 w-4" /></Button>
											<Button variant="ghost" size="icon" className={fmt(!!editor?.isActive("underline"))} onClick={() => editor?.chain().focus().toggleUnderline().run()} aria-label="Underline"><UnderlineIcon className="h-4 w-4" /></Button>
											<Button variant="ghost" size="icon" className={fmt(!!editor?.isActive("strike"))} onClick={() => editor?.chain().focus().toggleStrike().run()} aria-label="Strikethrough"><Strikethrough className="h-4 w-4" /></Button>
											<span className="mx-1 h-5 w-px bg-black/10" />
											<Button variant="ghost" size="icon" className={fmt(!!editor?.isActive("bulletList"))} onClick={() => editor?.chain().focus().toggleBulletList().run()} aria-label="Bulleted list"><List className="h-4 w-4" /></Button>
											<Button variant="ghost" size="icon" className={fmt(!!editor?.isActive("orderedList"))} onClick={() => editor?.chain().focus().toggleOrderedList().run()} aria-label="Numbered list"><ListOrdered className="h-4 w-4" /></Button>
											<Button variant="ghost" size="icon" className={fmt(!!editor?.isActive("blockquote"))} onClick={() => editor?.chain().focus().toggleBlockquote().run()} aria-label="Quote"><Quote className="h-4 w-4" /></Button>
											<Button variant="ghost" size="icon" className={fmt(!!editor?.isActive("link"))} onClick={() => {
												const prev = editor?.getAttributes("link").href as string | undefined;
												const url = window.prompt("Link address", prev ?? "https://");
												if (url === null) return;
												if (url === "") editor?.chain().focus().extendMarkRange("link").unsetLink().run();
												else editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
											}} aria-label="Link"><Link2 className="h-4 w-4" /></Button>
											<Button variant="ghost" size="icon" className={toolBtn} onClick={() => editor?.chain().focus().setHorizontalRule().run()} aria-label="Divider"><Minus className="h-4 w-4" /></Button>
										</div>
									)}
									<EditorContent editor={editor} />
									{(vault.length > 0 || files.length > 0) && (
										<div className="mt-3 border-t border-black/[0.06] pt-3">
											<p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-serene-neutral-600"><Paperclip className="h-3.5 w-3.5" /> Attachments</p>
											<ul className="flex flex-wrap gap-2" aria-label="Attachments">
												{vault.map((v) => (
													<li key={v.id} className="flex items-center gap-2 rounded-lg border border-sauti-teal/30 bg-sauti-teal-light/40 px-2.5 py-1.5 text-xs text-sauti-dark">
														<HardDrive className="h-3.5 w-3.5" /> <span className="max-w-[180px] truncate">{v.name}</span>
														<button
															onClick={() => v.canShare && setVault(vault.map((x) => (x.id === v.id ? { ...x, mode: x.mode === "link" ? "attach" : "link" } : x)))}
															title={v.canShare ? "Switch between a link and a copy" : "You can view this file but not share a copy; it goes as a link"}
															className="rounded bg-white px-1.5 py-0.5 font-semibold"
														>{v.mode === "link" ? "Link" : "Copy"}</button>
														<button onClick={() => setVault(vault.filter((x) => x.id !== v.id))} aria-label={`Remove ${v.name}`}><X className="h-3 w-3 text-sauti-teal hover:text-red-600" /></button>
													</li>
												))}
												{files.map((f, i) => (
													<li key={i} className="flex items-center gap-2 rounded-lg border border-serene-neutral-200 bg-white px-2.5 py-1.5 text-xs">
														<span className="flex h-6 w-6 items-center justify-center rounded bg-serene-neutral-100 text-[9px] font-bold uppercase text-serene-neutral-600">{(f.name.split(".").pop() ?? "file").slice(0, 4)}</span>
														<span className="max-w-[170px] truncate">{f.name}</span>
														<span className="text-serene-neutral-400">{f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`}</span>
														<button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}><X className="h-3 w-3 text-serene-neutral-400 hover:text-red-600" /></button>
													</li>
												))}
												{files.length > 0 && <li className={cn("self-center text-xs", size > 18 * 1024 * 1024 ? "text-red-600" : "text-serene-neutral-400")}>{(size / 1024 / 1024).toFixed(1)} MB of 18</li>}
											</ul>
										</div>
									)}
								</div>

								{seed.quoteHtml && (
									<label className="mt-3 flex cursor-pointer items-center gap-2 px-1 text-xs text-serene-neutral-500">
										<input type="checkbox" checked={withQuote} onChange={(e) => setWithQuote(e.target.checked)} className="h-3.5 w-3.5 accent-[#068297]" />
										<FileText className="h-3.5 w-3.5" /> Include the message I am answering below my reply
									</label>
								)}
							</div>

							{/* The conversation, one colour per person, beside the reply */}
							{thread.length > 0 && expanded && (
								<aside className="hidden w-[320px] shrink-0 flex-col border-l border-black/[0.06] bg-white md:flex" aria-label="Conversation">
									<p className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">Conversation <span className="rounded-full bg-black/5 px-1.5 py-0.5 normal-case tracking-normal">{thread.length}</span></p>
									<div className="min-h-0 flex-1 overflow-y-auto p-3">
										{threadList}
										<div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
											{people.map((a, i) => {
												const t = thread.find((x) => x.address.toLowerCase() === a)!;
												const sh = a === me ? MINE : SHADES[i % SHADES.length];
												return <span key={a} className="flex items-center gap-1.5 text-[11px] text-serene-neutral-600"><span className={cn("h-2 w-2 rounded-full", sh.dot)} />{a === me ? "You" : t.name || a}</span>;
											})}
										</div>
									</div>
								</aside>
							)}
						</div>

						{dragging && (
							<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-sauti-teal/10 backdrop-blur-[1px]">
								<div className="rounded-2xl border-2 border-dashed border-sauti-teal bg-white/90 px-8 py-6 text-center text-sm font-medium text-sauti-dark shadow-lg">Drop files to attach them<br /><span className="text-xs font-normal text-serene-neutral-500">A Markdown file is turned into the message text</span></div>
							</div>
						)}

						<footer className="flex flex-wrap items-center gap-1 border-t border-black/[0.06] bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
							<Button variant="ghost" size="icon" className={fmt(rich)} onClick={() => setRich((v) => !v)} aria-label="Formatting options" aria-pressed={rich} title="Formatting options"><Type className="h-4 w-4" /></Button>
							<Button variant="ghost" size="icon" className={toolBtn} onClick={() => fileInput.current?.click()} aria-label="Attach files" title="Attach files"><Paperclip className="h-4 w-4" /></Button>
							<input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
							<Popover>
								<PopoverTrigger asChild><Button variant="ghost" size="icon" className={toolBtn} aria-label="Attach from the vault" title="Attach from the vault"><HardDrive className="h-4 w-4" /></Button></PopoverTrigger>
								<PopoverContent align="start" className="w-80 space-y-2 p-2">
									<Input value={vaultQ} onChange={(e) => setVaultQ(e.target.value)} placeholder="Search the vault" aria-label="Search the vault" />
									<ul className="max-h-60 overflow-y-auto">
										{vaultHits.map((f) => (
											<li key={f.id}><button onClick={() => addVault(f)} className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-serene-neutral-100"><span className="truncate font-medium">{f.name}</span><span className="text-xs text-serene-neutral-500">{f.folder ? `${f.folder} · ` : ""}you can {f.level === "view" ? "view" : f.level === "share" ? "view and share" : "edit"}</span></button></li>
										))}
										{vaultHits.length === 0 && <li className="p-3 text-xs text-serene-neutral-500">No files you can use. Upload some in the Vault tab.</li>}
									</ul>
								</PopoverContent>
							</Popover>
							<Button variant="ghost" size="icon" className={toolBtn} onClick={insertScheduling} aria-label="Insert scheduling link" title="Scheduling link"><CalendarClock className="h-4 w-4" /></Button>
							<Popover>
								<PopoverTrigger asChild><Button variant="ghost" size="icon" className={cn(toolBtn, "font-mono text-xs")} aria-label="Insert snippet" title="Snippets">{"{}"}</Button></PopoverTrigger>
								<PopoverContent align="start" className="w-64 p-1">
									{snippets.length === 0 ? <p className="p-3 text-xs text-serene-neutral-500">No snippets yet. Save reusable text from Settings, then type / to insert it.</p> : snippets.map((s) => (
										<button key={s.id} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-serene-neutral-100" onClick={() => editor?.chain().focus().insertContent(s.body_html).run()}>{s.name}</button>
									))}
								</PopoverContent>
							</Popover>

							<span className="mx-1 hidden h-5 w-px bg-black/10 sm:block" />
							<Popover>
								<PopoverTrigger asChild>
									<Button variant="ghost" size="sm" className="h-8 gap-1.5 text-sauti-teal" disabled={rewriting}>{rewriting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} <span className="hidden sm:inline">{rewriting && tone ? "Rewriting" : "Tone"}</span><ChevronDown className="h-3 w-3" /></Button>
								</PopoverTrigger>
								<PopoverContent align="start" className="w-64 p-1">
									<p className="px-2.5 pb-1 pt-1.5 text-xs text-serene-neutral-500">Rewrites {sel ? "the highlighted text" : "your message"}. Undo with Ctrl+Z.</p>
									{TONES.map((t) => (
										<button key={t.mode} onClick={() => rewrite(t.mode, !sel)} className="flex w-full flex-col rounded-md px-2.5 py-1.5 text-left hover:bg-serene-neutral-100">
											<span className="text-sm font-medium">{t.label}</span><span className="text-xs text-serene-neutral-500">{t.hint}</span>
										</button>
									))}
								</PopoverContent>
							</Popover>
							{seed.replyTo && (
								<>
									<Button variant="ghost" size="sm" className="h-8 gap-1.5 text-sauti-teal" onClick={() => (drafting ? draftCtl.current?.abort() : writeWithAi(guide))}>
										{drafting ? <><X className="h-4 w-4" /> <span className="hidden sm:inline">Stop</span></> : <><Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Write reply</span></>}
									</Button>
									<Popover>
										<PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-6 text-serene-neutral-500" aria-label="Tell the AI what to say"><ChevronDown className="h-3.5 w-3.5" /></Button></PopoverTrigger>
										<PopoverContent align="start" className="w-72 space-y-2 p-3">
											<p className="text-xs text-serene-neutral-600">Optional: say what the reply should include. Leave it empty and it answers the email.</p>
											<Input value={guide} onChange={(e) => setGuide(e.target.value)} placeholder="e.g. Thank them and propose Tuesday" onKeyDown={(e) => { if (e.key === "Enter") writeWithAi(guide); }} />
											<Button size="sm" className="w-full gap-1.5" onClick={() => writeWithAi(guide)} disabled={drafting}>{drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Write it</Button>
										</PopoverContent>
									</Popover>
								</>
							)}
							<div className="flex-1" />
							<span className="hidden text-xs text-serene-neutral-400 md:inline">Ctrl+Enter</span>
							<Button onClick={() => send()} disabled={sending} className="gap-1.5 bg-sauti-teal px-5 hover:bg-sauti-dark">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send</Button>
						</footer>
					</>
				)}
			</div>

			<Dialog open={!!issues} onOpenChange={(o) => !o && setIssues(null)}>
				<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Some recipients cannot open these files</DialogTitle>
						<DialogDescription>Access to vault documents follows who can view and share them. Choose what to do before sending.</DialogDescription>
					</DialogHeader>
					<ul className="space-y-3 text-sm">
						{issues?.map((c) => {
							const missing = c.recipients.filter((r) => !r.level);
							if (!missing.length) return null;
							return (
								<li key={c.fileId} className="rounded-xl bg-amber-50 p-3 text-amber-950">
									<p className="font-semibold">{c.fileName}</p>
									<ul className="mt-1 list-disc pl-5 text-xs">
										{missing.map((m) => <li key={m.email}>{m.email} {m.external ? "is outside the platform, so cannot be given access" : "has no view access"}</li>)}
									</ul>
									{!c.senderCanShare && <p className="mt-1 text-xs">You can view this file but not share it, so you cannot grant access or send a copy.</p>}
								</li>
							);
						})}
					</ul>
					<DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
						{issues?.some((c) => c.senderCanShare && c.recipients.some((r) => !r.level && !r.external)) && (
							<Button className="bg-sauti-teal hover:bg-sauti-dark" onClick={async () => {
								const list = issues!;
								try {
									const ids = list.filter((c) => c.senderCanShare).map((c) => c.fileId);
									const emails = [...new Set(list.flatMap((c) => c.recipients.filter((r) => !r.level && !r.external).map((r) => r.email)))];
									await grantViewTo(ids, emails);
									setIssues(null);
									await send({ skipCheck: true, acknowledge: true });
								} catch (e) { toast({ title: "Could not share", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
							}}>Give them view access and send</Button>
						)}
						{issues?.some((c) => c.senderCanShare) && (
							<Button variant="outline" onClick={() => {
								const bad = new Set(issues!.filter((c) => c.senderCanShare && c.recipients.some((r) => !r.level)).map((c) => c.fileId));
								const next = vault.map((v) => (bad.has(v.id) ? { ...v, mode: "attach" as const } : v));
								setVault(next);
								setIssues(null);
								send({ skipCheck: true, vault: next });
							}}>Send those files as attachments instead</Button>
						)}
						<Button variant="outline" onClick={() => { setIssues(null); send({ skipCheck: true, acknowledge: true }); }}>Send anyway (they will not be able to open the links)</Button>
						<Button variant="ghost" onClick={() => setIssues(null)}>Go back and edit</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{sel && !slash && (
				<div role="toolbar" aria-label="Improve selected text" style={{ left: Math.max(8, Math.min(sel.x, (typeof window !== "undefined" ? window.innerWidth : 800) - 330)), top: Math.max(8, sel.y - 46) }} className="fixed z-[60] flex items-center gap-0.5 rounded-xl border border-serene-neutral-200 bg-white p-1 shadow-xl">
					{rewriting ? <span className="flex items-center gap-2 px-3 py-1.5 text-sm text-serene-neutral-600"><Loader2 className="h-4 w-4 animate-spin" /> Rewriting...</span> : (
						<>
							<Sparkles className="mx-1.5 h-4 w-4 text-sauti-teal" />
							{([["improve", "Improve"], ["formal", "Formal"], ["warm", "Warm"], ["shorter", "Shorter"], ["revamp", "Revamp"], ["fix", "Fix spelling"]] as const).map(([m, l]) => (
								<button key={m} onMouseDown={(e) => e.preventDefault()} onClick={() => rewrite(m)} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-serene-neutral-800 hover:bg-serene-neutral-100">{l}</button>
							))}
						</>
					)}
				</div>
			)}

			{slash && items.length > 0 && (
				<ul role="listbox" aria-label="Insert block" style={{ left: Math.min(slash.x, (typeof window !== "undefined" ? window.innerWidth : 800) - 310), top: slash.y }} className="fixed z-[60] max-h-80 w-72 overflow-y-auto rounded-xl border border-serene-neutral-200 bg-white p-1 shadow-xl">
					<li role="presentation" className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-serene-neutral-500">{slash.kind === "mention" ? "Vault files" : "Basic blocks"}</li>
					{items.map((it, i) => (
						<li key={it.id} role="option" aria-selected={i === active}>
							<button onMouseDown={(e) => { e.preventDefault(); pick(it); }} onMouseEnter={() => setActive(i)} className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", i === active && "bg-serene-neutral-100")}>
								<span className="flex h-8 w-8 items-center justify-center rounded-md border border-serene-neutral-200 bg-white"><it.icon className="h-4 w-4 text-serene-neutral-600" /></span>
								<span><span className="block text-sm font-medium text-serene-neutral-900">{it.label}</span><span className="block text-xs text-serene-neutral-500">{it.hint}</span></span>
							</button>
						</li>
					))}
				</ul>
			)}
		</>
	);
}

function Row({ label, children, extra }: { label: string; children: React.ReactNode; extra?: React.ReactNode }) {
	return (
		<div className="flex items-center gap-2 px-4">
			<span className="w-14 shrink-0 text-xs text-serene-neutral-500">{label}</span>
			<div className="min-w-0 flex-1">{children}</div>
			{extra}
		</div>
	);
}
