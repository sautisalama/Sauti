// Documents: highlight text and let the AI rewrite it; continue writing; a skill that is switched on is applied.
//   node --env-file=.env.local scripts/e2e/uat/27-docs-ai.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const bytes = fs.readFileSync(new URL("../samples/e2e-sample.docx", import.meta.url));
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(120000);
await page.setViewportSize({ width: 1500, height: 1000 });
let file = null;
try {
	const path = `e2e/${Date.now()}-docs-ai.docx`;
	await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
	const { data: row } = await db.from("vault_files").insert({ name: "AI test.docx", storage_path: path, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: bytes.length, owner_id: accounts.accounts.admin.id }).select("id").single();
	file = { id: row.id, path };

	const asked = [];
	page.on("request", (r) => { if (r.url().includes("/api/mjengo/ai/complete")) { try { asked.push(JSON.parse(r.postData() ?? "{}")); } catch { /* not json */ } } });
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/documents/editor?file=${file.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByRole("button", { name: /^File/ }).first().waitFor({ timeout: 90000 });
	await page.locator(".wcai button").first().waitFor({ timeout: 120000 });
	await page.waitForTimeout(4000);

	// Highlight a paragraph: triple-click in the page.
	const target = page.getByText("Quarterly community response summary").first();
	await target.waitFor({ timeout: 60000 }).catch(() => undefined);
	const box = await target.boundingBox().catch(() => null);
	const pt = box ? { x: box.x + 40, y: box.y + box.height / 2 } : { x: 700, y: 485 };
	await page.mouse.click(pt.x, pt.y);
	await page.keyboard.press("Home");
	await page.keyboard.press("Shift+End");
	await page.waitForTimeout(600);
	await page.locator(".wcai button").first().click();
	await page.waitForTimeout(800);
	const chips = (await page.locator(".wcai").first().innerText()).replace(/\s+/g, " ");
	console.log("  [chips]", chips.slice(0, 200));
	await page.screenshot({ path: `${process.env.TEMP}/ai-2.png` });
	const rewrite = page.getByRole("button", { name: /^Rewrite/ }).first();
	check("Rewrite is offered for highlighted text", (await rewrite.count()) > 0, chips.slice(0, 120));
	await rewrite.click();
	await page.getByText(/Suggestion for the selected text/).waitFor({ timeout: 120000 });
	await page.getByRole("button", { name: "Replace", exact: true }).waitFor({ timeout: 120000 });
	check("The AI answers with a suggestion for the selection", true);
	const suggestion = ((await page.locator(".wcai-result-text").first().innerText()) ?? "").trim();
	await page.getByRole("button", { name: "Replace", exact: true }).click();
	await page.waitForTimeout(1200);
	const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
	await page.screenshot({ path: `${process.env.TEMP}/ai-3.png` });
	check("Replace swaps the highlighted text for the suggestion", suggestion.length > 10 && !body.includes("prepared for the e2e suite.") , suggestion.slice(0, 60));
	check("The skill that is on is sent with the request", asked.length > 0 && String(asked[0].instructions ?? "").length > 20, String(asked[0]?.instructions ?? "").slice(0, 80));

	// Continue writing with nothing highlighted.
	await page.keyboard.press("Control+End");
	await page.locator(".wcai button").first().click();
	await page.getByRole("button", { name: /^Continue writing/ }).first().click();
	await page.getByRole("button", { name: "Insert", exact: true }).waitFor({ timeout: 120000 });
	check("Continue writing gives text to insert", true);
} catch (e) {
	check("Docs AI flow", false, String(e).slice(0, 300));
} finally {
	if (file) { await db.from("vault_files").delete().eq("id", file.id); await db.storage.from("mjengo-docs").remove([file.path]); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
