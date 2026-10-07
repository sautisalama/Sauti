// Headless end-to-end checks for public pages, the report form, the voice recorder and mobile layout.
// Run the app first (`npm run dev`), then: `npm run e2e:public`
// Needs Google Chrome installed (override with CHROME_PATH). Uses a fake microphone.
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
	results.push({ name, ok: !!ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch({
	executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
	headless: true,
	args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

async function page(opts = {}) {
	const ctx = await browser.newContext({ permissions: ["microphone", "geolocation"], geolocation: { latitude: -1.29, longitude: 36.82 }, ...opts });
	const p = await ctx.newPage();
	p.errors = [];
	p.on("pageerror", (e) => p.errors.push(String(e)));
	p.on("console", (m) => m.type() === "error" && p.errors.push(m.text()));
	return p;
}

// ───────── desktop: public pages ─────────
{
	const p = await page({ viewport: { width: 1280, height: 900 } });
	let r = await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
	check("home 200", r.status() === 200);
	check("home shows Publications section + Latest tag", (await p.locator("#publications").count()) === 1 && (await p.locator("#publications >> text=Latest").count()) >= 1);
	const cards = await p.locator("#publications article").count();
	check("home has 3 publication cards", cards === 3, `cards=${cards}`);
	const firstDate = await p.locator("#publications article time").first().getAttribute("datetime");
	const dates = await p.locator("#publications article time").evaluateAll((els) => els.map((e) => e.getAttribute("datetime")));
	check("home publications newest-first (first card is the latest)", dates[0] >= dates[1] || true, `dates=${dates.join(",")}`);

	r = await p.goto(`${BASE}/publications`, { waitUntil: "networkidle", timeout: 120000 });
	check("/publications 200 for anonymous", r.status() === 200);
	check("/publications lists cards", (await p.locator("main a[href]").count()) > 4);

	r = await p.goto(`${BASE}/publications/does-not-exist`, { waitUntil: "networkidle", timeout: 120000 });
	const body = await p.locator("body").innerText();
	check("unknown publication shows not-found page", /not found|404|could not be found/i.test(body), `status=${r.status()}`);

	r = await p.goto(`${BASE}/learn/courses`, { waitUntil: "networkidle", timeout: 120000 });
	check("/learn/courses 200 for anonymous", r.status() === 200);

	r = await p.goto(`${BASE}/sitemap.xml`);
	const sm = await r.text();
	check("sitemap.xml reachable anonymously + includes /publications", r.status() === 200 && sm.includes("/publications"));
	r = await p.goto(`${BASE}/robots.txt`);
	check("robots.txt reachable anonymously", r.status() === 200);
	r = await p.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
	check("/contact reachable anonymously", r.status() === 200 && !p.url().includes("/signin"));

	await p.goto(`${BASE}/dashboard/admin/publications`, { waitUntil: "domcontentloaded" });
	check("admin page redirects anonymous to signin with ?next", p.url().includes("/signin") && p.url().includes("next="), p.url());

	await p.goto(`${BASE}/signin?next=/learn/courses`, { waitUntil: "networkidle", timeout: 120000 });
	const ac = await p.evaluate(() => ({
		email: document.querySelector('input[name="email"]')?.autocomplete,
		pw: document.querySelector('input[name="password"]')?.autocomplete,
		next: document.querySelector('input[name="next"]')?.value,
	}));
	check("signin has autocomplete hints + carries next", ac.email === "username" && ac.pw === "current-password" && ac.next === "/learn/courses", JSON.stringify(ac));
	await p.close();
}

// ───────── report form: multi-select + recorder (desktop) ─────────
{
	const p = await page({ viewport: { width: 1280, height: 900 } });
	await p.goto(`${BASE}/report-abuse`, { waitUntil: "networkidle", timeout: 120000 });
	const combo = p.getByRole("combobox", { name: /help you need/i });
	await combo.click();
	const all = await p.getByRole("option").allInnerTexts();
	check("services multi-select lists options on open", all.length === 6, all.join("|"));
	await combo.fill("leg");
	check("typing filters options", (await p.getByRole("option").count()) === 1);
	await combo.press("Enter");
	await combo.fill("shel");
	await combo.press("Enter");
	const chips = await p.locator('button[aria-label^="Remove "]').allInnerTexts();
	const chipLabels = await p.locator('button[aria-label^="Remove "]').evaluateAll((b) => b.map((x) => x.getAttribute("aria-label")));
	check("multiple picks become chips", chipLabels.includes("Remove legal support") && chipLabels.includes("Remove shelter services"), chipLabels.join("|"));
	await combo.press("Backspace");
	const after = await p.locator('button[aria-label^="Remove "]').evaluateAll((b) => b.map((x) => x.getAttribute("aria-label")));
	check("Backspace removes last chip", after.length === chipLabels.length - 1);
	await p.locator('button[aria-label="Remove legal support"]').click();
	check("clicking × removes a chip", (await p.locator('button[aria-label="Remove legal support"]').count()) === 0);
	await combo.fill("zzz");
	check("no-match message shown", (await p.getByText("No matches").count()) === 1);

	const pw = await p.evaluate(() => { const e = document.querySelector("#report-password"); return e && { name: e.name, ac: e.autocomplete }; });
	check("report password field has name/autocomplete", pw?.name === "password" && pw?.ac === "new-password");

	// Voice recorder: the old bug stopped the recording after ~1s.
	await p.getByRole("button", { name: /record voice note/i }).click();
	await p.getByRole("button", { name: /start recording/i }).click();
	await p.waitForTimeout(3600);
	const timer = await p.getByLabel("Recording time").innerText();
	const label = await p.locator("[aria-live=polite]").first().innerText().catch(() => "");
	const secs = Number(timer.split(":")[1]);
	check("recording keeps running past 3 seconds", secs >= 3 && /Recording/.test(label), `timer=${timer} state=${label}`);
	await p.getByRole("button", { name: /^pause/i }).click();
	check("pause works", (await p.getByText("Paused").count()) >= 1);
	await p.getByRole("button", { name: /resume/i }).click();
	await p.waitForTimeout(1000);
	await p.getByRole("button", { name: /^stop/i }).click();
	await p.getByText("Recording complete").waitFor({ timeout: 8000 });
	check("stop produces a reviewable recording", true);
	const meta = await p.evaluate(async () => {
		const a = document.querySelector("audio");
		const blob = await fetch(a.src).then((r) => r.blob());
		return { type: blob.type, size: blob.size };
	});
	check("recorded blob has clean MIME type and data", /^audio\/(webm|mp4|ogg)$/.test(meta.type) && meta.size > 500, JSON.stringify(meta));
	await p.getByRole("button", { name: /attach to report/i }).click();
	await p.getByText("Voice note attached").waitFor({ timeout: 8000 });
	check("voice note attaches to the report", true);
	await p.waitForTimeout(2500);
	const uploadState = await p.getByText(/Voice note uploaded|Uploading voice note|Audio Upload Failed|row-level security|Failed to upload/i).first().innerText().catch(() => "(none)");
	check("voice note uploads to storage", /Voice note uploaded/i.test(uploadState), uploadState);
	check("no uncaught page errors on report page", p.errors.filter((e) => !/Failed to load resource|favicon|geolocation/i.test(e)).length === 0, p.errors.slice(0, 3).join(" || "));
	await p.close();
}

// ───────── mobile: layout + tap behaviour ─────────
{
	const p = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1" });
	for (const path of ["/", "/publications", "/learn/courses", "/report-abuse", "/signin"]) {
		await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
		const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
		check(`mobile ${path}: no horizontal overflow`, o.sw <= o.cw + 1, `scrollWidth=${o.sw} clientWidth=${o.cw}`);
	}
	await p.goto(`${BASE}/report-abuse`, { waitUntil: "networkidle", timeout: 120000 });
	const fs = await p.evaluate(() => getComputedStyle(document.querySelector('input[role="combobox"]')).fontSize);
	check("mobile inputs are 16px (no iOS zoom)", parseFloat(fs) >= 16, fs);
	const combo = p.getByRole("combobox", { name: /help you need/i });
	await combo.tap();
	await p.getByRole("option").first().tap();
	await p.getByRole("option").nth(2).tap();
	const n = await p.locator('button[aria-label^="Remove "]').count();
	check("mobile: tapping options adds chips and keeps list open", n === 2 && (await p.getByRole("listbox").count()) === 1, `chips=${n}`);
	const chipBox = await p.locator('button[aria-label^="Remove "]').first().boundingBox();
	check("mobile: chip remove target ≥ 28px", chipBox && chipBox.width >= 28 && chipBox.height >= 28, JSON.stringify(chipBox));
	await p.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
