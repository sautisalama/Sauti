"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday, isThisYear } from "date-fns";
import { ChevronDown, Forward, Loader2, Reply, ReplyAll, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { messageDoc, softFor } from "@/lib/mail/thread";
import { fitFrame } from "@/lib/mail/frame";
import { getMessageDetail, type MessageRow } from "./api";
import { detailKey, mailStore, type Detail } from "./mail-store";

const name = (a: { name: string; address: string }) => a.name || a.address || "Unknown";
const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "?";
const stamp = (d: string | null) => (!d ? "" : isToday(new Date(d)) ? format(new Date(d), "HH:mm") : isThisYear(new Date(d)) ? format(new Date(d), "d MMM, HH:mm") : format(new Date(d), "d MMM yyyy"));
const plainOf = (d: Detail | null) => (d ? (d.text || d.html?.replace(/<[^>]+>/g, " ") || "").replace(/\s+/g, " ").trim() : "");

/** The body of one message in a sandboxed frame, with its quoted history folded under "See more". */
function Body({ html, text }: { html: string | null; text: string }) {
	const frame = useRef<HTMLIFrameElement>(null);
	const [h, setH] = useState(120);
	const { doc } = useMemo(() => messageDoc({ html, text }), [html, text]);
	const stop = useRef<(() => void) | null>(null);
	useEffect(() => () => { stop.current?.(); }, []);
	// A frame that finished loading before React attached onLoad still gets sized.
	useEffect(() => {
		const f = frame.current;
		if (f && f.contentDocument?.readyState === "complete" && f.contentDocument.body?.childNodes.length) { stop.current?.(); stop.current = fitFrame(f, setH, { min: 40 }); }
	}, [doc]);
	return (
		<iframe
			ref={frame}
			title="Message"
			sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
			srcDoc={doc}
			onLoad={() => {
				// Sized to the content only, kept right as images load and "See more" opens or closes.
				stop.current?.();
				if (frame.current) stop.current = fitFrame(frame.current, setH, { min: 40 });
			}}
			style={{ height: h }}
			className="w-full border-0"
		/>
	);
}

/**
 * One message in a conversation, in the manner of Apple Mail: a round avatar, the sender in bold with the
 * date on the right, "To" with a Details link, and Reply, Reply All and Forward appearing when you point at
 * the header. Closed messages are a single line with the start of what was said.
 */
export function ThreadMessage({
	m, accountId, open, onOpenChange, detail, mine, isCurrent, onReply, onReplyAll, onForward, children,
}: {
	m: MessageRow; accountId: string; open: boolean; onOpenChange: (o: boolean) => void;
	/** Already loaded (the message being read). Otherwise it is fetched when the message is opened. */
	detail?: Detail | null; mine: boolean; isCurrent?: boolean;
	onReply?: () => void; onReplyAll?: () => void; onForward?: () => void;
	children?: React.ReactNode;
}) {
	const key = detailKey(accountId, m.mailbox, m.uid);
	const [d, setD] = useState<Detail | null>(detail ?? mailStore.details.get(key) ?? null);
	const [busy, setBusy] = useState(false);
	const [details, setDetails] = useState(false);
	const tint = softFor(m.from.address, mine);

	useEffect(() => { if (detail) setD(detail); }, [detail]);
	useEffect(() => {
		// The one-line summary needs the text too, so fetch quietly once the row is on screen.
		if (d || busy) return;
		const cached = mailStore.details.get(key);
		if (cached) { setD(cached); return; }
		if (!open) return;
		let on = true;
		setBusy(true);
		getMessageDetail(accountId, m.mailbox, m.uid, true)
			.then((r) => { mailStore.details.set(key, r); if (on) setD(r); })
			.catch(() => undefined)
			.finally(() => on && setBusy(false));
		return () => { on = false; };
	}, [open, d, busy, key, accountId, m.mailbox, m.uid]);

	const snippet = plainOf(d).slice(0, 140);
	const who = mine ? "You" : name(m.from);

	if (!open) {
		return (
			<li className="border-b border-black/[0.06]">
				<button onClick={() => onOpenChange(true)} aria-expanded={false} className="group flex w-full items-center gap-3 py-3 text-left">
					<span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", tint.dot, tint.ink)}>{initials(name(m.from))}</span>
					<span className="min-w-0 flex-1">
						<span className="flex items-baseline gap-2"><span className="truncate text-[14px] font-semibold text-[#37352f]">{who}</span><span className="shrink-0 text-xs text-[#9b9a97]">{stamp(m.date)}</span></span>
						<span className="block truncate text-[13px] text-[#787774]">{snippet || (busy ? "Opening..." : m.subject)}</span>
					</span>
					<ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-[#c1c0bc] group-hover:text-[#787774]" />
				</button>
			</li>
		);
	}

	return (
		<li className={cn("border-b border-black/[0.06]", isCurrent && "scroll-mt-4")} data-current={isCurrent ? "1" : undefined}>
			<div className="group/h flex items-start gap-3 pb-1 pt-4">
				<span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold", tint.dot, tint.ink)}>{initials(name(m.from))}</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-baseline gap-2">
						<button onClick={() => !isCurrent && onOpenChange(false)} className="truncate text-left text-[15px] font-semibold text-[#37352f]" title={!isCurrent ? "Close this message" : undefined}>{who}</button>
						<span className="shrink-0 text-xs text-[#9b9a97]">{m.date ? format(new Date(m.date), "d MMM yyyy, HH:mm") : ""}</span>
						<span className="ml-auto flex items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover/h:opacity-100">
							{onReply && <button onClick={onReply} aria-label="Reply" title="Reply" className="flex h-7 w-7 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Reply className="h-4 w-4" /></button>}
							{onReplyAll && <button onClick={onReplyAll} aria-label="Reply all" title="Reply all" className="flex h-7 w-7 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><ReplyAll className="h-4 w-4" /></button>}
							{onForward && <button onClick={onForward} aria-label="Forward" title="Forward" className="flex h-7 w-7 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 hover:text-[#37352f]"><Forward className="h-4 w-4" /></button>}
						</span>
					</div>
					<p className="mt-0.5 text-[13px] text-[#787774]">
						To: {d ? (d.to.length ? d.to.map((t) => name(t)).slice(0, details ? 99 : 2).join(", ") : "me") : "..."}
						{d && !details && (d.to.length > 2 || d.cc.length > 0) && <span> +{Math.max(0, d.to.length - 2) + d.cc.length}</span>}
						{d && <button onClick={() => setDetails((v) => !v)} className="ml-2 text-[#068297] hover:underline">{details ? "Hide" : "Details"}</button>}
					</p>
					{details && d && (
						<dl className="mt-1.5 space-y-0.5 text-[13px] text-[#787774]">
							<div><dt className="inline text-[#9b9a97]">From </dt><dd className="inline">{m.from.name ? `${m.from.name} ` : ""}&lt;{m.from.address}&gt;</dd></div>
							{d.to.length > 0 && <div><dt className="inline text-[#9b9a97]">To </dt><dd className="inline">{d.to.map((t) => t.address).join(", ")}</dd></div>}
							{d.cc.length > 0 && <div><dt className="inline text-[#9b9a97]">Cc </dt><dd className="inline">{d.cc.map((t) => t.address).join(", ")}</dd></div>}
							<div><dt className="inline text-[#9b9a97]">Subject </dt><dd className="inline">{d.subject}</dd></div>
						</dl>
					)}
				</div>
			</div>
			<div className="pb-4 pl-[52px]">
				{!d ? <p className="flex items-center gap-2 py-3 text-sm text-[#787774]"><Loader2 className="h-4 w-4 animate-spin" /> Opening...</p> : <Body html={d.html} text={d.text} />}
				{children}
			</div>
		</li>
	);
}

/**
 * A summary at the top of a long message or thread, written as the page opens and streamed in, the way Gemini
 * does it in Gmail: a one-line "TL;DR", a few key points and what is being asked. Short messages get a small
 * "Summarise" chip instead, so nothing is sent to the AI service unless it helps.
 */
export function AiSummary({ accountId, mailbox, uid, subject, from, text, earlier }: {
	accountId: string; mailbox: string; uid: number; subject: string; from: string; text: string; earlier: { from: string; text: string }[];
}) {
	const key = `${accountId}:${mailbox}:${uid}`;
	const long = text.length > 700 || earlier.length >= 2;
	const [out, setOut] = useState<string>(mailStore.summaries.get(key) ?? "");
	const [busy, setBusy] = useState(false);
	const [hidden, setHidden] = useState(false);
	const [asked, setAsked] = useState(false);
	const ctl = useRef<AbortController | null>(null);

	const run = async () => {
		ctl.current?.abort();
		const c = new AbortController();
		ctl.current = c;
		setBusy(true);
		setOut("");
		try {
			const res = await fetch("/api/mjengo/mail/ai", {
				method: "POST",
				signal: c.signal,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ task: "summary", subject, from, text, earlier }),
			});
			if (!res.ok || !res.body) throw new Error("unavailable");
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			let acc = "";
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				acc += dec.decode(value, { stream: true });
				setOut(acc);
			}
			mailStore.summaries.set(key, acc);
		} catch {
			if (!c.signal.aborted) setOut("");
		} finally {
			if (ctl.current === c) setBusy(false);
		}
	};

	// Long messages are summarised as soon as they open; the answer is kept for next time.
	useEffect(() => {
		setHidden(false);
		setAsked(false);
		setOut(mailStore.summaries.get(key) ?? "");
		if (!long || mailStore.summaries.has(key)) return;
		const t = setTimeout(() => { void run(); }, 350);
		return () => { clearTimeout(t); ctl.current?.abort(); };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, long]);

	if (hidden || !text.trim()) return null;
	if (!out && !busy && !long && !asked) {
		return (
			<button onClick={() => { setAsked(true); void run(); }} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-[#787774] hover:bg-black/[0.03]">
				<Sparkles className="h-3.5 w-3.5 text-[#068297]" /> Summarise
			</button>
		);
	}
	const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
	const tldr = lines.find((l) => /^tl;?dr:/i.test(l))?.replace(/^tl;?dr:\s*/i, "") ?? (busy && lines.length === 0 ? "" : lines[0]);
	const bullets = lines.filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, ""));
	const needs = lines.find((l) => /^needs:/i.test(l))?.replace(/^needs:\s*/i, "");
	return (
		<section aria-label="Summary" className="mt-4 rounded-2xl border border-[#068297]/15 bg-[#F4FAFB] p-4">
			<div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#068297]">
				<Sparkles className="h-3.5 w-3.5" /> Summary
				{busy && <Loader2 className="h-3 w-3 animate-spin" />}
				<span className="flex-1" />
				{!busy && <button onClick={() => void run()} className="rounded px-1.5 py-0.5 text-[11px] normal-case tracking-normal text-[#787774] hover:bg-black/5">Redo</button>}
				<button onClick={() => setHidden(true)} aria-label="Hide summary" className="rounded p-0.5 text-[#9b9a97] hover:bg-black/5"><X className="h-3.5 w-3.5" /></button>
			</div>
			{tldr ? <p className="text-[15px] font-medium leading-snug text-[#0b2228]">{tldr}</p> : busy ? <p className="text-sm text-[#787774]">Reading the thread...</p> : null}
			{bullets.length > 0 && <ul className="mt-2 space-y-1 text-sm text-[#37352f]">{bullets.map((b, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#068297]" />{b}</li>)}</ul>}
			{needs && <p className="mt-2 rounded-lg bg-white px-3 py-1.5 text-sm text-[#37352f]"><span className="font-semibold text-[#068297]">Needs: </span>{needs}</p>}
		</section>
	);
}
