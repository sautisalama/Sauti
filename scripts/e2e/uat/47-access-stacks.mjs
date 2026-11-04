// Overlapping photos of the people with access, on contacts and on the grants, opportunities and projects lists.
//   node --env-file=.env.local scripts/e2e/uat/47-access-stacks.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const me = accounts.accounts.admin.id;
const tag = Date.now();
const { data: c } = await db.from("mjengo_contacts").insert({ name: `E2E Stack ${tag}`, email: `stack${tag}@example.com`, visibility: "team", created_by: me, source: "manual" }).select("id").single();
const { data: o } = await db.from("mjengo_opportunities").insert({ title: `E2E Opp ${tag}`, status: "new", created_by: me, visibility: "team" }).select("id").single();

const browser = await launch();
const page = await newPage(browser, {});
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/contacts`, { waitUntil: "domcontentloaded" });
	const row = page.locator("li, div").filter({ hasText: `E2E Stack ${tag}` }).last();
	await row.waitFor({ timeout: 90000 });
	await page.waitForTimeout(2500);
	const stack = await page.locator(`xpath=//*[contains(text(),'E2E Stack ${tag}')]/ancestor::*[self::li or self::div][.//span[contains(@class,'-space-x-2')]][1]//span[contains(@class,'-space-x-2')]`).count();
	check("A contact shows the people who have it", stack >= 1, `stacks=${stack}`);
	await page.goto(`${BASE}/dashboard/mjengo/opportunities`, { waitUntil: "domcontentloaded" });
	await page.getByText(`E2E Opp ${tag}`).first().waitFor({ timeout: 90000 });
	await page.waitForTimeout(2500);
	const opp = await page.locator(`xpath=//*[contains(text(),'E2E Opp ${tag}')]/ancestor::*[.//*[contains(@class,'-space-x')]][1]//*[contains(@class,'-space-x')]`).count();
	const html = opp >= 1 ? "" : (await page.locator(`xpath=//*[contains(text(),'E2E Opp ${tag}')]/ancestor::li[1]`).first().innerText().catch(() => "no li")).split(String.fromCharCode(10)).join(" | ");
	check("An opportunity shows the people who have it", opp >= 1, `stacks=${opp} ${html}`);
} catch (e) {
	check("Access stacks", false, String(e).slice(0, 300));
} finally {
	await db.from("mjengo_contacts").delete().eq("id", c.id);
	await db.from("mjengo_opportunities").delete().eq("id", o.id);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
