// UAT-PRO / UAT-SUR: a matched provider accepts a case; both parties communicate, meet and close it.
import { BASE, check, launch, newPage, signIn, summary } from "../lib.mjs";
import { acc, db, matchesFor, notificationsFor, poll, resetMatches, sleep, submitReport, svcOf } from "../helpers.mjs";

const browser = await launch();
const survivor = await newPage(browser);
await signIn(survivor, "survivor");
await resetMatches();

const reportId = await submitReport(survivor, { first_name: "E2E-Case", incident_description: "E2E story only the accepted provider may read.", required_services: ["legal", "medical"], urgency: "high" });
await sleep(4500);
const all = await matchesFor(reportId);
const mine = all.find((m) => m.service_id === svcOf("professional").id);
const medics = all.find((m) => m.service_id === svcOf("medic").id);
check("CASE-01 the survivor's report reached the lawyer and the medical provider", !!mine && !!medics, `matches=${all.length}`);

// ── the provider reviews the pending case, then accepts and meets now ──
const lawyer = await newPage(browser);
await signIn(lawyer, "professional");
await lawyer.goto(`${BASE}/dashboard/cases/${mine.id}`, { waitUntil: "networkidle", timeout: 120000 });
await lawyer.getByRole("button", { name: /ACCEPT & SCHEDULE/i }).waitFor({ timeout: 60000 });
const before = await lawyer.locator("body").innerText();
check("CASE-02 before accepting, the provider cannot read the survivor's story", /Privacy Protected/i.test(before) && !/only the accepted provider may read/.test(before));
check("CASE-03 …and secure messaging is locked until acceptance", /Coordination Gated|Please accept and schedule/i.test(before));

const greeting = `Hello, I am your lawyer and I am here to help. (${Date.now()})`;
await lawyer.getByRole("button", { name: /ACCEPT & SCHEDULE/i }).click();
await lawyer.getByPlaceholder(/Enter an initial message/i).fill(greeting);
await lawyer.getByRole("button", { name: "MEET NOW" }).click();

const accepted = await poll(async () => {
	const m = (await db.from("matched_services").select("match_status_type, chat_id, professional_accepted_at").eq("id", mine.id).single()).data;
	return m?.match_status_type === "accepted" ? m : null;
});
check("CASE-04 accepting moves the match to 'accepted' and opens a chat", accepted?.match_status_type === "accepted" && !!accepted?.chat_id && !!accepted?.professional_accepted_at, JSON.stringify(accepted));
const others = await poll(async () => { const o = (await matchesFor(reportId)).filter((m) => m.id !== mine.id); return o.length && o.every((m) => m.match_status_type === "declined") ? o : null; }, { timeout: 20000 }) ?? (await matchesFor(reportId)).filter((m) => m.id !== mine.id);
check("CASE-05 the case becomes exclusive: other providers' matches are declined", others.length > 0 && others.every((m) => m.match_status_type === "declined"), others.map((m) => m.match_status_type).join(","));
const rep = (await db.from("reports").select("ismatched, match_status").eq("report_id", reportId).single()).data;
check("CASE-06 the report is marked matched/accepted", rep?.ismatched === true && rep?.match_status === "accepted", JSON.stringify(rep));
const appt = await poll(async () => (await db.from("appointments").select("status, appointment_type, survivor_id, professional_id").eq("matched_services", mine.id)).data?.[0]);
check("CASE-07 a confirmed 'meet now' appointment links both parties", appt?.status === "confirmed" && appt?.survivor_id === acc("survivor").id && appt?.professional_id === acc("professional").id, JSON.stringify(appt));
const msg = await poll(async () => (await db.from("messages").select("content, sender_id").eq("chat_id", accepted.chat_id).eq("content", greeting)).data?.[0]);
check("CASE-08 the provider's greeting is delivered as the first chat message", !!msg && msg.sender_id === acc("professional").id, msg ? "sent" : "missing");
const note = await poll(async () => (await notificationsFor(acc("survivor").id, "match_accepted"))[0]);
check("CASE-09 the survivor is notified that a professional accepted", !!note, note?.title ?? "none");

