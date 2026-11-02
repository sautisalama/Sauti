// The opportunity's Application tab: quiet details, context (instructions, notes, skills, links, files), suggestions from
// the vault, template question on the CV and cover letter pills, and the agent writing a document that lands in Files.
import path from "node:path";
import { BASE, launch, newPage, signIn, check, summary } from "./lib.mjs";
import { db, acc, poll } from "./helpers.mjs";

const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
const admin = acc("admin");
const stamp = Date.now();
const live = !!process.env.OPENROUTER_API_KEY && process.env.E2E_NO_AI !== "1";
const { data: opp } = await db.from("mjengo_opportunities").insert({
	title: "E2E Digital Technology Advisor", organisation: "E2E Light Foundation", status: "new", created_by: admin.id, visibility: "team", verification: { status: "done", at: new Date().toISOString(), trust: "verified", trustReason: "E2E", sourceKind: "official", sourceHost: null, account: null, organisation: null, website: null, applyUrl: null, title: null, category: null, deadline: null, deadlineQuote: null, eligibility: null, deliverables: null, email: null, checks: [], foundBy: null, finalUrl: "https://example.org/funder-call" },
	description: "Lead the governance of digital platforms: websites, analytics, accessibility and GDPR. Excellent English and German required. Experience with CMS platforms and external vendors.",
}).select("id").single();

// A CV and a template already in Files.
const cvPath = `vault/${admin.id}/e2e-cv-${stamp}.txt`;
await db.storage.from("mjengo-docs").upload(cvPath, new Blob([`Jane Wanjiru\nDigital platforms lead, Nairobi\nExperience\n- Built and ran WordPress and Sanity websites for NGOs and real estate firms.\n- Data handler under the Kenya Data Protection Act on a UN funded hub.\n- Set up Google Tag Manager and Microsoft Clarity tracking.\nLanguages: English, learning German.`], { type: "text/plain" }), { contentType: "text/plain", upsert: true });
const { data: cv } = await db.from("vault_files").insert({ folder_id: null, name: `E2E CV ${stamp}.txt`, storage_path: cvPath, mime: "text/plain", size: 300, owner_id: admin.id }).select("id").single();
const tplPath = `vault/${admin.id}/e2e-template-${stamp}.txt`;
await db.storage.from("mjengo-docs").upload(tplPath, new Blob(["# Name\nContact line\n\n## Why this role\n## My evidence\n## Closing"], { type: "text/plain" }), { contentType: "text/plain", upsert: true });
const { data: tpl } = await db.from("vault_files").insert({ folder_id: null, name: `E2E letter template ${stamp}.txt`, storage_path: tplPath, mime: "text/plain", size: 60, owner_id: admin.id }).select("id").single();

