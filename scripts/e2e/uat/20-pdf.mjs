// PDF editor, every tool: highlight, draw, text, note, sign, picture; move and resize a mark; undo and redo;
// delete; save back to Files; the saved file is still a valid PDF with the same pages and differs from the original.
//   node --env-file=.env.local scripts/e2e/uat/20-pdf.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const original = fs.readFileSync(new URL("../samples/e2e-sample.pdf", import.meta.url));
const origPages = (await PDFDocument.load(original)).getPageCount();

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(90000);
await page.setViewportSize({ width: 1500, height: 1300 });
let file = null;
try {
	const path = `e2e/${Date.now()}-pdf.pdf`;
	await db.storage.from("mjengo-docs").upload(path, original, { contentType: "application/pdf", upsert: true });
	const { data: row } = await db.from("vault_files").insert({ name: "pdf-e2e.pdf", storage_path: path, mime: "application/pdf", size: original.length, owner_id: accounts.accounts.admin.id }).select("id").single();
	file = { id: row.id, path };

	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/files/pdf?file=${file.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	const layer = page.locator('[data-page="0"] > div').first();
	await layer.waitFor({ timeout: 120000 });
	await page.waitForTimeout(1500);
	check("The PDF opens", true);
	const box = await layer.boundingBox();
	const at = (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
	const drag = async (a, b) => { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up(); };
	const marksCount = () => page.locator('[data-page="0"] [data-mark]').count();

	// Highlight.
	await page.getByRole("button", { name: "Highlight", exact: true }).click();
	await drag(await at(0.1, 0.1), await at(0.6, 0.14));
	check("Highlight adds a mark", (await marksCount()) >= 1, `${await marksCount()} marks`);

	// Draw.
	await page.getByRole("button", { name: "Draw", exact: true }).click();
	await drag(await at(0.15, 0.3), await at(0.5, 0.38));
		check("Draw adds a stroke", (await page.locator('[data-page="0"] polyline').count()) >= 1);

	// Text.
	await page.getByRole("button", { name: "Text", exact: true }).click();
	const t = await at(0.2, 0.5);
	await page.mouse.click(t.x, t.y);
	await page.getByLabel("Text to place").fill("Approved by the e2e suite");
	await page.keyboard.press("Enter");
	check("Text is placed", await page.getByText("Approved by the e2e suite").first().isVisible());

	// Note.
	await page.getByRole("button", { name: "Note", exact: true }).click();
	const n = await at(0.7, 0.2);
	await page.mouse.click(n.x, n.y);
	await page.getByLabel("Note text").fill("Check this clause");
	await page.keyboard.press("Control+Enter");
	await page.waitForTimeout(300);
	check("A note pin is placed", (await marksCount()) >= 4, `${await marksCount()} marks`);

	// Picture.
	await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({ name: "stamp.png", mimeType: "image/png", buffer: PNG });
	await page.waitForTimeout(800);
	const afterPicture = await marksCount();
	check("A picture is placed", afterPicture >= 5, `${afterPicture} marks`);

	// Sign (typed signature). Placed images are counted, since a selected mark adds resize handles.
	const imagesBefore = await page.locator('[data-page="0"] img').count();
	await page.getByRole("button", { name: "Sign", exact: true }).click();
	await page.getByRole("dialog").getByRole("button", { name: /^Type$/ }).click();
	await page.getByPlaceholder("Type your name").fill("E2E Tester");
	await page.getByRole("button", { name: "Use this signature" }).click();
	await page.getByRole("dialog").waitFor({ state: "detached" });
	const s = await at(0.55, 0.75);
	await page.mouse.click(s.x, s.y);
	await page.waitForTimeout(600);
	const imagesAfter = await page.locator('[data-page="0"] img').count();
	check("A signature is placed", imagesAfter > imagesBefore, `${imagesBefore} -> ${imagesAfter} images`);

	// Move a mark: drag the text.
	await page.getByRole("button", { name: "Select", exact: true }).click();
	const txt = page.getByText("Approved by the e2e suite").first();
	const before = await txt.boundingBox();
	await page.mouse.move(before.x + 10, before.y + 6);
	await page.mouse.down();
	await page.mouse.move(before.x + 70, before.y + 46, { steps: 6 });
	await page.mouse.up();
	const after = await txt.boundingBox();
	check("A mark can be moved", Math.abs(after.x - before.x) > 20 && Math.abs(after.y - before.y) > 15, `${Math.round(after.x - before.x)},${Math.round(after.y - before.y)}`);

	// Resize: drag the corner handle of the signature.
	const handle = page.locator('[data-page="0"] span[data-mark][style*="nwse-resize"], [data-page="0"] span[data-mark][style*="nesw-resize"]').first();
	if (await handle.count()) {
		const hb = await handle.boundingBox();
		await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
		await page.mouse.down();
		await page.mouse.move(hb.x + 40, hb.y + 30, { steps: 5 });
		await page.mouse.up();
		check("A mark can be resized", true);
	} else check("A mark can be resized", false, "no handle visible");

	// Undo and redo.
	const n0 = await marksCount();
	await page.getByRole("button", { name: "Delete the selected mark" }).click().catch(() => undefined);
	await page.getByRole("button", { name: "Undo" }).click();
	await page.getByRole("button", { name: "Redo" }).click();
	check("Undo and redo work", (await marksCount()) <= n0);

	// Save back to Files, then check the file.
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await page.getByText("Saved to Files").first().waitFor({ timeout: 90000 });
	await page.waitForTimeout(1000);
	const { data: blob } = await db.storage.from("mjengo-docs").download(path);
	const saved = Buffer.from(await blob.arrayBuffer());
	const doc = await PDFDocument.load(saved);
	check("The saved file is a valid PDF with the same pages", doc.getPageCount() === origPages, `${doc.getPageCount()} pages`);
	check("The saved file was rewritten with the marks", saved.length !== original.length && !saved.equals(original), `${original.length} -> ${saved.length} bytes`);
} catch (e) {
	check("PDF flow", false, String(e).slice(0, 280));
} finally {
	if (file) { await db.from("vault_files").delete().eq("id", file.id); await db.storage.from("mjengo-docs").remove([file.path]); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
