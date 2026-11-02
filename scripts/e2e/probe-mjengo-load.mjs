// What an Mjengo page asks the server for while it opens, in order, with timings. Usage: node --env-file=.env.local scripts/e2e/probe-mjengo-load.mjs [path ...]
import { BASE, launch, newPage, signIn } from "./lib.mjs";

const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["dashboard/mjengo/opportunities", "dashboard/mjengo/grants"];
const browser = await launch();
const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
await signIn(page, "admin");
await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 120000 }).catch(() => {});
await page.waitForTimeout(8000); // let the start-up warm-up finish so we measure a normal open

for (const p of paths) {
	const log = [];
	const t0 = Date.now();
	const onReq = (r) => { r._t = Date.now(); };
	const onDone = async (r) => {
		const act = r.headers()["next-action"];
		if (r.method() === "POST" && act) log.push({ at: r._t - t0, ms: Date.now() - r._t, kind: "action", id: act.slice(0, 8), bytes: (await (await r.response())?.body().catch(() => null))?.length ?? 0 });
		else if (/\/api\//.test(r.url())) log.push({ at: r._t - t0, ms: Date.now() - r._t, kind: "api", id: new URL(r.url()).pathname });
		else if (r.resourceType() === "document" || r.url().includes("_rsc=")) log.push({ at: r._t - t0, ms: Date.now() - r._t, kind: "page", id: new URL(r.url()).pathname });
	};
	page.on("request", onReq);
	page.on("requestfinished", onDone);
	await page.evaluate((u) => { window.history.pushState(null, "", u); }, "/" + p).catch(() => {});
	await page.goto(BASE + "/" + p, { waitUntil: "domcontentloaded", timeout: 120000 });
	await page.waitForFunction(() => !document.querySelector('[role=status]') , null, { timeout: 60000 }).catch(() => {});
	const shown = Date.now() - t0;
	await page.waitForTimeout(3000);
	page.off("request", onReq);
	page.off("requestfinished", onDone);
	console.log(`\n== ${p}: loader gone after ${shown} ms`);
	for (const l of log.sort((a, b) => a.at - b.at)) console.log(`${String(l.at).padStart(6)} ms  +${String(l.ms).padStart(5)}  ${l.kind} ${l.id}${l.bytes ? ` (${l.bytes}b)` : ""}`);
}
await browser.close();
