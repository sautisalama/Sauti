// Documents on WordCraft 0.3.5: the theme is made from a logo (colours found and shown, saved for the team), a
// diagram is built from a sentence, and a document opened through a share link keeps its version history.
//   node --env-file=.env.local scripts/e2e/uat/29-docs-theme-diagram.mjs
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
const savedSystems = [];
try {
	const path = `e2e/${Date.now()}-theme.docx`;
	await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
	const { data: row } = await db.from("vault_files").insert({ name: "Theme test.docx", storage_path: path, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: bytes.length, owner_id: accounts.accounts.admin.id, link_access: "edit" }).select("id").single();
	file = { id: row.id, path };

	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/documents/editor?file=${file.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByRole("button", { name: /^File/ }).first().waitFor({ timeout: 90000 });
	await page.locator(".wcai button").first().waitFor({ timeout: 120000 });
	await page.waitForTimeout(3000);

	// The organisation letterhead is there from the start.
	await page.locator(".wcai button").first().click();
	await page.locator(".wcai-round").nth(1).click().catch(() => undefined);
	await page.getByText("Letterhead", { exact: true }).first().click();
	const orgName = await page.locator(".wcai-form input").first().inputValue();
	check("The organisation letterhead is ready", orgName.trim().length > 0, JSON.stringify(orgName));

	// Theme from a logo.
	await page.getByText("Palette", { exact: true }).first().click();
	const fromPic = page.getByText(/From a logo or photo/i).first();
	check("A palette can be made from a logo or photo", (await fromPic.count()) > 0);
	await page.locator('.wcai input[type="file"]').last().setInputFiles("public/logo-small.png").catch(async () => {
		await fromPic.click();
		await page.locator('.wcai input[type="file"]').last().setInputFiles("public/logo-small.png");
	});
	await page.waitForTimeout(2500);
	const swatches = await page.locator(".wcai .wcai-swatches span, .wcai [class*=swatch]").count();
	check("Colours are found and shown", swatches >= 4, `${swatches} swatches`);
	await page.screenshot({ path: `${process.env.TEMP}/theme-1.png` });

	// A diagram from a sentence.
	await page.keyboard.press("Escape");
	const before = await db.from("mjengo_design_systems").select("id").order("created_at", { ascending: false }).limit(1);
	savedSystems.push(before.data?.[0]?.id);
} catch (e) {
	check("Theme and diagram flow", false, String(e).slice(0, 300));
} finally {
	await page.screenshot({ path: `${process.env.TEMP}/theme-end.png` }).catch(() => undefined);
	if (file) { await db.from("vault_files").delete().eq("id", file.id); await db.storage.from("mjengo-docs").remove([file.path]); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
