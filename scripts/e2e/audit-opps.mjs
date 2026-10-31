import fs from "node:fs";
import path from "node:path";
import { BASE, launch, newPage, signIn } from "./lib.mjs";
const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
await signIn(page, "admin");
const go = async (p, n, wait = 4500) => { await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(wait); await page.screenshot({ path: path.join(OUT, `opp_${n}.png`) }); console.log(n, new URL(page.url()).pathname); };
await go("/dashboard/mjengo", "01_suite_home");
await go("/dashboard/mjengo/opportunities", "02_board");
const card = page.locator("[draggable=true]").first();
if (await card.count()) { await card.click(); await page.waitForTimeout(2500); await page.screenshot({ path: path.join(OUT, "opp_03_editor.png") }); console.log("editor"); }
else console.log("no cards");
await page.keyboard.press("Escape");
await page.emulateMedia({ colorScheme: "dark" });
await go("/dashboard/mjengo/opportunities", "04_board_dark");
await browser.close();
