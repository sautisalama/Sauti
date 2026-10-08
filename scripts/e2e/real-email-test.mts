// Sends ONE real "Delayed Support" email and ONE real publication email (PDF + Word) to a single address you control.
//   npx tsx --env-file=.env.local scripts/e2e/real-email-test.mts you@example.com
// Never run with EMAIL_MODE=capture (that would only write to the outbox).
import { buildEscalationEmail } from "../../lib/cases/escalation.ts";
import { sendEmail, sendEmailWithAttachments } from "../../lib/notifications/email.ts";
import { renderDocx, renderPdf } from "../../lib/content/export.ts";

const to = process.argv[2];
if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error("usage: real-email-test.mts <your address>");
if (process.env.EMAIL_MODE === "capture") throw new Error("unset EMAIL_MODE=capture for a real send");

const { subject, html } = buildEscalationEmail(
	[{ kind: "unmatched_report", refId: "00000000-test", reportId: "00000000-test", reason: "TEST — Reported and still not matched with a service", hoursWaiting: 27, incident: "Test incident", urgency: "high", area: "Nairobi" }],
	"https://sautisalama.org"
);
const a = await sendEmail(to, subject, html, { email: "alerts@sautisalama.org", name: "Sauti Salama Alerts" }, { urgent: true, category: "Urgent Escalation" });
console.log("Delayed Support:", subject, "→", a);

const body = "<h1>Test publication</h1><p>This is a test of the publication email with Word and PDF copies attached.</p>";
const meta = { title: "Test publication", author: "Sauti Salama", publishedAt: new Date().toISOString() };
const b = await sendEmailWithAttachments(to, "TEST — New publication: Test publication", body, [
	{ filename: "test-publication.pdf", content: renderPdf(body, meta), type: "application/pdf" },
	{ filename: "test-publication.docx", content: await renderDocx(body, meta), type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
] as any);
console.log("Publication:", b);
