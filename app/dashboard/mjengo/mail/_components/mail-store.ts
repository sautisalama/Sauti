import { useSyncExternalStore } from "react";
import { peek, put } from "@/lib/client/swr";
import { cacheList, readList } from "@/lib/mail/offline-cache";
import { getMailboxes, getMessageDetail, getMessageDetails, mailBootstrap, type MessageRow, type PendingItem } from "./api";

type Boot = Awaited<ReturnType<typeof mailBootstrap>>;
type Boxes = Awaited<ReturnType<typeof getMailboxes>>;
/** What the sorted inbox shows beside the list: counts under the labels, pending payments, mailboxes that failed. */
export interface Extra { counts: Record<"subscription" | "receipt" | "update", number>; pending: PendingItem[]; failed: string[] }
interface Page { items: MessageRow[]; total: number; at: number; extra?: Extra }
export const ALL = "all";

/** The accounts, labels, views and snippets: one request shared by the warm-up and the screen, and kept on this device. */
export function bootMail(): Promise<Boot> {
	return (mailStore.boot ??= mailBootstrap().then((b) => { put("mail:boot", b); return b; }).catch((e) => { mailStore.boot = null; throw e; }));
}
export const heldBoot = () => peek<Boot>("mail:boot")?.value;
export type Detail = Awaited<ReturnType<typeof getMessageDetail>>;

/**
 * What the mail screen has already fetched this session. It lives outside React so leaving Mail and coming
 * back (or hovering the link before the first visit) never starts from nothing: the screen paints from here
 * and then asks the server only for what is new.
 */
export const mailStore = {
	boot: null as Promise<Boot> | null,
	boxes: new Map<string, Boxes & { at: number }>(),
	lists: new Map<string, Page>(),
	/** Message bodies already fetched, so opening one (or flipping through the list) shows at once. */
	details: new Map<string, Detail>(),
	/** The earlier messages of a conversation, by account, folder and subject. */
	convos: new Map<string, MessageRow[]>(),
	/** AI summaries already written, so coming back to a message shows its summary at once. */
	summaries: new Map<string, string>(),
};

export const detailKey = (accountId: string, mailbox: string, uid: number) => `${accountId}:${mailbox}:${uid}`;

const inflight = new Set<string>();

/**
 * Fetch the bodies of messages that are not cached yet, a few at a time and without marking them read.
 * Skips what is already here or on its way.
 */
export async function prefetchDetails(accountId: string, rows: Pick<MessageRow, "mailbox" | "uid">[], limit = 12): Promise<void> {
	const byBox = new Map<string, number[]>();
	for (const r of rows) {
		const k = detailKey(accountId, r.mailbox, r.uid);
		if (mailStore.details.has(k) || inflight.has(k)) continue;
		if ((byBox.get(r.mailbox)?.length ?? 0) >= limit) continue;
		byBox.set(r.mailbox, [...(byBox.get(r.mailbox) ?? []), r.uid]);
	}
	for (const [mailbox, uids] of byBox) {
		const keys = uids.map((u) => detailKey(accountId, mailbox, u));
		keys.forEach((k) => inflight.add(k));
		try {
			const got = await getMessageDetails(accountId, mailbox, uids);
			for (const d of got) mailStore.details.set(detailKey(accountId, mailbox, d.uid), d);
		} catch {
			// Best effort: opening a message fetches it as before.
		} finally {
			keys.forEach((k) => inflight.delete(k));
		}
	}
	// Keep the cache from growing without limit.
	if (mailStore.details.size > 120) {
		const drop = Array.from(mailStore.details.keys()).slice(0, mailStore.details.size - 100);
		drop.forEach((k) => mailStore.details.delete(k));
	}
}

export const listKey = (accountId: string, viewKey: string, onlyUnread: boolean) => `${accountId}:${viewKey}:${onlyUnread ? 1 : 0}`;

const time = (d: string | null) => (d ? new Date(d).getTime() : 0);

/**
 * Fold a fresh first page into what is already shown: new and changed messages come in at the top,
 * older pages the person already scrolled to stay, anything newer than the oldest fresh row that the
 * server no longer lists (archived or deleted elsewhere) drops out.
 */
export function mergeFresh(prev: MessageRow[], fresh: MessageRow[]): MessageRow[] {
	if (!fresh.length) return prev.length ? [] : prev;
	const seen = new Set(fresh.map((m) => m.uid));
	const floor = time(fresh[fresh.length - 1].date);
	const older = prev.filter((p) => !seen.has(p.uid) && time(p.date) < floor);
	return [...fresh, ...older];
}

/** A list kept on this device from an earlier visit: shown at once on a cold start, then refreshed. */
export function coldList(key: string): Page | undefined {
	const saved = readList<{ items: MessageRow[]; total: number; extra?: Extra }>(key);
	return saved ? { items: saved.items, total: saved.total, extra: saved.extra, at: 0 } : undefined;
}

/** Keep a sorted inbox in memory and on this device. */
export function keepList(accountId: string, viewKey: string, onlyUnread: boolean, page: { items: MessageRow[]; total: number; extra?: Extra }) {
	mailStore.lists.set(listKey(accountId, viewKey, onlyUnread), { ...page, at: Date.now() });
	if (!onlyUnread && viewKey === "inbox") cacheList(`${accountId}:${viewKey}`, { items: page.items, total: page.total, extra: page.extra });
}

let warming: Promise<void> | null = null;

/** Fetch the accounts, every mailbox's folders and the sorted Inbox (the one the screen opens on) ahead of the first visit. */
export function prefetchMail(): Promise<void> {
	if (warming) return warming;
	warming = (async () => {
		try {
			// One plain request does the lot on the server, side by side (server actions would queue behind each other).
			const res = await fetch("/api/mail/warm", { credentials: "same-origin" });
			if (!res.ok) return;
			const w = (await res.json()) as { ok: boolean; boot: Boot; boxes: Record<string, Boxes | null>; target: string | null; toAnswer?: unknown; list: { items: MessageRow[]; total: number; counts: Extra["counts"]; pending: PendingItem[]; failed: string[] } | null };
			if (!w.ok) return;
			mailStore.boot ??= Promise.resolve(w.boot);
			put("mail:boot", w.boot);
			let unread = 0;
			for (const [id, b] of Object.entries(w.boxes)) if (b) { mailStore.boxes.set(id, { ...b, at: Date.now() }); unread += b.unread; }
			setMailUnread(unread);
			if (w.toAnswer) put("mail-to-answer", w.toAnswer);
			if (w.target && w.list) keepList(w.target, "inbox", false, { items: w.list.items, total: w.list.total, extra: { counts: w.list.counts, pending: w.list.pending, failed: w.list.failed } });
		} catch {
			// Warming is best effort; the screen loads normally if it failed.
		} finally {
			setTimeout(() => { warming = null; }, 30_000);
		}
	})();
	return warming;
}

/* ---- unread counter shared with the side navigation */
let unreadTotal = 0;
const unreadListeners = new Set<() => void>();
export function setMailUnread(n: number) {
	if (n === unreadTotal) return;
	unreadTotal = n;
	unreadListeners.forEach((l) => l());
}
export function useMailUnread(): number {
	return useSyncExternalStore((l) => { unreadListeners.add(l); return () => unreadListeners.delete(l); }, () => unreadTotal, () => 0);
}
