// UAT-ACC / UAT-VDOC / UAT-CERT: account deletion, password change, real device sign-out, the
// verification-document alert, and course certificates.
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";
import { acc, apiAs, db, poll, readOutbox, sleep, svcOf } from "../helpers.mjs";

const started = new Date().toISOString();
const stamp = Date.now();
const browser = await launch();

async function tempUser(role, extra = {}) {
	const email = `e2e-sauti.tmp-${role}-${stamp}@example.com`;
	const password = "Temp-Pass-12345!";
	const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: "Temp", last_name: role } });
	if (error) throw error;
	await db.from("profiles").upsert({ id: data.user.id, email, first_name: "Temp", last_name: role, user_type: role === "survivor" ? "survivor" : "professional", policies: { all_policies_accepted: true, accepted_policies: ["terms", "privacy"] }, professional_title: role === "survivor" ? null : "Lawyer", ...extra }, { onConflict: "id" });
	return { id: data.user.id, email, password };
}
async function login(page, u) {
	await page.goto(`${BASE}/signin`, { waitUntil: "networkidle", timeout: 120000 });
	await page.fill('input[name="email"]', u.email);
	await page.fill('input[name="password"]', u.password);
	await Promise.all([page.waitForURL((x) => !x.pathname.startsWith("/signin"), { timeout: 90000 }), page.click('button[type="submit"]')]);
}

// ═════ A. Verification-document alert ═════
const pend = await apiAs("pending_pro");
const svcId = svcOf("pending_pro").id;
// start from "no documents" so adding one is a real submission (the seed attaches a placeholder)
await db.from("support_services").update({ accreditation_files_metadata: [] }).eq("id", svcId);
await db.from("profiles").update({ accreditation_files_metadata: [] }).eq("id", acc("pending_pro").id);
await db.from("verification_submissions").delete().in("subject_id", [svcId, acc("pending_pro").id]);
const docs = (n) => Array.from({ length: n }, (_, i) => ({ title: `Practising certificate ${i + 1}`, url: `https://example.com/e2e-${i}.pdf`, status: "pending", uploaded_at: new Date().toISOString() }));
let r = await pend.from("support_services").update({ accreditation_files_metadata: docs(1) }).eq("id", svcId);
check("VDOC-01 a provider can attach documents to their service", !r.error, r.error?.message ?? "");
const ledger = await poll(async () => (await db.from("verification_submissions").select("*").eq("subject_id", svcId)).data?.[0]);
check("VDOC-02 the database records the submission (it cannot be missed by any screen)", !!ledger && ledger.kind === "service" && ledger.document_count === 1 && !ledger.notified_at, JSON.stringify(ledger));

const pro = await newPage(browser);
await signIn(pro, "pending_pro");
const notify = await pro.request.post(`${BASE}/api/verification/notify`);
check("VDOC-03 the flush endpoint answers signed-in providers", notify.status() === 200);
const mails = readOutbox(started).filter((e) => e.category === "Verification Documents");
check("VDOC-04 ONE email goes to the escalation team (malkia@ and oliver@)", mails.length === 1 && [].concat(mails[0].to).map((s) => s.toLowerCase()).sort().join() === "malkia@sautisalama.org,oliver@sautisalama.org", JSON.stringify(mails.map((m) => m.to)));
check("VDOC-05 the subject says documents were submitted", /Verification documents submitted/i.test(mails[0]?.subject ?? ""), mails[0]?.subject);
const done = (await db.from("verification_submissions").select("notified_at").eq("subject_id", svcId).single()).data;
check("VDOC-06 the submission is marked as sent", !!done?.notified_at);
await pro.request.post(`${BASE}/api/verification/notify`);
check("VDOC-07 calling again never repeats the email", readOutbox(started).filter((e) => e.category === "Verification Documents").length === 1);
const adminNote = (await db.from("notifications").select("id").eq("user_id", acc("admin").id).eq("type", "new_service_submission").gte("created_at", started)).data ?? [];
check("VDOC-08 admins also get an in-app notification", adminNote.length >= 1);

