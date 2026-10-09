"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { parseOtherEntries } from "@/lib/other-option";
import { cn } from "@/lib/utils";

/**
 * The text box shown when someone picks "Other". Type one or several (comma separated), press Enter or
 * Add; each is converted to the same format as the listed options.
 */
export function OtherEntry({ label, placeholder, onAdd, className, autoFocus = true }: { label: string; placeholder?: string; onAdd: (values: string[]) => void; className?: string; autoFocus?: boolean }) {
	const [text, setText] = React.useState("");
	const id = React.useId();

	const commit = () => {
		const values = parseOtherEntries(text);
		if (values.length) onAdd(values);
		setText("");
	};

	return (
		<div className={cn("space-y-1.5", className)}>
			<label htmlFor={id} className="text-xs font-semibold text-gray-600">{label}</label>
			<div className="flex gap-2">
				<input
					id={id}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === ",") {
							e.preventDefault();
							commit();
						}
					}}
					onBlur={commit}
					autoFocus={autoFocus}
					autoComplete="off"
					enterKeyHint="done"
					placeholder={placeholder ?? "Type it here, separate several with commas"}
					className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-base outline-none focus:border-sauti-teal focus:ring-2 focus:ring-sauti-teal/30"
				/>
				<button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commit} disabled={!text.trim()} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-sauti-teal px-4 text-sm font-bold text-white disabled:opacity-40">
					<Plus className="h-4 w-4" /> Add
				</button>
			</div>
		</div>
	);
}
