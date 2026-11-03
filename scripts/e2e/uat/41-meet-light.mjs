// Light mode: the call screens follow the chosen theme, even when the computer prefers dark.
//   node --env-file=.env.local scripts/e2e/uat/41-meet-light.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const pick = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
const code = `${pick(3)}-${pick(4)}-${pick(3)}`;
await db.from("mjengo_meetings").insert({ code, mode: "video", title: "E2E light", created_by: accounts.accounts.admin.id });
const lum = (rgb) => { const [r, g, b] = rgb.match(/\d+/g).map(Number); return (r * 299 + g * 587 + b * 114) / 1000; };

const browser = await launch();
const page = await newPage(browser, { colorScheme: "dark" });
try {
	await page.addInitScript(() => { try { localStorage.setItem("ss_theme", "light"); } catch {} });
	await signIn(page, "admin");
	await page.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await page.getByPlaceholder("How should people see you?").waitFor({ timeout: 60000 });
	await page.waitForTimeout(1500);
	const surfaces = await page.evaluate(() => {
		const out = {};
		const bgOf = (el) => { while (el) { const c = getComputedStyle(el).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; el = el.parentElement; } return "rgb(255, 255, 255)"; };
		const wrap = document.querySelector("div.fixed.inset-0") || document.body;
		out.page = getComputedStyle(wrap).backgroundColor;
		out.bodyFallback = bgOf(wrap);
		out.dark = document.documentElement.classList.contains("dark");
		const h1 = document.querySelector("h1");
		out.title = h1 ? getComputedStyle(h1).color : "";
		return out;
	});
	await page.screenshot({ path: process.env.SHOTS + "/light-prejoin.png" });
	check("Pre-join is light in light mode", !surfaces.dark && lum(surfaces.page) > 200, JSON.stringify(surfaces));
} catch (e) {
	check("Light mode", false, String(e).slice(0, 300));
} finally {
	await db.from("mjengo_meetings").delete().eq("code", code);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
