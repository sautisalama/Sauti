import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, launch, newPage, signIn } from "../lib.mjs";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const bytes = fs.readFileSync(new URL("../samples/e2e-sample.docx", import.meta.url));
const path = `e2e/${Date.now()}-peek.docx`;
await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
const { data: row } = await db.from("vault_files").insert({ name: "peek.docx", storage_path: path, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: bytes.length, owner_id: accounts.accounts.admin.id }).select("id").single();
const browser = await launch(); const page = await newPage(browser); page.setDefaultTimeout(60000);
page.on("console", (m) => { if (m.type() === "error") console.log("  [err]", m.text().slice(0, 300)); });
page.on("console", (m) => { if (m.text().includes("[dbg]")) console.log("  ", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 400)));
await page.setViewportSize({ width: 1500, height: 1000 });
try {
  await signIn(page, "admin");
  await page.goto(`${BASE}/dashboard/mjengo/documents/editor?file=${row.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator(".wcai-launch").first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.locator(".wcai-launch").first().click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "AI Studio" }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Letterhead" }).or(page.getByText("Letterhead", { exact: true })).first().click();
  await page.waitForTimeout(800);
  console.log("inputs", JSON.stringify(await page.locator(".wcai input").evaluateAll((els) => els.map((e) => [e.type, e.value, e.placeholder]))));
  await page.screenshot({ path: process.env.TEMP + "/peek1.png" });
  console.log("buttons", await page.evaluate(() => Array.from(document.querySelectorAll(".wcai button")).map((b) => (b.getAttribute("aria-label") || b.title || b.textContent || "").trim().slice(0, 30)).join(" | ")));
} finally { await db.from("vault_files").delete().eq("id", row.id); await db.storage.from("mjengo-docs").remove([path]); await browser.close(); }
