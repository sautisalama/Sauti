"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISS_KEY = "ss_push_prompt_dismissed";

function keyToBytes(base64: string) {
	const pad = "=".repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribe(): Promise<boolean> {
	if (!VAPID || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
	const reg = await navigator.serviceWorker.ready;
	const sub =
		(await reg.pushManager.getSubscription()) ??
		(await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID) }));
	const res = await fetch("/api/push/subscribe", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(sub.toJSON()),
	});
	return res.ok;
}

/**
 * Keeps two things in step for the signed-in user, on every dashboard page:
 *  - the installed app's icon badge = number of unread notifications
 *  - this device's web-push subscription (so notifications reach the phone's drawer)
 * and offers a one-tap "turn on notifications" prompt, because browsers require a user gesture.
 */
export function PushAndBadge() {
	const [showPrompt, setShowPrompt] = useState(false);

	// Unread count -> app-icon badge.
	useEffect(() => {
		const supabase = createClient();
		let userId: string | null = null;
		let active = true;

		const sync = async () => {
			if (!userId) return;
			const { count } = await supabase
				.from("notifications")
				.select("id", { count: "exact", head: true })
				.eq("user_id", userId)
				.eq("read", false);
			if (!active) return;
			const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
			try {
				if (count && count > 0) await nav.setAppBadge?.(count);
				else await nav.clearAppBadge?.();
			} catch {}
		};

		let channel: ReturnType<typeof supabase.channel> | null = null;
		supabase.auth.getUser().then(({ data }) => {
			if (!data.user || !active) return;
			userId = data.user.id;
			sync();
			channel = supabase
				.channel(`app-badge-${Math.random().toString(36).slice(2)}`)
				.on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, sync)
				.subscribe();
		});
		const onVisible = () => document.visibilityState === "visible" && sync();
		document.addEventListener("visibilitychange", onVisible);

		return () => {
			active = false;
			document.removeEventListener("visibilitychange", onVisible);
			if (channel) supabase.removeChannel(channel);
		};
	}, []);

	// Push subscription: refresh silently if already allowed, otherwise offer to enable.
	useEffect(() => {
		if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !VAPID) return;
		if (Notification.permission === "granted") {
			subscribe().catch(() => {});
		} else if (Notification.permission === "default") {
			try {
				if (localStorage.getItem(DISMISS_KEY)) return;
			} catch {}
			setShowPrompt(true);
		}
	}, []);

	const enable = useCallback(async () => {
		setShowPrompt(false);
		const result = await Notification.requestPermission();
		if (result === "granted") await subscribe().catch(() => {});
	}, []);

	const dismiss = () => {
		setShowPrompt(false);
		try {
			localStorage.setItem(DISMISS_KEY, "1");
		} catch {}
	};

	if (!showPrompt) return null;
	return (
		<div
			role="dialog"
			aria-label="Turn on notifications"
			className="fixed inset-x-3 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-serene-neutral-200 bg-white p-3 shadow-xl lg:bottom-6 lg:left-auto lg:right-6"
		>
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sauti-teal/10 text-sauti-teal">
				<BellRing className="h-5 w-5" />
			</div>
			<p className="min-w-0 flex-1 text-sm font-medium text-serene-neutral-800">
				Get case updates and verification results on this device.
			</p>
			<Button size="sm" onClick={enable} className="shrink-0 rounded-full">
				Turn on
			</Button>
			<button onClick={dismiss} aria-label="Not now" className="shrink-0 p-1 text-serene-neutral-400 hover:text-serene-neutral-700">
				<X className="h-4 w-4" />
			</button>
		</div>
	);
}
