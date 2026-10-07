import assert from "node:assert/strict";
import { buildEscalationEmail } from "../lib/cases/escalation.ts";
const { subject, html } = buildEscalationEmail(
	[
		{ kind: "unmatched_report", refId: "11111111-aaaa", reportId: "11111111-aaaa", reason: "Reported and still not matched with a service", hoursWaiting: 30, incident: "sexual assault", urgency: "high", area: "Nairobi" },
		{ kind: "inactive_match", refId: "22222222-bbbb", reportId: "22222222-bbbb", reason: "Matched, awaiting response (pending)", hoursWaiting: 49, incident: null, urgency: null, area: "<script>x</script>" },
	],
	"https://sautisalama.org"
);
assert.equal(subject, "Delayed Support");
assert.ok(html.indexOf("49h") < html.indexOf("30h"), "longest wait first");
assert.ok(!html.includes("<script>"), "escaped");
assert.match(html, /dashboard\/admin\/matching/);
console.log("ok -", subject);
