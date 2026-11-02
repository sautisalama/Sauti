"use client";

import { useEffect } from "react";
import { friendly, reloadOnce } from "@/lib/client/friendly-error";

/** What a person sees when a page fails. A stale page reloads itself once; anything else offers a retry. */
export function ErrorScreen({ error, reset, full }: { error: Error & { digest?: string }; reset: () => void; full?: boolean }) {
	const f = friendly(error);
	const stale = f?.kind === "stale";
	useEffect(() => { if (stale) reloadOnce(); }, [stale]);
	const title = f?.title ?? "Something went wrong";
	const message = f?.message ?? "This page could not be shown. Try again, and if it keeps happening, go back to the start.";
	return (
		<div className={`flex items-center justify-center p-6 ${full ? "min-h-screen" : "min-h-[60vh]"}`} style={full ? { background: "#ffffff", color: "#111827" } : undefined}>
			<div role="alert" className="max-w-md space-y-4 text-center">
				<h1 className="text-xl font-bold">{title}</h1>
				<p className="text-sm opacity-80">{message}</p>
				<div className="flex flex-wrap justify-center gap-2">
					<button type="button" onClick={() => (stale ? window.location.reload() : reset())} className="rounded-full px-4 py-2 text-sm font-medium" style={{ background: "#0e7490", color: "#ffffff" }}>{stale ? "Reload" : "Try again"}</button>
					<a href="/dashboard" className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium">Go to dashboard</a>
				</div>
				{error.digest && <p className="text-xs opacity-50">Reference {error.digest}</p>}
			</div>
		</div>
	);
}
