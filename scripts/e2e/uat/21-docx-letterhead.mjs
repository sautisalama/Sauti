// A Word document gets the organisation letterhead from the brand: open the editor on a .docx, open AI Studio,
// the Letterhead page already carries the organisation, apply it, save, and check the saved file's header.
//   node --env-file=.env.local scripts/e2e/uat/21-docx-letterhead.mjs
import fs from "node:fs";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const bytes = fs.readFileSync(new URL("../samples/e2e-sample.docx", import.meta.url));
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(90000);
await page.setViewportSize({ width: 1500, height: 1000 });
let file = null;
try {
	const path = `e2e/${Date.now()}-letterhead.docx`;
	await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
	const { data: row } = await db.from("vault_files").insert({ name: "Letterhead test.docx", storage_path: path, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: bytes.length, owner_id: accounts.accounts.admin.id }).select("id").single();
	file = { id: row.id, path };

	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/documents/editor?file=${file.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByRole("button", { name: /^File/ }).first().waitFor({ timeout: 90000 });
	// AI Studio: the launcher opens the bar, "AI Studio" the studio, and its Letterhead page starts filled in.
	await page.locator(".wcai-launch").first().waitFor({ timeout: 120000 });
	await page.waitForTimeout(3000);
	await page.locator(".wcai-launch").first().click();
	await page.getByRole("button", { name: "AI Studio" }).first().click();
	await page.getByText("Letterhead", { exact: true }).first().click();
	const name = await page.locator(".wcai-form input").first().inputValue();
	check("The letterhead starts from the organisation brand", name.trim().length > 0, JSON.stringify(name));
	await page.getByRole("button", { name: "Apply to document" }).click();
	await page.getByText(/Letterhead added to the document/).waitFor({ timeout: 20000 });
	check("The letterhead is applied", true);
	await page.getByRole("button", { name: /^Save/ }).first().click().catch(async () => { await page.keyboard.press("Control+s"); });
	await page.waitForTimeout(8000);
	const { data: blob } = await db.storage.from("mjengo-docs").download(path);
	const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
	const headers = await Promise.all(Object.keys(zip.files).filter((f) => /^word\/header\d*\.xml$/.test(f)).map((f) => zip.file(f).async("string")));
	check("The saved file's header carries the organisation name", headers.some((h) => h.includes(name.trim())), `${headers.length} headers`);
} catch (e) {
	check("Docx letterhead flow", false, String(e).slice(0, 300));
} finally {
	if (file) { await db.from("vault_files").delete().eq("id", file.id); await db.storage.from("mjengo-docs").remove([file.path]); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
