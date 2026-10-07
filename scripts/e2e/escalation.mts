// Dry run of the 24h escalation finder against the seeded stale report (does NOT send email).
//   npx tsx --env-file=.env.local scripts/e2e/escalation.mts
import assert from "node:assert/strict";
import fs from "node:fs";
import { findStaleCases, buildEscalationEmail } from "../../lib/cases/escalation.ts";

const seed = JSON.parse(fs.readFileSync(new URL("../../.e2e-accounts.local.json", import.meta.url), "utf8"));
const stale = await findStaleCases();
const mine = stale.find((c) => c.refId === seed.staleReportId);
assert.ok(mine, "seeded 30h-old unmatched report must be found");
assert.equal(mine.kind, "unmatched_report");
assert.ok(mine.hoursWaiting >= 29, `hoursWaiting=${mine.hoursWaiting}`);
const { subject, html } = buildEscalationEmail([mine], "https://sautisalama.org");
assert.equal(subject, "Delayed Support");
assert.ok(!/E2E-Stale/.test(html), "email must not contain the reporter's name field");
console.log("escalation ok:", subject, "| waiting", mine.hoursWaiting, "h");
