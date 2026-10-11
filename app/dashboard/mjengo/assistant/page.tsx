"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import logo from "@/public/logo-small.png";
import { AlertCircle, ArrowUp, Check, FileText, ImageIcon, KeyRound, Loader2, MessageSquarePlus, MoreHorizontal, Paperclip, Palette, PanelLeft, Pencil, Plus, RotateCw, Sparkles, Trash2, X } from "lucide-react";
import { putToSignedUrl } from "@/lib/client/upload";
import { prepareUpload, registerUpload, searchFiles } from "../vault/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import * as raw from "@/app/actions/mjengo-ai";
import type { AiSettings, ChatMessage, DesignSystem, ThreadRow } from "@/app/actions/mjengo-ai";
import { Markdown } from "../_components/Markdown";
import { MjengoLoader } from "../_components/MjengoLoader";

const api = {
	threads: () => unwrap(raw.listThreads()),
	thread: (id: string) => unwrap(raw.getThread(id)),
	rename: (id: string, t: string) => unwrap(raw.renameThread(id, t)),
	remove: (id: string) => unwrap(raw.deleteThread(id)),
	setDesign: (id: string, d: string | null) => unwrap(raw.setThreadDesign(id, d)),
	settings: () => unwrap(raw.getAiSettings()),
	saveKey: (p: "openrouter" | "openai", k: string, m: string | null) => unwrap(raw.saveAiKey(p, k, m)),
	removeKey: () => unwrap(raw.removeAiKey()),
	designs: () => unwrap(raw.listDesignSystems()),
	saveDesign: (...a: Parameters<typeof raw.saveDesignSystem>) => unwrap(raw.saveDesignSystem(...a)),
	removeDesign: (id: string) => unwrap(raw.deleteDesignSystem(id)),
	privateFolder: () => unwrap(raw.privateDocsFolder()),
	designFiles: (id: string) => unwrap(raw.designFiles(id)),
	attach: (id: string, f: string) => unwrap(raw.attachDesignFile(id, f)),
	detach: (id: string, f: string) => unwrap(raw.detachDesignFile(id, f)),
};

interface Msg { id: string; role: "user" | "assistant"; content: string; image?: string | null; pending?: boolean }

const SUGGESTIONS = [
	"Draft a short concept note for a survivor support grant",
	"Summarise the key points to raise in a funder call",
	"Write a LinkedIn post announcing our new partnership",
	"Turn these notes into a clear project plan",
];