await pend.from("support_services").update({ accreditation_files_metadata: [] }).eq("id", svcId);
await pro.request.post(`${BASE}/api/verification/notify`);
check("VDOC-09 removing a document is not a submission", readOutbox(started).filter((e) => e.category === "Verification Documents").length === 1);

r = await pend.from("profiles").update({ accreditation_files_metadata: docs(2) }).eq("id", acc("pending_pro").id);
await pro.request.post(`${BASE}/api/verification/notify`);
const profMail = readOutbox(started).filter((e) => e.category === "Verification Documents");
check("VDOC-10 documents added to the provider's own profile are announced too", profMail.length === 2, `emails=${profMail.length} err=${r.error?.message ?? ""}`);
check("VDOC-11 anonymous callers cannot trigger the flush", (await (await browser.newContext()).request.post(`${BASE}/api/verification/notify`)).status() === 401);
await db.from("profiles").update({ accreditation_files_metadata: [] }).eq("id", acc("pending_pro").id);
await db.from("verification_submissions").delete().in("subject_id", [svcId, acc("pending_pro").id]);

// ═════ B. Certificates ═════
const slug = `e2e-cert-${stamp}`;
const { data: course } = await db.from("courses").insert({ slug, title: `E2E Certificate Course ${stamp}`, status: "published", published_at: new Date().toISOString(), level: "beginner" }).select("id").single();
const { data: mod } = await db.from("course_modules").insert({ course_id: course.id, title: "Module 1", position: 0 }).select("id").single();
const { data: lessons } = await db.from("course_lessons").insert([{ module_id: mod.id, course_id: course.id, title: "L1", content: "<p>a</p>", position: 0 }, { module_id: mod.id, course_id: course.id, title: "L2", content: "<p>b</p>", position: 1 }]).select("id");
const learner = await newPage(browser);
await signIn(learner, "survivor2");
// finish via the real lesson screens
await learner.goto(`${BASE}/learn/courses/${slug}/lessons/${lessons[0].id}`, { waitUntil: "networkidle", timeout: 120000 });
await learner.getByRole("button", { name: /Complete & continue/ }).click();
await learner.waitForURL(new RegExp(`/lessons/${lessons[1].id}`), { timeout: 30000 });
check("CERT-01 a certificate is NOT issued before the last lesson", ((await db.from("course_certificates").select("id").eq("course_id", course.id)).data?.length ?? 0) === 0);
await learner.getByRole("button", { name: /Finish course/ }).click();
await learner.waitForURL(new RegExp(`/learn/courses/${slug}$`), { timeout: 30000 });
const cert = await poll(async () => (await db.from("course_certificates").select("*").eq("course_id", course.id)).data?.[0]);
check("CERT-02 finishing the last lesson issues a certificate", !!cert && /^SS-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cert.certificate_number), cert?.certificate_number);
check("CERT-03 it carries the learner's name and the course title", cert?.learner_name?.includes("Neighbour") && cert?.course_title?.includes("E2E Certificate Course"), `${cert?.learner_name} / ${cert?.course_title}`);
await learner.getByRole("link", { name: /View your certificate/ }).waitFor({ timeout: 20000 });
check("CERT-04 the course page offers 'View your certificate'", true);
await learner.goto(`${BASE}/dashboard/learning`, { waitUntil: "networkidle", timeout: 120000 });
check("CERT-05 My learning shows the certificate link and the completed badge", (await learner.getByRole("link", { name: /Certificate/ }).count()) >= 1 && (await learner.getByText("Completed").count()) >= 1);

