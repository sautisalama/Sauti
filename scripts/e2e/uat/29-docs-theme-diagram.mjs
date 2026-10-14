// Documents on WordCraft 0.3.5:
//  - a theme is made from a logo (colours found and shown), saved for the team and applied to the document theme;
//  - a diagram is built from a sentence and inserted;
//  - a document opened through a share link keeps version history through direct storage.
//   node --env-file=.env.local scripts/e2e/uat/29-docs-theme-diagram.mjs
import fs from "node:fs";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const bytes = fs.readFileSync(new URL("../samples/e2e-sample.docx", import.meta.url));
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(120000);
await page.setViewportSize({ width: 1500, height: 1000 });
let file = null;
const stamp = Date.now();
try {
	const path = `e2e/${stamp}-theme.docx`;
	await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
	const { data: row } = await db.from("vault_files").insert({ name: "Theme test.docx", storage_path: path, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: bytes.length, owner_id: accounts.accounts.admin.id, link_access: "edit" }).select("id").single();
	file = { id: row.id, path };

	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/documents/editor?file=${file.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.locator(".wcai-launch").first().waitFor({ timeout: 120000 });
	await page.waitForTimeout(3000);

	// ---- Theme from a logo.
	await page.locator(".wcai-launch").first().click();
	await page.getByRole("button", { name: "AI Studio" }).first().click();
	await page.getByText("Palette", { exact: true }).first().click();
	await page.getByRole("button", { name: "From a logo or photo" }).click();
	await page.locator('.wcai input[type="file"]').last().setInputFiles(["public/logo-small.png"]);
	await page.locator('.wcai button[title*="% of logo-small"]').first().waitFor({ timeout: 30000 });
	const swatches = await page.locator('.wcai button[title*="% of logo-small"]').count();
	check("Colours are found in the logo and shown", swatches >= 4, `${swatches} swatches`);
	const fix = page.getByRole("button", { name: "Fix contrast" });
	if (await fix.count()) await fix.click();
	await page.getByRole("button", { name: "Save palette" }).click();
	let systems = null;
	for (let i = 0; i < 20 && !systems?.length; i++) {
		await page.waitForTimeout(1000);
		({ data: systems } = await db.from("mjengo_design_systems").select("id, name, colors").ilike("description", "Made from a picture%").gte("created_at", new Date(stamp).toISOString()).order("created_at", { ascending: false }).limit(1));
	}
	check("The palette is saved for the team", (systems?.[0]?.colors?.length ?? 0) >= 3, JSON.stringify(systems?.[0]?.colors));
	if (systems?.[0]) await db.from("mjengo_design_systems").delete().eq("id", systems[0].id);

	await page.getByRole("button", { name: "Apply to document" }).first().click();
	await page.getByText(/is now the document theme/).waitFor({ timeout: 20000 });
	check("The theme is applied to the document", true);
	await page.getByRole("button", { name: "Close AI Studio" }).click().catch(() => undefined);
	await page.getByRole("button", { name: /^Save/ }).first().click().catch(() => undefined);
	await page.waitForTimeout(8000);
	const { data: blob } = await db.storage.from("mjengo-docs").download(path);
	const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
	const theme = Object.keys(zip.files).find((f) => /^word\/theme\/theme1\.xml$/.test(f));
	const themeXml = theme ? await zip.file(theme).async("string") : "";
	check("The colours are written into the document theme", /<a:srgbClr val="[0-9A-Fa-f]{6}"/.test(themeXml) && /1E4B63|1786BF|ECAD09/i.test(themeXml), themeXml.slice(0, 0));

	// ---- A diagram from a sentence.
	await page.locator(".wcai-launch").first().click().catch(() => undefined);
	await page.getByRole("button", { name: "Insert", exact: true }).first().click();
	await page.getByRole("menuitem", { name: /Diagram/ }).or(page.getByText("Diagram", { exact: true })).first().click();
	await page.screenshot({ path: `${process.env.TEMP}/diagram-1.png` });
	const prompt = page.getByPlaceholder(/describe|what|diagram/i).first();
	await prompt.fill("A flowchart of a case referral: report received, triage, assign to a paralegal, follow up, close");
	await page.keyboard.press("Enter");
	await page.getByRole("button", { name: /^Insert$|Insert below|Replace/ }).first().waitFor({ timeout: 120000 });
	await page.screenshot({ path: `${process.env.TEMP}/diagram-2.png` });
	check("A diagram preview is made from a sentence", true);
} catch (e) {
	check("Theme and diagram flow", false, String(e).slice(0, 300));
	await page.screenshot({ path: `${process.env.TEMP}/theme-fail.png` }).catch(() => undefined);
}

// ---- Version history for a signed-in editor: the same direct route, checked against the file's access.
try {
	const result = await page.evaluate(async ({ id }) => {
		const base = `/api/mjengo/docs/versions/${id}`;
		const vid = `ed${Date.now().toString(36)}`;
		const up = await fetch(`${base}/${vid}/upload`, { method: "POST" });
		if (!up.ok) return { step: "upload", status: up.status };
		const { signedUrl } = await up.json();
		const form = new FormData();
		form.append("cacheControl", "3600");
		form.append("", new Blob([new Uint8Array(6_000_000).fill(3)], { type: "application/octet-stream" }));
		const put = await fetch(signedUrl, { method: "PUT", body: form });
		if (!put.ok) return { step: "put", status: put.status };
		const commit = await fetch(`${base}/${vid}/commit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: vid, createdAt: new Date().toISOString(), reason: "manual", size: 0 }) });
		if (commit.status !== 200) return { step: "commit", status: commit.status };
		const committed = await commit.json();
		const list = await (await fetch(base)).json();
		const mine = list.find((m) => m.id === vid);
		const link = await (await fetch(`${base}/${vid}?url=1`)).json();
		const got = await fetch(link.url);
		return { step: "done", size: mine?.size ?? 0, committed: committed.size, found: !!mine, readBack: (await got.arrayBuffer()).byteLength };
	}, { id: file.id });
	check("A 6 MB version is saved and read back by an editor (larger than a function may carry)", result.step === "done" && result.size >= 6_000_000 && result.readBack >= 6_000_000, JSON.stringify(result));
} catch (e) {
	check("Editor history", false, String(e).slice(0, 240));
}

// ---- Version history through a share link (no sign-in needed; the link allows editing).
try {
	const base = `${BASE}/api/public-docs/${file.id}/versions`;
	const vid = `e2e${stamp.toString(36)}`;
	const meta = { id: vid, createdAt: new Date().toISOString(), reason: "manual", size: 0, title: "E2E", author: { name: "Guest" } };
	const up = await fetch(`${base}/${vid}/upload`, { method: "POST" });
	check("A share link can ask to upload a version", up.ok, String(up.status));
	const { signedUrl } = await up.json();
	const form = new FormData();
	form.append("cacheControl", "3600");
	form.append("", new Blob([new Uint8Array(300_000).fill(7)], { type: "application/octet-stream" }));
	const put = await fetch(signedUrl, { method: "PUT", body: form });
	check("The bytes go straight to storage", put.ok, String(put.status));
	const commit = await fetch(`${base}/${vid}/commit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(meta) });
	const committed = commit.ok ? await commit.json() : null;
	check("The version is recorded", commit.ok, `${commit.status} ${JSON.stringify(committed)}`);
	const list = await (await fetch(base)).json();
	const mine = list.find((m) => m.id === vid);
	check("It shows in the history with its size", !!mine && mine.size >= 300_000, JSON.stringify(mine)?.slice(0, 120));
	const url = await (await fetch(`${base}/${vid}?url=1`)).json();
	const got = await fetch(url.url);
	check("It can be read back directly", got.ok && (await got.arrayBuffer()).byteLength >= 300_000);
} catch (e) {
	check("Share link history", false, String(e).slice(0, 240));
} finally {
	if (file) {
		await db.storage.from("mjengo-docs").remove([file.path]);
		const { data: files } = await db.storage.from("mjengo-docs").list(`versions/${file.id}`);
		if (files?.length) await db.storage.from("mjengo-docs").remove(files.map((f) => `versions/${file.id}/${f.name}`));
		await db.from("mjengo_doc_versions").delete().eq("file_id", file.id);
		await db.from("vault_files").delete().eq("id", file.id);
	}
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
