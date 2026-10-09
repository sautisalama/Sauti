"use client";

import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enablePush } from "./PushAndBadge";

type State = "loading" | "unsupported" | "not-configured" | "blocked" | "off" | "on";

/** Shows whether this device receives push notifications and lets the user fix it. */
export function PushSettings() {
	const [state, setState] = useState<State>("loading");
	const [note, setNote] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const refresh = async () => {
		if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
			return setState("unsupported");
		}
		if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return setState("not-configured");
		if (Notification.permission === "denied") return setState("blocked");
		const reg = await navigator.serviceWorker.getRegistration();
		const sub = await reg?.pushManager.getSubscription();
		setState(Notification.permission === "granted" && sub ? "on" : "off");
	};
	useEffect(() => {
		refresh().catch(() => setState("unsupported"));
	}, []);

	const turnOn = async () => {
		setBusy(true);
		setNote(null);
		try {
			const ok = await enablePush();
			setNote(ok ? null : "Could not register this device. Reload the page and try again.");
		} finally {
			setBusy(false);
			refresh();
		}
	};

	const test = async () => {
		setBusy(true);
		setNote(null);
		try {
			const res = await fetch("/api/push/test", { method: "POST" });
			const j = await res.json();
			if (!j.configured) setNote("The server has no push keys configured (VAPID_PRIVATE_KEY).");
			else if (!j.devices) setNote("The server has no device registered for you yet. Tap Turn on first.");
			else if (!j.sent) setNote("A device is registered but delivery failed. Turn notifications off and on again.");
			else setNote("Test sent. It should appear in your notification drawer.");
		} finally {
			setBusy(false);
		}
	};

	const text: Record<State, string> = {
		loading: "Checking…",
		unsupported: "This browser can't receive push notifications. On iPhone, add Sauti Salama to your Home Screen first.",
		"not-configured": "Push isn't set up for this site yet (missing public key in this build).",
		blocked: "Notifications are blocked for this site. Allow them in your browser or phone's site settings, then come back.",
		off: "Get messages, case updates and verification results in your notification drawer, with a counter on the app icon.",
		on: "This device receives notifications.",
	};

	return (
		<div className="rounded-2xl border border-serene-neutral-200 bg-white p-4 md:p-5">
			<div className="flex items-start gap-3">
				<div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${state === "on" ? "bg-green-50 text-green-600" : state === "blocked" || state === "not-configured" ? "bg-amber-50 text-amber-600" : "bg-sauti-teal/10 text-sauti-teal"}`}>
					{state === "on" ? <CheckCircle2 className="h-5 w-5" /> : state === "blocked" || state === "not-configured" ? <AlertTriangle className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
				</div>
				<div className="min-w-0 flex-1">
					<h3 className="font-bold text-serene-neutral-900">Push notifications</h3>
					<p className="mt-1 text-sm text-serene-neutral-600">{text[state]}</p>
					{note && <p role="status" className="mt-2 text-sm font-medium text-serene-neutral-800">{note}</p>}
					<div className="mt-3 flex flex-wrap gap-2">
						{state === "off" && <Button size="sm" onClick={turnOn} disabled={busy}>Turn on</Button>}
						{state === "on" && <Button size="sm" variant="outline" onClick={test} disabled={busy}>Send a test</Button>}
					</div>
				</div>
			</div>
		</div>
	);
}
