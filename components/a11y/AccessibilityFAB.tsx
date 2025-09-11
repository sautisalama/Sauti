"use client";

import { useState } from "react";
import { useAccessibility } from "@/components/a11y/AccessibilityProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye, Type, Contrast } from "lucide-react";

function ToggleRow({ label, attr }: { label: string; attr: string }) {
	const a11y = useAccessibility();
	const isOn =
		typeof document !== "undefined" &&
		document.documentElement.getAttribute(attr) === "1";
	const toggle = () => {
		const el = document.documentElement;
		const next = isOn ? "0" : "1";
		el.setAttribute(attr, next);
		const patch: any = {};
		if (attr === "data-a11y-high-contrast") patch.highContrast = next === "1";
		if (attr === "data-a11y-reduce-motion") patch.reduceMotion = next === "1";
		if (attr === "data-a11y-lg-text") patch.largeText = next === "1";
		if (attr === "data-a11y-readable-font") patch.readableFont = next === "1";
		if (attr === "data-a11y-underline-links") patch.underlineLinks = next === "1";
		if (attr === "data-a11y-dyslexic") patch.dyslexic = next === "1";
		a11y.set(patch);
	};
	return (
		<button
			onClick={toggle}
			className={cn(
				"w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm",
				isOn ? "bg-primary-50 border-primary-200" : "border-neutral-200"
			)}
			aria-pressed={isOn}
			aria-label={label}
		>
			<span>{label}</span>
			<span
				className={cn(
					"inline-block h-5 w-9 rounded-full",
					isOn ? "bg-primary-500" : "bg-neutral-300"
				)}
			></span>
		</button>
	);
}

export default function AccessibilityFAB() {
	const a11y = useAccessibility();
	const [open, setOpen] = useState(false);

	const scale =
		typeof document !== "undefined"
			? document.documentElement.getAttribute("data-a11y-text-scale") || "100"
			: "100";
	const setScale = (val: string) => {
		const n = Number(val) || 100;
		document.documentElement.setAttribute("data-a11y-text-scale", String(n));
		a11y.set({ textScale: n });
	};

	return (
		<div className="fixed bottom-10 left-4 z-[60] md:bottom-40">
			{open && (
				<div className="mb-2 w-72 rounded-xl border bg-white shadow-lg p-3 space-y-2">
					<div className="flex items-center gap-2 text-sm font-medium mb-1">
						<Contrast className="h-4 w-4" /> Accessibility
					</div>
					<ToggleRow label="High contrast" attr="data-a11y-high-contrast" />
					<ToggleRow label="Reduce motion" attr="data-a11y-reduce-motion" />
					<ToggleRow label="Dyslexic-friendly font" attr="data-a11y-dyslexic" />
					<div className="text-sm">
						<div className="mb-1 flex items-center gap-2">
							<Type className="h-4 w-4" /> Text size
						</div>
						<select
							aria-label="Text size"
							className="w-full rounded-md border px-2 py-1 text-sm"
							value={scale}
							onChange={(e) => setScale(e.target.value)}
						>
							<option value="100">100%</option>
							<option value="112.5">112.5%</option>
							<option value="125">125%</option>
							<option value="137.5">137.5%</option>
							<option value="150">150%</option>
						</select>
					</div>
				</div>
			)}

			<Button
				onClick={() => setOpen((v) => !v)}
				variant="outline"
				className="rounded-full h-12 w-12 p-0 flex items-center justify-center bg-white/90 backdrop-blur border-neutral-300"
				aria-label="Accessibility options"
				aria-expanded={open}
			>
				<Eye className="h-5 w-5" />
			</Button>
		</div>
	);
}
