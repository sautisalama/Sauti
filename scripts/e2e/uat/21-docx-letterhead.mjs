// WIP, paused: the editor was still on "Starting the editor" after 150 s in the last run (see the upload-tray snapshot fix just before it), so the letterhead steps were never reached.
// A Word document gets the organisation letterhead from the brand: open the editor on a .docx, open AI Studio,
// apply the letterhead, save, and check that the saved file's header carries the organisation name.
//   node --env-file=.env.local scripts/e2e/uat/21-docx-letterhead.mjs
import fs from "node:fs";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const SHOTS = process.env.SHOTS || "";
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png` }); };
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

	page.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log("  [console]", m.text().slice(0, 200)); });
	page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 200)));
	page.on("requestfailed", (r) => console.log("  [reqfailed]", r.url().slice(0, 120)));
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/documents/editor?file=${file.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByRole("button", { name: /^File/ }).first().waitFor({ timeout: 90000 });
	await page.getByText("Clipboard", { exact: true }).waitFor({ timeout: 150000 });
	await page.waitForTimeout(1500);
	await shot(page, "1-open");
	await page.mouse.click(878, 936);
	await page.waitForTimeout(700);
	await shot(page, "1b-bar");
	await page.mouse.click(563, 916);
	await page.waitForTimeout(800);
	await shot(page, "2-studio");
	await page.getByText("Letterhead", { exact: true }).first().click();
	await page.waitForTimeout(800);
	await shot(page, "3-letterhead");
} catch (e) {
	check("Docx letterhead flow", false, String(e).slice(0, 300));
} finally {
	if (file) { await db.from("vault_files").delete().eq("id", file.id); await db.storage.from("mjengo-docs").remove([file.path]); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
