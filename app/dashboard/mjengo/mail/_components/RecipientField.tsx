"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { suggestContacts } from "@/app/actions/mjengo-contacts";

const emailOk = (e: string) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(e);
const split = (s: string) => s.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);

/** Pull the address out of "Name <a@b.c>" if that is what was pasted. */
const addressOf = (s: string) => /<([^>]+)>/.exec(s)?.[1]?.trim() ?? s.trim();

/**
 * Recipients as pills, like Gmail: type or paste addresses, pick a contact from the suggestions,
 * Backspace removes the last pill. The value is a comma-separated string so callers stay simple.
 */
export function RecipientField({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
	const [draft, setDraft] = useState("");
	const [hits, setHits] = useState<{ name: string; email: string }[]>([]);
	const [active, setActive] = useState(0);
	const [focused, setFocused] = useState(false);
	const names = useRef(new Map<string, string>());
	const input = useRef<HTMLInputElement>(null);
	const pills = useMemo(() => split(value), [value]);

	useEffect(() => {
		const q = draft.trim();
		if (!q) { setHits([]); return; }
		const t = setTimeout(async () => {
			try {
				const r = await unwrap(suggestContacts(q));
				r.forEach((c) => names.current.set(c.email.toLowerCase(), c.name));
				setHits(r.filter((c) => !pills.some((p) => p.toLowerCase() === c.email.toLowerCase())));
				setActive(0);
			} catch {
				setHits([]);
			}
		}, 150);
		return () => clearTimeout(t);
	}, [draft, pills]);

	const add = (raw: string) => {
		const parts = split(raw).map(addressOf).filter(Boolean);
		if (!parts.length) return;
		const next = [...pills];
		for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
		onChange(next.join(", "));
		setDraft("");
		setHits([]);
	};

	return (
		<div className="relative min-w-0 flex-1">
			<div className="flex min-h-9 flex-wrap items-center gap-1 py-1" onClick={() => input.current?.focus()}>
				{pills.map((p) => {
					const ok = emailOk(p);
					const label = names.current.get(p.toLowerCase());
					return (
						<span key={p} title={p} className={cn("flex max-w-[260px] items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-sm", ok ? "border-serene-neutral-200 bg-serene-neutral-50 text-serene-neutral-900" : "border-red-200 bg-red-50 text-red-700")}>
							<span className="truncate">{label ?? p}</span>
							<button type="button" aria-label={`Remove ${p}`} onClick={(e) => { e.stopPropagation(); onChange(pills.filter((x) => x !== p).join(", ")); }} className="rounded-full p-0.5 text-serene-neutral-400 hover:bg-black/5 hover:text-serene-neutral-700">
								<X className="h-3 w-3" />
							</button>
						</span>
					);
				})}
				<input
					ref={input}
					value={draft}
					autoFocus={autoFocus}
					inputMode="email"
					autoComplete="off"
					aria-label={placeholder ?? "Recipients"}
					placeholder={pills.length ? "" : placeholder}
					onChange={(e) => {
						const v = e.target.value;
						// A comma, semicolon or space finishes an address; pasted lists are split.
						if (/[,;\s]$/.test(v) && v.trim()) add(v);
						else setDraft(v);
					}}
					onFocus={() => setFocused(true)}
					onBlur={() => { setFocused(false); if (draft.trim()) add(draft); }}
					onPaste={(e) => {
						const t = e.clipboardData.getData("text");
						if (/[,;\n\s]/.test(t.trim())) { e.preventDefault(); add(t.replace(/\n/g, ",")); }
					}}
					onKeyDown={(e) => {
						if (e.key === "Backspace" && !draft && pills.length) { onChange(pills.slice(0, -1).join(", ")); return; }
						if (e.key === "ArrowDown" && hits.length) { e.preventDefault(); setActive((a) => (a + 1) % hits.length); return; }
						if (e.key === "ArrowUp" && hits.length) { e.preventDefault(); setActive((a) => (a - 1 + hits.length) % hits.length); return; }
						if (e.key === "Enter" || e.key === "Tab") {
							if (hits.length && draft.trim()) { e.preventDefault(); const h = hits[active]; names.current.set(h.email.toLowerCase(), h.name); add(h.email); return; }
							if (draft.trim()) { e.preventDefault(); add(draft); }
						}
						if (e.key === "Escape") setHits([]);
					}}
					className="min-w-[8ch] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-serene-neutral-400"
				/>
			</div>
			{focused && hits.length > 0 && (
				<ul role="listbox" className="absolute left-0 top-full z-[70] mt-1 w-full max-w-sm overflow-hidden rounded-xl border border-serene-neutral-200 bg-white p-1 shadow-xl">
					{hits.map((h, i) => (
						<li key={h.email} role="option" aria-selected={i === active}>
							<button
								type="button"
								onMouseDown={(e) => { e.preventDefault(); names.current.set(h.email.toLowerCase(), h.name); add(h.email); }}
								onMouseEnter={() => setActive(i)}
								className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", i === active && "bg-sauti-teal-light/60")}
							>
								<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sauti-teal-light text-xs font-bold text-sauti-teal">{(h.name || h.email).charAt(0).toUpperCase()}</span>
								<span className="min-w-0"><span className="block truncate text-sm font-medium text-serene-neutral-900">{h.name}</span><span className="block truncate text-xs text-serene-neutral-500">{h.email}</span></span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
