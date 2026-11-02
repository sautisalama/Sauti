// The Mjengo side menu: any item can be hidden with one click and brought back from the Hidden list, and it follows the account.
import { BASE, launch, newPage, signIn, check, summary } from "./lib.mjs";
import { db, acc, poll } from "./helpers.mjs";

const admin = acc("admin");
{ const { data: pr } = await db.from("profiles").select("settings").eq("id", admin.id).single(); const st = { ...(pr?.settings ?? {}) }; delete st.mjengo_nav; await db.from("profiles").update({ settings: st }).eq("id", admin.id); }
const browser = await launch();
try {
	const page = await newPage(browser, { viewport: { width: 1360, height: 900 } });
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo`, { waitUntil: "domcontentloaded", timeout: 120000 });
	const menu = page.locator("aside, nav").filter({ has: page.getByRole("link", { name: "Opportunities" }) }).first();
	await page.getByRole("link", { name: "Contacts" }).first().waitFor({ timeout: 90000 });
	const backY = async () => (await page.getByRole("link", { name: /Back to dashboard/ }).first().boundingBox())?.y ?? -1;
	const before = await backY();
	await page.getByRole("link", { name: "Contacts" }).first().hover();
	await page.getByRole("button", { name: "Hide Contacts from the menu" }).click();
	await page.getByRole("link", { name: "Contacts" }).first().waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
	check("an item can be hidden from the menu", (await page.getByRole("link", { name: "Contacts", exact: true }).count()) === 0);
	await page.waitForTimeout(500);
	const after = await backY();
	await page.screenshot({ path: "audit-out/nav_hidden.png" });
	check("Back to dashboard stays at the bottom of the menu, in view", before > 0 && after > 0 && Math.abs(before - after) < 3 && after < 900);
	check("Overview cannot be hidden", (await page.getByRole("button", { name: "Hide Overview from the menu" }).count()) === 0);
	await page.getByRole("button", { name: /^Hidden \(1\)/ }).click();
	check("hidden items are listed so they can be added back", (await page.getByRole("button", { name: "Show Contacts in the menu again" }).count()) === 1);
	const saved = await poll(async () => { const h = (await db.from("profiles").select("settings").eq("id", admin.id).single()).data?.settings?.mjengo_nav?.hidden; return Array.isArray(h) && h.includes("mj-contacts"); }, { timeout: 45000, interval: 1000 });
	check("what was hidden is saved to the account", !!saved);
	await page.reload({ waitUntil: "domcontentloaded" });
	await page.getByRole("link", { name: "Opportunities" }).first().waitFor({ timeout: 90000 });
	await page.getByRole("link", { name: "Contacts", exact: true }).first().waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
	check("it stays hidden after a reload", (await page.getByRole("link", { name: "Contacts", exact: true }).count()) === 0);
	const phone = await newPage(browser, { viewport: { width: 390, height: 800 } });
	await signIn(phone, "admin");
	await phone.goto(`${BASE}/dashboard/mjengo`, { waitUntil: "domcontentloaded", timeout: 120000 });
	const strip = phone.getByRole("navigation", { name: "Mjengo sections" });
	await strip.getByRole("link", { name: "Opportunities" }).waitFor({ timeout: 90000 });
	await strip.getByRole("link", { name: "Contacts" }).waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
	check("the phone strip leaves out what was hidden", (await strip.getByRole("link", { name: "Contacts" }).count()) === 0 && (await strip.getByRole("link", { name: "Mail" }).count()) === 1);
	await phone.close();
	await page.getByRole("button", { name: /^Hidden \(1\)/ }).click();
	await page.getByRole("button", { name: "Show Contacts in the menu again" }).click();
	await page.getByRole("link", { name: "Contacts", exact: true }).first().waitFor({ timeout: 10000 });
	check("adding it back shows it in the menu again", true);
	await poll(async () => { const h = (await db.from("profiles").select("settings").eq("id", admin.id).single()).data?.settings?.mjengo_nav?.hidden; return Array.isArray(h) && !h.includes("mj-contacts"); }, { timeout: 45000, interval: 1000 });
	void menu;
} finally {
	const { data: pr } = await db.from("profiles").select("settings").eq("id", admin.id).single();
	const st = { ...(pr?.settings ?? {}) }; delete st.mjengo_nav;
	await db.from("profiles").update({ settings: st }).eq("id", admin.id);
	await browser.close();
}
summary();
