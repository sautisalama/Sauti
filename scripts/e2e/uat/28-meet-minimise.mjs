// Picture in picture from the call page minimises the call into the corner of the suite: the person goes on to
// other pages, the same call keeps running, and expanding brings it back full screen.
//   node --env-file=.env.local scripts/e2e/uat/28-meet-minimise.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const pick = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
const code = `${pick(3)}-${pick(4)}-${pick(3)}`;
const { error } = await db.from("mjengo_meetings").insert({ code, mode: "video", title: "E2E minimise", created_by: accounts.accounts.admin.id });
if (error) { console.error("Could not create the test meeting:", error.message); process.exit(1); }

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(60000);
await page.setViewportSize({ width: 1400, height: 900 });
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await page.getByPlaceholder("How should people see you?").fill("Host Tester");
	await page.getByRole("button", { name: /^Join now$/ }).click();
	await page.getByRole("button", { name: "Leave call" }).waitFor({ timeout: 30000 });
	check("The host is in the call", true);

	// Picture in picture: the call page is left and the call shrinks into the corner.
	await page.getByRole("button", { name: /Picture in picture/ }).first().click();
	await page.waitForURL((u) => !u.pathname.startsWith("/meet/"), { timeout: 30000 });
	await page.getByRole("button", { name: "Return to the full call" }).waitFor({ timeout: 15000 });
	check("The page moves on and the call is minimised in the corner", true, new URL(page.url()).pathname);

	// Move around the suite with the sidebar: the call is still there and was not dropped.
	const here = new URL(page.url()).pathname;
	const link = page.locator('a[href^="/dashboard"]:visible').filter({ hasNot: page.locator("[hidden]") });
	let moved = false;
	for (let i = 0; i < Math.min(6, await link.count()) && !moved; i++) {
		const href = await link.nth(i).getAttribute("href");
		if (!href || href === here || href.startsWith("/dashboard/mjengo/meet")) continue;
		await link.nth(i).click();
		await page.waitForURL((u) => u.pathname !== here, { timeout: 20000 }).then(() => { moved = true; }).catch(() => undefined);
	}
	check("A sidebar link was followed without a reload", moved, new URL(page.url()).pathname);
	await page.getByRole("button", { name: "Return to the full call" }).waitFor({ timeout: 15000 });
	const lobby = await page.getByRole("button", { name: /^Join now$/ }).count();
	check("The call keeps running while moving between pages", lobby === 0);

	// Expand: back on the call page, full screen, still in the call.
	await page.getByRole("button", { name: "Return to the full call" }).click();
	await page.waitForURL(new RegExp(`/meet/${code}`), { timeout: 30000 });
	await page.getByRole("button", { name: "Leave call" }).waitFor({ timeout: 20000 });
	check("Expanding returns to the full call", true);

	// Leave from the full call: nothing is left floating.
	await page.getByRole("button", { name: "Leave call" }).click();
	await page.waitForTimeout(1500);
	check("Leaving closes the call", (await page.getByRole("button", { name: "Return to the full call" }).count()) === 0);
} catch (e) {
	check("Minimise flow", false, String(e).slice(0, 280));
} finally {
	await db.from("mjengo_meetings").delete().eq("code", code);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
