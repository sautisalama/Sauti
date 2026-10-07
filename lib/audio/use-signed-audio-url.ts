"use client";

import { useEffect, useState } from "react";

/** Voice notes live in the private `report-audio` bucket; stored URLs are only markers. */
const isReportAudio = (src: string) => /\/storage\/v1\/object\/(?:public|sign)\/report-audio\//.test(src);

const cache = new Map<string, { url: string; expires: number }>();
const TTL_MS = 50 * 60 * 1000; // signed for 60 min; refresh a little early

/**
 * Returns a playable URL for a stored voice-note URL. Non-storage URLs (blob:
 * previews, other hosts) pass through unchanged. Returns undefined while the
 * signed URL is being fetched, or if the viewer is not allowed to hear it.
 */
export function useSignedAudioUrl(src: string | null | undefined): string | undefined {
	const [resolved, setResolved] = useState<string | undefined>(() => (src && !isReportAudio(src) ? src : undefined));

	useEffect(() => {
		if (!src) return setResolved(undefined);
		if (!isReportAudio(src)) return setResolved(src);

		const hit = cache.get(src);
		if (hit && hit.expires > Date.now()) return setResolved(hit.url);

		let cancelled = false;
		fetch(`/api/audio/sign?url=${encodeURIComponent(src)}`, { credentials: "same-origin" })
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
			.then(({ url }: { url: string }) => {
				cache.set(src, { url, expires: Date.now() + TTL_MS });
				if (!cancelled) setResolved(url);
			})
			.catch(() => {
				if (!cancelled) setResolved(undefined);
			});
		return () => {
			cancelled = true;
		};
	}, [src]);

	return resolved;
}
