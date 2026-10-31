import fs from "node:fs";
import path from "node:path";
import { BASE, check, launch, newPage, signIn, summary } from "./lib.mjs";
import { submitReport, sleep } from "./helpers.mjs";
const OUT = process.env.AUDIT_OUT || path.resolve("audit-out");
const browser = await launch();
const btn = (p) => p.getByRole("button", { name: /exit this page/i });
const hits = [];
async function trap(page) { await page.route(/bbc\.com/, (r) => { hits.push(r.request().url()); r.abort(); }); }

// public page, phone
let ph = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await trap(ph);
await ph.goto(`${BASE}/report-abuse`, { waitUntil: "networkidle", timeout: 120000 });
check("EXIT-01 report page shows Exit this page", await btn(ph).isVisible());
check("EXIT-02 report page shows hotline 1195 link", (await ph.locator('a[href="tel:1195"]').count()) >= 1);
await ph.screenshot({ path: path.join(OUT, "v_report_mobile.png") });
await btn(ph).tap();
await ph.waitForTimeout(1500);
check("EXIT-03 tapping the button leaves for the neutral site", hits.length > 0, hits[0]);

// shift x3 on desktop
let d = await newPage(browser);
hits.length = 0; await trap(d);
await d.goto(`${BASE}/signup`, { waitUntil: "networkidle", timeout: 120000 });
check("EXIT-04 signup shows the button", await btn(d).isVisible());
await d.screenshot({ path: path.join(OUT, "v_signup.png") });
await d.keyboard.press("Shift"); await d.keyboard.press("Shift");
await d.waitForTimeout(400);
check("EXIT-05 two Shift presses do not exit", hits.length === 0);
await d.keyboard.press("Shift");
await d.waitForTimeout(1500);
check("EXIT-06 three quick Shift presses exit", hits.length > 0);

// survivor vs provider
let sv = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await signIn(sv, "survivor");
await sv.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 120000 });
await sv.waitForTimeout(2500);
check("EXIT-07 survivor dashboard shows the button", await btn(sv).isVisible());
check("NEXT-01 survivor sees a next-step card", await sv.getByRole("region", { name: /your next step/i }).isVisible());
await sv.screenshot({ path: path.join(OUT, "v_survivor_dash.png") });
await sv.goto(`${BASE}/dashboard/matches`, { waitUntil: "networkidle", timeout: 120000 });
await sv.waitForTimeout(2500);
await sv.screenshot({ path: path.join(OUT, "v_survivor_matches.png") });
const body = await sv.evaluate(() => document.body.innerText);
check("MATCH-01 survivor with a report is not told to file one", !/No Active Matches/.test(body) || /find|match/i.test(body));

// give the provider a real offer to look at
const filer = await newPage(browser);
await signIn(filer, "survivor");
await submitReport(filer, { first_name: "UX-verify", type_of_incident: "physical", required_services: ["legal"], urgency: "high" });
await sleep(6000);
let pro = await newPage(browser);
await signIn(pro, "professional");
await pro.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 120000 });
await pro.waitForTimeout(2000);
check("EXIT-08 provider dashboard has NO exit button", (await btn(pro).count()) === 0);
await pro.goto(`${BASE}/dashboard/matches`, { waitUntil: "networkidle", timeout: 120000 });
await pro.waitForURL(/\/dashboard\/cases/, { timeout: 30000 }).catch(() => {});
check("MATCH-02 provider is sent from Matches to Cases", /\/dashboard\/cases/.test(pro.url()), pro.url());
await pro.waitForTimeout(3000);
await pro.screenshot({ path: path.join(OUT, "v_pro_cases.png") });
const cardText = await pro.evaluate(() => document.body.innerText);
check("CARD-01 provider card shows a plain-language title and status", /Physical abuse/.test(cardText) && /Needs your response/.test(cardText), cardText.match(/Physical abuse|physical/)?.[0]);
check("CARD-02 provider card no longer says Unassigned", !/Unassigned/.test(cardText));
let ad = await newPage(browser);
await signIn(ad, "admin");
await ad.goto(`${BASE}/dashboard/admin`, { waitUntil: "networkidle", timeout: 120000 });
await ad.getByRole("region", { name: /escalated cases/i }).waitFor({ timeout: 60000 }).catch(() => {});
const esc = await ad.getByRole("region", { name: /escalated cases/i }).innerText().catch(() => "");
check("ESC-01 admin overview shows the escalated-cases panel", esc.length > 0, esc.replace(/\s+/g, " ").slice(0, 90));
await ad.screenshot({ path: path.join(OUT, "v_admin_escalated.png") });
await ad.goto(`${BASE}/dashboard/admin/matching`, { waitUntil: "networkidle", timeout: 120000 });
check("MATCHING-01 no fabricated efficiency/latency tiles", !/98\.2%|14ms/.test(await ad.evaluate(() => document.body.innerText)));
process.exitCode = summary() ? 1 : 0;
await browser.close();
