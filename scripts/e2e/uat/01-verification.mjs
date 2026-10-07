// UAT-ADM: administrators approve / reject professionals, NGOs and their services.
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";
import { acc, auditFor, deactivateAllServices, db, matchesFor, notificationsFor, poll, serviceIdsOf, sleep, submitReport } from "../helpers.mjs";

const browser = await launch();
const admin = await newPage(browser);
admin.on("dialog", (d) => d.accept().catch(() => undefined));
await signIn(admin, "admin");
const proId = acc("pending_pro").id;
const ngoId = acc("pending_ngo").id;
const proSvc = accounts.services.pending_pro.id;
const ngoSvc = accounts.services.pending_ngo.id;

// Nobody is available yet: take every active service out of play so the report has to wait.
const restoreServices = await deactivateAllServices();
const survivor = await newPage(browser);
await signIn(survivor, "survivor");
const waitingReport = await submitReport(survivor, { first_name: "E2E-Waiting", type_of_incident: "emotional", required_services: ["mental_health"], urgency: "high" });
await sleep(4000);
let m = await matchesFor(waitingReport);
check("VER-01 with no verified provider available the report waits (nothing matched)", m.length === 0, `matches=${m.length}`);

// ── review queue ──
await admin.goto(`${BASE}/dashboard/admin/review`, { waitUntil: "networkidle", timeout: 120000 });
await admin.getByText("E2E Counsellor").first().waitFor({ timeout: 60000 });
const queue = await admin.locator("body").innerText();
check("VER-02 the review queue lists pending professionals AND NGOs", /E2E Counsellor/.test(queue) && /E2E Fund/.test(queue) && /Ngo/i.test(queue));
check("VER-03 the queue counts applicants and services", /2 Users/.test(queue) && /2 Services/.test(queue), queue.match(/\d+ Users|\d+ Services/g)?.join(", "));

// non-admins cannot use the review tools
const other = await newPage(browser);
await signIn(other, "professional");
await other.goto(`${BASE}/dashboard/admin/review`, { waitUntil: "networkidle", timeout: 120000 });
await other.waitForTimeout(3000);
check("VER-04 a non-admin does not get the review queue data", (await other.getByText("E2E Counsellor").count()) === 0);
await other.close();

// ── approve the counsellor (profile) through the UI ──
await admin.goto(`${BASE}/dashboard/admin/review/${proId}?type=professional`, { waitUntil: "networkidle", timeout: 120000 });
await admin.getByRole("button", { name: "Verify", exact: true }).first().click();
await admin.getByPlaceholder("Add an internal note...").fill("Licence checked against the council register (e2e).");
await admin.getByRole("button", { name: "Approve", exact: true }).click();
const prof = await poll(async () => {
	const p = (await db.from("profiles").select("verification_status,isVerified,admin_verified_by,verification_notes").eq("id", proId).single()).data;
	return p?.verification_status === "verified" ? p : null;
});
check("VER-05 approving a professional verifies the profile", prof?.verification_status === "verified" && prof?.isVerified === true, JSON.stringify(prof));
check("VER-06 the approval records who approved it and the note", prof?.admin_verified_by === acc("admin").id && /council register/.test(prof?.verification_notes ?? ""));
const audit = await poll(async () => (await auditFor(proId)).find((a) => a.action_type === "verify_user"));
check("VER-07 the approval is written to the admin audit log with the previous status", !!audit && audit.details?.previous_status === "pending", JSON.stringify(audit?.details));
const note = await poll(async () => (await notificationsFor(proId, "verification_verified"))[0]);
check("VER-08 the professional is notified in-app", !!note, note?.message ?? "no notification");

