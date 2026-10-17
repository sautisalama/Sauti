// Salama on a call: she is listed as an AI team member, and "Salama, ..." typed in Messages is answered in the
// chat for everyone, from the workspace, and kept with the meeting. The quick asks work too.
//   node --env-file=.env.local scripts/e2e/uat/34-salama-call.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const pick = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
const code = `${pick(3)}-${pick(4)}-${pick(3)}`;
const tag = `zq${Date.now()}`;
const { error } = await db.from("mjengo_meetings").insert({ code, mode: "video", title: "E2E Salama call", created_by: accounts.accounts.admin.id });
if (error) { console.error("Could not create the test meeting:", error.message); process.exit(1); }
const { data: grant } = await db.from("mjengo_grants").insert({ title: `Mwangaza ${tag} survivor fund`, funder: "Harmony Trust", status: "drafting", owner_id: accounts.accounts.admin.id }).select("id").single();

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(60000);
await page.setViewportSize({ width: 1400, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await page.getByPlaceholder("How should people see you?").fill("Host Tester");
	await page.getByRole("button", { name: /^Join now$/ }).click();
	await page.getByRole("button", { name: "Leave call" }).waitFor({ timeout: 30000 });

	await page.getByRole("button", { name: "People" }).first().click();
	await page.getByText("AI team member").first().waitFor({ timeout: 10000 });
	check("Salama is listed among the people in the call", true);

	await page.getByRole("button", { name: /^Messages/ }).first().click();
	const box = page.locator('textarea[aria-label="Message"]:visible').first();
	await box.fill(`Salama, what is the status of the Mwangaza ${tag} fund?`);
	await box.press("Enter");
	await page.getByText(/drafting/i).first().waitFor({ timeout: 90000 });
	check("She answers in the call's chat from the workspace", true);

	await page.getByRole("button", { name: "Catch me up" }).click();
	await page.getByText(/Salama is thinking/).first().waitFor({ timeout: 10000 }).catch(() => undefined);
	await page.waitForFunction(() => document.body.innerText.split("Salama").length > 4, null, { timeout: 90000 });
	check("A quick ask gets an answer too", true);
	check("No page errors", errors.length === 0, errors.join(" | "));
	await page.getByRole("button", { name: "Leave call" }).click();
} catch (e) {
	check("Salama call flow", false, String(e).slice(0, 300));
	await page.screenshot({ path: `${process.env.TEMP}/salama-call-fail.png` }).catch(() => undefined);
} finally {
	if (grant) await db.from("mjengo_grants").delete().eq("id", grant.id);
	await db.from("mjengo_meetings").delete().eq("code", code);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
