"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

/** Where "Exit this page" sends people: an ordinary, expected site. */
const EXIT_URL = "https://www.bbc.com/weather";

/** Public pages where someone may need to leave in a hurry. Dashboards opt in with `always`. */
const SENSITIVE_PUBLIC = [/^\/report-abuse/, /^\/signup/, /^\/signin/];

/** Three Shift presses inside this window trigger the exit, as on GOV.UK. */
const SHIFT_WINDOW_MS = 1500;

/**
 * Leaves the site at once: blanks the screen, opens a neutral site, and replaces this
 * page in history. It cannot erase browser history, so the report page says that too.
 */
export function ExitPageButton({ always = false }: { always?: boolean }) {
	const pathname = usePathname() ?? "";
	const [leaving, setLeaving] = useState(false);
	const presses = useRef<number[]>([]);
	const visible = always || SENSITIVE_PUBLIC.some((re) => re.test(pathname));

	const exit = useCallback(() => {
		setLeaving(true);
		try {
			sessionStorage.clear();
		} catch {}
		try {
			window.open(EXIT_URL, "_blank", "noopener,noreferrer");
		} catch {}
		window.location.replace(EXIT_URL);
	}, []);

	useEffect(() => {
		if (!visible) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Shift" || e.repeat) {
				presses.current = [];
				return;
			}
			const now = Date.now();
			presses.current = [...presses.current.filter((t) => now - t < SHIFT_WINDOW_MS), now];
			if (presses.current.length >= 3) {
				presses.current = [];
				exit();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [visible, exit]);

	if (!visible) return null;

	return (
		<>
			<button
				type="button"
				onClick={exit}
				title="Leave this site now. You can also press Shift three times."
				className={cn(
					// Amber sits outside the brand teal and blue so it is always easy to find.
					"fixed right-3 bottom-24 lg:right-6 lg:bottom-6 z-[90] print:hidden",
					"inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 h-11 text-sm font-semibold text-neutral-900",
					"shadow-lg ring-1 ring-black/10 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
				)}
			>
				<LogOut className="h-4 w-4" aria-hidden />
				Exit this page
			</button>
			{leaving && <div className="fixed inset-0 z-[2147483647] bg-white" aria-hidden />}
		</>
	);
}
