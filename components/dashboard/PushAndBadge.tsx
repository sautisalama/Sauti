"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { getUnreadChatTotal } from "@/app/actions/chat";
import { markChatDelivered } from "@/app/actions/chat-social";
import { CHATS_CHANGED_EVENT } from "@/lib/chat/client-read";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISS_KEY = "ss_push_prompt_dismissed";

function keyToBytes(base64: string) {
	const pad = "=".repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Ask permission (needs a user gesture) and register this device for push. */
export async function enablePush(): Promise<boolean> {
	if (!("Notification" in window)) return false;
	const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
	return result === "granted" ? subscribe().catch(() => false) : false;
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
	const dash = useDashboardData();
	const setUnreadChatCount = dash?.setUnreadChatCount;
	const myId = useRef<string | null>(null);
	const pathname = usePathname(); // recount after navigation (a server refresh resets the shared count)

	// Unread chat messages -> nav badges (bottom bar, sidebar). Recounted when a message arrives
	// (RLS limits realtime to chats I'm in), when a chat is read, and when the app is reopened.
	useEffect(() => {
		if (!setUnreadChatCount) return;
		const supabase = createClient();
		let active = true;
		supabase.auth.getUser().then(({ data }) => (myId.current = data.user?.id ?? null));
		const recount = () => getUnreadChatTotal().then((n) => active && setUnreadChatCount(n)).catch(() => {});
		recount();
		const channel = supabase
			.channel(`unread-chats-${Math.random().toString(36).slice(2)}`)
			.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
				recount();
				// This device has the message: tell the sender (double tick).
				const m = payload.new as { chat_id?: string; sender_id?: string };
				if (m.chat_id && m.sender_id !== myId.current) markChatDelivered(m.chat_id).catch(() => {});
			})
			.subscribe();
		const onVisible = () => document.visibilityState === "visible" && recount();
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener(CHATS_CHANGED_EVENT, recount);
		return () => {
			active = false;
			supabase.removeChannel(channel);
			document.removeEventListener("visibilitychange", onVisible);
			window.removeEventListener(CHATS_CHANGED_EVENT, recount);
		};
	}, [setUnreadChatCount, pathname]);

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
		await enablePush();
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
