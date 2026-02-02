"use client";

import { useState } from "react";
import { useAccessibility } from "@/components/a11y/AccessibilityProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye, Type, Contrast } from "lucide-react";

// Assuming AccessibilityState is defined in AccessibilityProvider or globally
// For the purpose of this edit, we'll assume it's available.
// Example: type AccessibilityState = { highContrast: boolean; reduceMotion: boolean; dyslexic: boolean; textScale: number; set: (patch: Partial<AccessibilityState>) => void; };
function ToggleRow({ label, property }: { label: string; property: keyof Omit<ReturnType<typeof useAccessibility>, "set"> }) {
	const a11y = useAccessibility();
	const isOn = !!a11y[property];
	const toggle = () => {
		a11y.set({ [property]: !isOn });
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

	const scale = String(a11y.textScale);
	const setScale = (val: string) => {
		const n = Number(val) || 100;
		a11y.set({ textScale: n });
	};

	return (
		<div className="fixed bottom-10 left-4 z-[60] md:bottom-40">
			{open && (
				<div className="mb-2 w-72 rounded-xl border bg-white shadow-lg p-3 space-y-2">
					<div className="flex items-center gap-2 text-sm font-medium mb-1">
						<Contrast className="h-4 w-4" /> Accessibility
					</div>
					<ToggleRow label="High contrast" property="highContrast" />
					<ToggleRow label="Reduce motion" property="reduceMotion" />
					<ToggleRow label="Dyslexic-friendly font" property="dyslexic" />
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
