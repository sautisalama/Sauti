"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY, inThemedArea } from "./boot";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = THEME_KEY;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): ThemeChoice {
	try {
		const v = localStorage.getItem(KEY);
		return v === "light" || v === "dark" ? v : "system";
	} catch {
		return "system";
	}
}

export function apply(choice: ThemeChoice = read()) {
	const wants = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
	const dark = wants && inThemedArea(window.location.pathname);
	document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(choice: ThemeChoice) {
	try {
		if (choice === "system") localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, choice);
	} catch {}
	apply(choice);
	emit();
}

let watching = false;
function watchSystem() {
	if (watching || typeof window === "undefined") return;
	watching = true;
	// "Auto" follows the device, including when it switches at sunset.
	window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
		if (read() === "system") apply("system");
	});
	window.addEventListener("storage", (e) => {
		if (e.key === KEY) {
			apply(read());
			emit();
		}
	});
}

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
	const choice = useSyncExternalStore(
		(l) => {
			watchSystem();
			listeners.add(l);
			return () => listeners.delete(l);
		},
		read,
		() => "system" as ThemeChoice
	);
	return [choice, setTheme];
}
