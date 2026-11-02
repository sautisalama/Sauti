"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { STALE_EVENT, isStaleVersion } from "@/lib/client/friendly-error";

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID;

/**
 * Notices when this tab was loaded from an older build than the server is running, which is what makes a
 * button call an action the server no longer has. Shows a calm banner instead of a raw error; it never reloads
 * by itself, so nothing a person is typing or uploading is lost.
 */
export function VersionGuard() {
	const [stale, setStale] = useState(false);

	const check = useCallback(async () => {
		if (!BUILD) return;
		try {
			const r = await fetch("/api/version", { cache: "no-store" });
			if (!r.ok) return;
			const j = (await r.json()) as { build?: string | null };
			if (j.build && j.build !== BUILD) setStale(true);
		} catch { /* offline: nothing to compare */ }
	}, []);

	useEffect(() => {
		const onStale = () => setStale(true);
		const onReject = (e: PromiseRejectionEvent) => { if (isStaleVersion(e.reason)) setStale(true); };
		const onError = (e: ErrorEvent) => { if (isStaleVersion(e.error ?? e.message)) setStale(true); };
		const onVisible = () => { if (document.visibilityState === "visible") void check(); };
		window.addEventListener(STALE_EVENT, onStale);
		window.addEventListener("unhandledrejection", onReject);
		window.addEventListener("error", onError);
		document.addEventListener("visibilitychange", onVisible);
		const first = setTimeout(() => void check(), 20_000);
		const every = setInterval(() => void check(), 5 * 60_000);
		return () => {
			window.removeEventListener(STALE_EVENT, onStale);
			window.removeEventListener("unhandledrejection", onReject);
			window.removeEventListener("error", onError);
			document.removeEventListener("visibilitychange", onVisible);
			clearTimeout(first);
			clearInterval(every);
		};
	}, [check]);

	if (!stale) return null;
	return (
		<div role="status" aria-live="polite" className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 pl-4 text-sm text-neutral-900 shadow-xl">
			<p className="min-w-0 flex-1"><span className="font-semibold">Sauti Salama was updated.</span> Reload to keep working.</p>
			<button type="button" onClick={() => window.location.reload()} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium" style={{ background: "#0e7490", color: "#ffffff" }}>
				<RefreshCw className="h-3.5 w-3.5" aria-hidden /> Reload
			</button>
		</div>
	);
}
