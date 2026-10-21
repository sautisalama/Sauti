import { BASE, launch, newPage, signIn } from "./lib.mjs";
const browser = await launch();
const page = await newPage(browser);
await signIn(page, "admin");
const log = [];
page.on("response", async (r) => {
	const rq = r.request();
	if (rq.method() === "POST" && rq.headers()["next-action"]) log.push(`${Math.round(performance.now() / 1000)}s ${r.status()} ${rq.url().replace(BASE, "")} ${(rq.postData() || "").slice(0, 40)}`);
	if (r.url().includes("/api/mail/warm")) log.push(`${Math.round(performance.now() / 1000)}s mail-warm ${r.status()}`);
});
page.on("console", (m) => { if (m.type() === "error") log.push("console: " + m.text().slice(0, 160)); });
await page.goto(`${BASE}/dashboard/mjengo`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(45000);
console.log(log.join("\n"));
await browser.close();
