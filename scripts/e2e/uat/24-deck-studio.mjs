// Presentation with AI: pictures and a logo are added, their colours are read and shown, and the deck that
// comes out carries the pictures and uses those colours.
//   node --env-file=.env.local scripts/e2e/uat/24-deck-studio.mjs
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(120000);
await page.setViewportSize({ width: 1400, height: 1000 });
let made = null;
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/vault`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByText("Presentation", { exact: true }).first().click();
	await page.getByRole("dialog").waitFor();
	await page.getByRole("dialog").locator('input[type="file"]').setInputFiles(["public/logo-small.png", "public/couple-salama.jpg"]);
	await page.getByRole("button", { name: /^Main colour #/ }).first().waitFor({ timeout: 30000 });
	const n = await page.getByRole("button", { name: /^Main colour #/ }).count();
	check("Colours are read from the pictures and shown", n >= 2, `${n} colours`);
	check("The logo and the photo are listed", (await page.getByRole("button", { name: "logo", exact: true }).count()) >= 1 && (await page.getByRole("button", { name: "photo", exact: true }).count()) >= 1);
	const before = await page.getByLabel("Preview of the look").evaluate((el) => getComputedStyle(el.querySelector("span")).backgroundColor);
	await page.getByRole("button", { name: /^Main colour #/ }).nth(Math.min(1, n - 1)).click();
	const after = await page.getByLabel("Preview of the look").evaluate((el) => getComputedStyle(el.querySelector("span")).backgroundColor);
	check("Choosing a colour changes the preview", before !== after, `${before} -> ${after}`);

	await page.getByRole("dialog").locator("textarea").first().fill("A short briefing on our legal aid clinics for a county partner");
	await page.getByRole("button", { name: "Create", exact: true }).click();
	await page.getByText("Saved to Files").waitFor({ timeout: 180000 });
	check("The deck is made and saved", true);
	const { data: row } = await db.from("vault_files").select("id, name, storage_path").eq("owner_id", accounts.accounts.admin.id).like("name", "%.pptx").order("created_at", { ascending: false }).limit(1).single();
	made = row;
	const { data: blob } = await db.storage.from("mjengo-docs").download(row.storage_path);
	const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
	const media = Object.keys(zip.files).filter((f) => f.startsWith("ppt/media/"));
	check("The pictures are inside the deck", media.length >= 2, `${media.length} media files`);
} catch (e) {
	check("Deck studio flow", false, String(e).slice(0, 280));
} finally {
	if (made) { await db.from("vault_files").delete().eq("id", made.id); await db.storage.from("mjengo-docs").remove([made.storage_path]); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
