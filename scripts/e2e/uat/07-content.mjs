// UAT-PUB / UAT-LRN: publishing (Word/PDF import, preview, publish, email), courses, learner progress, hardening, private voice notes.
// Signed-in end-to-end run against the DEV project. Prereqs:
//   node --env-file=.env.local scripts/e2e/seed.mjs                       (creates test accounts)
//   PUBLICATIONS_EMAIL=<your address> CRON_SECRET=x npm run dev           (so the publish email goes to you)
//   SAMPLES=<dir with e2e-sample.docx / e2e-sample.pdf> node --env-file=.env.local scripts/e2e/authenticated.mjs
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const SAMPLES = process.env.SAMPLES || fileURLToPath(new URL("../samples", import.meta.url));
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
const PUB_TITLE = `E2E Publication ${stamp}`;
const COURSE_TITLE = `E2E Course ${stamp}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await launch();
const acceptDialogs = (p) => p.on("dialog", (d) => d.accept().catch(() => undefined));

// ═════════════ A. Admin: publishing ═════════════
const admin = await newPage(browser);
acceptDialogs(admin);
await signIn(admin, "admin");
check("admin lands on admin dashboard after sign-in", /\/dashboard/.test(admin.url()), admin.url());

await admin.goto(`${BASE}/dashboard/admin/publications`, { waitUntil: "networkidle", timeout: 120000 });
check("admin publications list loads", (await admin.getByRole("heading", { name: "Publications" }).count()) >= 1);

await admin.goto(`${BASE}/dashboard/admin/publications/new`, { waitUntil: "networkidle", timeout: 120000 });
await admin.getByPlaceholder("A clear, specific title").fill(PUB_TITLE);
await admin.locator("textarea").first().fill("A short summary written by the e2e test.");
const editor = admin.locator('[aria-label="Article body"]');
await editor.click();
await admin.keyboard.type("Early referral reduces harm for survivors in Kenya. ");
await admin.keyboard.press("Control+A");
await admin.getByRole("button", { name: /^Bold/ }).click();
// add an inline link to another source through the toolbar
await admin.getByRole("button", { name: /Add or edit link/ }).click();
await admin.getByLabel("URL", { exact: true }).fill("www.who.int/violence");
await admin.getByRole("group", { name: "Link to another source" }).getByRole("button", { name: /Insert|Update/ }).click();
await admin.waitForTimeout(300);
const html1 = await editor.innerHTML();
check("editor: bold + inline link applied", /<strong>/.test(html1) && /href="https:\/\/www\.who\.int\/violence"/.test(html1), html1.slice(0, 160));
// bad link is rejected
await admin.getByRole("button", { name: /Add or edit link/ }).click();
await admin.getByLabel("URL", { exact: true }).fill("javascript:alert(1)");
await admin.getByRole("group", { name: "Link to another source" }).getByRole("button", { name: /Insert|Update/ }).click();
check("editor: javascript: link rejected", (await admin.getByText(/valid link/i).count()) >= 1);
await admin.getByRole("button", { name: "Close", exact: true }).first().click().catch(() => undefined);
// "Other sources" box
await admin.getByRole("button", { name: /Add a source/ }).click();
await admin.getByLabel("Source 1 label").fill("Kenya Sexual Offences Act");
await admin.getByLabel("Source 1 link").fill("kenyalaw.org/sexual-offences");
// table + checklist + heading exist in toolbar
await editor.click();
await admin.keyboard.press("Control+End");
await admin.getByRole("button", { name: "Insert table" }).click();
check("editor: table inserted", (await editor.locator("table").count()) === 1);

await admin.getByRole("button", { name: /Save draft/ }).click();
await admin.waitForURL(/\/dashboard\/admin\/publications\/[0-9a-f-]{36}$/, { timeout: 45000 });
const pubId = admin.url().split("/").pop();
check("saved as draft (id in URL)", !!pubId);
await admin.getByText("Draft").first().waitFor();
let row = (await db.from("publications").select("*").eq("id", pubId).single()).data;
check("DB: draft row, sanitised body, link stored", row?.status === "draft" && /<strong>/.test(row.body) && row.external_links?.[0]?.url === "https://kenyalaw.org/sexual-offences", `status=${row?.status}`);
check("DB: summary + read time computed", !!row?.summary && row?.read_minutes >= 1);

await admin.getByRole("tab", { name: /preview/i }).click();
check("in-page preview shows title + other sources", (await admin.getByRole("heading", { name: PUB_TITLE }).count()) === 1 && (await admin.getByText("Other sources").count()) >= 1);
await admin.getByRole("tab", { name: /edit/i }).click();

// drafts are private, the secret preview link works
const anon = await newPage(browser);
const slug = row.slug;
await anon.goto(`${BASE}/publications/${slug}`, { waitUntil: "networkidle", timeout: 120000 });
check("anonymous cannot see the draft", (await anon.getByRole("heading", { name: PUB_TITLE }).count()) === 0);
await anon.goto(`${BASE}/publications/${slug}?preview=${row.preview_token}`, { waitUntil: "networkidle", timeout: 120000 });
check("secret preview link shows the draft with a banner", (await anon.getByRole("heading", { name: PUB_TITLE }).count()) === 1 && (await anon.getByText(/Preview — this draft is not public yet/).count()) === 1);
await anon.goto(`${BASE}/publications/${slug}?preview=00000000-0000-0000-0000-000000000000`, { waitUntil: "networkidle", timeout: 120000 });
check("wrong preview token shows nothing", (await anon.getByRole("heading", { name: PUB_TITLE }).count()) === 0);

// publish
await admin.getByRole("button", { name: /^Publish$/ }).click();
await admin.getByText("Live on the website").waitFor({ timeout: 45000 });
check("published banner shown", true);
await anon.goto(`${BASE}/publications/${slug}`, { waitUntil: "networkidle", timeout: 120000 });
check("anonymous can read the published article", (await anon.getByRole("heading", { name: PUB_TITLE }).count()) === 1);
check("article shows inline link + Other sources link", (await anon.locator('.rich-content a[href^="https://www.who.int"]').count()) === 1 && (await anon.locator('a[href="https://kenyalaw.org/sexual-offences"]').count()) === 1);
check("external links open safely", (await anon.locator('.rich-content a[href^="https://www.who.int"]').getAttribute("rel"))?.includes("noopener") === true);
await anon.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
const firstTitle = await anon.locator("#publications article h3").first().innerText();
check("homepage: newest publication leads the section", firstTitle.trim() === PUB_TITLE, firstTitle.trim());
await anon.goto(`${BASE}/publications`, { waitUntil: "networkidle", timeout: 120000 });
check("/publications index lists it", (await anon.getByText(PUB_TITLE).count()) >= 1);
const sm = await (await anon.request.get(`${BASE}/sitemap.xml`)).text();
check("sitemap includes the new article", sm.includes(`/publications/${slug}`));

// email copy (goes to PUBLICATIONS_EMAIL for this run)
let emailed = null;
for (let i = 0; i < 30 && emailed !== "sent"; i++) {
	await sleep(2000);
	emailed = (await db.from("publications").select("email_status").eq("id", pubId).single()).data?.email_status;
}
check("publish emailed a PDF+Word copy (email_status=sent)", emailed === "sent", String(emailed));
const events = (await db.from("publication_events").select("action").eq("publication_id", pubId)).data?.map((e) => e.action) ?? [];
check("audit trail recorded created/edited/published", ["created", "published"].every((a) => events.includes(a)), events.join(","));

// non-admin cannot reach the admin editor
const learnerForGuard = await newPage(browser);
await signIn(learnerForGuard, "survivor");
await learnerForGuard.goto(`${BASE}/dashboard/admin/publications`, { waitUntil: "networkidle", timeout: 120000 });
check("non-admin is turned away from admin publications", !learnerForGuard.url().includes("/admin/publications"), learnerForGuard.url());
await learnerForGuard.close();

// unpublish hides it again
await admin.getByRole("button", { name: /Unpublish/ }).click();
await admin.getByText("Not visible to anyone yet").waitFor({ timeout: 45000 });
await anon.goto(`${BASE}/publications/${slug}`, { waitUntil: "networkidle", timeout: 120000 });
check("unpublished article is hidden from the public", (await anon.getByRole("heading", { name: PUB_TITLE }).count()) === 0);

// import Word + PDF
if (SAMPLES) {
	for (const [kind, file] of [["Word", "e2e-sample.docx"], ["PDF", "e2e-sample.pdf"]]) {
		await admin.goto(`${BASE}/dashboard/admin/publications/new`, { waitUntil: "networkidle", timeout: 120000 });
		await admin.locator('input[type="file"][aria-label="Upload Word or PDF document"]').setInputFiles(`${SAMPLES}/${file}`);
		await admin.getByText(/Imported from/).waitFor({ timeout: 60000 });
		const body = await admin.locator('[aria-label="Article body"]').innerText();
		const title = await admin.getByPlaceholder("A clear, specific title").inputValue();
		check(`${kind} import fills title + body`, /Quarterly community response/.test(body) && /E2E Imported Report/.test(title), `title="${title}"`);
		if (kind === "Word") check("Word import keeps structure (list + link)", (await admin.locator('[aria-label="Article body"] li').count()) >= 2 && (await admin.locator('[aria-label="Article body"] a[href^="https://www.who.int"]').count()) === 1);
		else check("PDF import warns about layout", (await admin.getByText(/PDF layout can't be reproduced/).count()) === 1);
		await admin.getByRole("button", { name: /Save draft/ }).click();
		await admin.waitForURL(/\/publications\/[0-9a-f-]{36}$/, { timeout: 45000 });
		const imp = (await db.from("publications").select("status,source_file_type,source_file_url").eq("id", admin.url().split("/").pop()).single()).data;
		check(`${kind} import saved as a draft with the original attached`, imp?.status === "draft" && !!imp?.source_file_url, JSON.stringify({ t: imp?.source_file_type }));
	}
	// rejected uploads
	await admin.goto(`${BASE}/dashboard/admin/publications/new`, { waitUntil: "networkidle", timeout: 120000 });
	await admin.locator('input[type="file"][aria-label="Upload Word or PDF document"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
	await admin.getByText(/Word \(\.docx\) or PDF/).first().waitFor({ timeout: 15000 });
	check("unsupported file type is rejected with a clear message", true);
}

// ═════════════ B. Courses: admin builds, learner learns, admin tracks ═════════════
await admin.goto(`${BASE}/dashboard/admin/courses/new`, { waitUntil: "networkidle", timeout: 120000 });
await admin.locator('input[minlength="3"]').first().fill(COURSE_TITLE);
await admin.getByRole("button", { name: /Create course/ }).click();
await admin.waitForURL(/\/dashboard\/admin\/courses\/[0-9a-f-]{36}$/, { timeout: 45000 });
const courseId = admin.url().split("/").pop();
await admin.getByRole("button", { name: /Add module/ }).click();
await admin.getByLabel("Module title").last().fill("Module One");
await admin.getByRole("button", { name: "Add", exact: true }).click();
await admin.getByRole("button", { name: /Add lesson/ }).first().waitFor({ timeout: 30000 });
for (const [i, name] of ["Lesson Alpha", "Lesson Beta"].entries()) {
	await admin.getByRole("button", { name: /Add lesson/ }).first().click();
	await admin.getByLabel("Lesson title").last().fill(name);
	await admin.getByRole("button", { name: "Add", exact: true }).click();
	await admin.getByText("Lesson title").first().waitFor({ timeout: 30000 }); // editor opens
	await admin.locator('[aria-label="Article body"]').last().click();
	await admin.keyboard.type(`Content of ${name}. Remember the helpline 1195.`);
	await admin.getByRole("button", { name: /Save lesson/ }).click();
	await admin.getByText("Lesson saved.").waitFor({ timeout: 30000 });
	await admin.getByRole("button", { name: "Close", exact: true }).last().click();
	if (i === 0) await admin.waitForTimeout(500);
}
let lessons = (await db.from("course_lessons").select("title,position").eq("course_id", courseId).order("position")).data ?? [];
check("course has 2 lessons in order", lessons.length === 2 && lessons[0].title === "Lesson Alpha" && lessons[1].title === "Lesson Beta", lessons.map((l) => l.title + "@" + l.position).join(","));
await admin.getByRole("button", { name: "Move lesson down" }).first().click();
for (let i = 0; i < 20; i++) {
	await sleep(1000);
	lessons = (await db.from("course_lessons").select("title,position").eq("course_id", courseId).order("position")).data ?? [];
	if (lessons[0]?.title === "Lesson Beta") break;
}
check("reordering lessons persists", lessons[0].title === "Lesson Beta", lessons.map((l) => l.title).join(","));
await admin.getByRole("button", { name: "Move lesson down" }).first().click();
await sleep(1500);

const learnerAnon = await newPage(browser);
await learnerAnon.goto(`${BASE}/learn/courses`, { waitUntil: "networkidle", timeout: 120000 });
check("draft course is not in the public catalogue", (await learnerAnon.getByText(COURSE_TITLE).count()) === 0);

await admin.getByRole("button", { name: /^Publish$/ }).click();
await admin.getByText("Published. Learners can now enrol.").waitFor({ timeout: 30000 });
await learnerAnon.goto(`${BASE}/learn/courses`, { waitUntil: "networkidle", timeout: 120000 });
check("published course appears in the public catalogue", (await learnerAnon.getByText(COURSE_TITLE).count()) >= 1);
const cslug = (await db.from("courses").select("slug").eq("id", courseId).single()).data.slug;
await learnerAnon.goto(`${BASE}/learn/courses/${cslug}`, { waitUntil: "networkidle", timeout: 120000 });
check("anonymous sees outline but is asked to sign in", (await learnerAnon.getByText(/Sign in to start/).count()) === 1);
const firstLessonId = (await db.from("course_lessons").select("id").eq("course_id", courseId).order("position").limit(1).single()).data.id;
await learnerAnon.goto(`${BASE}/learn/courses/${cslug}/lessons/${firstLessonId}`, { waitUntil: "networkidle", timeout: 120000 });
check("lesson content requires sign-in (redirects with ?next)", learnerAnon.url().includes("/signin") && learnerAnon.url().includes("next="), learnerAnon.url());
await learnerAnon.close();

const learner = await newPage(browser);
await signIn(learner, "survivor");
await learner.goto(`${BASE}/learn/courses/${cslug}`, { waitUntil: "networkidle", timeout: 120000 });
await learner.getByRole("button", { name: /Start course/ }).click();
await learner.waitForURL(/\/lessons\//, { timeout: 45000 });
check("learner enrolled and landed on lesson 1", /lesson 1 of 2/i.test(await learner.locator("body").innerText()));
check("lesson content renders", (await learner.getByText(/Remember the helpline 1195/).count()) >= 1);
await learner.getByRole("button", { name: /Complete & continue/ }).click();
await learner.getByText(/lesson 2 of 2/i).waitFor({ timeout: 45000 });
check("complete & continue moves to lesson 2", true);
await learner.getByRole("button", { name: /Finish course/ }).click();
await learner.waitForURL(new RegExp(`/learn/courses/${cslug}$`), { timeout: 45000 });
await learner.getByText(/Course completed/).waitFor({ timeout: 30000 });
check("finishing marks the course complete", true);
await learner.goto(`${BASE}/dashboard/learning`, { waitUntil: "networkidle", timeout: 120000 });
check("learner dashboard shows 100% progress", (await learner.getByText(COURSE_TITLE).count()) === 1 && (await learner.locator('[role="progressbar"]').first().getAttribute("aria-valuenow")) === "100");
const enr = (await db.from("course_enrollments").select("completed_at").eq("course_id", courseId)).data ?? [];
const prog = (await db.from("lesson_progress").select("id").eq("course_id", courseId)).data ?? [];
check("DB: enrolment completed, 2 progress rows", enr.length === 1 && !!enr[0].completed_at && prog.length === 2);

await admin.goto(`${BASE}/dashboard/admin/courses/${courseId}/progress`, { waitUntil: "networkidle", timeout: 120000 });
const ptxt = await admin.locator("body").innerText();
check("admin progress page shows the learner at 100%", /E2E Learner/.test(ptxt) && /2\/2/.test(ptxt) && /100%/.test(ptxt));

// (chat and AI assistant are covered by 04-communication)
const pro = await newPage(browser);
await signIn(pro, "professional");

// ═════════════ D. Chat/admin hardening ═════════════
const noAuth = await anon.request.post(`${BASE}/api/assistant`, { data: { messages: [{ role: "user", content: "hi" }] } });
check("AI endpoint rejects unauthenticated callers", noAuth.status() === 401);
const noCron = await anon.request.get(`${BASE}/api/cron/escalate-stale-cases`);
check("escalation cron rejects callers without the secret", noCron.status() === 401);
const noCron2 = await anon.request.get(`${BASE}/api/cron/daily-reminder`);
check("daily-reminder cron rejects callers without the secret", noCron2.status() === 401);
const noSign = await anon.request.get(`${BASE}/api/audio/sign?url=${encodeURIComponent("https://x.supabase.co/storage/v1/object/public/report-audio/reports/1.webm")}`);
check("audio signing requires sign-in", noSign.status() === 401);

// ═════ E. Private voice notes ═════
{
	const objPath = `reports/e2e-${stamp}.webm`;
	await db.storage.from("report-audio").upload(objPath, Buffer.from("RIFF-e2e-not-really-audio"), { contentType: "audio/webm", upsert: true });
	const marked = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/report-audio/${objPath}`;
	const { error: repErr } = await db.from("reports").insert({ first_name: "E2E-Audio", user_id: accounts.accounts.survivor.id, media: { url: marked, type: "audio/webm" }, ismatched: false, record_only: true });
	check("fixture: report with voice note created", !repErr, repErr?.message ?? "");
	const direct = await fetch(marked);
	check("voice note is NOT downloadable from the old public URL", direct.status >= 400, String(direct.status));
	const own = await learner.request.get(`${BASE}/api/audio/sign?url=${encodeURIComponent(marked)}`);
	const ownJson = own.ok() ? await own.json() : null;
	check("report owner gets a signed link", own.status() === 200 && !!ownJson?.url, String(own.status()));
	const played = ownJson?.url ? await fetch(ownJson.url) : null;
	check("signed link actually serves the audio", played?.status === 200, String(played?.status));
	const other = await pro.request.get(`${BASE}/api/audio/sign?url=${encodeURIComponent(marked)}`);
	check("an unrelated signed-in user is refused (404)", other.status() === 404, String(other.status()));
	const adm = await admin.request.get(`${BASE}/api/audio/sign?url=${encodeURIComponent(marked)}`);
	// Admins have no read access to `reports` (least privilege), so they cannot pull the audio either.
	check("an admin without report access is refused too", adm.status() === 404, String(adm.status()));
	const traversal = await learner.request.get(`${BASE}/api/audio/sign?url=${encodeURIComponent(marked.replace(objPath, "reports/../secret.webm"))}`);
	check("path traversal is rejected", traversal.status() === 400, String(traversal.status()));
	await db.from("reports").delete().eq("first_name", "E2E-Audio");
	await db.storage.from("report-audio").remove([objPath]);
}

// ── cleanup of rows this run created ──
await db.from("publications").delete().like("title", "E2E %");
await db.from("courses").delete().like("title", "E2E %");

await browser.close();
process.exit(summary() ? 1 : 0);
