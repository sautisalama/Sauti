// PDF comments: pin one on the page, reply to it, resolve it; the threads are kept on the server per file.
//   node --env-file=.env.local scripts/e2e/uat/22-pdf-comments.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const original = fs.readFileSync(new URL("../samples/e2e-sample.pdf", import.meta.url));
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(90000);
await page.setViewportSize({ width: 1500, height: 1100 });
let file = null;
try {
	const path = `e2e/${Date.now()}-pdf-comments.pdf`;
	await db.storage.from("mjengo-docs").upload(path, original, { contentType: "application/pdf", upsert: true });
	const { data: row } = await db.from("vault_files").insert({ name: "pdf-comments-e2e.pdf", storage_path: path, mime: "application/pdf", size: original.length, owner_id: accounts.accounts.admin.id }).select("id").single();
	file = { id: row.id, path };

	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/files/pdf?file=${file.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	const layer = page.locator('[data-page="0"] > div').first();
	await layer.waitFor({ timeout: 120000 });
	await page.waitForTimeout(1500);

	await page.getByRole("button", { name: "Comments", exact: true }).click();
	const box = await layer.boundingBox();
	await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.3);
	await page.getByLabel("Comment text").fill("Please check this figure");
	await page.getByRole("button", { name: "Comment", exact: true }).click();
	await page.getByRole("button", { name: /^Comment 1 by/ }).waitFor();
	const { data: rows } = await db.from("mjengo_pdf_comments").select("id, body, page, x, y, resolved").eq("file_id", file.id);
	check("A comment is saved on the file", rows?.length === 1 && rows[0].body === "Please check this figure" && Math.abs(rows[0].x - 0.4) < 0.03, JSON.stringify(rows));
	check("The pin shows on the page", (await page.getByRole("button", { name: /^Comment 1 by/ }).count()) === 1);

	// Reply: open the thread, answer.
	await page.getByText("Please check this figure").first().click();
	await page.getByPlaceholder("Reply").fill("Checked, it is right");
	await page.keyboard.press("Enter");
	await page.getByText("Checked, it is right").first().waitFor();
	await page.waitForTimeout(500);
	const { count } = await db.from("mjengo_pdf_comments").select("id", { count: "exact", head: true }).eq("file_id", file.id);
	check("A reply is kept in the thread", count === 2, String(count));

	// Resolve.
	await page.getByRole("button", { name: /Resolve/ }).click();
	let resolved = false;
	for (let i = 0; i < 30 && !resolved; i++) {
		await page.waitForTimeout(1000);
		const { data: after } = await db.from("mjengo_pdf_comments").select("resolved").eq("file_id", file.id).is("parent_id", null).single();
		resolved = after?.resolved === true;
	}
	check("A thread can be resolved", resolved);
} catch (e) {
	check("PDF comments flow", false, String(e).slice(0, 280));
} finally {
	if (file) { await db.from("vault_files").delete().eq("id", file.id); await db.storage.from("mjengo-docs").remove([file.path]); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
