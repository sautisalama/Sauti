// Quick look at what a signed-in admin sees on a few suite pages (no assertions).
import { BASE, launch, newPage, signIn } from "./lib.mjs";

const browser = await launch();
const page = await newPage(browser);
await signIn(page, "admin");
for (const path of process.argv.slice(2)) {
	await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.waitForTimeout(4000);
	console.log(path, "->", page.url().replace(BASE, ""), "|", (await page.locator("h1, h2").first().textContent().catch(() => ""))?.trim().slice(0, 80));
}
await browser.close();
