// Shared helpers for the authenticated e2e run. Credentials come from the
// git-ignored .e2e-accounts.local.json written by seed.mjs (never printed).
import fs from "node:fs";
import { chromium } from "playwright-core";

export const BASE = process.env.E2E_BASE || "http://localhost:3000";
export const accounts = JSON.parse(fs.readFileSync(new URL("../../.e2e-accounts.local.json", import.meta.url), "utf8"));

const results = [];
export const check = (name, ok, detail = "") => {
	results.push({ name, ok: !!ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
export const summary = () => {
	const failed = results.filter((r) => !r.ok);
	console.log(`\n${results.length - failed.length}/${results.length} passed`);
	return failed.length;
};

export async function launch() {
	return chromium.launch({
		executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
		headless: true,
		args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
	});
}

export async function newPage(browser, opts = {}) {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["microphone", "geolocation"], geolocation: { latitude: -1.2921, longitude: 36.8219 }, ...opts });
	const page = await ctx.newPage();
	page.setDefaultTimeout(45000);
	page.errors = [];
	page.on("pageerror", (e) => page.errors.push(String(e)));
	return page;
}

/** Sign in through the real sign-in form. */
export async function signIn(page, role) {
	const { email, password } = accounts.accounts[role];
	await page.goto(`${BASE}/signin`, { waitUntil: "networkidle", timeout: 120000 });
	await page.fill('input[name="email"]', email);
	await page.fill('input[name="password"]', password);
	await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 90000 }), page.click('button[type="submit"]')]);
}
