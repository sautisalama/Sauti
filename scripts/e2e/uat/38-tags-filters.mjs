// Tags and filters across modules: grants (tag filter, team member filter, tag editor, suggested tags, similar),
// to-dos (tag filter) and files (tag filter and the tags dialog).
//   node --env-file=.env.local scripts/e2e/uat/38-tags-filters.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tag = `zq${Date.now()}`;
const me = accounts.accounts.admin.id;
const tA = `kibera-${tag.slice(2, 8)}`;
const tB = `budget-${tag.slice(2, 8)}`;
const { data: gA } = await db.from("mjengo_grants").insert({ title: `Survivor legal aid ${tag}`, funder: "Harmony Trust", status: "drafting", created_by: me, owner_id: me, tags: [tA, "legal-aid"], description: "Peer paralegals help survivors reach the courts." }).select("id").single();
const { data: gB } = await db.from("mjengo_grants").insert({ title: `Office refurbishment ${tag}`, status: "idea", created_by: null, tags: [tB], description: "Painting and shelving for the office." }).select("id").single();
const { data: track } = await db.from("mjengo_todo_tracks").insert({ name: `tags ${tag}`, created_by: me }).select("id").single();
const { data: todoA } = await db.from("mjengo_todos").insert({ track_id: track.id, title: `Call the clinic ${tag}`, tags: [tA], created_by: me, assignee_ids: [me] }).select("id").single();
const { data: todoB } = await db.from("mjengo_todos").insert({ track_id: track.id, title: `Order paint ${tag}`, tags: [tB], created_by: me, assignee_ids: [me] }).select("id").single();
const path = `e2e/${tag}-tagged.txt`;
await db.storage.from("mjengo-docs").upload(path, Buffer.from("Notes about the peer paralegal programme and referral numbers."), { contentType: "text/plain", upsert: true });
const { data: file } = await db.from("vault_files").insert({ name: `tagged-${tag}.txt`, storage_path: path, mime: "text/plain", size: 60, owner_id: me, tags: [tA] }).select("id").single();
const { data: file2 } = await db.from("vault_files").insert({ name: `plain-${tag}.txt`, storage_path: path, mime: "text/plain", size: 60, owner_id: me, tags: [tB] }).select("id").single();

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(90000);
await page.setViewportSize({ width: 1500, height: 1100 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const tagBtn = (g, t) => page.getByRole("group", { name: "Filter by tag" }).getByRole("button", { name: new RegExp(`^${t.replace("-", " ")}`) });
try {
	await signIn(page, "admin");

	// Grants
	await page.goto(`${BASE}/dashboard/mjengo/grants`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByText(`Survivor legal aid ${tag}`).first().waitFor();
	await page.getByText(`Office refurbishment ${tag}`).first().waitFor();
	await tagBtn(null, tA).click();
	await page.waitForFunction((t) => !document.body.innerText.includes(`Office refurbishment ${t}`), tag, { timeout: 30000 });
	check("Filtering grants by a tag keeps only those with it", (await page.getByText(`Survivor legal aid ${tag}`).count()) > 0);
	await tagBtn(null, tA).click();
	await page.getByText(`Office refurbishment ${tag}`).first().waitFor();
	const members = page.getByLabel("Filter by team member");
	await members.selectOption(me);
	await page.getByText(`Survivor legal aid ${tag}`).first().waitFor();
	await page.waitForFunction((t) => !document.body.innerText.includes(`Office refurbishment ${t}`), tag, { timeout: 30000 });
	check("Filtering by team member keeps what that person owns", true);
	await members.selectOption("");

	await page.locator('[tabindex="0"]').filter({ hasText: `Survivor legal aid ${tag}` }).first().click();
	await page.getByText("Tags", { exact: true }).first().waitFor();
	await page.getByLabel("Add a tag").first().fill(`added-${tag.slice(2, 8)}`);
	await page.getByLabel("Add a tag").first().press("Enter");
	await page.getByText(`added ${tag.slice(2, 8)}`).first().waitFor({ timeout: 30000 });
	// Saving waits behind the calls the sheet makes when it opens (twice over in development), so it is given time.
	let saved = [];
	for (let i = 0; i < 60 && !saved.includes(`added-${tag.slice(2, 8)}`); i++) { saved = (await db.from("mjengo_grants").select("tags").eq("id", gA.id).single()).data.tags; if (!saved.includes(`added-${tag.slice(2, 8)}`)) await page.waitForTimeout(2000); }
	check("A tag added in the grant is saved", saved.includes(`added-${tag.slice(2, 8)}`) && saved.includes(tA), saved.join(","));
	await page.getByRole("button", { name: "Suggest tags" }).first().click();
	let after = saved;
	for (let i = 0; i < 60 && after.length <= saved.length; i++) { await page.waitForTimeout(2000); after = (await db.from("mjengo_grants").select("tags").eq("id", gA.id).single()).data.tags; }
	check("Suggest tags adds tags from what the grant says and keeps the existing ones", after.length > saved.length && saved.every((t) => after.includes(t)), after.join(","));
	await page.getByRole("button", { name: "Find similar" }).first().click();
	await page.getByText(/Nothing else reads like this yet|Similar/).first().waitFor({ timeout: 60000 });
	check("Find similar answers inside the grant", true);

	// To-dos
	await page.goto(`${BASE}/dashboard/mjengo/todos`, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: /^Tasks/ }).first().click().catch(() => undefined);
	await page.getByText(`Call the clinic ${tag}`).first().waitFor();
	await tagBtn(null, tB).click();
	await page.getByText(`Order paint ${tag}`).first().waitFor();
	await page.waitForFunction((t) => !document.body.innerText.includes(`Call the clinic ${t}`), tag, { timeout: 30000 });
	check("Filtering to-dos by a tag keeps only those with it", true);

	// Files
	await page.goto(`${BASE}/dashboard/mjengo/vault`, { waitUntil: "domcontentloaded" });
	await page.getByText(`tagged-${tag}.txt`).first().waitFor();
	await tagBtn(null, tA).click();
	await page.waitForFunction((t) => !document.body.innerText.includes(`plain-${t}.txt`), tag, { timeout: 30000 });
	check("Filtering files by a tag keeps only those with it", (await page.getByText(`tagged-${tag}.txt`).count()) > 0);
	await tagBtn(null, tA).click();
	check("No page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
	check("Tags and filters flow", false, String(e).slice(0, 300));
	await page.screenshot({ path: `${process.env.TEMP}/tags-fail.png` }).catch(() => undefined);
} finally {
	for (const f of [file, file2]) if (f) { await db.from("mjengo_search_chunks").delete().eq("source_id", f.id); await db.from("mjengo_search_sources").delete().eq("source_id", f.id); await db.from("vault_files").delete().eq("id", f.id); }
	await db.storage.from("mjengo-docs").remove([path]);
	for (const t of [todoA, todoB]) if (t) { await db.from("mjengo_search_sources").delete().eq("source_id", t.id); await db.from("mjengo_search_chunks").delete().eq("source_id", t.id); await db.from("mjengo_todos").delete().eq("id", t.id); }
	if (track) await db.from("mjengo_todo_tracks").delete().eq("id", track.id);
	for (const g of [gA, gB]) if (g) { await db.from("mjengo_search_sources").delete().eq("source_id", g.id); await db.from("mjengo_search_chunks").delete().eq("source_id", g.id); await db.from("mjengo_grants").delete().eq("id", g.id); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
