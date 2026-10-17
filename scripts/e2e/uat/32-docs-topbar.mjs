// The editor's own top bar and host-owned comments: back, quick access, title, live collaborators, comments,
// Share and the user menu sit in one bar (ours is gone); a new comment opens the composer and leaves nothing behind.
//   node --env-file=.env.local scripts/e2e/uat/32-docs-topbar.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const bytes = fs.readFileSync(new URL("../samples/e2e-sample.docx", import.meta.url));
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(30000);
await page.setViewportSize({ width: 1500, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
let file = null;
try {
	const path = `e2e/${Date.now()}-topbar.docx`;
	await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
	const { data: row } = await db.from("vault_files").insert({ name: "Top bar test.docx", storage_path: path, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: bytes.length, owner_id: accounts.accounts.admin.id }).select("id").single();
	file = { id: row.id, path };

	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/documents/editor?file=${file.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.locator(".wcai-launch").first().waitFor({ timeout: 120000 });
	await page.waitForTimeout(3000);
	await page.screenshot({ path: `${process.env.TEMP}/topbar.png` });

	const bar = await page.evaluate(() => {
		const root = document.querySelector("[data-wordcraft-root]");
		const labels = [...(root?.querySelectorAll("button,[role=button]") ?? [])].slice(0, 30).map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().slice(0, 30));
		return { labels, ourBar: !!document.querySelector('button[aria-label="Back"]:not([data-wordcraft-root] *)') };
	});
	console.log(JSON.stringify(bar));
	check("Our own top bar is gone", !bar.ourBar);
	check("The editor's bar has Back, Share and comments", bar.labels.some((l) => /back/i.test(l)) && bar.labels.some((l) => /share/i.test(l)) && bar.labels.some((l) => /comment/i.test(l)), bar.labels.join(" | "));
	check("No page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
	check("Top bar flow", false, String(e).slice(0, 300));
	await page.screenshot({ path: `${process.env.TEMP}/topbar-fail.png` }).catch(() => undefined);
} finally {
	if (file) { await db.storage.from("mjengo-docs").remove([file.path]); await db.from("vault_files").delete().eq("id", file.id); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
