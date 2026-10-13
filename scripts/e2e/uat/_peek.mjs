import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, launch, newPage, signIn } from "../lib.mjs";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const bytes = fs.readFileSync(process.env.TEMP + "/" + (process.env.DECK || "real.pptx"));
const path = `e2e/${Date.now()}-real.pptx`;
await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", upsert: true });
const { data: row } = await db.from("vault_files").insert({ name: process.env.DECK || "real.pptx", storage_path: path, mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", size: bytes.length, owner_id: accounts.accounts.admin.id }).select("id").single();
const browser = await launch(); const page = await newPage(browser); page.setDefaultTimeout(60000);
page.on("console", (m) => { if (m.type() === "error") console.log("  [err]", m.text().slice(0, 300)); });
page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 300)));
await page.setViewportSize({ width: 1400, height: 900 });
try {
  await signIn(page, "admin");
  await page.goto(`${BASE}/dashboard/mjengo/files/slides?file=${row.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(30000);
  console.log((await page.locator("body").innerText()).slice(0, 400).replace(/\n+/g, " | "));
  await page.screenshot({ path: process.env.TEMP + "/real1.png" });
} finally { await db.from("vault_files").delete().eq("id", row.id); await db.storage.from("mjengo-docs").remove([path]); await browser.close(); }
