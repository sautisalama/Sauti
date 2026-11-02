import { BASE, launch, newPage, signIn } from "./lib.mjs";
import { db, acc } from "./helpers.mjs";
const { data } = await db.from("mjengo_opportunities").insert({ title: "E2E hover row", organisation: "Hover Org", status: "new", created_by: acc("admin").id, visibility: "team" }).select("id").single();
const browser = await launch();
const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
await signIn(page, "admin");
await page.addInitScript(() => localStorage.setItem("ss_theme", "dark"));
await page.goto(`${BASE}/dashboard/mjengo/opportunities`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.getByRole("button", { name: "List", exact: true }).click({ timeout: 90000 });
const row = page.locator("ul > li.group").filter({ hasText: "E2E hover row" }).first();
await row.waitFor({ timeout: 60000 });
const rows = {};
for (const sel of ["button", "a[title='Open the full page']"]) {
	await row.hover(); await page.waitForTimeout(400);
	rows[sel] = await row.locator(sel).first().evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, color: c.color, display: c.display }; });
}
console.log(JSON.stringify(rows, null, 1));
await row.screenshot({ path: "audit-out/hover_row.png" });
await page.getByRole("button", { name: "Board", exact: true }).click();
const card = page.locator("[role=button][draggable]").filter({ hasText: "E2E hover row" }).first();
await card.hover(); await page.waitForTimeout(400);
console.log("card", await card.evaluate((e) => getComputedStyle(e).backgroundColor));
await db.from("mjengo_opportunities").delete().eq("id", data.id);
await browser.close();
