// Finds what is still light, low-contrast or harshly outlined in dark mode, per page, grouped by class.
// Usage: node scripts/e2e/audit-contrast.mjs [public|survivor|professional|admin ...]
import fs from "node:fs";
import path from "node:path";
import { BASE, launch, newPage, signIn } from "./lib.mjs";

const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = {
	public: ["/", "/about", "/faq", "/contact", "/signin", "/signup", "/report-abuse", "/publications", "/learn", "/programs", "/impact", "/join", "/volunteer", "/terms-conditions", "/privacy-policy"],
	survivor: ["/dashboard", "/dashboard/matches", "/dashboard/reports", "/dashboard/chat", "/dashboard/resources", "/dashboard/learning", "/dashboard/profile", "/dashboard/about", "/dashboard/activity", "/dashboard/blogs"],
	professional: ["/dashboard", "/dashboard/cases", "/dashboard/services", "/dashboard/chat", "/dashboard/resources", "/dashboard/learning", "/dashboard/profile", "/dashboard/blogs"],
	admin: ["/dashboard/admin", "/dashboard/admin/matching", "/dashboard/admin/professionals", "/dashboard/admin/users", "/dashboard/admin/services", "/dashboard/admin/review", "/dashboard/admin/publications", "/dashboard/mjengo", "/dashboard/mjengo/opportunities", "/dashboard/mjengo/mail", "/dashboard/mjengo/forms", "/dashboard/mjengo/todos", "/dashboard/mjengo/calendar", "/dashboard/mjengo/vault", "/dashboard/mjengo/contacts"],
};

const scan = () => {
	const parse = (c) => { const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]; return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
	const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
	const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
	const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
	const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
	const bgOf = (el) => {
		const stack = [];
		for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) stack.push(c); if (c.a >= 1) break; }
		let base = { r: 14, g: 21, b: 23, a: 1 };
		for (const c of stack.reverse()) base = blend(c, base);
		return base;
	};
	const sig = (el) => (typeof el.className === "string" ? el.className : "").split(/\s+/).filter((c) => !/^(hover|focus|group|peer|md|lg|sm|xl):/.test(c)).slice(0, 8).join(" ") || el.tagName.toLowerCase();
	const out = { light: new Map(), text: new Map(), border: new Map() };
	const note = (m, key, el, extra) => { const v = m.get(key) ?? { n: 0, sample: "", extra }; v.n++; if (!v.sample) v.sample = (el.innerText || "").trim().slice(0, 40); m.set(key, v); };
	for (const el of document.body.querySelectorAll("*")) {
		const cs = getComputedStyle(el);
		if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
		const r = el.getBoundingClientRect();
		if (r.width < 4 || r.height < 4) continue;
		if (el.closest("iframe, svg, canvas, img, video")) continue;
		const bg = parse(cs.backgroundColor);
		if (bg.a > 0.5 && r.width * r.height > 1500 && lum(bg) > 0.55 && cs.backgroundImage === "none") note(out.light, sig(el), el, `rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0})`);
		const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
		if (hasText) {
			const fg = parse(cs.color);
			const under = bgOf(el);
			const cr = ratio(blend(fg, under), under);
			if (cr < 3.5) note(out.text, sig(el), el, `${cr.toFixed(1)}:1 ${cs.color} on rgb(${under.r | 0},${under.g | 0},${under.b | 0})`);
		}
		for (const side of ["Top", "Right", "Bottom", "Left"]) {
			const w = parseFloat(cs[`border${side}Width`]);
			const c = parse(cs[`border${side}Color`]);
			if (w > 0 && cs[`border${side}Style`] !== "none" && c.a > 0.35 && lum(c) > 0.45 && !(el.tagName === "INPUT")) { note(out.border, sig(el), el, `border-${side.toLowerCase()} rgb(${c.r | 0},${c.g | 0},${c.b | 0})`); break; }
		}
	}
	const top = (m) => [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([k, v]) => ({ cls: k.slice(0, 110), n: v.n, sample: v.sample, extra: v.extra }));
	return { light: top(out.light), text: top(out.text), border: top(out.border) };
};

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PAGES);
const browser = await launch();
const report = {};
for (const who of want) {
	const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
	if (who !== "public") await signIn(page, who);
	await page.addInitScript(() => localStorage.setItem("ss_theme", "dark"));
	for (const p of PAGES[who]) {
		try {
			await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 120000 });
			await page.waitForFunction(() => !/(^|\n)(Loading|Opening your mail|Loading dashboard\.\.\.)(\n|$)/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
			await page.waitForFunction(() => !document.querySelector(".animate-pulse, [aria-busy=true]"), null, { timeout: 45000 }).catch(() => {});
			await page.waitForTimeout(2000);
			const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
			const r = await page.evaluate(scan);
			report[`${who} ${p}`] = { dark, ...r };
			await page.screenshot({ path: path.join(OUT, `c_${who}_${p.replace(/\W+/g, "_")}.png`) });
			console.log(`${who} ${p} dark=${dark} light=${r.light.length} text=${r.text.length} border=${r.border.length}`);
		} catch (e) {
			console.log(`${who} ${p} ERROR ${String(e).slice(0, 80)}`);
		}
	}
	await page.close();
}
fs.writeFileSync(path.join(OUT, "contrast.json"), JSON.stringify(report, null, 1));
await browser.close();
