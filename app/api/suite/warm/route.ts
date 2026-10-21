import { NextResponse } from "next/server";
import { getOverview, listAdmins, listDocuments, listEntities, getTodoBoard } from "@/app/actions/mjengo";
import { mjengoNav, suiteStatus } from "@/app/actions/mjengo-nav";
import { listTemplates } from "@/app/actions/mjengo-templates";
import { listAssets } from "@/app/actions/mjengo-ai";
import { financeFiles, financeInvoices, financeReceipts } from "@/app/actions/finance";
import { channelsState, listPosts } from "@/app/actions/mjengo-content";
import { listMeetings } from "@/app/actions/mjengo-meet";
import { listContacts } from "@/app/actions/mjengo-contacts";
import { calendarMonth } from "@/app/actions/mjengo-calendar";
import { filesHub } from "@/app/actions/mjengo-files";
import { getCaughtUp } from "@/app/actions/mjengo-caughtup";
import { getDigest } from "@/app/actions/mjengo-workflow";
import { listVault, searchFiles } from "@/app/actions/vault";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
/** A guarded action's data, or nothing if it failed (this person may not use that screen). */
const ok = async <T,>(p: Promise<Result<T>>): Promise<T | undefined> => { try { const r = await p; return r.ok ? r.data : undefined; } catch { return undefined; } };
const plain = async <T,>(p: Promise<T>): Promise<T | undefined> => p.catch(() => undefined);

/**
 * What each Mjengo screen shows first, fetched side by side in one request and keyed the way the screens look it up
 * (see lib/client/resources.ts). It is a plain request rather than a server action because actions run one at a time
 * in the browser, and this should not hold up anything the person clicks.
 */
export async function GET(req: Request) {
	const nav = await plain(mjengoNav());
	if (!nav?.isAdmin) return NextResponse.json({ nav });
	const u = new URL(req.url);
	const calStart = u.searchParams.get("calStart");
	const calEnd = u.searchParams.get("calEnd");
	const entries = await Promise.all<[string, unknown]>([
		(async () => ["overview", await plain(getOverview())] as [string, unknown])(),
		(async () => ["suite", await plain(suiteStatus())] as [string, unknown])(),
		(async () => ["caughtup", await ok(getCaughtUp())] as [string, unknown])(),
		(async () => ["digest", await ok(getDigest())] as [string, unknown])(),
		(async () => ["vault:mine:", await ok(listVault("mine", null))] as [string, unknown])(),
		(async () => ["files:hub", await ok(filesHub())] as [string, unknown])(),
		(async () => [`calendar:${calStart}`, calStart && calEnd ? await ok(calendarMonth(calStart, calEnd)) : undefined] as [string, unknown])(),
		(async () => ["documents", await plain(listDocuments())] as [string, unknown])(),
		(async () => ["written", await ok(searchFiles(""))] as [string, unknown])(),
		(async () => ["todos", await plain(getTodoBoard())] as [string, unknown])(),
		(async () => ["contacts:", await ok(listContacts(""))] as [string, unknown])(),
		(async () => ["templates:design", await ok(listTemplates("design"))] as [string, unknown])(),
		(async () => ["templates:invoice", await ok(listTemplates("invoice"))] as [string, unknown])(),
		(async () => ["templates:budget", await ok(listTemplates("budget"))] as [string, unknown])(),
		(async () => ["assets", await ok(listAssets())] as [string, unknown])(),
		(async () => ["entities:opportunity", await plain(listEntities("opportunity"))] as [string, unknown])(),
		(async () => ["entities:grant", await plain(listEntities("grant"))] as [string, unknown])(),
		(async () => ["entities:project", await plain(listEntities("project"))] as [string, unknown])(),
		(async () => ["entities:fellowship", await plain(listEntities("fellowship"))] as [string, unknown])(),
		(async () => ["admins", await plain(listAdmins())] as [string, unknown])(),
		(async () => ["content:posts", await ok(listPosts())] as [string, unknown])(),
		(async () => ["content:channels", await ok(channelsState())] as [string, unknown])(),
		(async () => ["fin:invoices", await ok(financeInvoices())] as [string, unknown])(),
		(async () => ["fin:receipts", await ok(financeReceipts())] as [string, unknown])(),
		(async () => ["fin:files", await ok(financeFiles())] as [string, unknown])(),
		(async () => ["meetings", await ok(listMeetings())] as [string, unknown])(),
	]);
	return NextResponse.json({ nav, ...Object.fromEntries(entries.filter(([, v]) => v !== undefined)) });
}
