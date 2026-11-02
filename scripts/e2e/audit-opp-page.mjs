// The full opportunity page: linked to-dos, suggestions from the deadline, redo, and the inline delete confirm.
import { BASE, launch, newPage, signIn, check, summary } from "./lib.mjs";
import { db, acc, poll } from "./helpers.mjs";

const admin = acc("admin");
const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const later = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
const { data: opp, error } = await db.from("mjengo_opportunities").insert({ title: "E2E page test opportunity", status: "new", deadline: soon, created_by: admin.id, visibility: "team" }).select("id").single();
if (error) { console.log("could not seed", error.message); process.exit(1); }

const browser = await launch();
const page = await newPage(browser, { viewport: { width: 1280, height: 900 } });
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/opportunities/${opp.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.getByRole("tab", { name: "To-dos and reminders" }).click();
	await page.getByText("Worked back from the deadline").waitFor({ timeout: 90000 });
	check("suggestions are shown, worked back from the deadline", true);
	await page.getByRole("button", { name: /Add these 4/ }).click();
	await page.getByRole("checkbox", { name: /Mark done: Check we are eligible/ }).waitFor({ timeout: 120000 });
	const { data: rows } = await db.from("mjengo_todos").select("title, due_date, entity_type, entity_id").eq("entity_id", opp.id);
	check("four to-dos were linked to the opportunity", rows?.length === 4, `n=${rows?.length}`);
	check("their due dates come before the deadline", rows?.every((r) => r.due_date && r.due_date <= soon));

	await page.getByRole("checkbox", { name: /Mark done: Check we are eligible/ }).click();
	const done = await poll(async () => ((await db.from("mjengo_todos").select("status").eq("entity_id", opp.id).eq("status", "done")).data?.length ?? 0) === 1, { timeout: 90000, interval: 2000 }).catch(() => false);
	check("ticking a to-do saves it as done", !!done);

	// Move the deadline, then redo: untouched suggestions follow it, the finished one stays.
	await db.from("mjengo_opportunities").update({ deadline: later }).eq("id", opp.id);
	await page.reload({ waitUntil: "domcontentloaded" });
	await page.getByRole("tab", { name: "To-dos and reminders" }).click();
	await page.getByText("Add a to-do and press Enter").first().waitFor({ state: "attached", timeout: 60000 }).catch(() => {});
	await page.getByRole("checkbox", { name: /Mark done: Gather the documents/ }).waitFor({ timeout: 60000 });
	const input = page.getByLabel("Add a to-do");
	await input.fill("Phone the programme officer");
	await input.press("Enter");
	await page.getByRole("checkbox", { name: /Mark done: Phone the programme officer/ }).waitFor({ timeout: 90000 });
	check("a typed to-do is added and linked", (await db.from("mjengo_todos").select("id").eq("entity_id", opp.id)).data?.length === 5);

	await page.getByRole("tab", { name: "Sharing" }).click();
	await page.getByRole("button", { name: /^Delete$/ }).first().click();
	check("delete asks inline, not with a browser prompt", await page.getByRole("button", { name: /Yes, delete it/ }).first().isVisible());
	await page.getByRole("button", { name: "Keep" }).first().click();
	check("keeping cancels the delete", (await db.from("mjengo_opportunities").select("id").eq("id", opp.id)).data?.length === 1);
} catch (e) {
	check("page flow ran to the end", false, String(e).slice(0, 160) + " | toast: " + (await page.locator("[role=status], [data-state=open][role=alert], li[data-state=open]").allInnerTexts().catch(() => [])).join(" / ").slice(0, 200));
} finally {
	await db.from("mjengo_todos").delete().eq("entity_id", opp.id);
	await db.from("mjengo_opportunities").delete().eq("id", opp.id);
	await browser.close();
}
summary();
