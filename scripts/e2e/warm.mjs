// Production build: after sign-in the app warms itself; then clicking Mail, Design, Documents and Files should
// need no server calls and show content straight away. Run against `next start` (prefetching is off in dev).
import { BASE, check, launch, newPage, signIn, summary } from "./lib.mjs";

const browser = await launch();
const page = await newPage(browser);
await signIn(page, "admin");
await page.goto(`${BASE}/dashboard/mjengo`, { waitUntil: "domcontentloaded", timeout: 120000 });

// Let the start-up warmer work.
const wait = Number(process.env.WARM_SECONDS || 40);
await page.waitForTimeout(wait * 1000);

const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("ss_swr:")).map((k) => k.split(":").slice(2).join(":")));
const saved = keys.length; console.log(keys.join(", "));
check("data was kept ahead of time", saved >= 8, `${saved} items held`);

for (const [label, href, ready] of [
	["Mail", "/dashboard/mjengo/mail", 'text=/Inbox|All inboxes|caught up/i'],
	["Design", "/dashboard/mjengo/design", "text=/Design|template/i"],
	["Opportunities", "/dashboard/mjengo/opportunities", "text=/Opportunit/i"],
	["To-dos", "/dashboard/mjengo/todos", "text=/To-dos|task/i"],
	["Contacts", "/dashboard/mjengo/contacts", "text=/Contacts/i"],
	["Files", "/dashboard/mjengo/vault", "text=/Files|My files|folder/i"],
	["Calendar", "/dashboard/mjengo/calendar", "text=/Calendar|Today/i"],
]) {
	let calls = 0;
	const count = (req) => { if (req.method() === "POST" && req.headers()["next-action"]) calls++; };
	page.on("request", count);
	const t0 = Date.now();
	await page.evaluate((h) => { const a = [...document.querySelectorAll("a")].find((x) => x.getAttribute("href") === h); if (a) a.click(); else history.pushState(null, "", h); }, href);
	await page.waitForURL((u) => u.pathname.startsWith(href), { timeout: 30000 });
	await page.locator(ready).first().waitFor({ timeout: 30000 });
	const ms = Date.now() - t0;
	await page.waitForTimeout(300);
	page.off("request", count);
	check(`${label} opens fast`, ms < 1500, `${ms} ms to content, ${calls} server call(s) during the click`);
}

console.log("page errors:", page.errors.length ? page.errors.slice(0, 3) : "none");
await browser.close();
process.exit(summary() ? 1 : 0);
