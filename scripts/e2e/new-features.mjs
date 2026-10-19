// Signed-in checks of the newest suite features against the DEV project:
//   node --env-file=.env.local scripts/e2e/new-features.mjs [shots-dir]
// Two browser windows (the same test admin) open one file, so what one does must appear in the other.
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { BASE, check, launch, newPage, signIn, summary } from "./lib.mjs";

const SHOTS = process.argv[2];
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => undefined); };
const fileOf = (url) => new URL(url).searchParams.get("file");
const bytesOf = async (id) => {
	const { data: row } = await db.from("vault_files").select("storage_path").eq("id", id).single();
	const { data } = await db.storage.from("mjengo-docs").download(row.storage_path);
	return Buffer.from(await data.arrayBuffer());
};
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const run = (name) => !only || only.includes(name);

const browser = await launch();
const open = async () => { const p = await newPage(browser); await signIn(p, "admin"); return p; };

/* ------------------------------------------------------------ Slides */
if (run("deck")) {
	try {
		const a = await open();
		await a.goto(`${BASE}/dashboard/mjengo/files/deck`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await a.getByRole("heading", { name: "New presentation" }).waitFor();
		check("slides: start screen lists templates", (await a.getByText("Pitch deck").count()) >= 1);
		await shot(a, "deck-start");
		await a.getByText("Pitch deck").first().click();
		await a.locator('[aria-label="Slide 8"]:visible').waitFor({ timeout: 60000 });
		check("slides: a template opens with all its slides", (await a.locator('[aria-label^="Slide "]:visible').count()) >= 8);
		await a.waitForFunction(() => location.search.includes("file="), null, { timeout: 30000 });
		const id = fileOf(a.url());
		check("slides: the presentation is saved as a file straight away", !!id);
		await shot(a, "deck-editor");

		// Add text, then a theme change, then see it in a second window.
		const b = await open();
		await b.goto(`${BASE}/dashboard/mjengo/files/deck?file=${id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await b.locator('[aria-label="Slide 8"]:visible').waitFor({ timeout: 60000 });
		await a.waitForTimeout(2500);
		await a.getByTitle("Add text").click();
		await b.getByText("Type here").first().waitFor({ timeout: 20000 }).then(() => check("slides: a box added in one window appears in the other", true)).catch(() => check("slides: a box added in one window appears in the other", false));
		await a.getByRole("button", { name: "Theme" }).click();
		await a.getByRole("menuitem", { name: /Ink/ }).click();
		await a.waitForTimeout(2500);
		const bg = await b.locator('[aria-label="Slide 1"]:visible > div').first().evaluate((n) => getComputedStyle(n).backgroundColor).catch(() => "");
		check("slides: changing the theme reaches the other window", /rgb\(14, 19, 24\)/.test(bg), bg);
		await shot(b, "deck-live-b");
		check("slides: the other person shows as live", (await a.getByText("Live").count()) >= 1);

		// Move the box with the pointer (measured on the big slide, not the small thumbnails).
		const big = async (p) => { const all = p.getByText("Type here"); const n = await all.count(); let best = null; for (let i = 0; i < n; i++) { const bx = await all.nth(i).boundingBox(); if (bx && (!best || bx.width > best.width)) best = bx; } return best; };
		const bb = await big(a);
		if (bb) {
			await a.mouse.move(bb.x + 10, bb.y + 10); await a.mouse.down(); await a.mouse.move(bb.x + 90, bb.y + 60, { steps: 8 }); await a.mouse.up();
			await a.waitForTimeout(1500);
			const bb1 = await big(a), bb2 = await big(b);
			check("slides: dragging a box moves it", !!bb1 && Math.abs(bb1.x - bb.x - 80) < 8 && Math.abs(bb1.y - bb.y - 50) < 8, JSON.stringify({ bb, bb1 }));
			check("slides: and the other window sees it move", !!bb1 && !!bb2 && bb2.width > 0, JSON.stringify({ bb2 }));
		}

		// Export and present.
		const [dl] = await Promise.all([a.waitForEvent("download", { timeout: 60000 }), (async () => { await a.getByRole("button", { name: "Export" }).click(); await a.getByRole("menuitem", { name: /PowerPoint/ }).click(); })()]);
		const path = await dl.path();
		const size = (await import("node:fs")).statSync(path).size;
		check("slides: exports a PowerPoint file", size > 20000 && /\.pptx$/.test(dl.suggestedFilename()), `${dl.suggestedFilename()} ${size} bytes`);
		await a.getByRole("button", { name: "Present" }).click();
		await a.getByText(/ \/ 8$/).waitFor({ timeout: 10000 }).then(() => check("slides: present mode shows the slide count", true)).catch(() => check("slides: present mode shows the slide count", false));
		await a.keyboard.press("ArrowRight"); await a.keyboard.press("Escape");

		// Saved file holds the edit.
		await a.waitForTimeout(4000);
		const saved = JSON.parse((await bytesOf(id)).toString("utf8"));
		check("slides: autosave wrote the edit and theme to the file", saved.theme?.id === "ink" && JSON.stringify(saved).includes("Type here"));

		// The file opens from Files by its type, and AI writes slides.
		await a.goto(`${BASE}/dashboard/mjengo/vault`, { waitUntil: "domcontentloaded" });
		await a.waitForTimeout(4000); await shot(a, "vault"); await a.getByText("SLIDES", { exact: true }).waitFor({ timeout: 30000 }).then(() => check("slides: Files has a Presentation card to start from", true)).catch(() => check("slides: Files has a Presentation card to start from", false));
		await b.close(); await a.close();
	} catch (e) { check("slides: run", false, String(e).slice(0, 300)); }
}

if (run("ai")) {
	try {
		const a = await open();
		await a.goto(`${BASE}/dashboard/mjengo/files/deck`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await a.getByRole("button", { name: /Write it with AI/ }).click();
		await a.getByLabel("What the presentation is about").fill("A short pitch to a foundation for a legal aid clinic that supports survivors of gender based violence in Nairobi: the need, our approach, and our ask.");
		await a.getByLabel("What the presentation is about").waitFor();
		await a.getByRole("button", { name: /Make a new presentation/ }).click();
		await a.waitForFunction(() => [...document.querySelectorAll('[aria-label^="Slide "]')].filter((e) => e.offsetParent !== null).length >= 5, null, { timeout: 120000 }).then(() => check("slides: AI writes a full presentation", true)).catch(() => check("slides: AI writes a full presentation", false));
		await shot(a, "deck-ai");
		await a.close();
	} catch (e) { check("slides: AI", false, String(e).slice(0, 300)); }
}

/* ------------------------------------------------------------ Spreadsheet, live */
if (run("sheet")) {
	try {
		const a = await open();
		await a.goto(`${BASE}/dashboard/mjengo/files/sheet`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await a.locator(".univer-host canvas").first().waitFor({ timeout: 90000 });
		await a.getByRole("button", { name: /^Save/ }).click();
		await a.waitForFunction(() => location.search.includes("file="), null, { timeout: 60000 });
		const id = fileOf(a.url());
		const b = await open();
		await b.goto(`${BASE}/dashboard/mjengo/files/sheet?file=${id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await b.locator(".univer-host canvas").first().waitFor({ timeout: 90000 });
		await a.getByText("Live").first().waitFor({ timeout: 25000 }).then(() => check("sheet: the other window shows as live", true)).catch(() => check("sheet: the other window shows as live", false));
		await shot(a, "sheet-live");
		// Type a number into a cell in A (the grid is a canvas, so click where the first cells are).
		const g = await a.locator(".univer-host canvas").first().boundingBox();
		await a.mouse.click(g.x + 160, g.y + 80);
		await a.keyboard.type("4242");
		await a.keyboard.press("Enter");
		await a.waitForTimeout(3000);
		await b.getByRole("button", { name: /^Save/ }).click();
		await b.getByText("Saved to Files").first().waitFor({ timeout: 30000 });
		const wb = XLSX.read(await bytesOf(id), { type: "buffer" });
		const flat = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }));
		check("sheet: a number typed in one window is in the other window's copy", flat.includes("4242"), flat.slice(0, 120));
		await a.close(); await b.close();
	} catch (e) { check("sheet: run", false, String(e).slice(0, 300)); }
}

