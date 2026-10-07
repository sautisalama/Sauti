// Debug helper: node --env-file=.env.local scripts/e2e/dump.mjs <role> <path> [waitMs]
import { BASE, launch, newPage, signIn } from "./lib.mjs";
const [role, path, wait = "3500"] = process.argv.slice(2);
const b = await launch();
const p = await newPage(b);
await signIn(p, role);
await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(Number(wait));
console.log("URL:", p.url());
console.log((await p.locator("body").innerText()).replace(/\n{3,}/g, "\n\n").slice(0, 2500));
console.log("BUTTONS:", await p.getByRole("button").evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") || e.innerText || "").trim().replace(/\s+/g, " ")).filter(Boolean).slice(0, 40)));
console.log("LINKS:", await p.getByRole("link").evaluateAll((els) => [...new Set(els.map((e) => (e.innerText || "").trim().replace(/\s+/g, " ") + " -> " + e.getAttribute("href")).filter((x) => x.length > 6))].slice(0, 40)));
await b.close();
