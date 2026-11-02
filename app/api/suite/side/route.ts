import { NextResponse } from "next/server";
import { mjengoNav, suiteCounts } from "@/app/actions/mjengo-nav";
import { getUnreadChatTotal } from "@/app/actions/chat";
import { openRouterBalance } from "@/app/actions/mjengo-openrouter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The small things that sit around every screen: the suite menu, the counters on it, the unread chat total and the
 * AI credit strip. They are a plain request rather than server actions because actions run one at a time in the
 * browser, and a screen's own data would otherwise wait behind them on every click.
 * `?parts=nav,counts,unread,balance` asks for only some of them.
 */
export async function GET(req: Request) {
	const wanted = new Set((new URL(req.url).searchParams.get("parts") ?? "nav,counts,unread,balance").split(","));
	const out: Record<string, unknown> = {};
	const quiet = async (key: string, p: Promise<unknown>) => { try { const v = await p; if (v !== undefined) out[key] = v; } catch { /* a missing part is just left out */ } };
	await Promise.all([
		wanted.has("nav") && quiet("nav", mjengoNav()),
		wanted.has("counts") && quiet("counts", suiteCounts()),
		wanted.has("unread") && quiet("unread", getUnreadChatTotal()),
		wanted.has("balance") && quiet("balance", openRouterBalance().then((r) => (r.ok ? r.data : null))),
	]);
	return NextResponse.json(out, { headers: { "Cache-Control": "private, no-store" } });
}
