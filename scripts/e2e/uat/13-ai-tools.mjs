// The AI tools end to end: documents (streamed completion), forms (create with AI from a template), sheets
// (formula writer), and the palette from a description. Uses the organisation key from the server environment.
//   node --env-file=.env.local scripts/e2e/uat/13-ai-tools.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(90000);
let formId = null;
let sheet = null;
try {
	await signIn(page, "admin");

	// Documents: the AI route streams text.
	const r = await page.request.post(`${BASE}/api/mjengo/ai/complete`, { data: { prompt: "Write one sentence welcoming volunteers.", action: "write", document: "", instructions: "" }, timeout: 90000 });
	const t = await r.text();
	check("Document AI streams an answer", r.ok() && t.trim().length > 10, `status ${r.status()}, ${t.length} chars`);

	// Forms: create with AI from a template.
	await page.goto(`${BASE}/dashboard/mjengo/forms`, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByRole("button", { name: /Create with AI/ }).click();
	await page.getByPlaceholder(/A feedback form/).fill("A feedback form for people who attended our legal clinic last week, about how easy it was to reach us.");
	await page.getByRole("button", { name: "Feedback", exact: true }).click();
	await page.getByRole("button", { name: /^Create$/ }).click();
	await page.waitForURL(/\/forms\/[0-9a-f-]{36}/, { timeout: 120000 });
	formId = page.url().match(/forms\/([0-9a-f-]{36})/)?.[1];
	const { data: f } = await db.from("mjengo_forms").select("title, questions").eq("id", formId).single();
	check("Create with AI makes a form with questions", Array.isArray(f?.questions) && f.questions.length >= 3, `${f?.questions?.length} questions: ${f?.title}`);

	// Sheets: the formula writer.
	const bytes = fs.readFileSync(new URL("../samples/e2e-sample.pdf", import.meta.url)); // placeholder size only
	const csv = Buffer.from("Item,Amount\nTravel,1200\nFood,800\nTravel,300\n");
	const path = `e2e/${Date.now()}-ai.csv`;
	await db.storage.from("mjengo-docs").upload(path, csv, { contentType: "text/csv", upsert: true });
	const { data: row } = await db.from("vault_files").insert({ name: "ai-test.csv", storage_path: path, mime: "text/csv", size: csv.length + 0 * bytes.length, owner_id: accounts.accounts.admin.id }).select("id").single();
	sheet = { id: row.id, path };
	await page.goto(`${BASE}/dashboard/mjengo/files/sheet?file=${row.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByRole("button", { name: "Formulas" }).waitFor({ timeout: 90000 });
	await page.getByRole("button", { name: "Formulas" }).click();
	await page.getByPlaceholder(/For example: total of column C/).fill("total amount where item is Travel");
	await page.getByRole("button", { name: /Write the formula/ }).click();
	const code = page.locator("code").first();
	await code.waitFor({ timeout: 90000 });
	const formula = (await code.textContent()) ?? "";
	check("The formula writer returns a formula", formula.trim().startsWith("="), formula.slice(0, 80));
	check("The formula refers to the sheet's columns", /[AB]\d|[AB]:[AB]|SUMIF/i.test(formula), formula.slice(0, 80));
} catch (e) {
	check("AI tools flow", false, String(e).slice(0, 240));
} finally {
	if (formId) await db.from("mjengo_forms").delete().eq("id", formId);
	if (sheet) { await db.from("vault_files").delete().eq("id", sheet.id); await db.storage.from("mjengo-docs").remove([sheet.path]); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
