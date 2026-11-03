// Editing a publication: bold and images stay put while the draft saves itself.
//   node --env-file=.env.local scripts/e2e/uat/43-publication-editing.mjs
import { BASE, check, launch, newPage, signIn, summary } from "../lib.mjs";

const browser = await launch();
const page = await newPage(browser, {});
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/admin/publications/new`, { waitUntil: "domcontentloaded" });
	await page.getByPlaceholder("A clear, specific title").fill("E2E editing " + Date.now());
	const ed = page.locator("[aria-label='Article body']");
	await ed.waitFor({ timeout: 60000 });
	await ed.click();
	await page.keyboard.type("Hello brave world");
	await page.keyboard.press("Control+A");
	await page.getByRole("button", { name: /^Bold/ }).click();
	await ed.evaluate((el) => { el.dataset.probe = "1"; window.__scroll = window.scrollY; });
	// Let the draft save itself (2.5s after the last change) and the page settle.
	await page.waitForTimeout(6000);
	const same = await page.locator("[aria-label='Article body'][data-probe='1']").count();
	check("The editor is not rebuilt by the save", same === 1);
	const sel = await page.evaluate(() => (document.getSelection()?.toString() ?? "").length);
	check("The selection is kept through the save", sel > 0, `selected=${sel}`);
	const bold = await ed.locator("strong").count();
	check("Bold survives the automatic save", bold >= 1, `strong=${bold}`);
	const url = page.url();
	check("The URL moved to the saved draft", /publications\/[0-9a-f-]{20,}/.test(url), url);
	// Open the saved draft again and edit it: this is where a refresh of the page would show.
	await page.goto(url, { waitUntil: "domcontentloaded" });
	await ed.waitFor({ timeout: 60000 });
	await ed.click();
	await page.keyboard.press("Control+A");
	await page.getByRole("button", { name: /^Italic/ }).click();
	await ed.evaluate((el) => { el.dataset.probe2 = "1"; });
	await page.waitForTimeout(6000);
	check("Editing a saved draft: editor kept through the save", (await page.locator("[aria-label='Article body'][data-probe2='1']").count()) === 1);
	check("Editing a saved draft: selection kept", (await page.evaluate(() => (document.getSelection()?.toString() ?? "").length)) > 0);
	// Typing right after a save still lands in the editor.
	await page.keyboard.press("End");
	await page.keyboard.type(" again");
	await page.waitForTimeout(500);
	check("Typing after the save still works", /again/.test(await ed.innerText()));
	// Image from a link, then wait through another save.
	await page.getByRole("button", { name: "Insert image from link" }).or(page.getByRole("button", { name: "Insert image" })).first().click();
	await page.getByPlaceholder("https://").fill("https://www.sautisalama.org/favicon.ico");
	await page.getByRole("button", { name: /^Insert$/ }).click();
	await page.waitForTimeout(6000);
	check("The image stays after the next save", (await ed.locator("img").count()) === 1);
} catch (e) {
	check("Publication editing", false, String(e).slice(0, 300));
} finally {
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
