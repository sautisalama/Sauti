// Debug helper: print the matching engine's scoring for every provider against a report.
//   npx tsx --env-file=.env.local scripts/e2e/simulate.mts <first_name-of-report>
import { createClient } from "@supabase/supabase-js";
import { runSimulation } from "../../lib/matching-engine/pipeline.ts";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const name = process.argv[2];
const { data: rep } = await admin.from("reports").select("report_id").eq("first_name", name).order("submission_timestamp", { ascending: false }).limit(1).single();
const res = await runSimulation(rep!.report_id, admin as never);
for (const c of res.candidates) {
	console.log(`${c.candidate.display_name.padEnd(28)} score=${String(Math.round(c.score)).padStart(4)} bounced=${c.is_bounced} ${c.bounce_reason ?? ""} existing=${c.existing_match_status ?? "-"} | ${c.reasons.slice(0, 4).join("; ")}`);
}
