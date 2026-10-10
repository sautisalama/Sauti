"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Bold, CalendarClock, Code2, HardDrive, Heading1, Heading2, Italic, List, ListChecks, ListOrdered, Loader2, Minus, Paperclip, Quote, Send, Sparkles, Text, X, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { draftReply, rewriteText, sendMail, type AccountView, type SnippetRow } from "./api";
import { createClient } from "@/utils/supabase/client";
import { checkRecipients, grantViewTo, searchFiles, type RecipientCheck } from "../../vault/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface ComposeSeed {
	to?: string[];
	cc?: string[];
	subject?: string;
	html?: string;
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

/**
 * Compose window with a block editor: type "/" for headings, lists, to-dos, quotes, dividers and your
 * saved snippets. Cmd/Ctrl+Enter sends.
 */
export function Composer({ accounts, accountId, seed, snippets, signature = "", onClose, onSent }: { accounts: AccountView[]; accountId: string; seed: ComposeSeed; snippets: SnippetRow[]; signature?: string; onClose: () => void; onSent: () => void }) {
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
	const fileInput = useRef<HTMLInputElement>(null);

	// ---- slash menu
	const [slash, setSlash] = useState<{ query: string; from: number; x: number; y: number } | null>(null);
	// Highlighted text: offer to improve it with AI.
	const [sel, setSel] = useState<{ from: number; to: number; x: number; y: number } | null>(null);
	const [rewriting, setRewriting] = useState(false);
	const [active, setActive] = useState(0);
	const items = useMemo(() => {
		if (!slash) return [];
		const all: SlashItem[] = [
			...BLOCKS,
			...snippets.map<SlashItem>((s) => ({ id: `snip-${s.id}`, label: s.name, hint: "Snippet", icon: Sparkles, snippet: s, run: () => undefined })),
		];
		const q = slash.query.toLowerCase();
		return all.filter((i) => !q || i.label.toLowerCase().includes(q) || i.id.includes(q)).slice(0, 8);
	}, [slash, snippets]);
	const slashRef = useRef({ slash, items, active });
	slashRef.current = { slash, items, active };

	const editor = useEditor({
		immediatelyRender: false,
		content: signature ? `<p></p>${signature}${seed.html ?? ""}` : (seed.html ?? ""),
		extensions: [StarterKit.configure({ heading: { levels: [1, 2] } }), Placeholder.configure({ placeholder: "Write something, or press / for blocks" }), TaskList, TaskItem.configure({ nested: true })],
		editorProps: {
			attributes: { class: "prose prose-sm max-w-none min-h-[200px] focus:outline-none px-1 py-2 [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2" },
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
		if (!m) return setSlash(null);
		const rect = ed.view.coordsAtPos(pos);
		setSlash({ query: m[1], from: pos - m[1].length - 1, x: rect.left, y: rect.bottom + 6 });
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
			await sendMail({
				accountId: from,
				to: recipients,
				cc: splitAddresses(cc),
				bcc: splitAddresses(bcc),
				subject,
				html: editor.getHTML(),
				inReplyTo: seed.inReplyTo,
				references: seed.references,
				attachments: await Promise.all(files.map(async (f) => ({ filename: f.name, contentBase64: await toBase64(f), contentType: f.type || "application/octet-stream" }))),
					vaultLinks: vlist.filter((v) => v.mode === "link").map((v) => v.id),
					vaultAttach: vlist.filter((v) => v.mode === "attach").map((v) => v.id),
					acknowledgeNoAccess,
			});
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

	const rewrite = async (mode: "improve" | "shorter" | "friendlier" | "fix") => {
		if (!sel || !editor) return;
		const text = editor.state.doc.textBetween(sel.from, sel.to, "\n");
		setRewriting(true);
		try {
			const out = await rewriteText(text, mode);
			editor.chain().focus().insertContentAt({ from: sel.from, to: sel.to }, out).run();
			setSel(null);
		} catch (e) {
			toast({ title: "Could not rewrite that", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setRewriting(false);
		}
	};

	const writeWithAi = async () => {
		if (!seed.replyTo || !editor) return;
		setAiBusy(true);
		try {
			const html = await draftReply(from, seed.replyTo.mailbox, seed.replyTo.uid, aiPrompt);
			editor.chain().focus().insertContentAt(0, html).run();
			setAiPrompt("");
		} catch (e) {
			toast({ title: "Could not write a draft", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setAiBusy(false);
		}
	};

	const size = files.reduce((n, f) => n + f.size, 0);

	return (
		<>
			<div
				role="dialog"
				aria-label="New message"
				className={cn(
					"fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-black/10",
					"inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[640px] sm:rounded-2xl",
					minimised ? "sm:h-12" : "sm:h-[min(78vh,680px)]"
				)}
			>
				<header className="flex items-center gap-2 border-b border-serene-neutral-100 bg-serene-neutral-50 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
					<p className="min-w-0 flex-1 truncate text-sm font-semibold text-serene-neutral-800">{subject || "New message"}</p>
					<Button variant="ghost" size="icon" className="hidden h-7 w-7 sm:inline-flex" onClick={() => setMinimised((v) => !v)} aria-label="Minimise"><Minimize2 className="h-4 w-4" /></Button>
					<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => (!editor?.getText().trim() && !subject && !to) || window.confirm("Discard this message?") ? onClose() : undefined} aria-label="Close"><X className="h-4 w-4" /></Button>
				</header>

				{!minimised && (
					<>
						<div className="space-y-px border-b border-serene-neutral-100 text-sm">
							<Row label="From">
								<select value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-transparent py-2 outline-none">
									{accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
								</select>
							</Row>
							<Row label="To" extra={!showCc && <button onClick={() => setShowCc(true)} className="px-2 text-xs text-serene-neutral-500 hover:text-serene-neutral-800">Cc / Bcc</button>}>
								<Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" className="h-9 border-0 px-0 shadow-none focus-visible:ring-0" autoComplete="off" inputMode="email" />
							</Row>
							{showCc && (
								<>
									<Row label="Cc"><Input value={cc} onChange={(e) => setCc(e.target.value)} className="h-9 border-0 px-0 shadow-none focus-visible:ring-0" autoComplete="off" /></Row>
									<Row label="Bcc"><Input value={bcc} onChange={(e) => setBcc(e.target.value)} className="h-9 border-0 px-0 shadow-none focus-visible:ring-0" autoComplete="off" /></Row>
								</>
							)}
							<Row label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9 border-0 px-0 shadow-none focus-visible:ring-0" /></Row>
						</div>

						<div className="flex-1 overflow-y-auto px-4 py-2">
							<EditorContent editor={editor} />
							{vault.length > 0 && (
									<ul className="mt-3 flex flex-wrap gap-2" aria-label="Vault documents">
										{vault.map((v) => (
											<li key={v.id} className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs text-purple-900">
												<HardDrive className="h-3 w-3" /> {v.name}
												<button
													onClick={() => v.canShare && setVault(vault.map((x) => (x.id === v.id ? { ...x, mode: x.mode === "link" ? "attach" : "link" } : x)))}
													title={v.canShare ? "Switch between a link and a copy" : "You can view this file but not share a copy; it goes as a link"}
													className="rounded bg-white px-1.5 py-0.5 font-semibold"
												>{v.mode === "link" ? "Link" : "Copy"}</button>
												<button onClick={() => setVault(vault.filter((x) => x.id !== v.id))} aria-label={`Remove ${v.name}`}><X className="h-3 w-3 text-purple-400 hover:text-red-600" /></button>
											</li>
										))}
									</ul>
								)}
								{files.length > 0 && (
								<ul className="mt-3 flex flex-wrap gap-2">
									{files.map((f, i) => (
										<li key={i} className="flex items-center gap-2 rounded-lg border border-serene-neutral-200 px-2.5 py-1 text-xs">
											<Paperclip className="h-3 w-3" /> {f.name}
											<button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}><X className="h-3 w-3 text-serene-neutral-400 hover:text-red-600" /></button>
										</li>
									))}
									<li className={cn("self-center text-xs", size > 18 * 1024 * 1024 ? "text-red-600" : "text-serene-neutral-400")}>{(size / 1024 / 1024).toFixed(1)} MB of 18</li>
								</ul>
							)}
						</div>

						<footer className="flex items-center gap-1 border-t border-serene-neutral-100 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
							<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor?.chain().focus().toggleBold().run()} aria-label="Bold"><Bold className="h-4 w-4" /></Button>
							<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor?.chain().focus().toggleItalic().run()} aria-label="Italic"><Italic className="h-4 w-4" /></Button>
							<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileInput.current?.click()} aria-label="Attach files"><Paperclip className="h-4 w-4" /></Button>
							<input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
							<Popover>
								<PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Attach from the vault" title="Attach from the vault"><HardDrive className="h-4 w-4" /></Button></PopoverTrigger>
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
							<Button variant="ghost" size="icon" className="h-8 w-8" onClick={insertScheduling} aria-label="Insert scheduling link" title="Scheduling link"><CalendarClock className="h-4 w-4" /></Button>
							<Popover>
								<PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 font-mono text-xs" aria-label="Insert snippet" title="Snippets">{"{}"}</Button></PopoverTrigger>
								<PopoverContent align="start" className="w-64 p-1">
									{snippets.length === 0 ? <p className="p-3 text-xs text-serene-neutral-500">No snippets yet. Save reusable text from Settings, then type / to insert it.</p> : snippets.map((s) => (
										<button key={s.id} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-serene-neutral-100" onClick={() => editor?.chain().focus().insertContent(s.body_html).run()}>{s.name}</button>
									))}
								</PopoverContent>
							</Popover>
							{seed.replyTo && (
								<Popover>
									<PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-8 gap-1.5 text-purple-700"><Sparkles className="h-4 w-4" /> Write reply</Button></PopoverTrigger>
									<PopoverContent align="start" className="w-72 space-y-2 p-3">
										<p className="text-xs text-serene-neutral-600">Tell the AI what to say. The email you are replying to is sent to the AI service to write the draft.</p>
										<Input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g. Thank them and propose Tuesday" onKeyDown={(e) => e.key === "Enter" && writeWithAi()} />
										<Button size="sm" className="w-full gap-1.5" onClick={writeWithAi} disabled={aiBusy}>{aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Draft</Button>
									</PopoverContent>
								</Popover>
							)}
							<div className="flex-1" />
							<span className="hidden text-xs text-serene-neutral-400 sm:inline">Ctrl+Enter</span>
							<Button onClick={() => send()} disabled={sending} className="gap-1.5 bg-purple-600 hover:bg-purple-700">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send</Button>
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
							<Button className="bg-purple-600 hover:bg-purple-700" onClick={async () => {
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
							<Sparkles className="mx-1.5 h-4 w-4 text-purple-600" />
							{([["improve", "Improve"], ["shorter", "Shorter"], ["friendlier", "Friendlier"], ["fix", "Fix spelling"]] as const).map(([m, l]) => (
								<button key={m} onMouseDown={(e) => e.preventDefault()} onClick={() => rewrite(m)} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-serene-neutral-800 hover:bg-serene-neutral-100">{l}</button>
							))}
						</>
					)}
				</div>
			)}

			{slash && items.length > 0 && (
				<ul role="listbox" aria-label="Insert block" style={{ left: Math.min(slash.x, (typeof window !== "undefined" ? window.innerWidth : 800) - 270), top: slash.y }} className="fixed z-[60] w-64 overflow-hidden rounded-xl border border-serene-neutral-200 bg-white p-1 shadow-xl">
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
