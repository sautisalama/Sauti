// The Mjengo side menu: "Hide items" opens a choice for every item, hidden items leave the menu and the rest sit in the
// middle between the top and the bottom controls. It follows the account and the phone strip.
import { BASE, launch, newPage, signIn, check, summary } from "./lib.mjs";
import { db, acc, poll } from "./helpers.mjs";

const admin = acc("admin");
const clear = async () => { const { data: pr } = await db.from("profiles").select("settings").eq("id", admin.id).single(); const st = { ...(pr?.settings ?? {}) }; delete st.mjengo_nav; await db.from("profiles").update({ settings: st }).eq("id", admin.id); };
await clear();
const browser = await launch();
try {
	const page = await newPage(browser, { viewport: { width: 1360, height: 1500 } });
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo`, { waitUntil: "domcontentloaded", timeout: 120000 });
	const link = (n) => page.getByRole("link", { name: n, exact: true });
	await link("Contacts").first().waitFor({ timeout: 90000 });
	const y = async (loc) => (await loc.first().boundingBox())?.y ?? -1;
	check("there is no Back to dashboard in the menu", (await page.getByRole("link", { name: /Back to dashboard/ }).count()) === 0);
	const overviewBefore = await y(link("Overview"));
	check("no choices show on the items until Hide items is chosen", (await page.getByRole("checkbox").count()) === 0);

	await page.getByRole("button", { name: "Hide items" }).click();
	check("Hide items shows a choice beside every item", (await page.getByRole("checkbox", { name: "Show Contacts in the menu" }).count()) === 1);
	check("Overview cannot be hidden", await page.getByRole("checkbox", { name: "Show Overview in the menu" }).isDisabled());
	await page.getByRole("checkbox", { name: "Show Contacts in the menu" }).click();
	await page.getByRole("button", { name: "Done", exact: true }).click();
	await link("Contacts").first().waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
	check("an unticked item leaves the menu", (await link("Contacts").count()) === 0);
	await page.waitForTimeout(600);
	check("Hide items stays with the items, with no bar of controls at the bottom", (await page.getByRole("button", { name: "Hide items" }).count()) === 1 && (await page.getByRole("button", { name: "Reset the menu" }).count()) === 0);
	check("the remaining items move to the middle", (await y(link("Overview"))) > overviewBefore + 20);
	await page.screenshot({ path: "audit-out/nav_hidden.png" });

	const saved = await poll(async () => { const h = (await db.from("profiles").select("settings").eq("id", admin.id).single()).data?.settings?.mjengo_nav?.hidden; return Array.isArray(h) && h.includes("mj-contacts"); }, { timeout: 45000, interval: 1000 });
	check("what was hidden is saved to the account", !!saved);
	await page.reload({ waitUntil: "domcontentloaded" });
	await link("Opportunities").first().waitFor({ timeout: 90000 });
	await link("Contacts").first().waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
	check("it stays hidden after a reload", (await link("Contacts").count()) === 0);

	const phone = await newPage(browser, { viewport: { width: 390, height: 800 } });
	await signIn(phone, "admin");
	await phone.goto(`${BASE}/dashboard/mjengo`, { waitUntil: "domcontentloaded", timeout: 120000 });
	const strip = phone.getByRole("navigation", { name: "Mjengo sections" });
	await strip.getByRole("link", { name: "Opportunities" }).waitFor({ timeout: 90000 });
	await strip.getByRole("link", { name: "Contacts" }).waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
	check("the phone strip leaves out what was hidden", (await strip.getByRole("link", { name: "Contacts" }).count()) === 0 && (await strip.getByRole("link", { name: "Mail" }).count()) === 1);
	await phone.close();

	await page.getByRole("button", { name: "Hide items" }).click();
	await page.getByRole("checkbox", { name: "Show Contacts in the menu" }).click();
	await page.getByRole("button", { name: "Done", exact: true }).click();
	await link("Contacts").first().waitFor({ timeout: 10000 });
	check("ticking it again brings it back", true);
	await poll(async () => { const h = (await db.from("profiles").select("settings").eq("id", admin.id).single()).data?.settings?.mjengo_nav?.hidden; return Array.isArray(h) && !h.includes("mj-contacts"); }, { timeout: 45000, interval: 1000 });
} finally {
	await clear();
	await browser.close();
}
summary();