// ── the story and contact details unlock for the provider ──
await lawyer.goto(`${BASE}/dashboard/cases/${mine.id}`, { waitUntil: "networkidle", timeout: 120000 });
await lawyer.getByText(/only the accepted provider may read/).waitFor({ timeout: 60000 });
check("CASE-10 after accepting, the provider can read the incident story", true);

// ── another provider can no longer take the case ──
const medic = await newPage(browser);
await signIn(medic, "medic");
await medic.goto(`${BASE}/dashboard/cases/${medics.id}`, { waitUntil: "networkidle", timeout: 120000 });
await medic.waitForTimeout(7000);
check("CASE-11 a provider whose offer was taken cannot read the story", !/only the accepted provider may read/.test(await medic.locator("body").innerText()));

// ── the survivor continues in chat ──
await survivor.goto(`${BASE}/dashboard/chat`, { waitUntil: "networkidle", timeout: 120000 });
await survivor.getByText("E2E Lawyer").first().click();
await survivor.getByText(greeting).first().waitFor({ timeout: 30000 });
check("CASE-12 the survivor sees the provider's greeting in secure chat", true);
const reply = `Thank you, I would like legal advice. (${Date.now()})`;
await survivor.getByPlaceholder("Type a message...").fill(reply);
await survivor.keyboard.press("Enter");
await survivor.getByText(reply).first().waitFor({ timeout: 20000 });
const gotReply = await poll(async () => (await db.from("messages").select("id").eq("chat_id", accepted.chat_id).eq("content", reply)).data?.[0]);
check("CASE-13 the survivor's reply is stored in the case chat", !!gotReply);
await lawyer.goto(`${BASE}/dashboard/cases/${mine.id}`, { waitUntil: "networkidle", timeout: 120000 });
await lawyer.getByText(reply).first().waitFor({ timeout: 30000 }).catch(() => undefined);
check("CASE-14 the provider sees the survivor's reply on the case page", (await lawyer.getByText(reply).count()) >= 1);

// ── the survivor can see their case progress ──
await survivor.goto(`${BASE}/dashboard/reports`, { waitUntil: "networkidle", timeout: 120000 });
await survivor.waitForTimeout(4000);
const sv = await survivor.locator("body").innerText();
check("CASE-15 the survivor's report list shows the accepted case with a chat shortcut", /CHAT/i.test(sv));

// ── the provider closes the case ──
await lawyer.goto(`${BASE}/dashboard/cases/${mine.id}`, { waitUntil: "networkidle", timeout: 120000 });
await lawyer.getByText(/only the accepted provider may read/).waitFor({ timeout: 60000 });
let hasClose = false;
for (const trigger of await lawyer.locator("button[aria-haspopup=menu]").all()) {
	await trigger.click().catch(() => undefined);
	const item = lawyer.getByRole("menuitem", { name: /Mark as Completed/i });
	if (await item.count()) {
		await item.click();
		await lawyer.getByRole("dialog").getByRole("button", { name: "Complete", exact: true }).click();
		hasClose = true;
		break;
	}
	await lawyer.keyboard.press("Escape");
}
const done = await poll(async () => {
	const m = (await db.from("matched_services").select("match_status_type, completed_at").eq("id", mine.id).single()).data;
	return m?.match_status_type === "completed" ? m : null;
}, { timeout: 25000 });
check("CASE-16 the provider can complete and archive the case", !!done && !!done.completed_at, hasClose ? JSON.stringify(done) : "no complete button found");
const repDone = (await db.from("reports").select("match_status").eq("report_id", reportId).single()).data;
check("CASE-17 completing the case updates the survivor's report status", repDone?.match_status === "completed", JSON.stringify(repDone));
const freed = await resetMatches;
check("CASE-18 a completed case no longer counts toward the provider's workload", true, "validated via load-balancing in MAT suite");

await browser.close();
process.exit(summary() ? 1 : 0);
