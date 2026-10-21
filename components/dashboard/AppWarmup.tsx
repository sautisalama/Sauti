"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { clearSwr, prime, put, setSwrOwner } from "@/lib/client/swr";
import { createClient } from "@/utils/supabase/client";

/** Tells the cache who is signed in before anything below reads it (runs in render so it is set before any screen's effect). */
export function SwrOwner({ id }: { id: string }) {
	setSwrOwner(id);
	return null;
}

type Conn = { saveData?: boolean; effectiveType?: string };
const connection = () => (navigator as unknown as { connection?: Conn }).connection;

const ROUTES = {
	survivor: ["/dashboard/reports", "/dashboard/chat", "/dashboard/resources", "/dashboard/learning", "/dashboard/profile"],
	professional: ["/dashboard/cases", "/dashboard/chat", "/dashboard/reports", "/dashboard/resources", "/dashboard/learning", "/dashboard/profile"],
	admin: ["/dashboard/admin", "/dashboard/admin/review", "/dashboard/admin/professionals", "/dashboard/admin/services", "/dashboard/admin/matching", "/dashboard/admin/blogs", "/dashboard/admin/publications", "/dashboard/admin/courses"],
	// In the order people reach for them.
	mjengo: ["/dashboard/mjengo", "/dashboard/mjengo/mail", "/dashboard/mjengo/vault", "/dashboard/mjengo/calendar", "/dashboard/mjengo/documents", "/dashboard/mjengo/design", "/dashboard/mjengo/opportunities", "/dashboard/mjengo/todos", "/dashboard/mjengo/contacts", "/dashboard/mjengo/grants", "/dashboard/mjengo/projects", "/dashboard/mjengo/content", "/dashboard/mjengo/finance", "/dashboard/mjengo/chat", "/dashboard/mjengo/forms", "/dashboard/mjengo/assistant", "/dashboard/mjengo/fellowships", "/dashboard/mjengo/meetings", "/dashboard/mjengo/files/deck", "/dashboard/mjengo/files/sheet", "/dashboard/mjengo/files/draw", "/meet"],
};

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Resolve when the browser has a quiet moment (and the tab is in view), so warming never competes with what the person is doing. */
function quiet(): Promise<void> {
	return new Promise((resolve) => {
		const go = () => {
			if (document.hidden) { document.addEventListener("visibilitychange", go, { once: true }); return; }
			const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
			if (w.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: 400 });
			else setTimeout(resolve, 300);
		};
		go();
	});
}

/** Run jobs a few at a time, each waiting for a quiet moment first. */
async function pool(jobs: (() => Promise<unknown>)[], width: number, dead: () => boolean) {
	let i = 0;
	await Promise.all(Array.from({ length: width }, async () => {
		while (i < jobs.length && !dead()) {
			const job = jobs[i++];
			await quiet();
			await job().catch(() => undefined);
		}
	}));
}

/**
 * Loads the app ahead of the person. Shortly after it opens, on any route and for any kind of account, it
 * fetches the pages the side navigation leads to, the data each Mjengo screen shows first (mail included), and the
 * heavy editors, a few at a time while the browser is idle. Clicking Mail, Design or Docs later then finds
 * everything already here. It backs off on data-saver and slow connections, and tops up when the tab is reopened.
 */
export function AppWarmup() {
	const router = useRouter();
	const dash = useDashboardData();
	const userId = dash?.data?.userId;
	const type = dash?.data?.userType;
	const adminMode = dash?.isAdminMode;

	// Sign-out clears what was kept for this person on this device.
	useEffect(() => {
		const { data } = createClient().auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") clearSwr(); });
		return () => data.subscription.unsubscribe();
	}, []);

	useEffect(() => {
		if (!userId) return;
		const c = connection();
		if (c?.saveData || c?.effectiveType === "2g" || c?.effectiveType === "slow-2g") return;
		let dead = false;
		const stop = () => dead;
		let lastData = 0;

		const warmData = async () => {
			lastData = Date.now();
			const [{ R }, mail] = await Promise.all([import("@/lib/client/resources"), import("@/app/dashboard/mjengo/mail/_components/mail-store")]);
			const nav = await prime(R.nav.key, R.nav.fetch, 300_000);
			if (!nav?.isAdmin || dead) return;
			// Two plain requests, side by side: mail (slow, it talks to mail servers) and everything else. Server actions
			// would run one at a time in the browser and make a click wait behind them.
			void mail.prefetchMail();
			const gridStart = startOfWeek(startOfMonth(new Date()), { weekStartsOn: 1 });
			const gridEnd = addDays(endOfWeek(endOfMonth(new Date()), { weekStartsOn: 1 }), 1);
			const res = await fetch(`/api/suite/warm?calStart=${encodeURIComponent(gridStart.toISOString())}&calEnd=${encodeURIComponent(gridEnd.toISOString())}`, { credentials: "same-origin" });
			if (!res.ok || dead) return;
			for (const [key, value] of Object.entries((await res.json()) as Record<string, unknown>)) if (value !== undefined && value !== null) put(key, value);
		};

		const warmRoutes = async () => {
			const list = [
				...(type === "survivor" ? ROUTES.survivor : []),
				...(type === "professional" || type === "ngo" ? ROUTES.professional : []),
				...(adminMode ? ROUTES.admin : []),
			];
			const nav = await prime("nav", async () => (await import("@/app/actions/mjengo-nav")).mjengoNav(), 300_000);
			if (nav?.isAdmin) list.push(...ROUTES.admin, ...ROUTES.mjengo);
			for (const href of [...new Set(list)]) {
				if (dead) return;
				await quiet();
				// "full" fetches the page's data as well as its code, so it opens without a wait.
				router.prefetch(href, { kind: "full" as never });
				await pause(350);
			}
		};

		const warmChunks = async () => {
			const fast = !c?.effectiveType || c.effectiveType === "4g";
			if (!fast) return;
			const nav = await prime("nav", async () => (await import("@/app/actions/mjengo-nav")).mjengoNav(), 300_000);
			if (!nav?.isAdmin) return;
			// The spreadsheet and drawing engines are large; fetching them now means opening a file does not wait on them.
			await pool([
				() => Promise.all([import("@univerjs/presets"), import("@univerjs/preset-sheets-core"), import("@univerjs/preset-sheets-core/locales/en-US")]),
				() => import("@excalidraw/excalidraw"),
			], 1, stop);
		};

		const start = setTimeout(async () => {
			// Data first (mail is the heaviest and most used), then the pages, then the large editors.
			await warmData().catch(() => undefined);
			await warmRoutes().catch(() => undefined);
			await warmChunks().catch(() => undefined);
		}, 1500);

		// Coming back to the tab after a while: bring the held copies up to date again.
		const onVisible = () => {
			if (document.hidden || Date.now() - lastData < 120_000) return;
			void warmData().catch(() => undefined);
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => { dead = true; clearTimeout(start); document.removeEventListener("visibilitychange", onVisible); };
	}, [userId, type, adminMode, router]);

	return null;
}
