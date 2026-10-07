"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
	value: string;
	label: string;
}

interface MultiSelectProps {
	selected: string[];
	onChange: (selected: string[]) => void;
	placeholder?: string;
	options: readonly Option[];
	/** Renders one hidden input per value so the control also works in plain <form> posts. */
	name?: string;
	emptyText?: string;
	className?: string;
	disabled?: boolean;
}

/**
 * Accessible multi-select combobox.
 *
 *  - Typing filters the list; ↑/↓/Enter/Esc/Backspace work from the keyboard.
 *  - Picks become removable chips; the list stays open so several can be chosen in a row.
 *  - Touch-safe: options select on click (never on touchend), so scrolling the list
 *    on a phone cannot accidentally pick something.
 *  - The search box is a filter, not a data-entry field, so browser autofill is off for it.
 */
export function MultiSelect({
	selected,
	onChange,
	placeholder = "Select options...",
	options,
	name,
	emptyText = "No matches",
	className,
	disabled,
}: MultiSelectProps) {
	const id = React.useId();
	const rootRef = React.useRef<HTMLDivElement>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const listRef = React.useRef<HTMLUListElement>(null);
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState("");
	const [active, setActive] = React.useState(0);

	const filtered = React.useMemo(() => {
		const q = query.trim().toLowerCase();
		return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : [...options];
	}, [options, query]);

	React.useEffect(() => setActive(0), [query]);

	// Close on outside press (pointerdown covers mouse, touch and pen).
	React.useEffect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("pointerdown", onDown);
		return () => document.removeEventListener("pointerdown", onDown);
	}, [open]);

	React.useEffect(() => {
		if (!open) return;
		(listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
	}, [active, open]);

	const toggle = (value: string) => {
		onChange(selected.includes(value) ? selected.filter((s) => s !== value) : [...selected, value]);
		setQuery("");
		inputRef.current?.focus();
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setOpen(true);
			setActive((i) => Math.min(i + 1, filtered.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActive((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			if (open && filtered[active]) {
				e.preventDefault();
				toggle(filtered[active].value);
			}
		} else if (e.key === "Escape") {
			setOpen(false);
		} else if (e.key === "Backspace" && !query && selected.length) {
			onChange(selected.slice(0, -1));
		}
	};

	const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
	const listId = `${id}-list`;

	return (
		<div ref={rootRef} className={cn("relative w-full", className)}>
			{name && selected.map((v) => <input key={v} type="hidden" name={name} value={v} />)}

			<div
				className={cn(
					"flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-2.5 py-1.5 text-left transition-colors",
					"focus-within:border-sauti-teal focus-within:ring-2 focus-within:ring-sauti-teal/30",
					disabled && "pointer-events-none opacity-60"
				)}
				onPointerDown={(e) => {
					// Tapping the padding or a chip's text should focus the search box.
					if ((e.target as HTMLElement).closest("button")) return;
					if (e.target !== inputRef.current) {
						e.preventDefault();
						inputRef.current?.focus();
					}
				}}
			>
				{selected.map((v) => (
					<span key={v} className="chip-in inline-flex items-center gap-1 rounded-full border border-sauti-teal/20 bg-sauti-teal/10 py-0.5 pl-3 pr-0.5 text-sm font-semibold text-sauti-teal">
						{labelOf(v)}
						<button
							type="button"
							aria-label={`Remove ${labelOf(v)}`}
							onClick={() => onChange(selected.filter((s) => s !== v))}
							className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-sauti-teal/15 active:bg-sauti-teal/25"
						>
							<X className="h-3.5 w-3.5" aria-hidden />
						</button>
					</span>
				))}
				<input
					ref={inputRef}
					role="combobox"
					aria-expanded={open}
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={open && filtered[active] ? `${id}-opt-${active}` : undefined}
					aria-label={placeholder}
					autoComplete="off"
					autoCorrect="off"
					autoCapitalize="none"
					spellCheck={false}
					enterKeyHint="done"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onKeyDown={onKeyDown}
					placeholder={selected.length === 0 ? placeholder : "Add more…"}
					className="min-w-[8ch] flex-1 bg-transparent py-1.5 text-base text-gray-900 outline-none placeholder:text-gray-500"
				/>
				<button
					type="button"
					tabIndex={-1}
					aria-label={open ? "Close options" : "Open options"}
					onClick={() => (open ? setOpen(false) : (setOpen(true), inputRef.current?.focus()))}
					className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500"
				>
					<ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} aria-hidden />
				</button>
			</div>

			{open && (
				<ul
					ref={listRef}
					id={listId}
					role="listbox"
					aria-multiselectable="true"
					className="pop-in absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[40vh] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1.5 shadow-2xl sm:max-h-64"
				>
					{filtered.length === 0 && <li className="px-3 py-3 text-sm text-gray-500">{emptyText}</li>}
					{filtered.map((o, i) => {
						const on = selected.includes(o.value);
						return (
							<li
								key={o.value}
								id={`${id}-opt-${i}`}
								role="option"
								aria-selected={on}
								// Keep focus in the search box so the keyboard/list stay open.
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => toggle(o.value)}
								onMouseEnter={() => setActive(i)}
								className={cn(
									"flex min-h-11 cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors active:bg-sauti-teal/15",
									on ? "bg-sauti-teal/10 font-bold text-sauti-teal" : "text-gray-700",
									i === active && !on && "bg-neutral-100"
								)}
							>
								<span>{o.label}</span>
								{on && <Check className="h-4 w-4" aria-hidden />}
							</li>
						);
					})}
					{selected.length > 0 && (
						<li className="sticky bottom-0 -mx-1.5 -mb-1.5 border-t border-gray-100 bg-white/95 p-1.5 backdrop-blur" role="presentation">
							<button
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									setOpen(false);
									setQuery("");
									inputRef.current?.blur();
								}}
								className="min-h-11 w-full rounded-lg bg-sauti-teal px-4 text-sm font-bold text-white"
							>
								Done — {selected.length} selected
							</button>
						</li>
					)}
				</ul>
			)}
		</div>
	);
}
