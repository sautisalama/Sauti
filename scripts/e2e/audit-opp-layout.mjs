// The rethought opportunity page: header with stage steps, autosave, tabs, key facts, related pages and copies.
import path from "node:path";
import { BASE, launch, newPage, signIn, check, summary } from "./lib.mjs";
import { db, acc, poll } from "./helpers.mjs";

const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
const admin = acc("admin");
const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
const { data: opp, error } = await db.from("mjengo_opportunities").insert({
	title: "E2E layout opportunity", organisation: "Example Foundation", status: "new", deadline: soon, created_by: admin.id, visibility: "team",
	source_url: "https://example.org/calls/youth-fund",
	verification: { status: "done", at: new Date().toISOString(), trust: "likely", trustReason: "e2e", sourceKind: "official", sourceHost: "example.org", account: null, organisation: "Example Foundation", website: { url: "https://example.org", host: "example.org", title: "Example Foundation", description: null, image: null, favicon: null, siteName: null }, applyUrl: "https://example.org/apply", title: null, category: null, deadline: null, deadlineQuote: null, eligibility: null, deliverables: null, email: null, checks: [] },
}).select("id").single();
if (error) { console.log("could not seed", error.message); process.exit(1); }

const browser = await launch();
for (const dark of [false, true]) {
	const page = await newPage(browser, { viewport: { width: 1280, height: 900 } });
	await signIn(page, "admin");
	await page.addInitScript((d) => localStorage.setItem("ss_theme", d ? "dark" : "light"), dark);
	await page.goto(`${BASE}/dashboard/mjengo/opportunities/${opp.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByLabel("opportunity name").waitFor({ timeout: 90000 });
	if (!dark) {
		check("title is editable in the header", (await page.getByLabel("opportunity name").inputValue()) === "E2E layout opportunity");
		check("stage is a compact menu", (await page.getByRole("combobox", { name: "Stage" }).count()) === 1);
		check("no Save button", (await page.getByRole("button", { name: /^Save$/ }).count()) === 0);

		await page.getByLabel("opportunity name").fill("E2E layout opportunity renamed");
		const saved = await poll(async () => (await db.from("mjengo_opportunities").select("title").eq("id", opp.id).single()).data?.title === "E2E layout opportunity renamed", { timeout: 30000, interval: 1000 });
		check("typing saves by itself", !!saved);

		await page.getByRole("combobox", { name: "Stage" }).click();
		const stages = await page.getByRole("option").allInnerTexts();
		await page.getByRole("option").nth(1).click();
		const moved = await poll(async () => (await db.from("mjengo_opportunities").select("status").eq("id", opp.id).single()).data?.status !== "new", { timeout: 30000, interval: 1000 });
		check(`choosing a stage saves it (${stages.join(", ")})`, !!moved);

		await page.getByRole("tab", { name: "Application" }).click();
		check("related pages list the source, the site and where to apply", (await page.getByText("The organisation's own site").count()) === 1 && (await page.getByText("Where to apply").count()) === 1);
		check("documents checklist sits beside the pages", (await page.getByText(/Documents|Add a document|needed/i).count()) > 0);
		await page.getByRole("tab", { name: "To-dos and reminders" }).click();
		await page.getByLabel("Add a to-do").waitFor({ timeout: 60000 }).catch(() => {});
			check("to-dos tab shows to-dos", (await page.getByLabel("Add a to-do").count()) > 0);
		await page.getByRole("tab", { name: "Sharing" }).click();
		check("delete is in Sharing", (await page.getByRole("button", { name: /^Delete$/ }).count()) > 0);
		await page.getByRole("tab", { name: "Application" }).click();
	}
	await page.waitForTimeout(1500);
	await page.screenshot({ path: path.join(OUT, `opp_layout_${dark ? "dark" : "light"}.png`), fullPage: false });
	await page.close();
}
await db.from("mjengo_opportunities").delete().eq("id", opp.id);
await browser.close();
summary();