// ── approve their service (Services tab) ──
await admin.goto(`${BASE}/dashboard/admin/review/${proId}?type=professional`, { waitUntil: "networkidle", timeout: 120000 });
await admin.getByText("Services (1)").first().click();
await admin.getByText("E2E Counselling Practice").first().waitFor({ timeout: 30000 });
await admin.getByRole("button", { name: "Verify", exact: true }).last().click();
await admin.getByRole("button", { name: "Approve", exact: true }).click();
const svc = await poll(async () => {
	const s = (await db.from("support_services").select("verification_status,is_active,verified_by,verified_at").eq("id", proSvc).single()).data;
	return s?.verification_status === "verified" ? s : null;
});
check("VER-09 approving a service verifies and activates it", svc?.verification_status === "verified" && svc?.is_active === true && svc?.verified_by === acc("admin").id, JSON.stringify(svc));
check("VER-10 the service approval is audited", !!(await poll(async () => (await auditFor(proSvc)).find((a) => a.action_type === "verify_service"))));
const svcNote = await poll(async () => (await notificationsFor(proId, "verification_verified")).find((n) => n.metadata?.target_type === "service"));
check("VER-11 the owner is notified about the service decision", !!svcNote);

// ── the waiting report is re-matched once a suitable provider is approved ──
const rematch = await poll(async () => {
	const mm = await matchesFor(waitingReport);
	return serviceIdsOf(mm).has(proSvc) ? mm : null;
}, { timeout: 45000 });
check("VER-12 a report that was waiting is matched to the newly approved provider", !!rematch, `matches=${(await matchesFor(waitingReport)).length}`);
const prNote = await poll(async () => (await notificationsFor(proId, "match_found"))[0], { timeout: 20000 });
check("VER-13 the newly matched provider is notified about the case", !!prNote, prNote?.title ?? "none");
await restoreServices();

// ── reject the NGO with a reason ──
await admin.goto(`${BASE}/dashboard/admin/review/${ngoId}?type=professional`, { waitUntil: "networkidle", timeout: 120000 });
await admin.getByRole("button", { name: "Reject", exact: true }).first().click();
const reason = "Registration certificate expired (e2e)";
await admin.getByPlaceholder("Please describe why this is being rejected...").fill(reason);
await admin.getByRole("dialog").getByRole("button", { name: "Reject", exact: true }).click();
const ngo = await poll(async () => {
	const p = (await db.from("profiles").select("verification_status,isVerified,verification_notes").eq("id", ngoId).single()).data;
	return p?.verification_status === "rejected" ? p : null;
});
check("VER-14 rejecting an NGO records the decision and reason", ngo?.verification_status === "rejected" && ngo?.isVerified === false && (ngo?.verification_notes ?? "").includes("expired"), JSON.stringify(ngo));
const rej = await poll(async () => (await notificationsFor(ngoId, "verification_rejected"))[0]);
check("VER-15 the NGO is notified of the rejection", !!rej);

// a rejected/unverified NGO stays out of matching
const ngoReport = await submitReport(survivor, { first_name: "E2E-Shelter", type_of_incident: "physical", required_services: ["shelter", "financial_assistance"], urgency: "high" });
await sleep(4000);
m = await matchesFor(ngoReport);
check("VER-16 a rejected NGO's service is never matched", !serviceIdsOf(m).has(ngoSvc), `matches=${m.length}`);
check("VER-17 the verified shelter NGO IS matched for a shelter need", serviceIdsOf(m).has(accounts.services.ngo.id));

// the approved professional sees the decision on their side
const pro = await newPage(browser);
await signIn(pro, "pending_pro");
await pro.goto(`${BASE}/dashboard/profile/verification`, { waitUntil: "networkidle", timeout: 120000 });
await pro.waitForTimeout(4000);
check("VER-18 the approved professional sees a verified status", /Fully Verified/i.test(await pro.locator("body").innerText()));

// a banned service drops out of matching
await db.from("support_services").update({ is_banned: true }).eq("id", proSvc);
const banReport = await submitReport(survivor, { first_name: "E2E-Banned", type_of_incident: "emotional", required_services: ["mental_health"] });
await sleep(4000);
check("VER-19 a banned service is excluded from new matches", !serviceIdsOf(await matchesFor(banReport)).has(proSvc));

await browser.close();
process.exit(summary() ? 1 : 0);
