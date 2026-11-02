import { BASE, launch, newPage, signIn } from "./lib.mjs";
import { db, acc } from "./helpers.mjs";
const { data: opp } = await db.from("mjengo_opportunities").insert({ title: "E2E autosave probe", status: "new", created_by: acc("admin").id, visibility: "team" }).select("id").single();
const browser = await launch();
const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text().slice(0, 200)); });
await signIn(page, "admin");
const T = Date.now();
const log = [];
page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) r._t = Date.now(); });
page.on("requestfinished", (r) => { if (r._t) log.push(`${String(r._t - T).padStart(6)}ms +${String(Date.now() - r._t).padStart(5)} ${r.headers()["next-action"].slice(0, 8)}`); });
await page.goto(`${BASE}/dashboard/mjengo/opportunities/${opp.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.getByLabel("opportunity name").waitFor({ timeout: 90000 });
await page.waitForTimeout(4000);
const t0 = Date.now();
await page.getByLabel("opportunity name").fill("E2E autosave probe renamed");
for (let i = 0; i < 20; i++) {
	await page.waitForTimeout(1500);
	const t = (await db.from("mjengo_opportunities").select("title").eq("id", opp.id).single()).data?.title;
	const status = await page.locator("p[aria-live=polite]").last().innerText().catch(() => "?");
	console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s db="${t}" ui="${status}"`);
	if (t.includes("renamed")) break;
}
console.log(log.join(String.fromCharCode(10)));
await db.from("mjengo_opportunities").delete().eq("id", opp.id);
await browser.close();
