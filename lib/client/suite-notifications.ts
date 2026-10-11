"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/utils/supabase/client";

export interface SuiteNote { id: string; type: string; title: string; message: string | null; link: string | null; read: boolean; created_at: string }

/**
 * The suite's own notifications, loaded as soon as the suite opens and kept live, so the counters are right
 * without anyone opening the list. Only notifications that link into the suite are kept.
 */
let notes: SuiteNote[] | null = null;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const mine = (n: { link: string | null }) => !!n.link && n.link.startsWith("/dashboard/mjengo");

export async function startSuiteNotifications(): Promise<void> {
	if (started) return;
	started = true;
	try {
		const supabase = createClient();
		const { data: auth } = await supabase.auth.getUser();
		const uid = auth.user?.id;
		if (!uid) { started = false; return; }
		const { data } = await supabase.from("notifications").select("id, type, title, message, link, read, created_at").like("link", "/dashboard/mjengo%").order("created_at", { ascending: false }).limit(100);
		notes = (data ?? []) as SuiteNote[];
		emit();
		supabase
			.channel(`suite-notes:${uid}`)
			.on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, (p) => {
				const n = p.new as SuiteNote;
				if (!mine(n)) return;
				notes = [n, ...(notes ?? []).filter((x) => x.id !== n.id)].slice(0, 100);
				emit();
			})
			.on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, (p) => {
				const n = p.new as SuiteNote;
				notes = (notes ?? []).map((x) => (x.id === n.id ? { ...x, read: n.read } : x));
				emit();
			})
			.subscribe();
		// Realtime can miss events on a flaky connection: refresh quietly now and then.
		setInterval(async () => {
			const { data: fresh } = await supabase.from("notifications").select("id, type, title, message, link, read, created_at").like("link", "/dashboard/mjengo%").order("created_at", { ascending: false }).limit(100);
			if (fresh) { notes = fresh as SuiteNote[]; emit(); }
		}, 120_000);
	} catch {
		started = false;
	}
}

export async function markSuiteRead(ids: string[]) {
	if (!ids.length) return;
	notes = (notes ?? []).map((n) => (ids.includes(n.id) ? { ...n, read: true } : n));
	emit();
	await createClient().from("notifications").update({ read: true }).in("id", ids);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useSuiteNotifications(): { notes: SuiteNote[] | null; unread: number } {
	const list = useSyncExternalStore(subscribe, () => notes, () => null);
	return { notes: list, unread: list ? list.filter((n) => !n.read).length : 0 };
}
