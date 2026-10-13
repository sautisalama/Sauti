// Grants: pasting the call's link fills in what it funds, sectors, themes and SDGs; fields with nothing in them
// are not shown; opportunities can be a consultancy.
//   node --env-file=.env.local scripts/e2e/uat/26-fund-from-link.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(120000);
await page.setViewportSize({ width: 1400, height: 1000 });
const title = `E2E fund ${Date.now()}`;
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/grants`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByRole("button", { name: /New grant/i }).first().click();
	await page.getByLabel("Grant name").fill(title);
	check("Empty details are not shown", (await page.locator("#f-notes").count()) === 0 && (await page.locator("#f-eligibility").count()) === 0 && (await page.getByRole("button", { name: /Notes/ }).count()) > 0);
	await page.getByLabel("Call / portal link").fill("https://www.un.org/sustainabledevelopment/gender-equality/");
	await page.getByText(/Filled from/).waitFor({ timeout: 120000 });
	const filled = (await page.getByText(/Filled from/).first().textContent()) ?? "";
	check("The link fills in details", /sectors|themes|SDGs|details/.test(filled), filled.slice(0, 120));
	check("Details that were found are now shown", (await page.getByRole("button", { name: /Goal 5/ }).count()) > 0 || (await page.getByPlaceholder("Type and press Enter").count()) > 0 || (await page.getByRole("button", { name: /^Remove / }).count()) > 0);
	await page.getByRole("button", { name: "Save" }).click();
	await page.waitForTimeout(2500);
	const { data } = await db.from("mjengo_grants").select("id, sectors, themes, sdgs, description").eq("title", title).maybeSingle();
	check("The details are kept", !!data && ((data.sectors?.length ?? 0) + (data.themes?.length ?? 0) + (data.sdgs?.length ?? 0) > 0), JSON.stringify(data)?.slice(0, 160));
	if (data) await db.from("mjengo_grants").delete().eq("id", data.id);

	await page.goto(`${BASE}/dashboard/mjengo/opportunities`, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: /New opportunity/i }).first().click();
	await page.getByLabel("Type").click();
	check("An opportunity can be a consultancy", (await page.getByRole("option", { name: "Consultancy" }).count()) === 1);
} catch (e) {
	check("Fund details flow", false, String(e).slice(0, 280));
} finally {
	await db.from("mjengo_grants").delete().eq("title", title);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