const visitor = await (await browser.newContext()).newPage();
await visitor.goto(`${BASE}/learn/certificates/${cert.certificate_number}`, { waitUntil: "networkidle", timeout: 120000 });
const certText = await visitor.locator("body").innerText();
check("CERT-06 anyone with the number can verify the certificate (no sign-in)", /Certificate of completion/i.test(certText) && certText.includes(cert.certificate_number) && /E2E Certificate Course/.test(certText));
check("CERT-07 the page shows no email or phone", !/@example\.com/.test(certText));
const pdf = await (await browser.newContext()).request.get(`${BASE}/api/certificates/${cert.certificate_number}/pdf`);
const body = await pdf.body();
check("CERT-08 the certificate downloads as a PDF", pdf.status() === 200 && /application\/pdf/.test(pdf.headers()["content-type"]) && body.subarray(0, 4).toString() === "%PDF" && body.length > 3000, `${pdf.status()} ${body.length}b`);
const fake = await (await browser.newContext()).request.get(`${BASE}/learn/certificates/SS-2026-AAAA-BBBB`);
check("CERT-09 an invented number shows no certificate", !/has successfully completed/i.test(await fake.text()) || fake.status() === 404, String(fake.status()));
const own = await apiAs("survivor");
check("CERT-10 another learner cannot read someone else's certificate record", ((await own.from("course_certificates").select("id").eq("course_id", course.id)).data?.length ?? 0) === 0);
const forge = await own.from("course_certificates").insert({ certificate_number: "SS-2026-FAKE-FAKE", course_id: course.id, user_id: acc("survivor").id, learner_name: "Me", course_title: "x" });
check("CERT-11 nobody can print their own certificate by writing to the table", !!forge.error, forge.error?.message ?? "no error");
await db.from("courses").delete().eq("id", course.id);

// ═════ C. Change password ═════
const u1 = await tempUser("survivor");
const pw = await newPage(browser);
await login(pw, u1);
await pw.goto(`${BASE}/dashboard/profile?section=privacy`, { waitUntil: "networkidle", timeout: 120000 });
await pw.getByRole("button", { name: /Change password/i }).click();
await pw.locator("#cp-current").fill("wrong-password-1");
await pw.locator("#cp-new").fill("Brand-New-Pass-77!");
await pw.locator("#cp-again").fill("Brand-New-Pass-77!");
await pw.getByRole("dialog").getByRole("button", { name: /Change password/i }).click();
await pw.getByText(/current password is not right/i).waitFor({ timeout: 20000 });
check("ACC-01 a wrong current password is refused", true);
await pw.locator("#cp-current").fill(u1.password);
await pw.getByRole("dialog").getByRole("button", { name: /Change password/i }).click();
await pw.getByRole("dialog").waitFor({ state: "hidden", timeout: 30000 });
const { createClient } = await import("@supabase/supabase-js");
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const withNew = await anon.auth.signInWithPassword({ email: u1.email, password: "Brand-New-Pass-77!" });
const withOld = await anon.auth.signInWithPassword({ email: u1.email, password: u1.password });
check("ACC-02 the new password works and the old one no longer does", !withNew.error && !!withOld.error);

// ═════ D. Delete my account (survivor) ═════
const { data: rep } = await db.from("reports").insert({ first_name: "E2E-Del", user_id: u1.id, type_of_incident: "physical", urgency: "low", record_only: true, ismatched: false }).select("report_id").single();
await db.from("notifications").insert({ user_id: u1.id, type: "system_alert", title: "x", message: "y" });
await pw.goto(`${BASE}/dashboard/profile?section=privacy`, { waitUntil: "networkidle", timeout: 120000 });
const delBtn = pw.getByRole("button", { name: /^Delete account$/ });
await delBtn.click();
const confirmBtn = pw.getByRole("dialog").getByRole("button", { name: /Delete everything/ });
check("ACC-03 the delete button stays disabled until DELETE is typed", await confirmBtn.isDisabled());
await pw.getByRole("dialog").getByRole("textbox").fill("DELETE");
await confirmBtn.click();
await pw.waitForURL(/\/\?account=deleted/, { timeout: 60000 });
const gone = await poll(async () => ((await db.from("profiles").select("id").eq("id", u1.id)).data?.length ?? 1) === 0 ? true : null, { timeout: 20000 });
check("ACC-04 the account, profile and sign-in are gone", !!gone && !(await db.auth.admin.getUserById(u1.id)).data?.user);
check("ACC-05 their reports and notifications are gone with it", ((await db.from("reports").select("report_id").eq("report_id", rep.report_id)).data?.length ?? 0) === 0 && ((await db.from("notifications").select("id").eq("user_id", u1.id)).data?.length ?? 0) === 0);
const relogin = await anon.auth.signInWithPassword({ email: u1.email, password: "Brand-New-Pass-77!" });
check("ACC-06 signing in again with the deleted account fails", !!relogin.error);

