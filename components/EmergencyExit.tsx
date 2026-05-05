"use client";

import { useCallback, useEffect, useState } from "react";

const ESCAPE_URL = "https://www.google.com/search?q=weather+kenya";

export function EmergencyExit() {
	const [visible, setVisible] = useState(true);

	const escape = useCallback(() => {
		window.location.replace(ESCAPE_URL);
	}, []);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape" && e.shiftKey) {
				e.preventDefault();
				escape();
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [escape]);

	if (!visible) return null;

	return (
		<button
			onClick={escape}
			aria-label="Quick Escape - Press Shift+Escape. Leaves this site immediately."
			title="Quick Escape (Shift+Esc)"
			className="fixed top-3 right-3 z-[9999] flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:bg-red-700 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 print:hidden"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M18 6 6 18" />
				<path d="m6 6 12 12" />
			</svg>
			<span className="hidden sm:inline">Quick Escape</span>
			<span className="sm:hidden">Exit</span>
		</button>
	);
}
