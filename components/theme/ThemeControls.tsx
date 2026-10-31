"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeChoice } from "./theme";

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
	{ value: "system", label: "Auto", icon: Monitor },
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
];

/** Auto / Light / Dark as one segmented control, for panels. */
export function ThemeSegmented({ className }: { className?: string }) {
	const [choice, set] = useTheme();
	return (
		<div role="radiogroup" aria-label="Appearance" className={cn("grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1", className)}>
			{OPTIONS.map(({ value, label, icon: Icon }) => (
				<button
					key={value}
					type="button"
					role="radio"
					aria-checked={choice === value}
					onClick={() => set(value)}
					className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors", choice === value ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
				>
					<Icon className="h-4 w-4" aria-hidden />
					{label}
				</button>
			))}
		</div>
	);
}

/** One row for account menus: tap to step Auto, Light, Dark. The menu stays open so the change is visible. */
export function ThemeMenuItem() {
	const [choice, set] = useTheme();
	const next: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
	const current = OPTIONS.find((o) => o.value === choice)!;
	const Icon = current.icon;
	return (
		<DropdownMenuItem
			onSelect={(e) => {
				e.preventDefault();
				set(next[choice]);
			}}
			className="flex cursor-pointer items-center gap-3 rounded-xl p-3"
		>
			<Icon className="h-4 w-4 text-serene-neutral-600" aria-hidden />
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium leading-none">Appearance</p>
				<p className="mt-1 text-xs leading-tight text-serene-neutral-600">{current.label}{choice === "system" ? ": follows your device" : ""}</p>
			</div>
		</DropdownMenuItem>
	);
}