/* ------------------------------------------------------------ Excalidraw */
if (run("draw")) {
	try {
		const a = await open();
		await a.goto(`${BASE}/dashboard/mjengo/files/draw`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await a.locator("canvas.excalidraw__canvas.interactive").waitFor({ timeout: 90000 });
		const c = await a.locator("canvas.excalidraw__canvas.interactive").boundingBox();
		// A rectangle: press R, drag.
		await a.locator('[data-testid="toolbar-rectangle"]').click({ force: true });
		await a.mouse.move(c.x + 560, c.y + 250); await a.mouse.down(); await a.mouse.move(c.x + 720, c.y + 350, { steps: 6 }); await a.mouse.up();
		await a.getByRole("button", { name: /^Save/ }).click(); await a.waitForTimeout(6000); await shot(a, "draw-after-save");await a.getByRole("button", { name: /^Save/ }).click();
		await a.waitForFunction(() => location.search.includes("file="), null, { timeout: 60000 });
		const id = fileOf(a.url());
		const countIn = async () => { const j = JSON.parse((await bytesOf(id)).toString("utf8")); return (j.elements ?? []).filter((e) => !e.isDeleted).length; };
		check("draw: a drawing saves as a file", (await countIn()) >= 1);
		const b = await open();
		await b.goto(`${BASE}/dashboard/mjengo/files/draw?file=${id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await b.locator("canvas.excalidraw__canvas.interactive").waitFor({ timeout: 90000 });
		await a.waitForTimeout(3000);
		// A draws an ellipse; B should receive it without reloading.
		await a.locator('[data-testid="toolbar-ellipse"]').click({ force: true });
		await a.mouse.move(c.x + 760, c.y + 250); await a.mouse.down(); await a.mouse.move(c.x + 870, c.y + 360, { steps: 6 }); await a.mouse.up();
		await a.waitForTimeout(3500);
		await shot(b, "draw-live-b");
		await b.getByRole("button", { name: /^Save/ }).click();
		await b.waitForTimeout(10000);
		let n = await countIn();
		for (let i = 0; i < 8 && n < 2; i++) { await b.waitForTimeout(3000); n = await countIn(); }
		check("draw: a shape drawn in one window reaches the other window's copy", n >= 2, `${n} elements saved`);
		check("draw: the other person shows in the header", (await a.locator('[aria-label^="Drawing now"]').count()) >= 1);
		await a.close(); await b.close();
	} catch (e) { check("draw: run", false, String(e).slice(0, 300)); }
}

/* ------------------------------------------------------------ Content ideas */
if (run("content")) {
	try {
		const a = await open();
		await a.goto(`${BASE}/dashboard/mjengo/content`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await a.getByText("What to post, and when").waitFor({ timeout: 60000 });
		check("content: asks the team to share photos", (await a.getByText("Share photos from your work").count()) >= 1);
		await a.getByLabel("Topic").fill("mental health");
		await a.getByRole("button", { name: /Find ideas/ }).click();
		await a.getByText("Best times to post").waitFor({ timeout: 60000 });
		check("content: shows best times per network", (await a.getByText(/Typical|Your results/).count()) >= 2);
		check("content: suggests hashtags", (await a.getByRole("button", { name: /^#MentalHealth$/ }).count()) >= 1);
		check("content: lists trending searches in Kenya", (await a.getByText("Trending in Kenya today").count()) >= 1);
		check("content: lists the questions people ask", (await a.getByText(/Questions people ask/).count()) >= 1);
		await shot(a, "content-ideas");
		await a.getByRole("button", { name: /Write post drafts/ }).click();
		await a.getByRole("button", { name: "Use this" }).first().waitFor({ timeout: 90000 }).then(() => check("content: writes post drafts from the ideas", true)).catch(() => check("content: writes post drafts from the ideas", false));
		await a.close();
	} catch (e) { check("content: run", false, String(e).slice(0, 300)); }
}

/* ------------------------------------------------------------ Calendar chooser */
if (run("calendar")) {
	try {
		const a = await open();
		await a.goto(`${BASE}/dashboard/mjengo/calendar`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await a.getByRole("button", { name: /^(Create|New)/ }).first().click();
		for (const t of ["Meeting", "Event", "Reminder", "Blocked time", "To-do", "Content", "Deadline"]) check(`calendar: the chooser offers ${t}`, (await a.getByText(t, { exact: false }).count()) >= 1);
		await shot(a, "calendar-chooser");
		await a.close();
	} catch (e) { check("calendar: run", false, String(e).slice(0, 300)); }
}

/* ------------------------------------------------------------ Opportunity card */
if (run("opp")) {
	let oid = null;
	try {
		const { data, error } = await db.from("mjengo_opportunities").insert({ title: `E2E opportunity ${Date.now()}` }).select("id, title").single();
		if (error) throw new Error(error.message);
		oid = data.id;
		const a = await open();
		await a.goto(`${BASE}/dashboard/mjengo/opportunities`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await a.getByText(data.title).first().waitFor({ timeout: 60000 });
		const link = a.getByRole("link", { name: /Open opportunity as a full page/i }).first();
		check("opportunities: each card has an Open as a full page button", (await link.count()) >= 1);
		await shot(a, "opportunity-card");
		await link.click();
		await a.waitForURL(new RegExp(`/opportunities/${oid}`), { timeout: 30000 }).then(() => check("opportunities: that button opens the full page before the side panel is used", true)).catch(() => check("opportunities: that button opens the full page before the side panel is used", false));
		await a.close();
	} catch (e) { check("opportunities: run", false, String(e).slice(0, 300)); }
	finally { if (oid) await db.from("mjengo_opportunities").delete().eq("id", oid); }
}

/* ------------------------------------------------------------ Mail: All inboxes (placeholder mailboxes that cannot be reached) */
if (run("mail")) {
	let ownerId = null; const made = [];
	try {
		const { accounts } = await import("./lib.mjs");
		ownerId = accounts.accounts.admin.id;
		if (!ownerId) { const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 200 }); ownerId = data.users.find((u) => u.email === accounts.accounts.admin.email)?.id; }
		for (const [email, label] of [["e2e.work@sautisalama.org", "Work"], ["e2e.me@gmail.com", "Personal"]]) {
			const { data, error } = await db.from("mail_accounts").insert({ owner_id: ownerId, label, email, password_enc: "x", protocol: "imap", auth_type: "password", imap_host: "127.0.0.1", imap_port: 1, imap_secure: false, smtp_host: "127.0.0.1", smtp_port: 1, smtp_secure: false, username: email }).select("id").single();
			if (error) throw new Error(error.message);
			made.push(data.id);
		}
		const a = await open();
		await a.goto(`${BASE}/dashboard/mjengo/mail`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await a.getByText("All inboxes").first().waitFor({ timeout: 60000 }).then(() => check("mail: All inboxes is the first choice with several mailboxes", true)).catch(() => check("mail: All inboxes is the first choice with several mailboxes", false));
		await a.waitForTimeout(3000);
		check("mail: each mailbox is tagged Work or Personal", (await a.getByText("Work", { exact: true }).count()) >= 1 && (await a.getByText("Personal", { exact: true }).count()) >= 1);
		check("mail: Subscriptions, Receipts and Updates sit under their own labels", (await a.getByText("Subscriptions").count()) >= 1 && (await a.getByText("Receipts").count()) >= 1 && (await a.getByText("Updates").count()) >= 1);
		await a.getByText(/Could not reach/).first().waitFor({ timeout: 30000 }).then(() => check("mail: an unreachable mailbox is named, not silently dropped", true)).catch(() => check("mail: an unreachable mailbox is named, not silently dropped", false));
		await shot(a, "mail-all");
		await a.close();
	} catch (e) { check("mail: run", false, String(e).slice(0, 300)); }
	finally { if (made.length) await db.from("mail_accounts").delete().in("id", made); }
}

await browser.close();
process.exit(summary() ? 1 : 0);
