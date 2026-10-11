"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import logo from "@/public/logo-small.png";
import { ArrowUp, Check, ImageIcon, KeyRound, Loader2, MessageSquarePlus, MoreHorizontal, Palette, PanelLeft, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
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
	const scroller = useRef<HTMLDivElement>(null);
	const abort = useRef<AbortController | null>(null);

	const refresh = useCallback(async () => {
		const [t, s, d] = await Promise.all([api.threads(), api.settings(), api.designs()]);
		setThreads(t);
		setSettings(s);
		setDesigns(d);
	}, []);
	useEffect(() => {
		refresh().catch(() => { setThreads([]); toast({ title: "Could not load the assistant", variant: "destructive" }); });
	}, [refresh, toast]);

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

	const send = async (textIn?: string) => {
		const text = (textIn ?? input).trim();
		if (!text || sending) return;
		setInput("");
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
				body: JSON.stringify({ threadId: active, message: text, mode, designSystemId: designId }),
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
							<button onClick={() => open(t.id)} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-[#37352f]">{t.title}</button>
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
						<button onClick={() => setConnect("manual")} className="flex w-full items-center gap-2 text-left"><KeyRound className="h-4 w-4" /> Using your {settings.provider === "openai" ? "OpenAI" : "OpenRouter"} key</button>
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
							<div className="flex items-center gap-1 px-1">
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
					<p className="text-xs text-serene-neutral-500">
						Sign in with ChatGPT is not offered to other apps by OpenAI. A ChatGPT account has no API key of its own; create one on platform.openai.com, or use OpenRouter.
					</p>
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