// ═════ E. Delete my account (provider with a case in progress) ═════
const prov = await tempUser("professional");
const { data: svc } = await db.from("support_services").insert({ user_id: prov.id, name: `E2E Temp Service ${stamp}`, service_types: "legal", email: prov.email, phone_number: "+254700000001", availability: "flexible", latitude: -1.29, longitude: 36.82, coverage_area_radius: 50, verification_status: "verified", is_active: true }).select("id").single();
const { data: rep2 } = await db.from("reports").insert({ first_name: "E2E-Del2", user_id: acc("survivor").id, type_of_incident: "financial", urgency: "low", record_only: true, ismatched: true }).select("report_id").single();
const { data: m } = await db.from("matched_services").insert({ report_id: rep2.report_id, survivor_id: acc("survivor").id, service_id: svc.id, hrd_profile_id: prov.id, support_service: "legal", match_score: 50, match_status_type: "pending" }).select("id").single();
const pp = await newPage(browser);
await login(pp, prov);
await pp.goto(`${BASE}/dashboard/profile?section=privacy`, { waitUntil: "networkidle", timeout: 120000 });
await pp.getByRole("button", { name: /^Delete account$/ }).click();
await pp.getByRole("dialog").getByRole("textbox").fill("DELETE");
await pp.getByRole("dialog").getByRole("button", { name: /Delete everything/ }).click();
await pp.waitForURL(/\/\?account=deleted/, { timeout: 60000 });
const provGone = await poll(async () => ((await db.from("profiles").select("id").eq("id", prov.id)).data?.length ?? 1) === 0 ? true : null, { timeout: 20000 });
check("ACC-07 a provider can delete their account", !!provGone);
check("ACC-08 their service is removed", ((await db.from("support_services").select("id").eq("id", svc.id)).data?.length ?? 0) === 0);
const mm = (await db.from("matched_services").select("match_status_type").eq("id", m.id).maybeSingle()).data;
check("ACC-09 their open case is cancelled (or removed), never left waiting on them", !mm || mm.match_status_type === "cancelled", JSON.stringify(mm));
const told = (await db.from("notifications").select("id").eq("user_id", acc("survivor").id).eq("title", "Your support is being reassigned").gte("created_at", started)).data ?? [];
check("ACC-10 the survivor is told their support is being reassigned", told.length >= 1);
await db.from("reports").delete().eq("report_id", rep2.report_id);

// ═════ F. Admin accounts cannot delete themselves ═════
const adm = await newPage(browser);
await signIn(adm, "admin");
await adm.goto(`${BASE}/dashboard/profile?section=privacy`, { waitUntil: "networkidle", timeout: 120000 });
await adm.getByRole("button", { name: /^Delete account$/ }).click();
await adm.getByRole("dialog").getByRole("textbox").fill("DELETE");
await adm.getByRole("dialog").getByRole("button", { name: /Delete everything/ }).click();
await adm.getByText(/must be removed by another administrator/i).waitFor({ timeout: 20000 });
check("ACC-11 an admin account cannot be deleted by itself", !!(await db.from("profiles").select("id").eq("id", acc("admin").id).maybeSingle()).data);

// ═════ G. Revoking a device really signs it out ═════
const u2 = await tempUser("survivor");
const phone = await newPage(browser);
await login(phone, u2);
await phone.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 120000 });
await phone.waitForTimeout(6000);
const dev = (await db.from("profiles").select("devices").eq("id", u2.id).single()).data?.devices ?? [];
check("ACC-12 the signed-in device is recorded", dev.length >= 1, `devices=${dev.length}`);
await db.from("profiles").update({ devices: [{ id: "some-other-device", device_name: "Other", last_active: new Date().toISOString() }] }).eq("id", u2.id);
await phone.evaluate(() => window.dispatchEvent(new Event("focus")));
await phone.waitForURL(/\/signin/, { timeout: 30000 }).catch(() => undefined);
check("ACC-13 a device removed from the list signs itself out", /\/signin/.test(phone.url()), phone.url());
await db.auth.admin.deleteUser(u2.id);

await browser.close();
process.exit(summary() ? 1 : 0);
