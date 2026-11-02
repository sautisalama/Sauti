import fs from "node:fs";
import path from "node:path";
import { BASE, launch, newPage, signIn, check, summary } from "./lib.mjs";

const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();

for (const role of ["survivor", "professional", "admin"]) {
	const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
	await signIn(page, role);
	await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.waitForTimeout(3500);
	// Force dark via the stored choice, reload, and make sure the class is there before paint settles.
	await page.evaluate(() => localStorage.setItem("ss_theme", "dark"));
	await page.reload({ waitUntil: "domcontentloaded" });
	const early = await page.evaluate(() => document.documentElement.classList.contains("dark"));
	await page.waitForTimeout(3500);
	check(`${role}: dark class set on first paint after reload`, early);
	const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	const m = bg.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
	check(`${role}: body background is dark (${bg})`, m[0] < 80 && m[1] < 80 && m[2] < 80);
	await page.screenshot({ path: path.join(OUT, `dark_${role}_dashboard.png`) });

	if (role === "professional") {
		for (const p of ["cases", "mjengo"]) {
			await page.goto(BASE + "/dashboard/" + p, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
			await page.waitForTimeout(3500);
			await page.screenshot({ path: path.join(OUT, `dark_${role}_${p}.png`) });
		}
		await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
		await page.waitForTimeout(3000);
		const sw = page.getByRole("switch", { name: /taking new cases/i }).first();
		if (await sw.count()) {
			const before = await sw.getAttribute("aria-checked");
			await sw.click();
			await page.waitForTimeout(2500);
			const after = await sw.getAttribute("aria-checked");
			check("professional: availability switch flips optimistically", before !== after, `${before} -> ${after}`);
			await page.waitForFunction(() => !document.querySelector('[role=switch][aria-label="Taking new cases"]')?.hasAttribute("disabled"));
			await sw.click();
			await page.waitForTimeout(2500);
			check("professional: availability restored", (await sw.getAttribute("aria-checked")) === before);
		} else check("professional: availability switch present", false);
	}
	if (role === "admin") {
		for (const p of ["mjengo", "mjengo/opportunities", "mjengo/mail"]) {
			await page.goto(BASE + "/dashboard/" + p, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
			await page.waitForFunction(() => !document.body.innerText.includes("Opening your mail") && !/Loading$/m.test(document.body.innerText.trim()), null, { timeout: 90000 }).catch(() => {});
			await page.waitForTimeout(3500);
			await page.screenshot({ path: path.join(OUT, `dark_admin_${p.replace(/\//g, "_")}.png`) });
		}
	}
	// Public pages must stay light.
	await page.goto(BASE + "/report-abuse", { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(1500);
	check(`${role}: public pages stay light`, !(await page.evaluate(() => document.documentElement.classList.contains("dark"))));
	await page.evaluate(() => localStorage.removeItem("ss_theme"));
	await page.close();
}
await browser.close();
summary();
