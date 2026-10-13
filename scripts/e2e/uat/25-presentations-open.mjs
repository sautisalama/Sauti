// Opening presentations: a PowerPoint-made .pptx is drawn; a file the full viewer cannot draw still shows its
// text; an older binary .ppt shows its text.
//   node --env-file=.env.local scripts/e2e/uat/25-presentations-open.mjs
import fs from "node:fs";
import JSZip from "jszip";
import * as CFB from "cfb";
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const real = fs.readFileSync(process.env.REAL_PPTX || `${process.env.TEMP}/real.pptx`);

// A pptx whose master is broken: the full viewer fails, the text survives.
const zip = await JSZip.loadAsync(real);
zip.file("ppt/slideMasters/slideMaster1.xml", "<broken");
const broken = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));

// An older .ppt: slide list with two slides of text.
const rec = (ver, inst, type, body) => { const h = Buffer.alloc(8); h.writeUInt16LE((inst << 4) | ver, 0); h.writeUInt16LE(type, 2); h.writeUInt32LE(body.length, 4); return Buffer.concat([h, body]); };
const text = (s) => rec(0, 0, 4000, Buffer.from(s, "utf16le"));
const persist = () => rec(0, 0, 1011, Buffer.alloc(20));
const list = rec(0xf, 0, 4080, Buffer.concat([persist(), text("Annual report\rProgramme results\rCases supported"), persist(), text("Next steps\rHire two paralegals")]));
const doc = rec(0xf, 0, 1000, list);
const cfb = CFB.utils.cfb_new();
CFB.utils.cfb_add(cfb, "/PowerPoint Document", doc);
const ppt = Buffer.from(CFB.write(cfb, { type: "buffer" }));

const made = [];
const put = async (name, bytes, mime) => {
	const path = `e2e/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${name}`;
	await db.storage.from("mjengo-docs").upload(path, bytes, { contentType: mime, upsert: true });
	const { data: row } = await db.from("vault_files").insert({ name, storage_path: path, mime, size: bytes.length, owner_id: accounts.accounts.admin.id }).select("id").single();
	made.push({ id: row.id, path });
	return row.id;
};
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(90000);
await page.setViewportSize({ width: 1400, height: 900 });
try {
	const ids = { real: await put("real.pptx", real, PPTX), broken: await put("broken.pptx", broken, PPTX), ppt: await put("old.ppt", ppt, "application/vnd.ms-powerpoint") };
	await signIn(page, "admin");
	const open = async (id) => page.goto(`${BASE}/dashboard/mjengo/files/slides?file=${id}`, { waitUntil: "domcontentloaded", timeout: 180000 });

	await open(ids.real);
	await page.getByText("1 / 4").waitFor({ timeout: 90000 });
	await page.getByText("Programme review").first().waitFor({ timeout: 60000 });
	check("A PowerPoint-made .pptx is drawn", true);

	await open(ids.broken);
	await page.getByText(/text and pictures are shown/).waitFor({ timeout: 40000 }).catch(async () => { console.log("  [page]", ((await page.textContent("body", { timeout: 5000 }).catch(() => "page not responding")) ?? "").slice(-300)); });
	check("A file the viewer cannot draw still shows its text", /Programme review/.test((await page.textContent("body")) ?? ""));

	await open(ids.ppt);
	await page.getByText(/older PowerPoint file/).waitFor({ timeout: 90000 });
	const body = (await page.textContent("body")) ?? "";
	check("An older .ppt shows its text, slide by slide", /Programme results/.test(body) && /Hire two paralegals/.test(body) && /Slide 2/.test(body));
} catch (e) {
	check("Presentations open", false, String(e).slice(0, 280));
} finally {
	for (const m of made) { await db.from("vault_files").delete().eq("id", m.id); await db.storage.from("mjengo-docs").remove([m.path]); }
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
