// First visit to the Mjengo suite: set-up prompt, snooze for a day, and the workspace label under the name.
//   node --env-file=.env.local scripts/e2e/uat/44-suite-welcome.mjs
import { BASE, check, launch, newPage, signIn, summary } from "../lib.mjs";

const browser = await launch();
const page = await newPage(browser, {});
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo`, { waitUntil: "domcontentloaded" });
	const dialog = page.getByRole("dialog", { name: "Set up your suite" });
	const shown = await dialog.waitFor({ timeout: 45000 }).then(() => true, () => false);
	check("The set-up prompt opens on the first visit while something is missing", shown);
	if (shown) {
		check("It offers one Google button", (await dialog.getByRole("link", { name: "Connect to Google services" }).count()) <= 1);
		const href = await dialog.getByRole("link", { name: "Connect to Google services" }).getAttribute("href").catch(() => "");
		check("The Google button asks for everything at once and returns to the suite", !href || (/choice=done/.test(href) && /return=/.test(href)), href || "(Google already connected)");
		await dialog.getByRole("button", { name: "Later" }).click();
		await page.reload({ waitUntil: "domcontentloaded" });
		await page.waitForTimeout(3000);
		check("Closing it hides it for a day", (await page.getByRole("dialog", { name: "Set up your suite" }).count()) === 0);
		const until = await page.evaluate(() => Number(localStorage.getItem("ss_suite_welcome_until") || 0));
		check("The reminder is set for about 24 hours", until - Date.now() > 23 * 3600e3 && until - Date.now() <= 24 * 3600e3 + 5000);
	}
	// Under the name: where you are working now.
	const label = await page.locator("p.capitalize").first().innerText().catch(() => "");
	check("The workspace under the name says Mjengo suite", /mjengo suite/i.test(label), label);
	await page.goto(`${BASE}/dashboard/admin`, { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(2000);
	const label2 = await page.locator("p.capitalize").first().innerText().catch(() => "");
	check("…and Admin in the admin workspace", /^admin$/i.test(label2.trim()), label2);
	// The public site's Home goes to the public homepage, not the dashboard.
	await page.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
	const homes = await page.locator("a[href='/?site']").count();
	check("Home on the public pages keeps a signed-in person on the homepage", homes >= 1, `links=${homes}`);
} catch (e) {
	check("Suite welcome", false, String(e).slice(0, 300));
} finally {
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
