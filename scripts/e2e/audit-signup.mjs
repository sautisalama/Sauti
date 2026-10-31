// Walks a brand-new account through signup + onboarding, screenshotting each step.
import fs from "node:fs";
import path from "node:path";
import { launch, newPage, BASE } from "./lib.mjs";
const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
fs.mkdirSync(OUT, { recursive: true });
const kind = process.argv[2] || "survivor";
const browser = await launch();
const page = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
page.on("console", (m) => m.type()==="error" && console.log("CONSOLE:", m.text().slice(0,300)));
const email = `e2e-anon-new-${kind}-${Date.now()}@example.com`;
const shot = async (n) => { await page.waitForTimeout(2800); await page.screenshot({ path: path.join(OUT, `signup_${kind}_${n}.png`) }); console.log(n, new URL(page.url()).pathname); };
await page.goto(BASE + "/signup", { waitUntil: "networkidle", timeout: 120000 });
await page.fill("#firstName", "Test"); await page.fill("#lastName", "Newuser");
await page.fill("#email", email); await page.fill("#password", "Sup3r-Secret-Pass!9");
await shot("1_form");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 90000 }).catch(() => {});
await shot("2_after_submit");
for (let i = 3; i < 12; i++) {
	// advance through whatever primary buttons the onboarding shows
	const txt = await page.evaluate(() => document.body.innerText.slice(0, 600));
	console.log("---", i, txt.replace(/\n+/g, " | ").slice(0, 300));
	const btns = await page.$$eval("button", (bs) => bs.filter((b) => b.offsetParent && !b.disabled).map((b) => b.innerText.trim()).filter(Boolean));
	console.log("buttons:", btns.slice(0, 12).join(" || "));
	await shot(`${i}`);
	const pick = process.argv[3] ? new RegExp(process.argv[3], "i") : /survivor|continue|next|get started/i;
	const target = btns.find((b) => pick.test(b));
	if (!target) break;
	await page.getByRole("button", { name: target }).first().click().catch(() => {});
}
console.log(email);
await browser.close();
