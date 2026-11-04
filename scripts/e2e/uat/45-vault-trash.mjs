// Files: delete goes to the trash, restore brings it back, deleting from the trash is for good, and Recent files has the same menu.
//   node --env-file=.env.local scripts/e2e/uat/45-vault-trash.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const owner = accounts.accounts.admin.id;
const name = `e2e-trash-${Date.now()}.txt`;
const path = `e2e/${name}`;
await db.storage.from("mjengo-docs").upload(path, new Blob(["hello"]), { contentType: "text/plain", upsert: true });
const { data: row } = await db.from("vault_files").insert({ folder_id: null, name, storage_path: path, mime: "text/plain", size: 5, owner_id: owner, last_opened_at: new Date().toISOString() }).select("id").single();
const id = row.id;

// The actions queue behind other page work, so poll the database instead of guessing a delay.
const until = async (read, ok, ms = 40000) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await read(); if (ok(v)) return v; await new Promise((r) => setTimeout(r, 700)); } return v; };
const state = () => db.from("vault_files").select("deleted_at, deleted_root").eq("id", id).maybeSingle().then((r) => r.data);

const browser = await launch();
const page = await newPage(browser, {});
try {
	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/vault`, { waitUntil: "domcontentloaded" });
	// Recent files: the same actions menu as All files.
	const recentMenu = page.getByRole("button", { name: `Actions for ${name}` }).first();
	await recentMenu.waitFor({ timeout: 60000 });
	await recentMenu.click();
	check("Recent files has the actions menu with Delete", (await page.getByRole("menuitem", { name: "Delete" }).count()) === 1);
	await page.getByRole("menuitem", { name: "Delete" }).click();
	await page.getByRole("button", { name: "Move to trash" }).click();
	const after = await until(state, (v) => !!v?.deleted_at);
	check("Deleting moves it to the trash (the file is kept)", !!after.deleted_at && after.deleted_root === true);
	const { data: still } = await db.storage.from("mjengo-docs").download(path);
	check("The stored file is still there", !!still);
	await page.getByRole("button", { name: "Move to trash" }).waitFor({ state: "detached", timeout: 45000 }).catch(() => undefined);
	await page.getByRole("button", { name: `Actions for ${name}` }).first().waitFor({ state: "detached", timeout: 45000 }).catch(() => undefined);
	check("It is gone from the lists", (await page.getByRole("button", { name: `Actions for ${name}` }).count()) === 0);

	await page.getByRole("button", { name: /^Trash$/ }).click();
	const dialog = page.getByRole("dialog", { name: "Trash" });
	await dialog.getByText(name).waitFor({ timeout: 45000 });
	check("The trash lists it with the days left", /2[01] days? left/.test(await dialog.innerText()));
	await dialog.getByRole("button", { name: "Restore" }).first().click();
	const back = await until(state, (v) => v?.deleted_at === null);
	check("Restore brings it back", back.deleted_at === null);

	// Delete again, then for good.
	await db.from("vault_files").update({ deleted_at: new Date().toISOString(), deleted_by: owner, deleted_root: true }).eq("id", id);
	await page.reload({ waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: /^Trash$/ }).click();
	const d2 = page.getByRole("dialog", { name: "Trash" });
	await d2.getByText(name).waitFor({ timeout: 45000 });
	await d2.getByRole("button", { name: `Delete ${name} for good` }).click();
	const gone = await until(state, (v) => !v);
	check("Delete for good removes it", !gone);
	const bytes = await until(() => db.storage.from("mjengo-docs").download(path).then((r) => r.data), (v) => !v);
	check("…and its stored file", !bytes);

	// 21 days: an old one is removed by the purge.
	const old = `e2e-old-${Date.now()}.txt`;
	await db.storage.from("mjengo-docs").upload(`e2e/${old}`, new Blob(["x"]), { contentType: "text/plain", upsert: true });
	const { data: o } = await db.from("vault_files").insert({ folder_id: null, name: old, storage_path: `e2e/${old}`, mime: "text/plain", size: 1, owner_id: owner, deleted_at: new Date(Date.now() - 22 * 86400e3).toISOString(), deleted_by: owner, deleted_root: true }).select("id").single();
	await page.goto(`${BASE}/dashboard/mjengo/vault`, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: /^Trash$/ }).click();
	await page.getByRole("dialog", { name: "Trash" }).waitFor();
	const oldAfter = await until(() => db.from("vault_files").select("id").eq("id", o.id).maybeSingle().then((r) => r.data), (v) => !v);
	check("Something older than 21 days is removed", !oldAfter);
} catch (e) {
	check("Vault trash", false, String(e).slice(0, 300));
} finally {
	await db.from("vault_files").delete().eq("id", id);
	await db.storage.from("mjengo-docs").remove([path]);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
