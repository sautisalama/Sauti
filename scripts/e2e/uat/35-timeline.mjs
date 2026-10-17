// A grant's timeline: it opens in the grant, shows what is coming and what happened, a call can be linked by hand
// and unlinked, and Salama's brief reads from it.
//   node --env-file=.env.local scripts/e2e/uat/35-timeline.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tag = `zq${Date.now()}`;
const title = `Kivuli ${tag} resilience grant`;
const soon = new Date(Date.now() + 20 * 86400_000).toISOString().slice(0, 10);
const code = tag.slice(0, 10);
const me = accounts.accounts.admin.id;
const { data: grant } = await db.from("mjengo_grants").insert({ title, funder: "Harmony Trust", status: "drafting", deadline: soon, created_by: me }).select("id").single();
const { data: meeting } = await db.from("mjengo_meetings").insert({ code, title: `Budget review ${tag}`, created_by: me, notes: "**Summary**\nThe budget needs a second pass before submission.", transcript: [] }).select("id").single();

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(60000);
await page.setViewportSize({ width: 1500, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/grants`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.locator('[tabindex="0"]').filter({ hasText: title }).first().click();
	const tl = page.getByText("Timeline", { exact: true }).first();
	await tl.waitFor({ timeout: 60000 });
	check("The grant shows its timeline", true);
	await page.getByText("Coming up", { exact: true }).waitFor({ timeout: 15000 });
	check("What is coming is on top (the deadline)", true);
	await page.getByText("was added").first().waitFor({ timeout: 15000 });
	check("What happened is listed", true);

	await page.getByRole("button", { name: /Link a call or file/ }).click();
	await page.getByLabel("Search calls, files and events").fill(`Budget review ${tag}`);
	await page.getByRole("button", { name: new RegExp(`Budget review ${tag}`) }).click();
	await page.getByText(`Call: Budget review ${tag}`).waitFor({ timeout: 20000 });
	check("A call linked by hand appears on the timeline with its summary", (await page.getByText(/second pass/).count()) > 0);

	await page.getByRole("button", { name: new RegExp(`Unlink Call: Budget review ${tag}`) }).click({ force: true });
	await page.waitForFunction((t) => !document.body.innerText.includes(`Call: Budget review ${t}`), tag, { timeout: 20000 });
	check("Unlinking takes it off again", true);

	await page.getByRole("button", { name: /Brief me/ }).click();
	await page.getByText("Where it stands").first().waitFor({ timeout: 90000 });
	check("Salama's brief reads the timeline", true);
	check("No page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
	check("Timeline flow", false, String(e).slice(0, 300));
	await page.screenshot({ path: `${process.env.TEMP}/timeline-fail.png` }).catch(() => undefined);
} finally {
	await db.from("mjengo_links").delete().eq("entity_id", grant.id);
	await db.from("mjengo_meetings").delete().eq("id", meeting.id);
	await db.from("mjengo_grants").delete().eq("id", grant.id);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
