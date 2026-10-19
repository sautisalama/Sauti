// The Overview search: a fragment from inside a file finds it (with the words marked), a question in other words
// finds it by meaning, tags and team member narrow the results, and Find similar shows neighbours.
//   node --env-file=.env.local scripts/e2e/uat/37-search.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tag = `zq${Date.now()}`;
const me = accounts.accounts.admin.id;
const LEGAL = ["Court registries open at eight and queues are long, so paralegals bring a flask and a folder of copies.", "A protection order lasts twelve months and can be renewed when the magistrate is satisfied that danger remains.", "Referral forms are filled in with the survivor, copied once, and the original is kept in the locked cabinet."];
const OFFICE = ["Printer paper is stored in the second cupboard and toner in the box under the desk.", "The generator is serviced every quarter and the diesel log is signed by the caretaker.", "Visitors sign the book at the gate and wear a badge while they are in the building."];
const pad = (n, pool = LEGAL) => Array.from({ length: n }, (_, i) => pool[i % pool.length]).join(" ");
const fragment = `the borehole committee voted to repaint the community hall ${tag}`;
const files = [];
const add = async (name, body) => {
	const path = `e2e/${tag}-${name}`;
	await db.storage.from("mjengo-docs").upload(path, Buffer.from(body), { contentType: "text/plain", upsert: true });
	const { data } = await db.from("vault_files").insert({ name, storage_path: path, mime: "text/plain", size: body.length, owner_id: me }).select("id").single();
	files.push({ id: data.id, path });
	return data.id;
};
const idA = await add(`minutes-${tag}.txt`, `${pad(6, OFFICE)} Item four: ${fragment}, after a long discussion. ${pad(6, OFFICE)}`);
const idB = await add(`handover-${tag}.txt`, `Notes for the incoming paralegal: women who survived abuse at home are helped to reach the court and to ask for a protection order. ${pad(4)}`);

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(150000);
await page.setViewportSize({ width: 1400, height: 1100 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo`, { waitUntil: "domcontentloaded", timeout: 180000 });
	const box = page.getByLabel("Search everything");
	await box.waitFor();

	// The first search also starts reading new files into the index; the page looks again by itself.
	await box.fill(fragment);
	await page.getByRole("link", { name: `minutes-${tag}.txt` }).waitFor({ timeout: 150000 });
	check("A fragment from inside a file finds the file", true);
	const mark = await page.locator("mark").first().innerText();
	check("The words found are marked in the passage", mark.toLowerCase() === fragment.toLowerCase(), mark);
	check("It says it matched the exact words", (await page.getByText(/exact words|words and meaning/).count()) > 0);

	await box.fill("help for women who suffered violence at home to get to court");
	await page.getByRole("link", { name: `handover-${tag}.txt` }).waitFor({ timeout: 60000 });
	check("A question in other words finds a file by meaning", true);
	check("The file about the hall repaint is not offered for that question", (await page.getByRole("link", { name: `minutes-${tag}.txt` }).count()) === 0);

	// Filters: kind, tags, team member.
	await page.getByRole("button", { name: "Documents", exact: true }).click();
	await page.getByRole("link", { name: `handover-${tag}.txt` }).waitFor({ timeout: 30000 });
	check("Filtering by kind keeps the documents", true);
	await page.getByRole("button", { name: "Grants", exact: true }).click();
	await page.getByRole("button", { name: "Documents", exact: true }).click();
	await page.waitForFunction((t) => !document.body.innerText.includes(`handover-${t}.txt`), tag, { timeout: 30000 });
	check("Filtering by another kind removes them", true);
	await page.getByRole("button", { name: "Grants", exact: true }).click();
	const members = page.getByLabel("Filter by team member");
	await members.selectOption({ index: 1 });
	await page.waitForTimeout(1500);
	await members.selectOption("");
	await page.getByRole("link", { name: `handover-${tag}.txt` }).waitFor({ timeout: 30000 });
	check("The team member filter is there and clears", true);

	// Tags came from the autotagger: the first tag chip of a result narrows the search to it.
	const chip = page.locator("li button.rounded-full").filter({ hasText: /^[a-z]/ }).first();
	const chipText = (await chip.innerText()).trim();
	await chip.click();
	await page.getByRole("group", { name: "Filter by tag" }).getByRole("button", { pressed: true }).first().waitFor({ timeout: 30000 });
	check("Tapping a tag on a result filters by it", chipText.length > 1, chipText);
	await page.getByRole("button", { name: "Clear", exact: true }).click();

	await page.getByRole("button", { name: "Find similar" }).first().click();
	await page.getByText(/Similar to/).first().waitFor({ timeout: 60000 });
	check("Find similar opens neighbours under the result", true);
	check("No page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
	check("Search flow", false, String(e).slice(0, 300));
	await page.screenshot({ path: `${process.env.TEMP}/search-fail.png` }).catch(() => undefined);
} finally {
	for (const f of files) { await db.from("mjengo_search_chunks").delete().eq("source_id", f.id); await db.from("mjengo_search_sources").delete().eq("source_id", f.id); await db.from("vault_files").delete().eq("id", f.id); await db.storage.from("mjengo-docs").remove([f.path]); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
