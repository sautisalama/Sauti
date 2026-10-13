// Slides: a generated deck opens in the viewer, shows its text, moves with the keys and presents.
//   node --env-file=.env.local scripts/e2e/uat/15-slides.mjs
import PptxGenJS from "pptxgenjs";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const p = new PptxGenJS();
p.layout = "LAYOUT_WIDE";
const cover = p.addSlide();
cover.addShape("rect", { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: "068297" } });
cover.addText("Quarterly update", { x: 0.8, y: 1.6, w: 11, h: 1.5, fontSize: 44, bold: true, color: "0F3B44" });
for (let i = 1; i <= 3; i++) {
	const s = p.addSlide();
	s.addShape("rect", { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: "068297" } });
	s.addText(`Slide number ${i + 1}`, { x: 0.7, y: 0.45, w: 12, h: 1, fontSize: 32, bold: true });
	s.addText([{ text: "First point", options: { bullet: true, breakLine: true } }, { text: "Second point", options: { bullet: true, breakLine: true } }], { x: 0.9, y: 1.7, w: 11, h: 3, fontSize: 22 });
}
const bytes = Buffer.from(await p.write({ outputType: "nodebuffer" }));
const path = `e2e/${Date.now()}-deck.pptx`;
await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", upsert: true });
const { data: row } = await db.from("vault_files").insert({ name: "E2E deck.pptx", storage_path: path, mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", size: bytes.length, owner_id: accounts.accounts.admin.id }).select("id").single();

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(90000);
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/files/slides?file=${row.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByText("1 / 4").waitFor();
	check("The deck opens with 4 slides", true);
	const text = (await page.textContent("body")) ?? "";
	check("The first slide's text is drawn", /Quarterly update/.test(text));
	await page.getByRole("button", { name: "Next slide" }).first().click();
	await page.getByText("2 / 4").waitFor();
	check("Next moves to slide 2", /Slide number 2/.test((await page.textContent("body")) ?? ""));
	await page.getByRole("button", { name: "Present" }).click();
	await page.waitForTimeout(800);
	await page.keyboard.press("ArrowRight");
	await page.getByText("3 / 4").waitFor();
	check("Present mode moves with the arrow keys", true);
	await page.keyboard.press("Escape");
	await page.waitForTimeout(500);
	check("Escape leaves presenting", (await page.getByRole("button", { name: "Present" }).count()) > 0);
} catch (e) {
	check("Slides flow", false, String(e).slice(0, 240));
} finally {
	await db.from("vault_files").delete().eq("id", row.id);
	await db.storage.from("mjengo-docs").remove([path]);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
