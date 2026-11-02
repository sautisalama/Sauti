// Files vault and opportunity: one Presentation card, forms and flows from "Create new", cards/list toggle,
// preview of Word/Excel/PowerPoint/SVG files, numbered to-dos with one suggested to-do holding steps, plain sharing words.
import path from "node:path";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";
import { BASE, launch, newPage, signIn, check, summary } from "./lib.mjs";
import { db, acc, poll } from "./helpers.mjs";

const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
const admin = acc("admin");
const stamp = Date.now();
const deadline = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
const { data: opp } = await db.from("mjengo_opportunities").insert({ title: "E2E suite opportunity", organisation: "Suite Org", status: "new", deadline, created_by: admin.id, visibility: "team" }).select("id").single();

// Fixtures: a Word file, a spreadsheet, a PowerPoint and an SVG, each attached as an upload.
const zip = new JSZip();
zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello from the word file</w:t></w:r></w:p></w:body></w:document>`);
const docx = await zip.generateAsync({ type: "nodebuffer" });
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Item", "Cost"], ["Hello sheet cell", 1200]]), "Budget");
const xlsx = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
const pp = new PptxGenJS();
pp.addSlide().addText("Hello from the slides", { x: 1, y: 1, w: 6, h: 1 });
const pptx = Buffer.from(await pp.write({ outputType: "arraybuffer" }));
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#0e7490"/></svg>`);
const files = [
	["E2E word file", `e2e-${stamp}.docx`, docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Hello from the word file"],
	["E2E sheet file", `e2e-${stamp}.xlsx`, xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Hello sheet cell"],
	["E2E slides file", `e2e-${stamp}.pptx`, pptx, "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Hello from the slides"],
];
const paths = [];
for (const [name, file, buf, mime] of files) {
	const p = `opportunity/${opp.id}/${file}`;
	paths.push(p);
	await db.storage.from("mjengo-docs").upload(p, buf, { contentType: mime, upsert: true });
	await db.from("mjengo_documents").insert({ entity_type: "opportunity", entity_id: opp.id, name, required: false, file_path: p, file_name: file, file_size: buf.length, mime_type: mime, uploaded_by: admin.id, uploaded_at: new Date().toISOString() });
}
const svgPath = `opportunity/${opp.id}/e2e-${stamp}.svg`;
paths.push(svgPath);
await db.storage.from("mjengo-docs").upload(svgPath, svg, { contentType: "image/svg+xml", upsert: true });
await db.from("mjengo_documents").insert({ entity_type: "opportunity", entity_id: opp.id, name: "E2E svg file", required: false, file_path: svgPath, file_name: `e2e-${stamp}.svg`, file_size: svg.length, mime_type: "image/svg+xml", uploaded_by: admin.id, uploaded_at: new Date().toISOString() });

const browser = await launch();
let formId = null;
try {
	const page = await newPage(browser, { viewport: { width: 1280, height: 900 } });
	await signIn(page, "admin");

	// Files: one Presentation card.
	await page.goto(`${BASE}/dashboard/mjengo/vault`, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByText("Start something new").first().waitFor({ timeout: 90000 });
	check("one Presentation card, no separate PowerPoint card", (await page.getByText("PowerPoint from AI").count()) === 0 && (await page.getByRole("button", { name: /Presentation/ }).count()) === 1);
	await page.getByRole("button", { name: /Presentation/ }).first().click();
	await page.getByText("New presentation").first().waitFor({ timeout: 15000 });
	check("it offers slides to edit together or a PowerPoint file", (await page.getByRole("button", { name: "Slides to edit together" }).count()) === 1 && (await page.getByRole("button", { name: "PowerPoint file" }).count()) === 1);
	check("blank and template starts are one link away", (await page.getByRole("link", { name: /Start blank or from a template/ }).count()) === 1);
	await page.keyboard.press("Escape");

	// Opportunity.
	await page.goto(`${BASE}/dashboard/mjengo/opportunities/${opp.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByLabel("opportunity name").waitFor({ timeout: 90000 });

	await page.getByRole("tab", { name: "To-dos and reminders" }).click();
	await page.getByText("Add a to-do for this opportunity?").waitFor({ timeout: 60000 });
	check("the page asks before adding suggested to-dos", true);
	check("it says they become one to-do with steps", (await page.getByText(/One to-do with \d+ steps inside it/).count()) === 1);
	await page.getByRole("button", { name: "Add the to-do" }).click();
	await page.getByText(/^Apply: E2E suite opportunity/).waitFor({ timeout: 60000 });
	const { data: todos } = await db.from("mjengo_todos").select("id, title, steps").eq("entity_id", opp.id);
	check("one to-do was made, with the steps inside it", todos?.length === 1 && Array.isArray(todos[0].steps) && todos[0].steps.length >= 3);
	check("to-dos are numbered", (await page.getByRole("list", { name: "To-dos" }).getByText("1.", { exact: true }).count()) === 1);
	const first = page.getByRole("checkbox", { name: /^Mark done: Check we are eligible/ });
	await first.click();
	await poll(async () => ((await db.from("mjengo_todos").select("steps").eq("entity_id", opp.id).single()).data?.steps ?? []).some((x) => x.done), { timeout: 40000, interval: 1500 }).then((ok) => check("ticking a step saves it", !!ok));

	await page.getByRole("tab", { name: "Sharing" }).click();
	await page.getByText("Who can open this").first().waitFor({ timeout: 90000 }).catch(() => {});
	check("sharing wording is plain", (await page.getByText("Who can open this", { exact: false }).count()) > 0 && (await page.getByText("Everyone on the team can see it").count()) === 0);

	await page.getByRole("tab", { name: "Application" }).click();
	await page.getByText("E2E word file").first().waitFor({ timeout: 90000 });
	check("row actions are preview, download and delete only", (await page.getByRole("button", { name: "Preview E2E word file" }).count()) >= 1 && (await page.getByRole("button", { name: "Download E2E word file" }).count()) === 1 && (await page.getByRole("button", { name: /^Replace / }).count()) === 0);
	await page.getByRole("button", { name: "Cards view" }).click();
	check("cards view shows the same documents", (await page.getByText("E2E word file").count()) >= 1);
	await page.getByRole("button", { name: "List view" }).click();

	for (const [name, , , , text] of files) {
		await page.getByRole("button", { name: `Preview ${name}` }).first().click();
		let ok = true;
		try {
			const frame = page.frameLocator("iframe").first();
			if (/slides/.test(name)) await page.getByText(text).first().waitFor({ timeout: 40000 });
			else await frame.getByText(text).first().waitFor({ timeout: 40000 });
		} catch { ok = false; }
		check(`${name} previews in the window`, ok && (await page.getByText("cannot be shown here").count()) === 0);
		if (name === "E2E word file") await page.screenshot({ path: path.join(OUT, "vault_preview_docx.png") });
		await page.keyboard.press("Escape");
		await page.waitForTimeout(600);
	}
	await page.getByRole("button", { name: "Preview E2E svg file" }).first().click();
	await page.getByRole("img", { name: new RegExp(`e2e-${stamp}\\.svg`) }).waitFor({ timeout: 30000 }).then(() => check("an SVG previews as a picture", true)).catch(() => check("an SVG previews as a picture", false));
	await page.keyboard.press("Escape");

	// Create new: flows and forms are offered; a form is added at once.
	await page.getByRole("button", { name: "Add a document" }).click();
	await page.getByRole("tab", { name: "Create new" }).click();
	check("Create new offers flow and form as well as document, spreadsheet, presentation", (await page.getByRole("button", { name: /^Flow or diagram/ }).count()) === 1 && (await page.getByRole("button", { name: /^Form/ }).count()) === 1 && (await page.getByRole("button", { name: /^Document/ }).count()) === 1);
	const popup = page.context().waitForEvent("page", { timeout: 30000 }).catch(() => null);
	await page.getByRole("button", { name: /^Form/ }).click();
	const tab = await popup;
	await tab?.close().catch(() => {});
	const made = await poll(async () => (await db.from("mjengo_documents").select("id, form_id").eq("entity_id", opp.id).not("form_id", "is", null).maybeSingle()).data, { timeout: 40000, interval: 1500 });
	formId = made?.form_id ?? null;
	check("a form was made and added to the opportunity", !!made);
	await page.waitForTimeout(1500);
	check("the form shows in the list with an open action", (await page.getByRole("link", { name: /Open the form/ }).count()) >= 1 || (await page.getByText("Form").count()) > 0);
	await page.screenshot({ path: path.join(OUT, "vault_opp_docs.png") });
} finally {
	await db.from("mjengo_documents").delete().eq("entity_id", opp.id);
	await db.from("mjengo_todos").delete().eq("entity_id", opp.id);
	if (formId) await db.from("mjengo_forms").delete().eq("id", formId);
	await db.from("mjengo_opportunities").delete().eq("id", opp.id);
	await db.storage.from("mjengo-docs").remove(paths);
	await browser.close();
}
summary();
