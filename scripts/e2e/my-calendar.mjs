import { BASE, launch, newPage, signIn, check, summary } from "./lib.mjs";

const browser = await launch();
for (const role of ["survivor", "professional"]) {
	const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
	await signIn(page, role);
	await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 });
	const link = page.locator('a[href="/dashboard/calendar"]').first();
	await link.waitFor({ timeout: 60000 }).catch(() => {});
	check(`${role}: sidebar Calendar goes to /dashboard/calendar`, (await link.count()) > 0);
	await page.goto(BASE + "/dashboard/calendar", { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByRole("heading", { name: "Calendar", exact: true }).waitFor({ timeout: 60000 }).catch(() => {});
	await page.waitForFunction(() => !document.body.innerText.includes("Loading"), null, { timeout: 30000 }).catch(() => {});
	check(`${role}: month grid shows`, (await page.locator('button[aria-label*=" items"], button[aria-label*=" item"]').count()) >= 28);
	check(`${role}: no error`, (await page.getByText("Could not load your calendar").count()) === 0);
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await page.getByRole("button", { name: "week", exact: true }).click();
	check(`${role}: week view has 7 days`, (await page.locator('button[aria-label*=" item"]').count()) === 7);
	await page.goto(BASE + "/dashboard/profile?section=calendar", { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.waitForTimeout(3000);
	check(`${role}: settings still reachable`, /calendar/i.test(await page.locator("body").innerText()));
	await page.close();
}
await browser.close();
summary();
