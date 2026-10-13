// Brand guidelines end to end: a document is tagged as the official guidelines, the AI reads colours, fonts and
// letterhead rules from it, the Brand page shows them, and a new form is styled in the brand colour.
//   node --env-file=.env.local scripts/e2e/uat/17-brand.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const GUIDE = [
	"Acme Relief brand guidelines",
	"Our primary colour is deep green #0B6E4F and our secondary colour is amber #F2A900. Accent is #1D3557 and quiet text is grey #6B7280.",
	"Headings use the font Merriweather and body text uses the font Source Sans Pro.",
	"Letterhead: the logo sits top left with 20 mm clear space on every side. The organisation name is set in the primary colour above the tagline.",
	"The letterhead is left aligned and a thin rule in the accent colour separates it from the body of every letter.",
	"The tagline is 'Relief that listens'. Contact: hello@acmerelief.org. Never place the logo on a busy photograph and never stretch it.",
	"Page numbers go bottom right in the quiet text colour. Reports carry the letterhead on the first page only.",
].join("\n");

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(120000);
let file = null;
let formId = null;
const before = (await db.from("mjengo_brand").select("*").eq("id", "org").maybeSingle()).data;
try {
	const path = `e2e/${Date.now()}-brand-guide.txt`;
	const bytes = Buffer.from(GUIDE);
	await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: "text/plain", upsert: true });
	const { data: row } = await db.from("vault_files").insert({ name: "Acme brand guidelines.txt", storage_path: path, mime: "text/plain", size: bytes.length, owner_id: accounts.accounts.admin.id }).select("id").single();
	file = { id: row.id, path };

	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/brand`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByRole("button", { name: /Choose the document|Choose another/ }).click();
	await page.getByPlaceholder(/Find a Word document/).fill("Acme brand");
	await page.getByRole("button", { name: /Acme brand guidelines\.txt/ }).click();
	await page.getByText(/Guidelines tagged and read/).first().waitFor({ timeout: 120000 });

	const { data: b } = await db.from("mjengo_brand").select("data, guidelines_file_id").eq("id", "org").single();
	const d = b.data;
	check("The document is recorded as the guidelines", b.guidelines_file_id === file.id);
	check("Brand colours are read from the document", d.colours.includes("#0B6E4F") && d.colours.includes("#F2A900"), d.colours.join(" "));
	check("Primary colour is the guideline's green", d.palette.primary === "#0B6E4F", d.palette.primary);
	check("Fonts are read", /merriweather/i.test(d.fonts.heading) && /source sans/i.test(d.fonts.body), `${d.fonts.heading} / ${d.fonts.body}`);
	check("Letterhead is left aligned with a rule", d.letterhead.align === "left" && d.letterhead.rule === true);
	check("Placement rules are kept", d.rules.length >= 3 && d.rules.some((r) => /logo/i.test(r)), `${d.rules.length} rules`);
	const { data: tagged } = await db.from("vault_files").select("tags").eq("id", file.id).single();
	check("The file carries the brand-guidelines tag", (tagged.tags ?? []).includes("brand-guidelines"));

	await page.reload({ waitUntil: "domcontentloaded" });
	await page.getByLabel("Letterhead preview").waitFor();
	const preview = await page.getByLabel("Letterhead preview").innerText();
	check("The letterhead preview shows the organisation", /Acme Relief/i.test(preview), preview.slice(0, 60).replace(/\n/g, " "));

	// A new form from a template is styled in the brand colour when nothing else is chosen.
	await page.goto(`${BASE}/dashboard/mjengo/forms`, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByRole("button", { name: /Create with AI/ }).click();
	await page.getByPlaceholder(/A feedback form/).fill("A short feedback form for people who attended our clinic.");
	await page.getByRole("button", { name: "Feedback", exact: true }).click();
	await page.getByRole("button", { name: /^Create$/ }).click();
	await page.waitForURL(/\/forms\/[0-9a-f-]{36}/, { timeout: 120000 });
	formId = page.url().match(/forms\/([0-9a-f-]{36})/)?.[1];
	const { data: f } = await db.from("mjengo_forms").select("settings").eq("id", formId).single();
	check("A new form takes the brand colour", f?.settings?.style?.accent === "#0B6E4F", String(f?.settings?.style?.accent));
} catch (e) {
	check("Brand flow", false, String(e).slice(0, 260));
} finally {
	if (formId) await db.from("mjengo_forms").delete().eq("id", formId);
	if (before) await db.from("mjengo_brand").upsert(before); else await db.from("mjengo_brand").delete().eq("id", "org");
	if (file) { await db.from("vault_files").delete().eq("id", file.id); await db.storage.from("mjengo-docs").remove([file.path]); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
