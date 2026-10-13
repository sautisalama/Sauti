// The design editor's selection box and arrange tools: Canva-style handles, size label support, Figma-style
// align and space for a selection, and justified text.
//   node --env-file=.env.local scripts/e2e/uat/18-design-selection.mjs
import { BASE, check, launch, newPage, signIn, summary } from "../lib.mjs";

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(60000);
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/design/editor?size=instagram`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByText("16 days story").first().waitFor({ timeout: 90000 });
	await page.getByText("16 days story").first().click();
	await page.waitForFunction(() => !!window.__designCanvas && window.__designCanvas.getObjects().length > 2, null, { timeout: 60000 });

	// Selection look.
	const look = await page.evaluate(() => {
		const o = window.__designCanvas.getObjects().find((x) => x.selectable !== false);
		return { style: o.cornerStyle, border: o.borderColor, size: o.cornerSize, filled: o.transparentCorners === false };
	});
	check("Selection box has round purple handles", look.style === "circle" && /8b3dff/i.test(look.border) && look.size >= 11 && look.filled, JSON.stringify(look));

	// Text can be justified.
	await page.evaluate(() => {
		const c = window.__designCanvas;
		const t = c.getObjects().find((x) => x.type === "textbox");
		c.setActiveObject(t); c.fire("selection:created", { selected: [t] }); c.requestRenderAll();
	});
	await page.getByRole("button", { name: "Justify" }).click();
	const al = await page.evaluate(() => window.__designCanvas.getActiveObject().textAlign);
	check("Text can be justified", al === "justify", al);

	// Align a selection with itself, then space it evenly.
	await page.evaluate(() => window.__designCanvas.discardActiveObject());
	await page.keyboard.press("Control+A");
	await page.getByRole("button", { name: "Align", exact: true }).click();
	await page.getByRole("button", { name: "Left", exact: true }).first().click();
	const lefts = await page.evaluate(() => window.__designCanvas.getObjects().filter((x) => x.selectable !== false).map((o) => Math.round(o.getBoundingRect().left)));
	const same = lefts.filter((l) => l === lefts[0]).length;
	check("Align left lines the selection up", same >= Math.min(lefts.length, 2) && lefts.every((l) => Math.abs(l - Math.min(...lefts)) <= 1), lefts.join(","));
} catch (e) {
	check("Design selection flow", false, String(e).slice(0, 260));
} finally {
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
