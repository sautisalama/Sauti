// The background picker: only Fill and Grid for a picture, and choosing the picture opens the picture's own settings
// even when the blur or colour settings were open. Grid draws the picture three across and three down.
//   node --env-file=.env.local scripts/e2e/uat/46-meet-picker.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const pick = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
const code = `${pick(3)}-${pick(4)}-${pick(3)}`;
await db.from("mjengo_meetings").insert({ code, mode: "video", title: "E2E picker", created_by: accounts.accounts.admin.id });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC", "base64");

const browser = await launch();
const page = await newPage(browser, {});
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await page.getByPlaceholder("How should people see you?").waitFor({ timeout: 90000 });
	await page.getByRole("button", { name: "Photo settings" }).waitFor({ timeout: 60000 });
	// Make sure there is a picture to choose.
	await page.getByRole("button", { name: "Photo settings" }).click();
	if ((await page.getByRole("button", { name: "Photo 1", exact: true }).count()) === 0) {
		await page.locator("input[type=file]").first().setInputFiles({ name: "bg.png", mimeType: "image/png", buffer: png });
		await page.getByRole("button", { name: "Photo 1", exact: true }).waitFor({ timeout: 30000 });
	}
	check("Only Fill and Grid are offered", (await page.getByRole("button", { name: "Fill", exact: true }).count()) === 1 && (await page.getByRole("button", { name: "Grid", exact: true }).count()) === 1 && (await page.getByRole("button", { name: "Fit", exact: true }).count()) === 0);

	// Blur settings open, then the picture tile: the picture's settings, not blur's.
	await page.getByRole("button", { name: "Blur settings" }).click();
	check("Blur settings are open", (await page.getByLabel("Amount of blur").count()) === 1);
	await page.getByRole("button", { name: "Photo", exact: true }).click({ timeout: 120000 });
	await page.getByRole("button", { name: "Photo 1", exact: true }).waitFor({ timeout: 15000 });
	check("Choosing the picture opens its settings (not blur)", (await page.getByLabel("Amount of blur").count()) === 0);

	// Same from the colour settings.
	await page.getByRole("button", { name: "Colour settings" }).click();
	check("Colour settings are open", (await page.getByLabel("First colour").count()) === 1);
	await page.getByRole("button", { name: "Photo", exact: true }).click({ timeout: 120000 });
	await page.getByRole("button", { name: "Photo 1", exact: true }).waitFor({ timeout: 15000 });
	check("…and the same from colour", (await page.getByLabel("First colour").count()) === 0);

	// Grid: three across, three down.
	await page.getByRole("button", { name: "Grid", exact: true }).click();
	check("Grid is selected", (await page.getByRole("button", { name: "Grid", exact: true }).getAttribute("aria-pressed")) === "true");
} catch (e) {
	check("Meet picker", false, String(e).slice(0, 300));
} finally {
	await db.from("mjengo_meetings").delete().eq("code", code);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
