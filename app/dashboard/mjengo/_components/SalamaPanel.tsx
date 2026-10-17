"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { askSalama } from "@/app/actions/mjengo-salama";
import { unwrap } from "@/lib/action-result";
import type { Source } from "@/lib/mjengo/salama";
import { cn } from "@/lib/utils";

interface Turn { role: "user" | "assistant"; content: string; sources?: Source[] }

const IDEAS = ["What is due this week?", "What did we promise our partners lately?", "Where do our grants stand?", "What was decided in our last calls?"];

/** The answer with its [1] marks as small links to the sources they came from. */
function Cited({ text, sources }: { text: string; sources: Source[] }) {
	return (
		<>
			{text.split(/(\[\d{1,2}\])/g).map((p, i) => {
				const m = /^\[(\d{1,2})\]$/.exec(p);
				const s = m ? sources.find((x) => x.n === Number(m[1])) : null;
				if (!s) return <Fragment key={i}>{p}</Fragment>;
				return s.link
					? <Link key={i} href={s.link} title={s.title} className="mx-0.5 rounded bg-sauti-teal-light px-1 text-[11px] font-semibold text-sauti-teal no-underline hover:underline">{s.n}</Link>
					: <span key={i} className="mx-0.5 rounded bg-sauti-teal-light px-1 text-[11px] font-semibold text-sauti-teal">{s.n}</span>;
			})}
		</>
	);
}

/**
 * Ask Salama, the team's AI member, anything about the team's own work. She answers from what you can see in
 * calls, documents, to-dos, events, grants, opportunities and projects, and shows where each answer came from.
 */
export function SalamaPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [turns, setTurns] = useState<Turn[]>([]);
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);
	const end = useRef<HTMLDivElement>(null);
	const input = useRef<HTMLTextAreaElement>(null);
	useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns.length, busy]);
	useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 50); }, [open]);

	const ask = async (q: string) => {
		const question = q.trim();
		if (!question || busy) return;
		const history = turns.map(({ role, content }) => ({ role, content }));
		setTurns((cur) => [...cur, { role: "user", content: question }]);
		setDraft("");
		setBusy(true);
		try {
			const a = await unwrap(askSalama(question, history));
			setTurns((cur) => [...cur, { role: "assistant", content: a.text, sources: a.sources }]);
		} catch (e) {
			setTurns((cur) => [...cur, { role: "assistant", content: e instanceof Error ? e.message : "I could not answer just now. Please try again." }]);
		} finally {
			setBusy(false);
		}
	};

	if (!open) return null;
	return (
		<div role="dialog" aria-label="Ask Salama" className="fixed bottom-4 right-4 z-[70] flex h-[min(620px,calc(100dvh-2rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
			<div className="flex shrink-0 items-center gap-2 border-b border-black/10 px-4 py-3">
				<span className="flex h-8 w-8 items-center justify-center rounded-full bg-sauti-teal text-white"><Sparkles className="h-4 w-4" /></span>
				<div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#37352f]">Salama</p><p className="text-xs text-[#787774]">Your team&apos;s AI member. Answers from your own work.</p></div>
				<button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-[#787774] hover:bg-black/5"><X className="h-4 w-4" /></button>
			</div>
			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
				{turns.length === 0 && (
					<div className="space-y-3">
						<p className="text-[#5f5e5b]">Ask me about calls, documents, to-dos, grants, projects or the calendar. I only use what you have access to, and I show where an answer came from.</p>
						<div className="flex flex-wrap gap-2">{IDEAS.map((i) => <button key={i} onClick={() => void ask(i)} className="rounded-full border border-black/10 px-3 py-1.5 text-left text-xs text-[#37352f] hover:bg-[#f7f7f5]">{i}</button>)}</div>
					</div>
				)}
				{turns.map((t, i) => (
					<div key={i} className={cn("flex flex-col", t.role === "user" && "items-end")}>
						<div className={cn("max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2", t.role === "user" ? "bg-sauti-teal text-white" : "bg-[#f1f3f4] text-[#37352f]")}>
							{t.role === "assistant" ? <Cited text={t.content} sources={t.sources ?? []} /> : t.content}
						</div>
						{!!t.sources?.length && (
							<ul className="mt-1.5 max-w-[92%] space-y-0.5 text-xs text-[#787774]">
								{t.sources.map((s) => <li key={s.n} className="truncate">{s.n}. {s.link ? <Link href={s.link} className="text-sauti-teal hover:underline">{s.title}</Link> : s.title} <span className="opacity-70">({s.kind})</span></li>)}
							</ul>
						)}
					</div>
				))}
				{busy && <p className="flex items-center gap-2 text-xs text-[#787774]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salama is looking through your work…</p>}
				<div ref={end} />
			</div>
			<form onSubmit={(e) => { e.preventDefault(); void ask(draft); }} className="flex shrink-0 items-end gap-2 border-t border-black/10 p-3">
				<textarea ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(draft); } }} rows={1} maxLength={1000} placeholder="Ask Salama" aria-label="Ask Salama" className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-sauti-teal" />
				<button type="submit" disabled={!draft.trim() || busy} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sauti-teal text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
			</form>
		</div>
	);
}
