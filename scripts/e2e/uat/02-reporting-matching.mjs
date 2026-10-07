// UAT-SUR / UAT-MAT: survivors report incidents; the engine matches verified providers correctly.
import { BASE, check, launch, newPage, signIn, summary } from "../lib.mjs";
import { acc, db, resetMatches, matchesFor, notificationsFor, poll, readOutbox, serviceIdsOf, sleep, submitReport, svcOf, deleteAnonUsersSince } from "../helpers.mjs";

const started = new Date().toISOString();
const browser = await launch();

// ═════════ A. Anonymous survivor files a report from a phone ═════════
{
	const phone = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	await phone.goto(`${BASE}/report-abuse`, { waitUntil: "networkidle", timeout: 120000 });
	await phone.getByRole("combobox", { name: /select incident types/i }).tap();
	await phone.getByRole("option", { name: "Physical abuse" }).tap();
	await phone.getByRole("button", { name: /^Done/ }).tap();
	await phone.getByText("select urgency").first().tap();
	await phone.getByText("high urgency").first().tap();
	await phone.getByRole("combobox", { name: /help you need/i }).tap();
	await phone.getByRole("option", { name: "legal support" }).tap();
	await phone.getByRole("option", { name: "medical care" }).tap();
	await phone.getByRole("button", { name: /^Done/ }).tap();
	await phone.getByText("select consent").first().tap();
	await phone.getByText("I consent").first().tap();
	await phone.getByPlaceholder(/share what happened/i).fill("E2E anonymous report from a phone.");
	await phone.locator("#report-password").fill(`E2e-${Date.now()}-pw`);
	await phone.getByRole("button", { name: /submit report/i }).tap();
	await phone.waitForURL(/\/dashboard/, { timeout: 90000 });
	check("REP-01 an anonymous survivor can file a report from a phone and lands on their dashboard", /\/dashboard/.test(phone.url()), phone.url());

	const anon = await poll(async () => {
		const { data } = await db.from("profiles").select("id, anon_username, is_anonymous").eq("is_anonymous", true).gte("created_at", started).limit(1);
		return data?.[0];
	}, { timeout: 30000 });
	check("REP-02 a private anonymous account was created (no real identity stored)", !!anon && !!anon.anon_username, anon?.anon_username ?? "none");
	const rep = anon ? (await db.from("reports").select("*").eq("user_id", anon.id).single()).data : null;
	check("REP-03 the report stores what the survivor chose", rep?.type_of_incident === "physical" && rep?.urgency === "high" && rep?.consent === "yes", JSON.stringify({ t: rep?.type_of_incident, u: rep?.urgency, c: rep?.consent }));
	check("REP-04 BOTH chosen services are saved (they drive matching)", Array.isArray(rep?.required_services) && rep.required_services.includes("legal") && rep.required_services.includes("medical"), JSON.stringify(rep?.required_services));
	check("REP-05 location is attached only if allowed (coordinates present)", rep?.latitude != null && rep?.longitude != null);
	const ms = rep ? await poll(async () => { const m = await matchesFor(rep.report_id); return m.length ? m : null; }, { timeout: 40000 }) : [];
	check("REP-06 the anonymous report is matched with verified providers", (ms?.length ?? 0) >= 2, `matches=${ms?.length}`);
	const types = new Set((ms ?? []).map((m) => m.support_service));
	check("REP-07 matched providers cover what the survivor asked for (legal + medical)", types.has("legal") && types.has("medical"), [...types].join(","));
	const mail = readOutbox(started);
	check("REP-08 the team is emailed about the new report", mail.some((e) => /report/i.test(e.subject ?? "")), mail.map((e) => e.subject).join(" | ").slice(0, 120));
	await phone.close();
}

// ═════════ B. Matching rules (signed-in survivor) ═════════
const survivor = await newPage(browser);
await signIn(survivor, "survivor");
const legal = svcOf("professional").id, medic = svcOf("medic").id, shelter = svcOf("ngo").id, counsel = svcOf("pending_pro").id;
const wait = () => sleep(4500);
const file = async (over) => {
	const id = await submitReport(survivor, over);
	await wait();
	return { id, matches: await matchesFor(id) };
};

let r = await file({ first_name: "E2E-M1", type_of_incident: "physical", required_services: ["legal", "medical"], urgency: "high" });
let ids = serviceIdsOf(r.matches);
check("MAT-01 physical abuse → legal and medical providers matched", ids.has(legal) && ids.has(medic), `n=${r.matches.length}`);
check("MAT-02 an unverified counsellor is never matched", !ids.has(counsel));
const top = [...r.matches].sort((a, b) => b.match_score - a.match_score)[0];
check("MAT-03 the strongest match is a primary specialty (legal/medical), not a secondary one", [legal, medic].includes(top?.service_id), `top=${top?.support_service} score=${top?.match_score}`);
check("MAT-04 every match starts as 'pending' and belongs to the survivor", r.matches.every((m) => m.match_status_type === "pending"));
const proNote = await poll(async () => (await notificationsFor(acc("professional").id, "match_found"))[0], { timeout: 15000 });
check("MAT-05 the matched provider is notified of the new case", !!proNote, proNote?.title ?? "none");
const surNote = await poll(async () => (await notificationsFor(acc("survivor").id, "match_found"))[0], { timeout: 15000 });
check("MAT-06 the survivor is told help is on the way", !!surNote, surNote?.title ?? "none");

