"use client";

import { useEffect } from "react";

/** Registers /sw.js: required for Chrome to treat the site as installable and for web push. */
export function ServiceWorkerRegister() {
	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		// Skip on localhost dev so a stale worker never masks code changes (use a prod build to test).
		if (process.env.NODE_ENV !== "production") return;
		navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => console.error("SW registration failed", err));
	}, []);
	return null;
}
