// UX audit crawler: signs in as each seeded role, visits the core journeys at
// desktop and mobile widths, saves screenshots and writes objective metrics.
//   node scripts/e2e/audit-ux.mjs [role ...]      (needs dev server + seeded accounts)
import fs from "node:fs";
import path from "node:path";
import { launch, newPage, signIn, BASE } from "./lib.mjs";

const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
fs.mkdirSync(OUT, { recursive: true });

const JOURNEYS = {
	public: ["/", "/signup", "/signin", "/report-abuse", "/programs", "/learn"],
	survivor: ["/dashboard", "/dashboard/reports", "/dashboard/matches", "/dashboard/chat", "/dashboard/services", "/dashboard/resources", "/dashboard/learning", "/dashboard/profile", "/dashboard/activity"],
	professional: ["/dashboard", "/dashboard/cases", "/dashboard/matches", "/dashboard/services", "/dashboard/profile/verification", "/dashboard/chat", "/dashboard/mjengo"],
	ngo: ["/dashboard", "/dashboard/cases", "/dashboard/services", "/dashboard/profile"],
	pending_pro: ["/dashboard", "/dashboard/profile/verification"],
	admin: ["/dashboard", "/dashboard/admin", "/dashboard/admin/review", "/dashboard/admin/matching", "/dashboard/admin/professionals", "/dashboard/admin/users", "/dashboard/admin/services"],
};

const probe = () => {
	const vis = (el) => {
		const r = el.getBoundingClientRect();
		const s = getComputedStyle(el);
		return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
	};
	const inter = [...document.querySelectorAll("a[href],button,input,select,textarea,[role=button],[role=tab],[role=menuitem]")].filter(vis);
	const small = inter.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 40 || r.height < 40; });
	const unlabeled = inter.filter((el) => !(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title") || el.textContent.trim() || (el.labels && el.labels.length) || el.getAttribute("placeholder") || el.getAttribute("alt")));
	const tiny = [...document.querySelectorAll("p,span,li,td,label,a,button,div")].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(el) && parseFloat(getComputedStyle(el).fontSize) < 12);
	const imgsNoAlt = [...document.images].filter((i) => !i.hasAttribute("alt"));
	const h1 = document.querySelectorAll("h1").length;
	const btns = [...document.querySelectorAll("button,a[role=button],a[class*=btn]")].filter(vis);
	return {
		title: document.title,
		h1,
		interactive: inter.length,
		smallTargets: small.length,
		smallSamples: small.slice(0, 6).map((e) => (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 30)),
		unlabeled: unlabeled.length,
		tinyText: tiny.length,
		imgsNoAlt: imgsNoAlt.length,
		primaryButtons: btns.length,
		docHeight: document.documentElement.scrollHeight,
		overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
		words: (document.body.innerText || "").split(/\s+/).filter(Boolean).length,
	};
};

const slug = (p) => (p === "/" ? "home" : p.replace(/^\//, "").replace(/[\/\[\]]/g, "_"));

async function run(role, browser) {
	const report = [];
	for (const [label, viewport] of [["desktop", { width: 1280, height: 860 }], ["mobile", { width: 390, height: 844 }]]) {
		const page = await newPage(browser, { viewport, isMobile: label === "mobile", hasTouch: label === "mobile" });
		const consoleErrs = [];
		page.on("console", (m) => m.type() === "error" && consoleErrs.push(m.text().slice(0, 160)));
		try {
			if (role !== "public") await signIn(page, role);
			for (const p of JOURNEYS[role]) {
				consoleErrs.length = 0;
				const t0 = Date.now();
				let status = "ok";
				try {
					await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 90000 });
				} catch (e) {
					status = "timeout";
				}
				const ms = Date.now() - t0;
				await page.waitForTimeout(600);
				const file = `${role}__${label}__${slug(p)}.png`;
				await page.screenshot({ path: path.join(OUT, file) });
				const m = await page.evaluate(probe);
				report.push({ role, viewport: label, path: p, finalUrl: new URL(page.url()).pathname, status, ms, errors: consoleErrs.slice(0, 3), ...m });
				console.log(`${role} ${label} ${p} -> ${new URL(page.url()).pathname} ${ms}ms small=${m.smallTargets} unl=${m.unlabeled} words=${m.words}`);
			}
		} catch (e) {
			console.log(`ERR ${role} ${label}: ${e.message.split("\n")[0]}`);
			report.push({ role, viewport: label, error: e.message.split("\n")[0] });
		}
		await page.context().close();
	}
	return report;
}

const roles = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOURNEYS);
const browser = await launch();
const all = [];
for (const r of roles) all.push(...(await run(r, browser)));
await browser.close();
fs.writeFileSync(path.join(OUT, `metrics-${roles.join("_")}.json`), JSON.stringify(all, null, 1));
console.log("done", all.length);
