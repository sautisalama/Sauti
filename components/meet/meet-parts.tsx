"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- reactions */

export const QUICK_REACTIONS = ["👍", "👏", "❤️", "😂", "😮", "🎉"];

const GROUPS: { label: string; emojis: string[] }[] = [
	{ label: "Feelings", emojis: ["😀", "😂", "🥹", "😍", "🤩", "😎", "🤔", "😮", "😢", "😭", "😡", "🥳", "😴", "🤯", "🙃", "😇"] },
	{ label: "Hands", emojis: ["👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "✌️", "🤞", "👌", "🫶", "👋", "☝️", "🤟", "✋", "👀"] },
	{ label: "Hearts", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "🔥", "✨", "⭐", "🌍", "🕊️", "🌱", "☀️"] },
	{ label: "Celebrate", emojis: ["🎉", "🎊", "🏆", "🥇", "🎯", "🚀", "💡", "✅", "❌", "❓", "❗", "⏰", "☕", "🍰", "🎶", "📣"] },
];

/** Every reaction in one place: a quick row plus all groups, so people find the right one fast. */
export function ReactionPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
	const [tab, setTab] = useState(0);
	return (
		<div role="dialog" aria-label="Reactions" className="absolute bottom-16 left-1/2 z-30 w-[19rem] -translate-x-1/2 rounded-2xl bg-white p-3 text-[#202124] shadow-2xl">
			<div className="mb-2 flex items-center gap-1">
				{QUICK_REACTIONS.map((e) => (
					<button key={e} onClick={() => onPick(e)} aria-label={`React ${e}`} className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition hover:scale-125 hover:bg-[#f1f3f4] active:scale-95">{e}</button>
				))}
				<button onClick={onClose} aria-label="Close reactions" className="ml-auto flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5"><X className="h-4 w-4" /></button>
			</div>
			<div className="mb-2 flex gap-1 border-b border-[#e8eaed] pb-2 text-xs">
				{GROUPS.map((g, i) => (
					<button key={g.label} onClick={() => setTab(i)} className={cn("rounded-full px-2.5 py-1 font-medium", tab === i ? "bg-[#e0f2f5] text-[#068297]" : "text-[#5f6368] hover:bg-[#f1f3f4]")}>{g.label}</button>
				))}
			</div>
			<div className="grid grid-cols-8 gap-0.5">
				{GROUPS[tab].emojis.map((e) => (
					<button key={e} onClick={() => onPick(e)} aria-label={`React ${e}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:scale-125 hover:bg-[#f1f3f4] active:scale-95">{e}</button>
				))}
			</div>
			<p className="mt-2 text-[11px] text-[#5f6368]">Tap again and again for a burst. Three people sending the same one sets off a celebration.</p>
		</div>
	);
}

export interface FloatingReaction { id: string; emoji: string; name: string; x: number; size: number; delay: number }

/** Emoji float up from the bottom of the call, each with the sender's name, then fade. */
export function ReactionLayer({ items }: { items: FloatingReaction[] }) {
	return (
		<div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
			<style>{`@keyframes meet-float{0%{transform:translateY(0) scale(.4);opacity:0}12%{opacity:1;transform:translateY(-8vh) scale(1)}80%{opacity:1}100%{transform:translateY(-70vh) scale(1.15);opacity:0}}@media (prefers-reduced-motion:reduce){.meet-float{animation:none!important;opacity:0}}`}</style>
			{items.map((r) => (
				<div key={r.id} className="meet-float absolute bottom-24 flex flex-col items-center" style={{ left: `${r.x}%`, animation: `meet-float 3.2s ease-out ${r.delay}ms both` }}>
					<span style={{ fontSize: r.size }} className="drop-shadow-lg">{r.emoji}</span>
					<span className="mt-0.5 max-w-[8rem] truncate rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">{r.name}</span>
				</div>
			))}
		</div>
	);
}

/* ---------------------------------------------------------------- chat */

export interface ChatMsg { id: string; name: string; text: string; at: string; mine?: boolean }

/** Messages for everyone in the call. Links are clickable; they are kept with the meeting afterwards. */
export function ChatPanel({ lines, onSend }: { lines: ChatMsg[]; onSend: (text: string) => void }) {
	const [draft, setDraft] = useState("");
	const end = useRef<HTMLDivElement>(null);
	useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [lines.length]);
	const submit = () => { const t = draft.trim(); if (!t) return; onSend(t); setDraft(""); };
	const linkify = (t: string) => t.split(/(https?:\/\/[^\s]+)/g).map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-[#068297] underline">{p}</a> : <span key={i}>{p}</span>));
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
				{lines.length === 0 && <p className="text-[#5f6368]">Messages are visible to everyone in the call and kept with the meeting.</p>}
				{lines.map((l) => (
					<div key={l.id} className={cn("flex flex-col", l.mine && "items-end")}>
						<span className="text-[11px] text-[#5f6368]">{l.mine ? "You" : l.name} · {new Date(l.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
						<span className={cn("mt-0.5 max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2", l.mine ? "bg-[#e0f2f5]" : "bg-[#f1f3f4]")}>{linkify(l.text)}</span>
					</div>
				))}
				<div ref={end} />
			</div>
			<form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-2 border-t border-[#dadce0] p-3">
				<textarea
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
					rows={1}
					maxLength={1000}
					placeholder="Send a message to everyone"
					aria-label="Message"
					className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-[#dadce0] bg-white px-3 py-2 text-sm outline-none focus:border-[#068297]"
				/>
				<button type="submit" disabled={!draft.trim()} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#068297] text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
			</form>
		</div>
	);
}
