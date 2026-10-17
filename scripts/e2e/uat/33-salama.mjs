// Salama, the team's AI member: the panel opens from the dock, answers a question about the team's own work
// from what is in the workspace, cites where it came from, and says so when it has nothing.
//   node --env-file=.env.local scripts/e2e/uat/33-salama.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(60000);
await page.setViewportSize({ width: 1500, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const tag = `zq${Date.now()}`;
let grant = null;
try {
	const { data } = await db.from("mjengo_grants").insert({ title: `Mwangaza ${tag} survivor fund`, funder: "Harmony Trust", status: "drafting", amount: 45000, currency: "USD", deadline: "2026-12-01", owner_id: accounts.accounts.admin.id }).select("id").single();
	grant = data;

	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo`, { waitUntil: "domcontentloaded", timeout: 180000 });
	// The dock expands on hover or focus; the Salama button is one of its tools.
	const handle = page.getByRole("button", { name: /Quick actions/ }).first();
	await handle.waitFor({ timeout: 120000 });
	await handle.hover();
	await page.getByRole("button", { name: "Salama", exact: true }).click();
	const panel = page.getByRole("dialog", { name: "Ask Salama" });
	await panel.waitFor();
	check("The Salama panel opens from the dock", true);

	await panel.getByLabel("Ask Salama").fill(`What is the status of the Mwangaza ${tag} fund?`);
	await panel.getByRole("button", { name: "Send" }).click();
	await panel.getByText(/drafting/i).first().waitFor({ timeout: 90000 });
	check("She answers from the workspace", true);
	const cites = await panel.getByRole("link", { name: new RegExp(`Mwangaza ${tag}`) }).count();
	check("She shows where the answer came from", cites > 0);

	await panel.getByLabel("Ask Salama").fill(`What is our policy on staff holidays in ${tag}x?`);
	await panel.getByRole("button", { name: "Send" }).click();
	await panel.getByText(/found nothing/i).first().waitFor({ timeout: 90000 });
	check("She says so when she has nothing", true);
	check("No page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
	check("Salama flow", false, String(e).slice(0, 300));
	await page.screenshot({ path: `${process.env.TEMP}/salama-fail.png` }).catch(() => undefined);
} finally {
	if (grant) await db.from("mjengo_grants").delete().eq("id", grant.id);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
