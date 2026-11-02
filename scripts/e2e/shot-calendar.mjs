import path from "node:path";
import { BASE, launch, newPage, signIn, check, summary } from "./lib.mjs";
const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
const browser = await launch();
for (const [role, dark] of [["professional", true], ["survivor", true], ["professional", false]]) {
	const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
	await signIn(page, role);
	await page.addInitScript((d) => localStorage.setItem("ss_theme", d ? "dark" : "light"), dark);
	await page.goto(BASE + "/dashboard/calendar", { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByRole("heading", { name: "Google Calendar" }).waitFor({ timeout: 60000 });
	await page.waitForFunction(() => !document.body.innerText.includes("Loading"), null, { timeout: 30000 }).catch(() => {});
	await page.waitForTimeout(1500);
	const chips = await page.locator("span.truncate").allInnerTexts();
	console.log(role, dark ? "dark" : "light", chips.join(" | "));
	check(`${role}: sessions appear in the grid`, chips.some((c) => /Session|Client session/.test(c)));
	if (role === "professional") check("professional: blocked time appears", chips.some((c) => /Blocked/.test(c)));
	else check("survivor: no blocked time of the provider", !chips.some((c) => /Blocked/.test(c)));
	if (role === "professional") check("professional: never sees survivor name", !(await page.locator("body").innerText()).includes("E2E-Survivor"));
	await page.screenshot({ path: path.join(OUT, `cal_${role}_${dark ? "dark" : "light"}.png`) });
	await page.close();
}
await browser.close();
summary();
