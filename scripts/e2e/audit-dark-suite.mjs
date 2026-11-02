// Dark-mode sweep of the Mjengo Files vault and the opportunity page: bright lines, light panels, weak text, and hover colours.
// Usage: node --env-file=.env.local scripts/e2e/audit-dark-suite.mjs   (ONLY=vault to run one stop)
import path from "node:path";
import { BASE, launch, newPage, signIn } from "./lib.mjs";
import { db, acc } from "./helpers.mjs";

const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
const ONLY = process.env.ONLY || "";
const admin = acc("admin");
const stamp = Date.now();
const { data: opp } = await db.from("mjengo_opportunities").insert({ title: "E2E dark opportunity", organisation: "Dark Org", status: "new", deadline: new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10), created_by: admin.id, visibility: "team", source_url: "https://example.org/call" }).select("id").single();
const up = `opportunity/${opp.id}/e2e-dark-${stamp}.txt`;
await db.storage.from("mjengo-docs").upload(up, new Blob(["dark mode preview"], { type: "text/plain" }), { contentType: "text/plain", upsert: true });
await db.from("mjengo_documents").insert([
	{ entity_type: "opportunity", entity_id: opp.id, name: "E2E budget", required: true, file_path: up, file_name: `e2e-dark-${stamp}.txt`, file_size: 17, mime_type: "text/plain", uploaded_by: admin.id, uploaded_at: new Date().toISOString() },
	{ entity_type: "opportunity", entity_id: opp.id, name: "E2E audited accounts", required: true },
]);

const STOPS = [
	{ id: "vault", url: "dashboard/mjengo/vault" },
	{ id: "vault-grid", url: "dashboard/mjengo/vault", before: async (p) => { await p.getByRole("button", { name: /grid/i }).first().click().catch(() => {}); } },
	{ id: "opp-files", url: `dashboard/mjengo/opportunities/${opp.id}`, before: async (p) => { await p.getByRole("tab", { name: "Application" }).click(); await p.getByRole("button", { name: "Add a document" }).waitFor({ timeout: 60000 }); await p.getByText("E2E budget").first().waitFor({ timeout: 90000 }); } },
	{ id: "opp-files-cards", url: `dashboard/mjengo/opportunities/${opp.id}`, before: async (p) => { await p.getByRole("tab", { name: "Application" }).click(); await p.getByRole("button", { name: "Cards view" }).click({ timeout: 90000 }); await p.getByText("E2E budget").first().waitFor({ timeout: 30000 }); } },
	{ id: "opp-work", url: `dashboard/mjengo/opportunities/${opp.id}`, before: async (p) => { await p.getByRole("tab", { name: "To-dos and reminders" }).click(); await p.getByLabel("Add a to-do").waitFor({ timeout: 60000 }); } },
	{ id: "opp-sharing", url: `dashboard/mjengo/opportunities/${opp.id}`, before: async (p) => { await p.getByRole("tab", { name: "Sharing" }).click(); } },
	{ id: "documents", url: "dashboard/mjengo/documents" },
	{ id: "todos", url: "dashboard/mjengo/todos" },
	{ id: "forms", url: "dashboard/mjengo/forms" },
];

const scan = () => {
	const parse = (c) => { const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1]; return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
	const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
	const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
	const blend = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
	const under = (e) => { let u = { r: 14, g: 21, b: 23, a: 1 }; const ch = []; for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) ch.push(c); if (c.a >= 1) break; } for (const c of ch.reverse()) u = blend(c, u); return u; };
	const name = (e) => `${e.tagName.toLowerCase()}.${(e.className?.toString?.() ?? "").split(/\s+/).filter((c) => c && !/^(group|peer)/.test(c)).slice(0, 5).join(".")}`.slice(0, 110);
	const out = { lines: [], panels: [], text: [] };
	const seen = new Set();
	for (const e of document.querySelectorAll("body *")) {
		if (e.closest("svg, canvas, iframe, img, video, [data-radix-popper-content-wrapper] svg")) continue;
		const r = e.getBoundingClientRect();
		if (r.width < 4 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
		const cs = getComputedStyle(e);
		if (cs.visibility === "hidden" || cs.display === "none") continue;
		const bg = under(e);
		for (const side of ["Top", "Right", "Bottom", "Left"]) {
			if (parseFloat(cs[`border${side}Width`]) < 0.5 || cs[`border${side}Style`] === "none") continue;
			const c = parse(cs[`border${side}Color`]);
			if (c.a < 0.05) continue;
			const f = blend(c, bg);
			if (L(f) > 0.2) { const k = `${side}|${name(e)}`; if (!seen.has(k)) { seen.add(k); out.lines.push(`${side} ${cs[`border${side}Color`]} on ${name(e)}`); } }
		}
		const own = parse(cs.backgroundColor);
		if (own.a > 0.5 && L(own) > 0.4 && r.width * r.height > 2500) { const k = `P|${name(e)}`; if (!seen.has(k)) { seen.add(k); out.panels.push(`${cs.backgroundColor} ${Math.round(r.width)}x${Math.round(r.height)} ${name(e)}`); } }
		const direct = [...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim().length > 1);
		if (direct) {
			const f = blend(parse(cs.color), bg);
			const ratio = (Math.max(L(f), L(bg)) + 0.05) / (Math.min(L(f), L(bg)) + 0.05);
			if (ratio < 3.2) { const k = `T|${name(e)}`; if (!seen.has(k)) { seen.add(k); out.text.push(`${ratio.toFixed(1)}:1 "${e.textContent.trim().slice(0, 28)}" ${name(e)}`); } }
		}
	}
	return out;
};

