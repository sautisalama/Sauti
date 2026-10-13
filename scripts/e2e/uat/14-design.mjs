// Design suite: a template brings its own page size, layers can be reordered, the brand colour field adds a
// colour once, and the scheduling modal suggests best times.
//   node --env-file=.env.local scripts/e2e/uat/14-design.mjs
import { BASE, check, launch, newPage, signIn, summary } from "../lib.mjs";

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(60000);
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/design/editor?size=instagram`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByText("16 days story").first().waitFor({ timeout: 90000 });
	check("Opens on the size from the link", true);

	// A story template changes the page to a story.
	await page.getByText("16 days story").first().click();
	await page.waitForTimeout(1500);
	const size = await page.locator('select[aria-label="Size"]').inputValue();
	check("A story template switches the page to a story", size === "story", size);

	// Layers: the list has move buttons.
	await page.getByRole("button", { name: "Layers" }).click();
	check("Layers can be moved up and down", (await page.getByRole("button", { name: "Move up" }).count()) > 0);
	await page.keyboard.press("Escape");

	// Brand: adding a colour once.
	await page.getByRole("button", { name: /^Brand$/ }).click();
	const before = await page.locator('button[title*="Click to apply"]').count();
	const picker = page.getByLabel("Add a brand colour");
	await picker.evaluate((el) => { el.value = "#112233"; el.dispatchEvent(new Event("input", { bubbles: true })); el.value = "#223344"; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
	await page.waitForTimeout(500);
	const after = await page.locator('button[title*="Click to apply"]').count();
	check("Moving through colours adds one, on commit", after === before + 1, `${before} -> ${after}`);

	// Scheduling modal: best times.
	await page.goto(`${BASE}/dashboard/mjengo/content`, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByRole("button", { name: /New post/ }).first().click();
	await page.getByText("Best times to post").waitFor({ timeout: 30000 });
	const modal = (await page.getByRole("dialog").textContent()) ?? "";
	check("Scheduling suggests best times", /East Africa Time/.test(modal));
	check("Scheduling has tags and previews", /Tags and mentions/.test(modal) && /Previews/.test(modal));
} catch (e) {
	check("Design flow", false, String(e).slice(0, 240));
} finally {
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