async function chatCheck(page) {
	await page.getByRole("tab", { name: "Application" }).click();
	await page.getByRole("button", { name: "Add", exact: true }).click();
	await page.getByRole("button", { name: "AI chat", exact: true }).click();
	await page.getByRole("button", { name: /Start a chat about this/ }).click();
	await page.waitForURL(/assistant\?thread=/, { timeout: 60000 });
	const { data: th } = await db.from("mjengo_ai_threads").select("id, entity_id").eq("entity_id", opp.id).maybeSingle();
	check("an AI chat about the opportunity is started in the Assistant", !!th && page.url().includes(th.id));
	const { data: item } = await db.from("mjengo_context_items").select("id").eq("entity_id", opp.id).eq("kind", "chat").maybeSingle();
	check("it is linked into the context", !!item);
}
const browser = await launch();
let madeFile = null;
try {
	for (const dark of [false, true]) {
		const page = await newPage(browser, { viewport: { width: 1280, height: 900 } });
		await signIn(page, "admin");
		await page.addInitScript((d) => localStorage.setItem("ss_theme", d ? "dark" : "light"), dark);
		await page.goto(`${BASE}/dashboard/mjengo/opportunities/${opp.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await page.getByLabel("opportunity name").waitFor({ timeout: 90000 });
		if (!dark) {
			check("every side panel item is visible, with nothing to hide", (await page.getByRole("button", { name: /Hide .* from this panel|Show or hide/ }).count()) === 0);
		check("details with nothing in them are a quiet row of chips", (await page.getByRole("group", { name: "Add details" }).count()) === 1 && (await page.getByRole("heading", { name: "At a glance" }).count()) === 0);
			await page.getByRole("button", { name: /^\+?\s*Amount/ }).first().click();
			check("a chip opens its field", (await page.getByLabel(/Estimated value|Amount/i).count()) > 0);
		}
		await page.screenshot({ path: path.join(OUT, `app_overview_${dark ? "dark" : "light"}.png`) });

		await page.getByRole("tab", { name: "Application" }).click();
		await page.getByRole("region", { name: "Application agent" }).waitFor({ timeout: 90000 });
		if (dark) {
			await page.waitForTimeout(3000);
			await page.screenshot({ path: path.join(OUT, "app_application_dark.png"), fullPage: true });
			await page.close();
			continue;
		}
		check("the tab is called Application, not Pages and copies", (await page.getByRole("tab", { name: "Pages and copies" }).count()) === 0);
		check("cover letter, CV and another document are pills", (await page.getByRole("button", { name: "Cover letter", exact: true }).count()) === 1 && (await page.getByRole("button", { name: "CV", exact: true }).count()) === 1 && (await page.getByRole("button", { name: "Another document" }).count()) === 1);

		await page.getByRole("button", { name: "Cover letter", exact: true }).click();
		await page.getByText("Do you want to use a template for your cover letter?").waitFor({ timeout: 10000 });
		check("choosing a pill asks about a template", true);
		await page.getByRole("button", { name: "Cover letter", exact: true }).click();
		check("clicking a selected pill again unselects it", (await page.getByText("Do you want to use a template").count()) === 0);
		await page.getByRole("button", { name: "Cover letter", exact: true }).click();
		check("the model can be chosen", (await page.getByRole("combobox", { name: "AI model" }).count()) === 1);
		check("it cannot run before that is answered", await page.getByRole("button", { name: /^Create cover letter/ }).isDisabled());

		// Context: instructions, a note, skills, a link.
		await page.getByRole("button", { name: "Add", exact: true }).click();
		await page.getByLabel("Instructions").fill("Write in the first person and keep it to one page.");
		await page.getByRole("button", { name: "Skills", exact: true }).click();
		await page.getByRole("textbox", { name: "Skills" }).fill("WordPress and Sanity CMS\nGoogle Tag Manager and Microsoft Clarity");
		await page.getByRole("button", { name: "Add skills" }).click();
		await page.getByRole("button", { name: "Open Skills" }).waitFor({ timeout: 40000 });
		await page.getByRole("button", { name: "Add", exact: true }).click();
		await page.getByRole("button", { name: "Note", exact: true }).click();
		await page.getByRole("textbox", { name: "Note title" }).fill("German");
		await page.getByRole("textbox", { name: "Note", exact: true }).fill("I am learning German and will keep improving.");
		await page.getByRole("button", { name: "Add note" }).click();
		await page.getByRole("button", { name: "Open German" }).waitFor({ timeout: 40000 });
		check("skills and notes appear as cards", true);
		const ins = await poll(async () => (await db.from("mjengo_context_items").select("body").eq("entity_id", opp.id).eq("kind", "instruction").maybeSingle()).data?.body, { timeout: 30000, interval: 1000 });
		check("instructions save by themselves", !!ins && /first person/.test(ins));

		check("the funder's own page is the funder's call", (await page.getByText("example.org", { exact: false }).count()) >= 1);
		await page.getByRole("button", { name: "Add", exact: true }).click();
		await page.getByRole("button", { name: "GitHub", exact: true }).click();
		await page.getByLabel("GitHub repository").fill("https://github.com/vercel/swr");
		await page.getByRole("button", { name: "Add repository" }).click();
		await page.getByRole("button", { name: "Open GitHub: vercel/swr" }).waitFor({ timeout: 60000 });
		check("a GitHub repository is read and added as context", true);

		// Suggestions from Files, one at a time.
		await page.getByText("Found in your files").waitFor({ timeout: 60000 });
		check("the CV in Files is suggested", (await page.getByText(`E2E CV ${stamp}.txt`).count()) >= 1);
		await page.getByRole("button", { name: "Add as context" }).first().click();
		await page.getByRole("button", { name: `Open E2E CV ${stamp}.txt` }).waitFor({ timeout: 40000 });
		check("adding a suggestion makes it a context card", true);
		await page.getByRole("button", { name: `Open E2E CV ${stamp}.txt` }).click();
		await page.getByText("Digital platforms lead").waitFor({ timeout: 30000 });
		check("a file in context opens in full", true);
		await page.keyboard.press("Escape");

		await page.screenshot({ path: path.join(OUT, "app_application_light.png"), fullPage: true });

		if (!live) { console.log("(no AI key: the writing step is skipped)"); await chatCheck(page); await page.close(); continue; }
		// Template then write.
		await page.getByRole("button", { name: /Choose a template from Files/ }).click();
		await page.getByRole("dialog").getByText(`E2E letter template ${stamp}.txt`).first().click();
		await page.getByRole("button", { name: /^Attach/ }).click();
		await page.getByText(/Template:/).waitFor({ timeout: 20000 }).catch(() => {});
		await page.getByLabel("Prompt").fill("Address the German requirement honestly.");
		await page.getByRole("button", { name: /^Create cover letter/ }).click();
		await page.getByRole("region", { name: "What the agent wrote" }).waitFor({ timeout: 170000 });
		check("the agent wrote a cover letter", true);
		const doc = await poll(async () => (await db.from("mjengo_documents").select("id, vault_file_id").eq("entity_id", opp.id).not("vault_file_id", "is", null).neq("vault_file_id", cv.id).maybeSingle()).data, { timeout: 20000, interval: 1000 });
		madeFile = doc?.vault_file_id ?? null;
		check("it was saved to Files and added to the opportunity", !!doc);
		check("it did not invent a name that is not in the context", !/\bJohn Smith\b/i.test(await page.getByRole("region", { name: "What the agent wrote" }).innerText()));
		await page.screenshot({ path: path.join(OUT, "app_result_light.png"), fullPage: true });

		await page.getByRole("tab", { name: "To-dos and reminders" }).click();
		await page.getByText("Similar", { exact: true }).first().waitFor({ timeout: 60000 });
		check("Similar sits with the to-dos and reminders", true);
		await chatCheck(page);
		await page.close();
	}
} finally {
	await db.from("mjengo_context_items").delete().eq("entity_id", opp.id);
	await db.from("mjengo_ai_threads").delete().eq("entity_id", opp.id);
	await db.from("mjengo_documents").delete().eq("entity_id", opp.id);
	await db.from("mjengo_links").delete().eq("entity_id", opp.id);
	await db.from("mjengo_opportunities").delete().eq("id", opp.id);
	const ids = [cv.id, tpl.id, madeFile].filter(Boolean);
	const { data: gone } = await db.from("vault_files").select("storage_path").in("id", ids);
	await db.from("vault_files").delete().in("id", ids);
	await db.storage.from("mjengo-docs").remove([cvPath, tplPath, ...(gone ?? []).map((g) => g.storage_path)]);
	await browser.close();
}
summary();
