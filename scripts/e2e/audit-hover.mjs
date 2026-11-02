// Hovers every interactive element on a page in dark mode and reports any whose background turns light or loses text contrast.
// Usage: HOVER_PATH=dashboard/mjengo/opportunities node --env-file=.env.local scripts/e2e/audit-hover.mjs [role]
import { BASE, launch, newPage, signIn } from "./lib.mjs";
import { db, acc } from "./helpers.mjs";

const role = process.argv[2] || "admin";
const path = process.env.HOVER_PATH || "dashboard/mjengo/opportunities";
const seeded = [];
if (/opportunities/.test(path)) {
	const { data } = await db.from("mjengo_opportunities").insert([1, 2].map((n) => ({ title: `E2E hover ${n}`, organisation: "Hover Org", status: "new", deadline: new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10), created_by: acc("admin").id, visibility: "team" }))).select("id");
	seeded.push(...(data ?? []).map((r) => r.id));
}
const browser = await launch();
const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
await signIn(page, role);
await page.addInitScript(() => localStorage.setItem("ss_theme", "dark"));
await page.goto(`${BASE}/${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !document.querySelector("[role=status], .animate-pulse"), null, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2500);
for (const view of ["Board", "List"]) {
	await page.getByRole("button", { name: view, exact: true }).click().catch(() => {});
	await page.waitForTimeout(800);
	const targets = await page.evaluate(() => {
		const sel = 'a[href], button, [role=button], [role=tab], li > button, [role=menuitem]';
		return [...document.querySelectorAll(sel)].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.top >= 0 && r.top < innerHeight && !el.closest("aside, nav, header[role=banner]"); }).map((el, i) => { el.setAttribute("data-hv", String(i)); return i; });
	});
	console.log(`${view}: ${targets.length} interactive elements`);
	const found = new Map();
	for (const i of targets.slice(0, 60)) {
		const el = page.locator(`[data-hv="${i}"]`);
		await el.hover({ timeout: 2000 }).catch(() => {});
		await page.waitForTimeout(350);
		const r = await el.evaluate((e) => {
			const parse = (c) => { const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1]; return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
			const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
			const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
			const blend = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
			let under = { r: 14, g: 21, b: 23, a: 1 };
			const chain = [];
			for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) chain.push(c); if (c.a >= 1) break; }
			for (const c of chain.reverse()) under = blend(c, under);
			// Text colour of the element or its first text-bearing descendant.
			const t = [e, ...e.querySelectorAll("*")].find((n) => [...n.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim().length > 1));
			const fg = parse(getComputedStyle(t ?? e).color);
			const f = blend(fg, under);
			const ratio = (Math.max(L(f), L(under)) + 0.05) / (Math.min(L(f), L(under)) + 0.05);
			return { cls: (e.className?.toString?.() ?? "").split(/\s+/).filter((c) => !/^(group|peer)/.test(c)).slice(0, 8).join(" ") || e.tagName, bg: `rgb(${under.r | 0},${under.g | 0},${under.b | 0})`, light: L(under) > 0.35, ratio: +ratio.toFixed(1), text: (e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 30) };
		}).catch(() => null);
		if (r && (r.light || r.ratio < 3.5)) found.set(r.cls, r);
	}
	console.log(`\n== ${view} view: ${found.size} problem(s)`);
	for (const r of found.values()) console.log(`${r.ratio}:1 ${r.bg} ${r.light ? "LIGHT" : ""} | ${r.cls} | ${r.text}`);
}
if (seeded.length) await db.from("mjengo_opportunities").delete().in("id", seeded);
await browser.close();
