// Documents: the top bar (people with access, Share, File menu), anyone-with-the-link access for people outside
// the team, and the PDF viewer. Uses the sample files and the service role to put them in the vault.
//   node --env-file=.env.local scripts/e2e/uat/12-documents.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const owner = accounts.accounts.admin.id;
const made = [];

async function put(localName, name, mime) {
	const bytes = fs.readFileSync(new URL(`../samples/${localName}`, import.meta.url));
	const path = `e2e/${Date.now()}-${name}`;
	const up = await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: mime, upsert: true });
	if (up.error) throw new Error(`upload ${name}: ${up.error.message}`);
	const { data, error } = await db.from("vault_files").insert({ name, storage_path: path, mime, size: bytes.length, owner_id: owner }).select("id").single();
	if (error) throw new Error(`row ${name}: ${error.message}`);
	made.push({ id: data.id, path });
	return data.id;
}

const browser = await launch();
const page = await newPage(browser);
const anon = await newPage(browser);
try {
	const docId = await put("e2e-sample.docx", "E2E document.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
	const pdfId = await put("e2e-sample.pdf", "E2E report.pdf", "application/pdf");

	await signIn(page, "admin");

	// The top bar of a document.
	await page.goto(`${BASE}/dashboard/mjengo/documents/editor?file=${docId}`, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: /^File/ }).first().waitFor({ timeout: 60000 });
	check("Document top bar has the File menu", true);
	check("Document top bar has Share", (await page.getByRole("button", { name: /Share/ }).count()) > 0);
	check("Document top bar has Copy link", (await page.getByRole("button", { name: "Copy link" }).count()) > 0);

	// Labels and meeting through the File menu.
	await page.getByRole("button", { name: /^File/ }).first().click();
	await page.getByRole("menuitem", { name: /Labels and meeting/ }).click();
	await page.getByPlaceholder(/Add a label/).fill("Grant report");
	await page.keyboard.press("Enter");
	await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
	let row = null;
	for (let i = 0; i < 30 && !(row?.tags ?? []).includes("Grant report"); i++) {
		await page.waitForTimeout(1000);
		row = (await db.from("vault_files").select("tags").eq("id", docId).single()).data;
	}
	check("A label is kept on the document", Array.isArray(row?.tags) && row.tags.includes("Grant report"), JSON.stringify(row?.tags));

	// Version history: opening the document records a version on the server.
	await page.waitForTimeout(4000);
	const vr = await page.request.get(`${BASE}/api/mjengo/docs/versions/${docId}`);
	const versions = vr.ok() ? await vr.json() : [];
	check("Opening a document records a version", Array.isArray(versions) && versions.length > 0, `status ${vr.status()}, ${versions.length} versions`);

	// Share box offers link access.
	await page.getByRole("button", { name: /^Share$/ }).first().click();
	await page.getByText("General access").waitFor({ timeout: 20000 });
	check("Share box has link access", (await page.getByText(/Anyone with the link|Link off/).count()) > 0);
	await page.keyboard.press("Escape");

	// A guest cannot open it until the link is on, then can.
	const closed = await anon.request.get(`${BASE}/api/public-docs/${docId}/file`);
	check("Link access is off by default", closed.status() === 404, `status ${closed.status()}`);
	await db.from("vault_files").update({ link_access: "edit" }).eq("id", docId);
	const open = await anon.request.get(`${BASE}/api/public-docs/${docId}/file`);
	const body = open.ok() ? await open.json() : {};
	check("An edit link gives a guest the file", open.ok() && !!body.url && body.access === "edit", `status ${open.status()}`);
	const saveDenied = await anon.request.put(`${BASE}/api/public-docs/${pdfId}/save`, { data: "x" });
	check("A file that is not shared cannot be written", saveDenied.status() === 403, `status ${saveDenied.status()}`);
	await anon.goto(`${BASE}/d/${docId}`, { waitUntil: "domcontentloaded" });
	await anon.getByPlaceholder("Your name").fill("Outside Guest");
	await anon.getByRole("button", { name: /Open the document/ }).click();
	await anon.waitForTimeout(8000);
	const text = (await anon.textContent("body")) ?? "";
	check("The shared page opens for a guest", /E2E document/.test(text) && !/not found/i.test(text));
	await db.from("vault_files").update({ link_access: "off" }).eq("id", docId);

	// The PDF viewer.
	page.errors.length = 0;
	await page.goto(`${BASE}/dashboard/mjengo/files/pdf?file=${pdfId}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.waitForSelector("canvas", { timeout: 60000 });
	await page.waitForTimeout(1500);
	check("PDF opens and draws a page", (await page.locator("canvas").count()) > 0 && page.errors.length === 0, page.errors[0]?.slice(0, 120));
} catch (e) {
	check("Documents flow", false, String(e).slice(0, 240));
} finally {
	for (const m of made) {
		await db.from("vault_files").delete().eq("id", m.id);
		await db.storage.from("mjengo-docs").remove([m.path]);
	}
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
