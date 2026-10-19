// The grant agent in a grant: it reads the funder's guidelines attached to the grant, lists the sections with their
// limits, drafts one within its limit, and reviews the draft against the scoring.
//   node --env-file=.env.local scripts/e2e/uat/36-grant-agent.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tag = `zq${Date.now()}`;
const title = `Safety Fund ${tag}`;
const me = accounts.accounts.admin.id;
const call = `Harmony Trust: Survivor Safety Fund. We fund survivor-led organisations in East Africa.
Who can apply: organisations registered in Kenya with an annual income under USD 500,000.
How to apply: Section 1, The need (maximum 300 words): describe the problem and who is affected. Section 2, Your approach (maximum 400 words): what you will do. Section 3, Budget summary (no limit).
You must attach: your registration certificate and a safeguarding policy.
How we score: Likely impact 60%, Safeguarding 40%.`;
const path = `e2e/${tag}-guidelines.txt`;
await db.storage.from("mjengo-docs").upload(path, Buffer.from(call), { contentType: "text/plain", upsert: true });
const { data: grant } = await db.from("mjengo_grants").insert({ title, funder: "Harmony Trust", status: "drafting", created_by: me, description: "A fund for survivor-led organisations." }).select("id").single();
await db.from("mjengo_documents").insert({ entity_type: "grant", entity_id: grant.id, name: "Funder guidelines", required: false, file_path: path, file_name: "guidelines.txt", mime_type: "text/plain", uploaded_by: me, uploaded_at: new Date().toISOString() });
const { data: meeting } = await db.from("mjengo_meetings").insert({ code: tag.slice(0, 10), title: `Prep for ${title}`, created_by: me, notes: `**Summary**\nOur peer paralegal programme in Kibera supported 212 survivors last year. ${tag}`, transcript: [] }).select("id").single();

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(120000);
await page.setViewportSize({ width: 1500, height: 1100 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/grants`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.locator('[tabindex="0"]').filter({ hasText: title }).first().click();
	await page.getByRole("button", { name: /Application agent/ }).click({ timeout: 60000 });
	await page.getByText("Application agent").first().waitFor({ timeout: 60000 });
	check("The agent is in the grant, and opens when asked", true);

	await page.getByRole("button", { name: "Read the funder's call" }).click();
	await page.getByText("The need", { exact: true }).waitFor({ timeout: 90000 });
	check("It reads the guidelines into sections", true);
	check("Limits and scoring are shown", (await page.getByText(/0 \/ 300 words/).count()) > 0 && (await page.getByText(/Likely impact 60%/).count()) > 0);

	await page.getByRole("button", { name: "Draft" }).first().click();
	const box = page.getByLabel("The need draft");
	await page.waitForFunction(() => { const t = [...document.querySelectorAll("textarea")].find((x) => (x.getAttribute("aria-label") ?? "").includes("The need draft")); return t && t.value.length > 80; }, null, { timeout: 120000 });
	const words = (await box.inputValue()).trim().split(/\s+/).length;
	check("The section is drafted within its limit", words <= 300, `${words} words`);
	check("It is written from the organisation's record", /212|paralegal|Kibera/i.test(await box.inputValue()));

	await page.getByRole("button", { name: /Review before sending/ }).click();
	await page.getByText(/Likely score about/).waitFor({ timeout: 120000 });
	check("The review scores it and lists what is missing", (await page.getByText(/has not been written/).count()) > 0 && (await page.getByText(/is not attached yet/).count()) > 0);
	check("No page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
	check("Grant agent flow", false, String(e).slice(0, 300));
	await page.screenshot({ path: `${process.env.TEMP}/agent-fail.png`, fullPage: false }).catch(() => undefined);
} finally {
	await db.from("mjengo_grant_briefs").delete().eq("entity_id", grant.id);
	await db.from("mjengo_documents").delete().eq("entity_id", grant.id);
	await db.storage.from("mjengo-docs").remove([path]);
	await db.from("mjengo_links").delete().eq("entity_id", grant.id);
	await db.from("mjengo_meetings").delete().eq("id", meeting.id);
	await db.from("mjengo_grants").delete().eq("id", grant.id);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