export default function AssistantPage() {
	const { toast } = useToast();
	const [threads, setThreads] = useState<ThreadRow[] | null>(null);
	const [active, setActive] = useState<string | null>(null);
	const [messages, setMessages] = useState<Msg[]>([]);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [mode, setMode] = useState<"chat" | "image">("chat");
	const [settings, setSettings] = useState<AiSettings | null>(null);
	const [designs, setDesigns] = useState<DesignSystem[]>([]);
	const [designId, setDesignId] = useState<string | null>(null);
	const [connect, setConnect] = useState<null | "limit" | "image" | "manual">(null);
	const [manageDesigns, setManageDesigns] = useState(false);
	const [rail, setRail] = useState(false);
	const [attached, setAttached] = useState<{ id: string; name: string }[]>([]);
	const [uploading, setUploading] = useState(false);
	const filePick = useRef<HTMLInputElement>(null);
	const scroller = useRef<HTMLDivElement>(null);
	const abort = useRef<AbortController | null>(null);

	const refresh = useCallback(async () => {
		const [t, s, d] = await Promise.all([api.threads(), api.settings(), api.designs()]);
		setThreads(t);
		setSettings(s);
		setDesigns(d);
	}, []);
	// Back from Sign in with ChatGPT.
	useEffect(() => {
		const p = new URLSearchParams(window.location.search);
		if (p.get("chatgpt") === "connected") toast({ title: "Signed in with ChatGPT", description: "Chats now use your ChatGPT plan." });
		if (p.get("chatgpt_error")) toast({ title: "Could not sign in with ChatGPT", description: p.get("chatgpt_error") ?? undefined, variant: "destructive" });
		if (p.get("chatgpt") || p.get("chatgpt_error")) window.history.replaceState(null, "", window.location.pathname);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	useEffect(() => {
		refresh().catch(() => { setThreads([]); toast({ title: "Could not load the assistant", variant: "destructive" }); });
	}, [refresh, toast]);

	// Chats that are still being answered keep updating in the list, and a finished one refreshes the open chat.
	const anyRunning = (threads ?? []).some((t) => t.status === "running");
	useEffect(() => {
		if (!anyRunning) return;
		const t = setInterval(() => { refresh().catch(() => undefined); }, 3000);
		return () => clearInterval(t);
	}, [anyRunning, refresh]);
	const activeStatus = threads?.find((t) => t.id === active);
	const wasRunning = useRef(false);
	useEffect(() => {
		const running = activeStatus?.status === "running";
		if (wasRunning.current && !running && active && !sending) open(active);
		wasRunning.current = running;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeStatus?.status]);

	useEffect(() => {
		scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
	}, [messages]);

	const open = async (id: string | null) => {
		abort.current?.abort();
		setActive(id);
		setRail(false);
		if (!id) { setMessages([]); return; }
		try {
			const r = await api.thread(id);
			setDesignId(r.thread.design_system_id);
			setMessages(r.messages.map((m: ChatMessage) => ({ id: m.id, role: m.role, content: m.content, image: m.asset_id ? r.assets[m.asset_id] ?? null : null })));
		} catch (e) {
			toast({ title: "Could not open the chat", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	};

	/** Documents for the assistant are kept under Private docs in the vault. */
	const attachFiles = async (files: FileList | null) => {
		if (!files?.length) return;
		setUploading(true);
		try {
			const folder = await api.privateFolder();
			for (const f of Array.from(files).slice(0, 3)) {
				const { path, signedUrl } = await prepareUpload(folder, f.name, f.size);
				await putToSignedUrl(signedUrl, f);
				const created = await registerUpload(folder, path, f.name, f.size, f.type || null);
				setAttached((a) => [...a, { id: created.id, name: f.name }].slice(0, 3));
			}
		} catch (e) {
			toast({ title: "Could not add the document", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setUploading(false);
			if (filePick.current) filePick.current.value = "";
		}
	};

	const send = async (textIn?: string) => {
		const text = (textIn ?? input).trim();
		if (!text || sending) return;
		setInput("");
		const sentFiles = attached;
		setAttached([]);
		setSending(true);
		const uid = `u${Date.now()}`;
		const aid = `a${Date.now()}`;
		setMessages((m) => [...m, { id: uid, role: "user", content: text }, { id: aid, role: "assistant", content: "", pending: true }]);
		const ctl = new AbortController();
		abort.current = ctl;
		let threadId = active;
		try {
			const res = await fetch("/api/mjengo/assistant/chat", {
				method: "POST",
				signal: ctl.signal,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ threadId: active, message: text, mode, designSystemId: designId, fileIds: attached.map((a) => a.id) }),
			});
			if (!res.body) throw new Error("No answer came back.");
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			let buf = "";
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += dec.decode(value, { stream: true });
				let i: number;
				while ((i = buf.indexOf("\n")) >= 0) {
					const l = buf.slice(0, i).trim();
					buf = buf.slice(i + 1);
					if (!l) continue;
					const ev = JSON.parse(l) as { t: string; id?: string; text?: string; url?: string; message?: string; reason?: string; hitLimit?: boolean };
					if (ev.t === "thread" && ev.id) { threadId = ev.id; setActive(ev.id); }
					else if (ev.t === "delta") setMessages((m) => m.map((x) => (x.id === aid ? { ...x, content: x.content + (ev.text ?? "") } : x)));
					else if (ev.t === "image") setMessages((m) => m.map((x) => (x.id === aid ? { ...x, image: ev.url ?? null, pending: false } : x)));
					else if (ev.t === "limit") {
						setMessages((m) => m.filter((x) => x.id !== aid && x.id !== uid));
						setInput(text);
						setAttached(sentFiles);
						setConnect(ev.reason === "image" ? "image" : "limit");
					} else if (ev.t === "error") throw new Error(ev.message);
					else if (ev.t === "done" && ev.hitLimit) setConnect("limit");
				}
			}
		} catch (e) {
			if ((e as Error).name !== "AbortError") {
				setMessages((m) => m.filter((x) => x.id !== aid));
				toast({ title: "The assistant could not answer", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			}
		} finally {
			setMessages((m) => m.map((x) => (x.id === aid ? { ...x, pending: false } : x)));
			setSending(false);
			refresh().catch(() => undefined);
			void threadId;
		}
	};

	const remaining = settings ? Math.max(0, settings.freeLimit - settings.freeUsed) : 0;
	const design = designs.find((d) => d.id === designId) ?? null;
	const empty = messages.length === 0;

	if (!threads || !settings) return <MjengoLoader label="Opening the assistant" className="h-full min-h-0" />;

	return (
		<div className="flex h-full min-h-0 bg-white">
			{/* Chats */}
			<aside className={cn("z-20 flex w-64 shrink-0 flex-col border-r border-black/[0.06] bg-[#f9f9f8] max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:shadow-xl", rail ? "max-lg:flex" : "max-lg:hidden")}>
				<div className="p-2">
					<button onClick={() => open(null)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#37352f] hover:bg-black/[0.05]"><MessageSquarePlus className="h-[18px] w-[18px]" /> New chat</button>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
					{threads.length === 0 && <p className="px-3 py-6 text-xs text-[#9b9a97]">Your chats appear here.</p>}
					{threads.map((t) => (
						<div key={t.id} className={cn("group flex items-center rounded-lg", active === t.id ? "bg-black/[0.06]" : "hover:bg-black/[0.04]")}>
							<button onClick={() => open(t.id)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm text-[#37352f]" title={t.status === "failed" ? t.error ?? "This reply did not finish" : undefined}>
								{t.status === "running" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sauti-teal" aria-label="Still answering" />}
								{t.status === "failed" && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-label="Did not finish" />}
								<span className="truncate">{t.title}</span>
							</button>
							<Popover>
								<PopoverTrigger asChild><button aria-label="Chat options" className="mr-1 hidden h-7 w-7 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.06] group-hover:flex"><MoreHorizontal className="h-4 w-4" /></button></PopoverTrigger>
								<PopoverContent align="end" className="w-40 p-1">
									<button onClick={async () => { const n = window.prompt("Rename chat", t.title); if (n?.trim()) { await api.rename(t.id, n).catch(() => undefined); refresh(); } }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-black/5"><Pencil className="h-4 w-4" /> Rename</button>
									<button onClick={async () => { await api.remove(t.id).catch(() => undefined); if (active === t.id) open(null); refresh(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>
								</PopoverContent>
							</Popover>
						</div>
					))}
				</div>
				<div className="border-t border-black/[0.06] p-3 text-xs text-[#787774]">
					{settings.hasKey ? (
						<button onClick={() => setConnect("manual")} className="flex w-full items-center gap-2 text-left"><KeyRound className="h-4 w-4" /> {settings.provider === "chatgpt" ? "Signed in with ChatGPT" : `Using your ${settings.provider === "openai" ? "OpenAI" : "OpenRouter"} key`}</button>
					) : (
						<button onClick={() => setConnect("manual")} className="flex w-full items-center gap-2 text-left hover:text-[#37352f]"><KeyRound className="h-4 w-4" /> {remaining > 0 ? `${remaining} free tokens left. Connect your own` : "Connect your own key"}</button>
					)}
				</div>
			</aside>

			{/* Conversation */}
			<section className="flex min-w-0 flex-1 flex-col">
				<header className="flex h-12 shrink-0 items-center gap-1 border-b border-black/[0.06] px-3">
					<button onClick={() => setRail((v) => !v)} aria-label="Chats" className="flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 lg:hidden"><PanelLeft className="h-[18px] w-[18px]" /></button>
					<span className="px-1 text-[15px] font-semibold text-[#37352f]">Assistant</span>
					<span className="flex-1" />
					<Popover>
						<PopoverTrigger asChild>
							<button className="flex h-8 items-center gap-2 rounded-lg border border-black/10 px-3 text-sm text-[#37352f] hover:bg-black/[0.03]"><Palette className="h-4 w-4 text-[#787774]" /> {design ? design.name : "No design system"}</button>
						</PopoverTrigger>
						<PopoverContent align="end" className="w-64 p-1.5">
							<button onClick={() => { setDesignId(null); if (active) api.setDesign(active, null).catch(() => undefined); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5">{!designId && <Check className="h-4 w-4 text-sauti-teal" />}<span className={designId ? "pl-6" : ""}>None</span></button>
							{designs.map((d) => (
								<button key={d.id} onClick={() => { setDesignId(d.id); if (active) api.setDesign(active, d.id).catch(() => undefined); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5">
									{designId === d.id ? <Check className="h-4 w-4 text-sauti-teal" /> : <span className="w-4" />}
									<span className="flex-1 truncate">{d.name}</span>
									<span className="flex -space-x-1">{d.colors.slice(0, 3).map((c) => <span key={c} className="h-3.5 w-3.5 rounded-full ring-1 ring-white" style={{ background: c }} />)}</span>
								</button>
							))}
							<button onClick={() => setManageDesigns(true)} className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[#787774] hover:bg-black/5"><Plus className="h-4 w-4" /> Manage design systems</button>
						</PopoverContent>
					</Popover>
				</header>

				<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
					{empty ? (
						<div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-4 text-center">
							<Image src={logo} alt="" className="mb-4 h-12 w-auto" />
							<h1 className="text-2xl font-semibold text-[#37352f]">How can I help today?</h1>
							{!settings.hasKey && (
								<p className="mt-2 text-sm text-[#787774]">{remaining > 0 ? `You have ${remaining} free tokens. Connect your own key any time to keep going.` : "The free allowance is used. Connect your own key to keep chatting."}</p>
							)}
							<div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
								{SUGGESTIONS.map((s) => (
									<button key={s} onClick={() => send(s)} className="rounded-2xl border border-black/10 px-4 py-3 text-left text-sm text-[#37352f] transition hover:bg-black/[0.03]">{s}</button>
								))}
							</div>
						</div>
					) : (
						<div className="mx-auto w-full max-w-3xl px-4 py-6">
							{messages.map((m) =>
								m.role === "user" ? (
									<div key={m.id} className="mb-6 flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-[#f4f4f2] px-5 py-3 text-[15px] text-[#37352f]">{m.content}</p></div>
								) : (
									<div key={m.id} className="mb-8 flex gap-4">
										<span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white"><Sparkles className="h-4 w-4 text-sauti-teal" /></span>
										<div className="min-w-0 flex-1 text-[15px] leading-7 text-[#37352f]">
											{m.image && <img src={m.image} alt="Generated" className="mb-2 max-h-[480px] rounded-2xl border border-black/10" />}
											{m.content ? <Markdown text={m.content} /> : m.pending && !m.image ? <span className="inline-flex gap-1 pt-2"><i className="h-2 w-2 animate-bounce rounded-full bg-black/30" /><i className="h-2 w-2 animate-bounce rounded-full bg-black/30 [animation-delay:150ms]" /><i className="h-2 w-2 animate-bounce rounded-full bg-black/30 [animation-delay:300ms]" /></span> : null}
										</div>
									</div>
								)
							)}
						</div>
					)}
				</div>

				<div className="shrink-0 px-4 pb-4">
					<div className="mx-auto w-full max-w-3xl">
						{activeStatus?.status === "failed" && !sending && (
							<div className="mb-2 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
								<AlertCircle className="h-4 w-4 shrink-0" />
								<span className="min-w-0 flex-1 truncate">{activeStatus.error || "That reply did not finish."}</span>
								<button onClick={() => { const last = [...messages].reverse().find((m) => m.role === "user"); if (last) send(last.content); }} className="flex shrink-0 items-center gap-1.5 font-semibold hover:underline"><RotateCw className="h-3.5 w-3.5" /> Try again</button>
							</div>
						)}
						{activeStatus?.status === "running" && !sending && (
							<p className="mb-2 flex items-center gap-2 text-xs text-[#787774]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> This chat is still being answered. It will appear here when ready.</p>
						)}
						<form
							onSubmit={(e) => { e.preventDefault(); send(); }}
							className="rounded-3xl border border-black/10 bg-white p-2 shadow-[0_2px_12px_rgba(0,0,0,0.06)] focus-within:border-black/25"
						>
							<Textarea
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
								rows={1}
								placeholder={mode === "image" ? "Describe the image to create" : "Message the assistant"}
								aria-label="Message"
								className="max-h-48 min-h-[44px] resize-none border-0 bg-transparent px-3 py-2.5 text-[15px] shadow-none focus-visible:ring-0"
							/>
							{attached.length > 0 && (
								<div className="flex flex-wrap gap-1.5 px-2 pb-1">
									{attached.map((a) => (
										<span key={a.id} className="flex max-w-[220px] items-center gap-1.5 rounded-full bg-[#f4f4f2] py-1 pl-2.5 pr-1 text-xs text-[#37352f]"><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{a.name}</span><button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAttached((x) => x.filter((y) => y.id !== a.id))} className="rounded-full p-0.5 hover:bg-black/10"><X className="h-3 w-3" /></button></span>
									))}
								</div>
							)}
							<div className="flex items-center gap-1 px-1">
								<button type="button" onClick={() => filePick.current?.click()} disabled={uploading} aria-label="Add a document" title="Add a document (kept in Private docs)" className="flex h-8 w-8 items-center justify-center rounded-full text-[#787774] hover:bg-black/5">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}</button>
								<input ref={filePick} type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,application/pdf" className="hidden" onChange={(e) => attachFiles(e.target.files)} />
								<button type="button" onClick={() => setMode((m) => (m === "image" ? "chat" : "image"))} aria-pressed={mode === "image"} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", mode === "image" ? "bg-sauti-teal-light text-sauti-teal" : "text-[#787774] hover:bg-black/5")}>
									<ImageIcon className="h-4 w-4" /> Image
								</button>
								<span className="flex-1" />
								{sending ? (
									<button type="button" onClick={() => abort.current?.abort()} aria-label="Stop" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#37352f] text-white"><span className="h-3 w-3 rounded-[2px] bg-white" /></button>
								) : (
									<button type="submit" disabled={!input.trim()} aria-label="Send" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#37352f] text-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
								)}
							</div>
						</form>
						<p className="mt-2 text-center text-xs text-[#9b9a97]">The assistant can make mistakes. Check important details.</p>
					</div>
				</div>
			</section>

			<ConnectDialog mode={connect} settings={settings} onClose={() => setConnect(null)} onChanged={refresh} />
			<DesignDialog open={manageDesigns} designs={designs} onClose={() => setManageDesigns(false)} onChanged={refresh} />
		</div>
	);
}

function ConnectDialog({ mode, settings, onClose, onChanged }: { mode: null | "limit" | "image" | "manual"; settings: AiSettings; onClose: () => void; onChanged: () => Promise<void> }) {
	const { toast } = useToast();
	const [provider, setProvider] = useState<"openai" | "openrouter">("openai");
	const [key, setKey] = useState("");
	const [model, setModel] = useState("");
	const [busy, setBusy] = useState(false);
	useEffect(() => { if (mode) { setKey(""); setModel(""); } }, [mode]);

	return (
		<Dialog open={!!mode} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{mode === "limit" ? "Keep chatting with your own key" : mode === "image" ? "Connect a key to create images" : "Connect your own key"}</DialogTitle>
					<DialogDescription>
						{mode === "limit" ? "The free allowance for the team key is used up. Add your own key and continue where you left off." : mode === "image" ? "Image creation uses your own account, so add a key first." : "Chats use your account and are not limited. Your key is stored encrypted and only used for your messages."}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<div className="grid grid-cols-2 gap-2">
						{(["openai", "openrouter"] as const).map((p) => (
							<button key={p} type="button" onClick={() => setProvider(p)} aria-pressed={provider === p} className={cn("rounded-xl border p-3 text-left text-sm", provider === p ? "border-sauti-teal bg-sauti-teal-light/30" : "border-serene-neutral-200")}>
								<span className="block font-semibold">{p === "openai" ? "OpenAI" : "OpenRouter"}</span>
								<span className="block text-xs text-serene-neutral-500">{p === "openai" ? "Your ChatGPT platform key" : "Many models, one key"}</span>
							</button>
						))}
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="ai-key">API key</Label>
						<Input id="ai-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={provider === "openai" ? "sk-..." : "sk-or-..."} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="ai-model">Model <span className="font-normal text-serene-neutral-400">(optional)</span></Label>
						<Input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === "openai" ? "gpt-4o-mini" : "google/gemini-2.5-flash-lite"} />
					</div>
					{settings.chatgptAvailable ? (
						<a href="/api/mjengo/assistant/chatgpt/start" className="flex items-center justify-center gap-2 rounded-lg border border-serene-neutral-200 py-2.5 text-sm font-semibold hover:bg-serene-neutral-50">
							<Sparkles className="h-4 w-4" /> Sign in with ChatGPT instead
						</a>
					) : (
						<p className="text-xs text-serene-neutral-500">
							Sign in with ChatGPT is available to apps OpenAI has approved. It switches on here once this site has its OpenAI client id. Until then, an API key from platform.openai.com or OpenRouter works.
						</p>
					)}
				</div>
				<DialogFooter className="gap-2">
					{settings.hasKey && <Button variant="ghost" className="text-red-600" disabled={busy} onClick={async () => { await api.removeKey().catch(() => undefined); await onChanged(); onClose(); }}>Remove key</Button>}
					<Button variant="outline" onClick={onClose} disabled={busy}>Not now</Button>
					<Button
						className="gap-2 bg-sauti-teal hover:bg-sauti-dark"
						disabled={busy || key.trim().length < 20}
						onClick={async () => {
							setBusy(true);
							try {
								await api.saveKey(provider, key, model.trim() || null);
								await onChanged();
								toast({ title: "Key connected" });
								onClose();
							} catch (e) {
								toast({ title: "Could not connect", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
							} finally {
								setBusy(false);
							}
						}}
					>
						{busy && <Loader2 className="h-4 w-4 animate-spin" />} Connect
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DesignDialog({ open, designs, onClose, onChanged }: { open: boolean; designs: DesignSystem[]; onClose: () => void; onChanged: () => Promise<void> }) {
	const { toast } = useToast();
	const [edit, setEdit] = useState<(Partial<DesignSystem> & { colorsText: string }) | null>(null);
	const [busy, setBusy] = useState(false);
	const start = (d?: DesignSystem) => setEdit(d ? { ...d, colorsText: d.colors.join(", ") } : { name: "", description: "", fonts: "", voice: "", notes: "", colorsText: "" });
	useEffect(() => { if (!open) setEdit(null); }, [open]);
	const set = (k: "name" | "description" | "fonts" | "voice" | "notes" | "colorsText") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEdit((x) => (x ? { ...x, [k]: e.target.value } : x));

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Design systems</DialogTitle>
					<DialogDescription>Colours, fonts and voice the assistant follows when it writes or creates images.</DialogDescription>
				</DialogHeader>
				{!edit ? (
					<div className="space-y-2">
						{designs.length === 0 && <p className="py-4 text-center text-sm text-serene-neutral-500">None yet.</p>}
						{designs.map((d) => (
							<div key={d.id} className="flex items-center gap-3 rounded-xl border border-serene-neutral-200 p-3">
								<span className="flex -space-x-1">{d.colors.slice(0, 4).map((c) => <span key={c} className="h-5 w-5 rounded-full ring-2 ring-white" style={{ background: c }} />)}</span>
								<span className="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
								<Button size="sm" variant="ghost" onClick={() => start(d)}>Edit</Button>
								<Button size="icon" variant="ghost" aria-label="Delete" onClick={async () => { if (window.confirm(`Delete ${d.name}?`)) { await api.removeDesign(d.id).catch(() => undefined); await onChanged(); } }}><Trash2 className="h-4 w-4" /></Button>
							</div>
						))}
						<Button className="w-full gap-2 bg-sauti-teal hover:bg-sauti-dark" onClick={() => start()}><Plus className="h-4 w-4" /> Add a design system</Button>
					</div>
				) : (
					<div className="space-y-3">
						<div className="space-y-1.5"><Label>Name</Label><Input value={edit.name ?? ""} onChange={set("name")} autoFocus /></div>
						<div className="space-y-1.5"><Label>Colours</Label><Input value={edit.colorsText} onChange={set("colorsText")} placeholder="#068297, #0f172a, #fafaf9" /></div>
						<div className="space-y-1.5"><Label>Fonts</Label><Input value={edit.fonts ?? ""} onChange={set("fonts")} placeholder="Headings in Inter Bold, body in Inter" /></div>
						<div className="space-y-1.5"><Label>Voice and tone</Label><Textarea rows={2} value={edit.voice ?? ""} onChange={set("voice")} placeholder="Warm, plain, survivor-centred" /></div>
						<div className="space-y-1.5"><Label>Rules</Label><Textarea rows={3} value={edit.notes ?? ""} onChange={set("notes")} placeholder="Never show faces. Always include the helpline number." /></div>
						{edit.id ? <DesignFiles designSystemId={edit.id as string} /> : <p className="text-xs text-serene-neutral-500">Save it first, then add PDFs or documents it should follow.</p>}
						<DialogFooter>
							<Button variant="outline" onClick={() => setEdit(null)} disabled={busy}>Back</Button>
							<Button
								className="gap-2 bg-sauti-teal hover:bg-sauti-dark"
								disabled={busy || !edit.name?.trim()}
								onClick={async () => {
									setBusy(true);
									try {
										await api.saveDesign((edit.id as string | undefined) ?? null, { name: edit.name!, description: edit.description, colors: edit.colorsText.split(/[,\s]+/).filter(Boolean), fonts: edit.fonts, voice: edit.voice, notes: edit.notes });
										await onChanged();
										setEdit(null);
									} catch (e) {
										toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
									} finally {
										setBusy(false);
									}
								}}
							>
								{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
							</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

/** PDFs and documents a design system follows: uploaded to Private docs, or picked from the vault. */
function DesignFiles({ designSystemId }: { designSystemId: string }) {
	const { toast } = useToast();
	const [files, setFiles] = useState<raw.DesignFile[] | null>(null);
	const [picking, setPicking] = useState(false);
	const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
	const [q, setQ] = useState("");
	const [busy, setBusy] = useState(false);
	const pick = useRef<HTMLInputElement>(null);

	const load = useCallback(async () => { setFiles(await api.designFiles(designSystemId).catch(() => [])); }, [designSystemId]);
	useEffect(() => { load(); }, [load]);
	useEffect(() => {
		if (!picking) return;
		const t = setTimeout(() => { searchFiles(q).then((r) => setOptions(r.map((f) => ({ id: f.id, name: f.name })))).catch(() => setOptions([])); }, 200);
		return () => clearTimeout(t);
	}, [picking, q]);

	const add = async (fileId: string) => {
		setBusy(true);
		try { await api.attach(designSystemId, fileId); await load(); setPicking(false); } catch (e) { toast({ title: "Could not add it", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	const upload = async (list: FileList | null) => {
		if (!list?.length) return;
		setBusy(true);
		try {
			const folder = await api.privateFolder();
			for (const f of Array.from(list).slice(0, 5)) {
				const { path, signedUrl } = await prepareUpload(folder, f.name, f.size);
				await putToSignedUrl(signedUrl, f);
				const created = await registerUpload(folder, path, f.name, f.size, f.type || null);
				await api.attach(designSystemId, created.id);
			}
			await load();
		} catch (e) {
			toast({ title: "Could not add the file", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
			if (pick.current) pick.current.value = "";
		}
	};

	return (
		<div className="space-y-2 rounded-xl border border-serene-neutral-200 p-3">
			<div className="flex items-center justify-between">
				<Label>Documents</Label>
				{busy && <Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" />}
			</div>
			{files?.length === 0 && <p className="text-xs text-serene-neutral-500">Brand guides, tone documents, past examples. Uploads are kept in your Private docs folder in Files.</p>}
			<ul className="space-y-1">
				{(files ?? []).map((f) => (
					<li key={f.file_id} className="flex items-center gap-2 text-sm">
						<FileText className="h-4 w-4 shrink-0 text-serene-neutral-400" />
						<span className="min-w-0 flex-1 truncate">{f.name}</span>
						{!f.readable && <span className="text-xs text-amber-700">not readable</span>}
						<button type="button" aria-label={`Remove ${f.name}`} className="text-serene-neutral-400 hover:text-red-600" onClick={async () => { await api.detach(designSystemId, f.file_id).catch(() => undefined); load(); }}><X className="h-4 w-4" /></button>
					</li>
				))}
			</ul>
			<div className="flex gap-2">
				<Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => pick.current?.click()}><Paperclip className="h-4 w-4" /> Add PDF or document</Button>
				<input ref={pick} type="file" multiple accept=".pdf,.docx,.txt,.md,application/pdf" className="hidden" onChange={(e) => upload(e.target.files)} />
				<Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setPicking((v) => !v)}>Choose from Files</Button>
			</div>
			{picking && (
				<div className="space-y-2 rounded-lg bg-serene-neutral-50 p-2">
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your files" className="h-9 bg-white" />
					<ul className="max-h-40 overflow-y-auto">
						{options.length === 0 && <li className="px-2 py-2 text-xs text-serene-neutral-500">No files found.</li>}
						{options.map((o) => (
							<li key={o.id}><button type="button" onClick={() => add(o.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white"><FileText className="h-4 w-4 text-serene-neutral-400" /><span className="truncate">{o.name}</span></button></li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
