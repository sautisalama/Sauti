"use client";

import { useEffect, useRef, useState } from "react";
import { AiStar, insertText, type WordcraftEditorRef } from "@gamine/wordcraft-react";
import { CornerDownLeft, Loader2, MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Turn { role: "user" | "ai"; text: string; applied?: boolean }

/**
 * A conversation about the open document. Answers can be applied to the document with one tap: at the caret
 * (or over the selection), or as a replacement for the whole document.
 */
export function DocAssist({ editor }: { editor: React.RefObject<WordcraftEditorRef> }) {
	const { toast } = useToast();
	const [open, setOpen] = useState(false);
	const [turns, setTurns] = useState<Turn[]>([]);
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const abort = useRef<AbortController | null>(null);
	const end = useRef<HTMLDivElement>(null);
	useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns, open]);
	useEffect(() => () => abort.current?.abort(), []);

	const send = async () => {
		const q = text.trim();
		if (!q || busy) return;
		const ed = editor.current;
		const history = turns.slice(-8).map((t) => `${t.role === "user" ? "Person" : "Assistant"}: ${t.text}`).join("\n");
		setTurns((t) => [...t, { role: "user", text: q }, { role: "ai", text: "" }]);
		setText("");
		setBusy(true);
		const ctl = new AbortController();
		abort.current = ctl;
		try {
			const res = await fetch("/api/mjengo/ai/complete", {
				method: "POST",
				signal: ctl.signal,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prompt: q,
					action: "write",
					document: ed?.getText?.() ?? "",
					instructions: history ? `Conversation so far:\n${history}\nAnswer the latest request. If the person asks for text for the document, reply with only that text.` : undefined,
				}),
			});
			if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || "The AI service is unavailable.");
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			let acc = "";
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				acc += dec.decode(value, { stream: true });
				setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, text: acc } : x)));
			}
		} catch (e) {
			if (!ctl.signal.aborted) {
				toast({ title: "The assistant could not answer", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
				setTurns((t) => t.filter((x, i) => !(i === t.length - 1 && x.role === "ai" && !x.text)));
			}
		} finally {
			setBusy(false);
		}
	};

	const apply = (i: number, whole: boolean) => {
		const ed = editor.current;
		const t = turns[i];
		if (!ed || !t?.text.trim()) return;
		try {
			if (whole) {
				const all = ed.commands().find((c) => /^select all$/i.test(c.label))?.id;
				if (all) ed.execute(all);
			}
			insertText(ed, t.text.trim());
			setTurns((all) => all.map((x, k) => (k === i ? { ...x, applied: true } : x)));
			toast({ title: whole ? "Document replaced" : "Added to the document", description: "Undo with Ctrl+Z if it is not what you wanted." });
		} catch {
			toast({ title: "Could not apply that", description: "Click in the document first, then try again.", variant: "destructive" });
		}
	};

	return (
		<>
			{!open && (
				<button
					onClick={() => setOpen(true)}
					aria-label="Chat about this document"
					className="absolute bottom-14 right-3 z-30 flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 text-sm font-medium text-[#37352f] shadow-lg hover:bg-[#f7f7f5] sm:bottom-16"
				>
					<MessageSquare className="h-4 w-4" /> <span className="hidden sm:inline">Chat</span>
				</button>
			)}
			{open && (
				<aside
					aria-label="Chat about this document"
					className={cn(
						"absolute z-40 flex flex-col overflow-hidden border border-black/10 bg-white shadow-2xl",
						"inset-x-0 bottom-0 h-[72%] rounded-t-2xl sm:inset-x-auto sm:bottom-14 sm:right-3 sm:top-auto sm:h-[min(560px,70%)] sm:w-[380px] sm:rounded-2xl"
					)}
				>
					<header className="flex items-center gap-2 border-b border-black/[0.07] px-3 py-2">
						<AiStar size={18} />
						<span className="flex-1 text-sm font-semibold text-[#37352f]">Chat about this document</span>
						<Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close chat" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
					</header>
					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
						{turns.length === 0 && <p className="rounded-xl bg-[#f7f7f5] p-3 text-sm text-[#787774]">Ask for a rewrite, a summary, a new section or feedback. When an answer is what you want, tap <strong>Add to document</strong> to put it in.</p>}
						{turns.map((t, i) => (
							<div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
								<div className={cn("max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm", t.role === "user" ? "bg-sauti-teal text-white" : "bg-[#f1f1ef] text-[#37352f]")}>
									{t.text || <Loader2 className="h-4 w-4 animate-spin" />}
									{t.role === "ai" && t.text && !(busy && i === turns.length - 1) && (
										<div className="mt-2 flex flex-wrap gap-1.5">
											<Button size="sm" className="h-8 gap-1.5 bg-sauti-teal text-xs hover:bg-sauti-dark" onClick={() => apply(i, false)}><CornerDownLeft className="h-3.5 w-3.5" /> {t.applied ? "Add again" : "Add to document"}</Button>
											<Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => apply(i, true)}>Replace document</Button>
										</div>
									)}
								</div>
							</div>
						))}
						<div ref={end} />
					</div>
					<form className="flex items-end gap-2 border-t border-black/[0.07] p-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
						<textarea
							value={text}
							onChange={(e) => setText(e.target.value)}
							onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } e.stopPropagation(); }}
							rows={1}
							placeholder="Ask about this document"
							aria-label="Message"
							className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-sauti-teal"
						/>
						{busy ? (
							<Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" aria-label="Stop" onClick={() => abort.current?.abort()}><X className="h-4 w-4" /></Button>
						) : (
							<Button type="submit" size="icon" className="h-10 w-10 shrink-0 bg-sauti-teal hover:bg-sauti-dark" aria-label="Send" disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
						)}
					</form>
				</aside>
			)}
		</>
	);
}
