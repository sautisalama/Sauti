// Document comments: highlighting text and pressing the comment button opens the drawer with a composer (no
// empty comment is made), the comment is saved with its text, it fits the drawer without sideways scrolling,
// and Edit and Delete work. The Help me write sparkle is visible without opening anything.
//   node --env-file=.env.local scripts/e2e/uat/31-docs-comments.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const bytes = fs.readFileSync(new URL("../samples/e2e-sample.docx", import.meta.url));
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(30000);
await page.setViewportSize({ width: 1500, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
let file = null;
try {
	const path = `e2e/${Date.now()}-comments.docx`;
	await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
	const { data: row } = await db.from("vault_files").insert({ name: "Comments test.docx", storage_path: path, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: bytes.length, owner_id: accounts.accounts.admin.id }).select("id").single();
	file = { id: row.id, path };

	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/documents/editor?file=${file.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.locator(".wcai-launch").first().waitFor({ timeout: 120000 });
	await page.waitForTimeout(3000);

	// The sparkle is there from the start, without opening Ask.
	const sparkle = await page.locator(".wcai-launch svg").first().boundingBox();
	check("The Help me write sparkle is visible from the start", !!sparkle && sparkle.width > 8 && sparkle.height > 8);

	// Highlight a line, then use the selection toolbar's comment button.
	const line = page.getByText("Quarterly community response summary").first();
	await line.waitFor({ timeout: 30000 });
	const b = await line.boundingBox();
	await page.mouse.click(b.x + 30, b.y + b.height / 2);
	await page.keyboard.press("Home");
	await page.keyboard.press("Shift+End");
	await page.waitForTimeout(600);
	await page.mouse.click(767, 442); // the comment button on the selection toolbar
	await page.locator(".wccm textarea").first().waitFor({ timeout: 15000 });
	check("The drawer opens with a composer on the selection", true);
	const openBefore = await page.locator(".wccm-list > *").count();
	check("No empty comment was made", openBefore === 0, `${openBefore} threads`);

	await page.locator(".wccm textarea").first().fill("Please check this figure with the clinic, the partner asked about it twice last month and we should confirm the number.");
	await page.getByRole("button", { name: "Comment", exact: true }).click();
	await page.getByText("Please check this figure").first().waitFor({ timeout: 15000 });
	check("The comment is saved with its text", true);

	const fit = await page.evaluate(() => { const l = document.querySelector(".wccm-list"); const p = document.querySelector(".wccm"); return { list: [l?.scrollWidth, l?.clientWidth], panel: [p?.scrollWidth, p?.clientWidth] }; });
	check("The drawer has no sideways scrolling", fit.list[0] <= fit.list[1] + 1 && fit.panel[0] <= fit.panel[1] + 1, JSON.stringify(fit));

	// Actions: edit, then delete.
	await page.locator(".wccm-list button").filter({ hasText: /^Edit$/ }).first().click({ force: true });
	const edit = page.locator(".wccm textarea").first();
	await edit.fill("Please check this figure with the clinic today");
	await page.getByRole("button", { name: /^Save$/ }).first().click();
	await page.getByText("with the clinic today").first().waitFor({ timeout: 10000 });
	check("A comment can be edited", true);
	await page.locator(".wccm-list button").filter({ hasText: /^Delete$/ }).first().click({ force: true });
	await page.waitForTimeout(800);
	const left = await page.locator(".wccm-list").getByText("with the clinic today").count();
	check("A comment can be deleted", left === 0);
	check("No page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
	check("Comments flow", false, String(e).slice(0, 300));
	await page.screenshot({ path: `${process.env.TEMP}/comments-fail.png` }).catch(() => undefined);
} finally {
	if (file) { await db.storage.from("mjengo-docs").remove([file.path]); await db.from("vault_files").delete().eq("id", file.id); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
