// Documents on an opportunity: add a file from Files, preview it in a window, move between files, remove only the link.
// Also checks the slim header on the full page.
import path from "node:path";
import { BASE, launch, newPage, signIn, check, summary } from "./lib.mjs";
import { db, acc, poll } from "./helpers.mjs";

const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
const admin = acc("admin");
const stamp = Date.now();
const { data: opp } = await db.from("mjengo_opportunities").insert({ title: "E2E documents opportunity", organisation: "Docs Org", status: "new", created_by: admin.id, visibility: "team" }).select("id").single();

const vaultPath = `vault/${admin.id}/e2e-note-${stamp}.txt`;
await db.storage.from("mjengo-docs").upload(vaultPath, new Blob(["hello from the files vault"], { type: "text/plain" }), { contentType: "text/plain", upsert: true });
const { data: vf } = await db.from("vault_files").insert({ folder_id: null, name: `e2e-note-${stamp}.txt`, storage_path: vaultPath, mime: "text/plain", size: 26, owner_id: admin.id }).select("id").single();

const upPath = `opportunity/${opp.id}/e2e-upload-${stamp}.txt`;
await db.storage.from("mjengo-docs").upload(upPath, new Blob(["hello from an upload"], { type: "text/plain" }), { contentType: "text/plain", upsert: true });
await db.from("mjengo_documents").insert({ entity_type: "opportunity", entity_id: opp.id, name: "E2E uploaded budget", required: true, file_path: upPath, file_name: `e2e-upload-${stamp}.txt`, file_size: 20, mime_type: "text/plain", uploaded_by: admin.id, uploaded_at: new Date().toISOString() });

const browser = await launch();
const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/opportunities/${opp.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByLabel("opportunity name").waitFor({ timeout: 90000 });
	const bar = await page.getByLabel("opportunity name").evaluate((el) => { const r = el.closest(".sticky").getBoundingClientRect(); return { h: r.height, top: r.top }; });
	check(`the top bar is slim (${Math.round(bar.h)}px)`, bar.h < 70);
	check("stage is a compact menu, not a row of steps", (await page.getByRole("combobox", { name: "Stage" }).count()) === 1);

	await page.getByRole("tab", { name: "Pages and copies" }).click();
	await page.getByRole("button", { name: "Add a document" }).waitFor({ timeout: 60000 });

	// Add a file that already exists in Files.
	await page.getByRole("button", { name: "Add a document" }).click();
	await page.getByRole("tab", { name: "From Files" }).waitFor();
	await page.getByLabel("Search").fill(`e2e-note-${stamp}`);
	await page.getByText(`e2e-note-${stamp}.txt`).first().waitFor({ timeout: 30000 });
	await page.getByRole("button", { name: "Add", exact: true }).first().click();
	await page.getByRole("button", { name: `Preview e2e-note-${stamp}.txt` }).first().waitFor({ timeout: 30000 });
	check("the file from Files is on the opportunity", true);
	const link = await poll(async () => (await db.from("mjengo_documents").select("vault_file_id, file_path").eq("entity_id", opp.id).eq("vault_file_id", vf.id).maybeSingle()).data, { timeout: 15000, interval: 1000 });
	check("only a link was stored, not a copy of the file", !!link && link.file_path === null);

	// Preview the uploaded file, then move on to the next.
	await page.getByRole("button", { name: "Preview E2E uploaded budget" }).first().click();
	await page.getByText("hello from an upload").waitFor({ timeout: 30000 });
	check("clicking a document shows it in a window", true);
	await page.screenshot({ path: path.join(OUT, "opp_preview.png") });
	await page.getByRole("button", { name: "Next file" }).click();
	await page.getByText("hello from the files vault").waitFor({ timeout: 30000 });
	check("the arrows move to the next file, wherever it lives", true);
	await page.keyboard.press("Escape");
	await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});

	// The other two routes are offered.
	await page.getByRole("button", { name: "Add a document" }).click();
	await page.getByRole("tab", { name: "Google Drive" }).click();
	await page.getByLabel("Google Drive link").waitFor({ timeout: 30000 });
	check("Google Drive search and paste-a-link are offered", true);
	await page.getByRole("tab", { name: "Create new" }).click();
	check("a document, spreadsheet and presentation can be created from here", (await page.getByRole("button", { name: /^Document/ }).count()) > 0 && (await page.getByRole("button", { name: /^Spreadsheet/ }).count()) > 0 && (await page.getByRole("button", { name: /^Presentation/ }).count()) > 0);
	await page.keyboard.press("Escape");

	// Removing the document from the record leaves the file in Files.
	page.on("dialog", (d) => d.accept());
	await page.getByRole("button", { name: `Delete e2e-note-${stamp}.txt` }).click();
	await poll(async () => !(await db.from("mjengo_documents").select("id").eq("entity_id", opp.id).eq("vault_file_id", vf.id).maybeSingle()).data, { timeout: 20000, interval: 1000 });
	const stillThere = await db.from("vault_files").select("id").eq("id", vf.id).maybeSingle();
	check("removing it only unlinks it; the file stays in Files", !!stillThere.data);
} finally {
	await db.from("mjengo_documents").delete().eq("entity_id", opp.id);
	await db.from("mjengo_opportunities").delete().eq("id", opp.id);
	await db.from("vault_files").delete().eq("id", vf.id);
	await db.storage.from("mjengo-docs").remove([vaultPath, upPath]);
	await browser.close();
}
summary();
