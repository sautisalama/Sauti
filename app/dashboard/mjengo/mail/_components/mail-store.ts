import { getMailboxes, listMessages, mailBootstrap, type MessageRow } from "./api";

type Boot = Awaited<ReturnType<typeof mailBootstrap>>;
type Boxes = Awaited<ReturnType<typeof getMailboxes>>;
interface Page { items: MessageRow[]; total: number; at: number }

/**
 * What the mail screen has already fetched this session. It lives outside React so leaving Mail and coming
 * back (or hovering the link before the first visit) never starts from nothing: the screen paints from here
 * and then asks the server only for what is new.
 */
export const mailStore = {
	boot: null as Promise<Boot> | null,
	boxes: new Map<string, Boxes & { at: number }>(),
	lists: new Map<string, Page>(),
};

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

/** The same request the list makes for the Inbox view, so a prefetched page is a cache hit. */
const inboxQuery = { unread: false, text: "" };

let warming: Promise<void> | null = null;

/** Fetch the accounts, the mailbox list and the first page of the Inbox ahead of the first visit. */
export function prefetchMail(): Promise<void> {
	if (warming) return warming;
	warming = (async () => {
		try {
			const boot = await (mailStore.boot ??= mailBootstrap().catch((e) => { mailStore.boot = null; throw e; }));
			const account = boot.accounts[0];
			if (!account) return;
			const boxes = await getMailboxes(account.id);
			mailStore.boxes.set(account.id, { ...boxes, at: Date.now() });
			const inbox = boxes.boxes.find((b) => b.special === "inbox")?.path ?? "INBOX";
			const page = await listMessages(account.id, inbox, inboxQuery, 0, 40);
			mailStore.lists.set(listKey(account.id, "inbox", false), { items: page.items, total: page.total, at: Date.now() });
		} catch {
			// Warming is best effort; the screen loads normally if it failed.
		} finally {
			setTimeout(() => { warming = null; }, 30_000);
		}
	})();
	return warming;
}
