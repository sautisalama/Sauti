"use client";

/**
 * What each Mjengo screen loads first, named once. The screens read these through `swr` (so a held copy paints at
 * once) and the start-up warmer primes the same keys (so there is a copy to paint before the screen is ever opened).
 */
import { unwrap } from "@/lib/action-result";
import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { getOverview, listAdmins, listDocuments, listEntities, getTodoBoard, type Kind } from "@/app/actions/mjengo";
import { mjengoNav, suiteStatus } from "@/app/actions/mjengo-nav";
import { listTemplates } from "@/app/actions/mjengo-templates";
import { listAssets } from "@/app/actions/mjengo-ai";
import { financeFiles, financeInvoices, financeReceipts } from "@/app/actions/finance";
import { channelsState, listPosts } from "@/app/actions/mjengo-content";
import { listMeetings } from "@/app/actions/mjengo-meet";
import { listContacts } from "@/app/actions/mjengo-contacts";
import { calendarMonth } from "@/app/actions/mjengo-calendar";
import { filesHub } from "@/app/actions/mjengo-files";
import { getCaughtUp, getMailToAnswer } from "@/app/actions/mjengo-caughtup";
import { getDigest } from "@/app/actions/mjengo-workflow";
import { listVault, searchFiles } from "@/app/dashboard/mjengo/vault/api";
import { peek, revalidate, swr } from "./swr";

export interface Resource<T> { key: string; fetch: () => Promise<T> }
const res = <T,>(key: string, fetch: () => Promise<T>): Resource<T> => ({ key, fetch });

export const R = {
	overview: res("overview", () => getOverview()),
	suite: res("suite", () => suiteStatus()),
	nav: res("nav", () => mjengoNav()),
	entities: (kind: Kind) => res(`entities:${kind}`, () => listEntities(kind)),
	admins: res("admins", () => listAdmins()),
	templates: (kind: "design" | "invoice" | "budget") => res(`templates:${kind}`, () => unwrap(listTemplates(kind))),
	assets: res("assets", () => unwrap(listAssets())),
	documents: res("documents", () => listDocuments()),
	written: res("written", () => searchFiles("")),
	todos: res("todos", () => getTodoBoard()),
	invoices: res("fin:invoices", () => unwrap(financeInvoices())),
	receipts: res("fin:receipts", () => unwrap(financeReceipts())),
	financeFiles: res("fin:files", () => unwrap(financeFiles())),
	posts: res("content:posts", () => unwrap(listPosts())),
	channels: res("content:channels", () => unwrap(channelsState()).catch(() => null)),
	meetings: res("meetings", () => unwrap(listMeetings())),
	contacts: (q = "") => res(`contacts:${q}`, () => unwrap(listContacts(q))),
	vault: (tab: "mine" | "shared" | "folder" = "mine", folderId: string | null = null) => res(`vault:${tab}:${folderId ?? ""}`, () => listVault(tab as never, folderId)),
	hub: res("files:hub", () => unwrap(filesHub())),
	caughtUp: res("caughtup", () => unwrap(getCaughtUp())),
	digest: res("digest", () => unwrap(getDigest())),
	mailToAnswer: res("mail-to-answer", () => unwrap(getMailToAnswer())),
	/** The month grid the calendar shows (weeks start on Monday), keyed by its first day. */
	calendar: (month: Date) => {
		const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
		const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
		return res(`calendar:${gridStart.toISOString()}`, () => unwrap(calendarMonth(gridStart.toISOString(), addDays(gridEnd, 1).toISOString())));
	},
};

/** For a screen: the held copy at once, then the fresh one. */
export function fromCache<T>(r: Resource<T>, onData: (v: T) => void, opts?: { maxAge?: number; onError?: (e: unknown) => void }) {
	return swr(r.key, r.fetch, onData, opts);
}
/** Fetch now and keep the copy (after a change, or a pull to refresh). */
export const fresh = <T,>(r: Resource<T>) => revalidate(r.key, r.fetch);
/** The held copy, if any, however old. */
export const held = <T,>(r: Resource<T>) => peek<T>(r.key)?.value;
