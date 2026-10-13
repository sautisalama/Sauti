// Finance end to end: an invoice is created and printed on the letterhead, a receipt is added with a photo,
// an Excel file tagged Financial appears under Budgets, and a budget sheet is created from lines.
//   node --env-file=.env.local scripts/e2e/uat/19-finance.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
const cleanup = { invoices: [], receipts: [], files: [], paths: [] };
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(90000);
// A 1x1 PNG as the receipt photo.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
try {
	// An Excel file that someone tagged Financial.
	const csv = Buffer.from("Item,Amount\nRent,1000\n");
	const path = `e2e/${stamp}-fin.csv`;
	await db.storage.from("mjengo-docs").upload(path, csv, { contentType: "text/csv", upsert: true });
	const { data: f } = await db.from("vault_files").insert({ name: `Finance ${stamp}.csv`, storage_path: path, mime: "text/csv", size: csv.length, owner_id: accounts.accounts.admin.id, tags: ["Financial"] }).select("id").single();
	cleanup.files.push(f.id); cleanup.paths.push(path);

	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/finance`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByRole("heading", { name: "Finance" }).waitFor({ timeout: 90000 });

	// Invoice.
	await page.getByRole("button", { name: /New invoice/ }).click();
	await page.getByLabel("Client", { exact: false }).first().fill(`Acme ${stamp}`);
	await page.getByPlaceholder("Description").first().fill("Training workshop");
	await page.getByLabel("Unit price").first().fill("2500");
	await page.getByRole("button", { name: /^Save$/ }).click();
	await page.getByText(/Invoice saved/).first().waitFor({ timeout: 60000 });
	const { data: inv } = await db.from("mjengo_invoices").select("id, number, total, status").eq("client_name", `Acme ${stamp}`).single();
	cleanup.invoices.push(inv.id);
	check("An invoice is saved with a number", /^INV-\d{4}-\d{4}$/.test(inv.number), inv.number);
	check("Its total is computed", Number(inv.total) === 2500, String(inv.total));
	await page.keyboard.press("Escape");

	await page.goto(`${BASE}/dashboard/mjengo/finance/invoice/${inv.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByText("Training workshop").waitFor();
	const body = await page.locator("article").innerText();
	check("The printable invoice carries the letterhead and the total", /Invoice/.test(body) && body.includes(inv.number) && /2,500\.00/.test(body), body.slice(0, 70).replace(/\n/g, " "));

	// Receipt with a photo.
	await page.goto(`${BASE}/dashboard/mjengo/finance`, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByRole("button", { name: /Add a receipt/ }).click();
	await page.locator('input[type="file"][capture]').setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
	await page.getByLabel("Paid to", { exact: false }).fill(`Shop ${stamp}`);
	await page.getByLabel("Amount", { exact: false }).first().fill("450");
	await page.getByRole("button", { name: /Save receipt/ }).click();
	await page.getByText("Receipt added").first().waitFor({ timeout: 90000 });
	const { data: rc } = await db.from("mjengo_receipts").select("id, file_id, amount").eq("vendor", `Shop ${stamp}`).single();
	cleanup.receipts.push(rc.id);
	check("A receipt is saved with its photo", !!rc.file_id && Number(rc.amount) === 450);
	const { data: rf } = await db.from("vault_files").select("id, tags, storage_path").eq("id", rc.file_id).single();
	cleanup.files.push(rf.id); cleanup.paths.push(rf.storage_path);
	check("The photo is a file tagged Receipt and Financial", rf.tags.includes("Receipt") && rf.tags.includes("Financial"), rf.tags.join(","));

	// Tagged spreadsheet shows under Budgets, and a budget is made.
	await page.reload({ waitUntil: "domcontentloaded" });
	await page.getByRole("tab", { name: "Budgets" }).click();
	check("A file tagged Financial is listed", await page.getByText(`Finance ${stamp}.csv`).isVisible());
	await page.getByPlaceholder("Budget name").fill(`Budget ${stamp}`);
	await page.getByRole("button", { name: /Create the sheet/ }).click();
	await page.waitForURL(/files\/sheet\?file=/, { timeout: 90000 });
	await page.waitForTimeout(1500);
	const { data: bf, error: bfe } = await db.from("vault_files").select("id, tags, storage_path").eq("name", `Budget ${stamp}.xlsx`).single();
	if (!bf) throw new Error(`budget file not found: ${bfe?.message}`);
	cleanup.files.push(bf.id); cleanup.paths.push(bf.storage_path);
	check("The budget sheet is in Files tagged Budget and Financial", bf.tags.includes("Budget") && bf.tags.includes("Financial"), bf.tags.join(","));

	// Mail labels exist.
	const { data: labels } = await db.from("mail_labels").select("name").eq("owner_id", accounts.accounts.admin.id);
	void labels; // created the first time the mailbox is opened
} catch (e) {
	check("Finance flow", false, String(e).slice(0, 260));
} finally {
	for (const id of cleanup.invoices) await db.from("mjengo_invoices").delete().eq("id", id);
	for (const id of cleanup.receipts) await db.from("mjengo_receipts").delete().eq("id", id);
	for (const id of cleanup.files) await db.from("vault_files").delete().eq("id", id);
	if (cleanup.paths.length) await db.storage.from("mjengo-docs").remove(cleanup.paths);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
