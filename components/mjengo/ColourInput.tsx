"use client";

import { useEffect, useRef } from "react";

/**
 * A colour well that only reports a choice when it is made. The browser's own colour input fires an event for
 * every colour the pointer passes over while the picker is open; listening to that (as React's onChange does)
 * applied or saved every one of them. `onCommit` fires once, when the picker is closed or a colour is typed;
 * `onLive` is optional and gets the moving value for a preview that is not saved.
 */
export function ColourInput({ value, onCommit, onLive, className, label }: { value: string; onCommit: (hex: string) => void; onLive?: (hex: string) => void; className?: string; label?: string }) {
	const ref = useRef<HTMLInputElement>(null);
	const commit = useRef(onCommit);
	const live = useRef(onLive);
	commit.current = onCommit;
	live.current = onLive;
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const onChange = () => commit.current(el.value.toUpperCase());
		const onInput = () => live.current?.(el.value.toUpperCase());
		el.addEventListener("change", onChange);
		el.addEventListener("input", onInput);
		return () => { el.removeEventListener("change", onChange); el.removeEventListener("input", onInput); };
	}, []);
	useEffect(() => { if (ref.current && ref.current.value.toLowerCase() !== value.toLowerCase()) ref.current.value = value; }, [value]);
	return <input ref={ref} type="color" aria-label={label} defaultValue={value} className={className} />;
}
