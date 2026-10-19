// Playbooks, approvals and the catch-up card in the app: changing a grant's stage to Awarded sets up its steps by
// themselves; the Playbooks page lists them; a file can be sent for approval; Since you were away lists what
// changed and clears when you say you are caught up.
//   node --env-file=.env.local scripts/e2e/uat/39-workflow.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tag = `zq${Date.now()}`;
const me = accounts.accounts.admin.id;
const { data: others } = await db.from("profiles").select("id").eq("is_admin", true).neq("id", me).limit(1);
const other = others?.[0]?.id ?? null;
const title = `Workflow grant ${tag}`;
const { data: grant } = await db.from("mjengo_grants").insert({ title, status: "submitted", created_by: me, owner_id: me }).select("id").single();
const path = `e2e/${tag}-wf.txt`;
await db.storage.from("mjengo-docs").upload(path, Buffer.from("A file to approve."), { contentType: "text/plain", upsert: true });
const { data: file } = await db.from("vault_files").insert({ name: `wf-${tag}.txt`, storage_path: path, mime: "text/plain", size: 18, owner_id: me }).select("id").single();
const { data: track } = await db.from("mjengo_todo_tracks").insert({ name: `wf ${tag}`, created_by: me }).select("id").single();
const { data: task } = await db.from("mjengo_todos").insert({ track_id: track.id, title: `Digest task ${tag}`, assignee_ids: [me], created_by: other }).select("id").single();
await db.from("mjengo_digest_seen").delete().eq("user_id", me);

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(120000);
await page.setViewportSize({ width: 1500, height: 1100 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
try {
	await signIn(page, "admin");

	// The catch-up card on the Overview.
	await page.goto(`${BASE}/dashboard/mjengo`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByText("Since you were away").first().waitFor();
	check("Since you were away lists a task given to you", (await page.getByText(`Digest task ${tag}`).count()) > 0);
	await page.getByRole("button", { name: /I'm caught up/ }).click();
	await page.getByText("Since you were away").first().waitFor({ state: "detached", timeout: 60000 });
	check("Saying you are caught up clears it", true);

	// A grant becomes awarded: its playbook sets up the steps.
	await page.goto(`${BASE}/dashboard/mjengo/grants`, { waitUntil: "domcontentloaded" });
	await page.locator('[tabindex="0"]').filter({ hasText: title }).first().click();
	await page.getByText("Stage", { exact: true }).first().waitFor();
	await page.getByText("Stage", { exact: true }).first().locator("..").getByRole("combobox").click();
	await page.getByRole("option", { name: "Awarded" }).click();
	await page.getByRole("button", { name: "Save", exact: true }).click();
	let todos = [];
	for (let i = 0; i < 60 && todos.length < 5; i++) { await page.waitForTimeout(2000); todos = (await db.from("mjengo_todos").select("title, due_date, assignee_ids").eq("entity_id", grant.id)).data ?? []; }
	check("Awarded sets up the steps of the playbook", todos.length >= 5, `${todos.length} to-dos`);
	check("They are given to the person responsible with due dates", todos.every((t) => t.assignee_ids.includes(me) && t.due_date));

	// The Playbooks page.
	await page.goto(`${BASE}/dashboard/mjengo/playbooks`, { waitUntil: "domcontentloaded" });
	await page.getByText("Grant awarded: set it up").first().waitFor();
	check("The Playbooks page lists the built-in playbooks with their steps", (await page.getByText("Agree the reporting calendar with the funder").count()) > 0);
	await page.getByRole("button", { name: /^(Edit|View)$/ }).first().click();
	await page.getByRole("dialog", { name: "Playbook" }).waitFor();
	check("A playbook opens to show its steps", (await page.getByRole("dialog", { name: "Playbook" }).getByLabel("To-do").count()) > 0);
	await page.getByRole("dialog", { name: "Playbook" }).getByRole("button", { name: "Close", exact: true }).last().click();

	// Approval from a file.
	await page.goto(`${BASE}/dashboard/mjengo/vault`, { waitUntil: "domcontentloaded" });
	await page.getByText(`wf-${tag}.txt`).first().waitFor({ timeout: 120000 });
	const nameCell = page.getByText(`wf-${tag}.txt`).last();
	const menuBtn = nameCell.locator('xpath=ancestor::*[.//button[@aria-haspopup="menu"]][1]').locator('button[aria-haspopup="menu"]').first();
	await menuBtn.click();
	await page.getByRole("menuitem", { name: /Tags, approval and similar files/ }).click();
	await page.getByRole("button", { name: "Ask for approval" }).waitFor();
	check("A file's dialog offers approval", true);
	if (other) {
		await page.getByRole("button", { name: "Ask for approval" }).click();
		await page.getByText("Who should approve it?").waitFor();
		await page.locator('button[aria-pressed]').filter({ hasNotText: /./ }).count();
		const names = page.getByText("Who should approve it?").locator("..").locator("button[aria-pressed]");
		const n = await names.count();
		for (let i = 0; i < n; i++) { const t = (await names.nth(i).innerText()).trim(); if (!/E2E Admin/.test(t)) { await names.nth(i).click(); break; } }
		await page.getByRole("button", { name: "Send request" }).click();
		await page.getByText("Waiting for approval").first().waitFor({ timeout: 90000 });
		check("Sending the request shows it waiting for approval", true);
		const ap = (await db.from("mjengo_approvals").select("status").eq("file_id", file.id)).data ?? [];
		check("It is recorded", ap.length === 1 && ap[0].status === "pending");
	}
	check("No page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
	check("Workflow flow", false, String(e).slice(0, 300));
	await page.screenshot({ path: `${process.env.TEMP}/workflow-fail.png` }).catch(() => undefined);
} finally {
	await db.from("mjengo_playbook_runs").delete().eq("entity_id", grant.id);
	await db.from("mjengo_todos").delete().eq("entity_id", grant.id);
	await db.from("mjengo_todos").delete().eq("id", task.id);
	await db.from("mjengo_todo_tracks").delete().eq("id", track.id);
	await db.from("vault_folders").delete().eq("owner_id", me).eq("name", title);
	await db.from("mjengo_search_chunks").delete().in("source_id", [grant.id, file.id]);
	await db.from("mjengo_search_sources").delete().in("source_id", [grant.id, file.id]);
	await db.from("vault_files").delete().eq("id", file.id);
	await db.storage.from("mjengo-docs").remove([path]);
	await db.from("mjengo_grants").delete().eq("id", grant.id);
	await db.from("mjengo_digest_seen").delete().eq("user_id", me);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