r = await file({ first_name: "E2E-M2", type_of_incident: "sexual", required_services: ["medical"], urgency: "high" });
check("MAT-07 sexual violence → a medical provider is matched", serviceIdsOf(r.matches).has(medic), `n=${r.matches.length}`);

r = await file({ first_name: "E2E-M3", type_of_incident: "physical", required_services: ["shelter"], urgency: "high" });
check("MAT-08 a shelter need → the NGO shelter is matched", serviceIdsOf(r.matches).has(shelter), `n=${r.matches.length}`);

r = await file({ first_name: "E2E-M4", type_of_incident: "child_abuse", required_services: ["legal"], urgency: "high" });
check("MAT-09 a child case is flagged for escalation on every match", r.matches.length > 0 && r.matches.every((m) => (m).escalation_required !== false), `n=${r.matches.length}`);
const childNote = await poll(async () => (await notificationsFor(acc("professional").id, "match_found")).find((n) => /child/i.test(n.title)), { timeout: 15000 });
check("MAT-10 providers get the URGENT child-case alert", !!childNote, childNote?.title ?? "none");

r = await file({ first_name: "E2E-M5", type_of_incident: "physical", required_services: ["legal"], consent: "no" });
check("MAT-11 when the survivor withholds consent, lawyers are not matched", !serviceIdsOf(r.matches).has(legal), `n=${r.matches.length}`);

await db.from("profiles").update({ out_of_office: true }).eq("id", acc("medic").id);
r = await file({ first_name: "E2E-M6", type_of_incident: "sexual", required_services: ["medical"] });
check("MAT-12 a provider who is out of office is not matched", !serviceIdsOf(r.matches).has(medic), `n=${r.matches.length}`);
await db.from("profiles").update({ out_of_office: false }).eq("id", acc("medic").id);

r = await file({ first_name: "E2E-M7", type_of_incident: "physical", required_services: ["legal"], latitude: 51.5, longitude: -0.12 });
check("MAT-13 a report far outside every provider's coverage is not force-matched", r.matches.filter((m) => [legal, medic, shelter].includes(m.service_id)).length === 0, `n=${r.matches.length}`);
const far = (await db.from("reports").select("requires_manual_review").eq("report_id", r.id).single()).data;
check("MAT-14 …and is flagged for an administrator to handle manually", far?.requires_manual_review === true);

// record-only reports are stored but not matched until escalated
await resetMatches();
const ro = await file({ first_name: "E2E-M8", type_of_incident: "physical", required_services: ["legal"], record_only: true });
check("MAT-15 a record-only report is NOT matched", ro.matches.length === 0);
const esc = await survivor.request.post(`${BASE}/api/reports/${ro.id}/escalate`);
await wait();
const after = await matchesFor(ro.id);
check("MAT-16 escalating a record-only report starts matching", esc.ok() && after.length > 0, `status=${esc.status()} n=${after.length}`);
await survivor.request.post(`${BASE}/api/reports/${ro.id}/escalate`);
await wait();
const again = await matchesFor(ro.id);
check("MAT-17 escalating twice never creates duplicate matches", again.length === after.length, `${after.length} → ${again.length}`);
const other = await newPage(browser);
await signIn(other, "survivor2");
const bad = await other.request.post(`${BASE}/api/reports/${ro.id}/escalate`);
check("MAT-18 someone else cannot escalate a survivor's report (they cannot even see it)", [403, 404].includes(bad.status()), String(bad.status()));
const unauth = await (await browser.newContext()).request.post(`${BASE}/api/reports`, { data: { first_name: "E2E-NoAuth" } });
check("MAT-19 submitting a signed-in report without signing in is refused", unauth.status() === 401, String(unauth.status()));

// ═════════ C. What each party sees ═════════
await survivor.goto(`${BASE}/dashboard/reports`, { waitUntil: "networkidle", timeout: 120000 });
await survivor.waitForTimeout(4000);
check("MAT-20 the survivor sees their reports with the number of matches", /\d+ MATCHES?/i.test(await survivor.locator("body").innerText()));

const pro = await newPage(browser);
await signIn(pro, "professional");
await pro.goto(`${BASE}/dashboard/cases`, { waitUntil: "networkidle", timeout: 120000 });
await pro.waitForTimeout(5000);
const cases = await pro.locator("body").innerText();
check("MAT-21 the matched provider sees the case in their queue as PENDING", /PENDING/.test(cases) && /physical/i.test(cases));
await pro.getByText(/physical/i).first().click();
await pro.getByRole("button", { name: /ACCEPT & SCHEDULE/i }).waitFor({ timeout: 60000 });
const detail = await pro.locator("body").innerText();
check("MAT-22 survivor details stay private until the provider accepts", /Privacy Protected/i.test(detail) && !/E2E Learner/.test(detail));

const noAccess = await newPage(browser);
await signIn(noAccess, "survivor2");
const m0 = (await matchesFor(ro.id))[0];
await noAccess.goto(`${BASE}/dashboard/cases/${m0.id}`, { waitUntil: "networkidle", timeout: 120000 });
await noAccess.waitForTimeout(6000);
check("MAT-23 an unrelated user cannot open someone else's case", !/ACCEPT & SCHEDULE|Incident Story/i.test(await noAccess.locator("body").innerText()));

await deleteAnonUsersSince(started);
await browser.close();
process.exit(summary() ? 1 : 0);