const hover = async (page) => {
	const ids = await page.evaluate(() => [...document.querySelectorAll('a[href], button, [role=button], [role=tab], [role=menuitem]')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.top >= 0 && r.top < innerHeight && !el.closest("aside, nav") && !el.disabled; }).map((el, i) => { el.setAttribute("data-hv", String(i)); return i; }));
	const found = new Map();
	for (const i of ids.slice(0, 45)) {
		const el = page.locator(`[data-hv="${i}"]`);
		await el.hover({ timeout: 1500 }).catch(() => {});
		await page.waitForTimeout(250);
		const r = await el.evaluate((e) => {
			const parse = (c) => { const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1]; return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
			const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
			const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
			const blend = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
			let under = { r: 14, g: 21, b: 23, a: 1 }; const ch = [];
			for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) ch.push(c); if (c.a >= 1) break; }
			for (const c of ch.reverse()) under = blend(c, under);
			const t = [e, ...e.querySelectorAll("*")].find((n) => [...n.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim().length > 1));
			const f = blend(parse(getComputedStyle(t ?? e).color), under);
			const ratio = (Math.max(L(f), L(under)) + 0.05) / (Math.min(L(f), L(under)) + 0.05);
			return { cls: (e.className?.toString?.() ?? "").split(/\s+/).filter((c) => !/^(group|peer)/.test(c)).slice(0, 7).join(" ") || e.tagName, bg: `rgb(${under.r | 0},${under.g | 0},${under.b | 0})`, light: L(under) > 0.3, ratio: +ratio.toFixed(1), text: (e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 26) };
		}).catch(() => null);
		if (r && (r.light || r.ratio < 3.5)) found.set(r.cls, r);
	}
	return [...found.values()];
};

const browser = await launch();
let bad = 0;
try {
	for (const stop of STOPS) {
		if (ONLY && !stop.id.includes(ONLY)) continue;
		const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
		await signIn(page, "admin");
		await page.addInitScript(() => localStorage.setItem("ss_theme", "dark"));
		await page.goto(`${BASE}/${stop.url}`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await page.waitForFunction(() => !document.querySelector("[role=status]"), null, { timeout: 90000 }).catch(() => {});
		await page.waitForTimeout(2500);
		try { await stop.before?.(page); } catch (e) { console.log(`  (could not set up ${stop.id}: ${String(e.message).split("\n")[0]})`); }
		await page.waitForTimeout(1200);
		await page.screenshot({ path: path.join(OUT, `dark_${stop.id}.png`) });
		const s = await page.evaluate(scan);
		const h = await hover(page);
		const n = s.lines.length + s.panels.length + s.text.length + h.length;
		bad += n;
		console.log(`\n== ${stop.id}: ${n} issue(s)`);
		for (const x of s.lines.slice(0, 12)) console.log(`  LINE  ${x}`);
		for (const x of s.panels.slice(0, 10)) console.log(`  PANEL ${x}`);
		for (const x of s.text.slice(0, 10)) console.log(`  TEXT  ${x}`);
		for (const x of h.slice(0, 10)) console.log(`  HOVER ${x.ratio}:1 ${x.bg}${x.light ? " LIGHT" : ""} | ${x.cls} | ${x.text}`);
		await page.close();
	}
} finally {
	await db.from("mjengo_documents").delete().eq("entity_id", opp.id);
	await db.from("mjengo_opportunities").delete().eq("id", opp.id);
	await db.storage.from("mjengo-docs").remove([up]);
	await browser.close();
}
console.log(`\n${bad} dark-mode issue(s) in total`);
