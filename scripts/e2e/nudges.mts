// Dev-only check of the in-product escalation: provider nudge at half the window, survivor follow-up at the full window.
// Run: npx tsx --env-file=.env.local scripts/e2e/nudges.mts
import { createClient } from "@supabase/supabase-js";
import { nudgeProviders, reassureSurvivors } from "../../lib/cases/nudges";
import { findStaleCases } from "../../lib/cases/escalation";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("xtzpoyoymgwagrmpfwom")) throw new Error("dev project only");
const db = createClient(url, (process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
let fails = 0;
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); if (!ok) fails++; };

const before = await db.from("notifications").select("id", { count: "exact", head: true }).in("type", ["case_waiting", "case_followup"]);
const first = await nudgeProviders("http://localhost:3000");
console.log("nudges first run:", first);
const second = await nudgeProviders("http://localhost:3000");
check("a nudge is sent at most once per match", second.sent === 0, `second run sent ${second.sent}`);
const mid = await db.from("notifications").select("id", { count: "exact", head: true }).in("type", ["case_waiting", "case_followup"]);
check("each nudge is one in-app notification", (mid.count ?? 0) - (before.count ?? 0) === first.sent, `new=${(mid.count ?? 0) - (before.count ?? 0)} sent=${first.sent}`);

const stale = await findStaleCases();
console.log("stale cases:", stale.length);
const told = await reassureSurvivors(stale);
const again = await reassureSurvivors(stale);
check("a survivor is told once, however many times it runs", again.sent === 0, `first ${told.sent}, again ${again.sent}`);
const msg = await db.from("notifications").select("title, message, type").eq("type", "case_followup").limit(1);
if (msg.data?.length) check("the survivor message is calm and asks nothing of them", /don't need to do anything/.test(msg.data[0].message));
process.exit(fails ? 1 : 0);
