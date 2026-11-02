// Deleting an opportunity removes the link to its documents, not the documents: files are kept for reuse.
import { BASE, launch, newPage, signIn, check, summary } from "./lib.mjs";
import { db, acc, poll } from "./helpers.mjs";

const { data: opp } = await db.from("mjengo_opportunities").insert({ title: "E2E delete keeps docs", status: "new", created_by: acc("admin").id, visibility: "team" }).select("id").single();
const { data: docs } = await db.from("mjengo_documents").insert([
	{ entity_type: "opportunity", entity_id: opp.id, name: "E2E kept budget", required: true, file_path: `opportunity/${opp.id}/budget.pdf`, file_name: "budget.pdf", file_size: 10, mime_type: "application/pdf" },
	{ entity_type: "opportunity", entity_id: opp.id, name: "E2E empty checklist item", required: true },
]).select("id, name");
const kept = docs.find((d) => d.name === "E2E kept budget").id;
const empty = docs.find((d) => d.name === "E2E empty checklist item").id;

const browser = await launch();
const page = await newPage(browser, { viewport: { width: 1280, height: 900 } });
await signIn(page, "admin");
await page.goto(`${BASE}/dashboard/mjengo/opportunities/${opp.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.getByRole("tab", { name: "Sharing" }).click({ timeout: 90000 });
check("delete says nothing about removing documents", (await page.getByText("Its documents stay in Documents").count()) === 1);
await page.getByRole("button", { name: /^Delete$/ }).first().click();
await page.getByRole("button", { name: "Yes, delete it", exact: true }).click();
const gone = await poll(async () => !(await db.from("mjengo_opportunities").select("id").eq("id", opp.id).maybeSingle()).data, { timeout: 60000, interval: 1500 });
check("the opportunity is deleted", !!gone);
const { data: after } = await db.from("mjengo_documents").select("id, entity_type, entity_id, file_path").in("id", [kept, empty]);
const k = after?.find((d) => d.id === kept);
check("the file is kept", !!k && k.file_path);
check("its link to the opportunity is removed", !!k && k.entity_type === null && k.entity_id === null);
check("an empty checklist item is removed with it", !after?.find((d) => d.id === empty));

await page.goto(`${BASE}/dashboard/mjengo/documents`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.getByText("E2E kept budget").first().waitFor({ timeout: 90000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: "audit-out/docs_not_linked.png" });
await page.getByText("Not linked").first().waitFor({ timeout: 60000 }).catch(() => {});
check("the kept file shows in Documents as not linked", (await page.getByText("E2E kept budget").count()) > 0 && (await page.getByText("Not linked").count()) > 0);
await db.from("mjengo_documents").delete().eq("id", kept);
await browser.close();
summary();
