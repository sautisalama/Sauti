// Smoke test of the Mjengo suite as a signed-in administrator: every section opens without a page error, and the
// features added in the latest round are present. Needs the dev server and the seeded accounts (seed.mjs).
//   node --env-file=.env.local scripts/e2e/uat/10-suite-smoke.mjs
import { BASE, check, launch, newPage, signIn, summary } from "../lib.mjs";

const SECTIONS = [
	["/dashboard/mjengo", "Overview"],
	["/dashboard/mjengo/mail", "Mail"],
	["/dashboard/mjengo/contacts", "Contacts"],
	["/dashboard/mjengo/calendar", "Calendar"],
	["/meet", "Meet"],
	["/dashboard/mjengo/vault", "Files"],
	["/dashboard/mjengo/grants", "Grants"],
	["/dashboard/mjengo/opportunities", "Opportunities"],
	["/dashboard/mjengo/projects", "Projects"],
	["/dashboard/mjengo/fellowships", "Fellowships"],
	["/dashboard/mjengo/forms", "Forms"],
	["/dashboard/mjengo/todos", "To-dos"],
	["/dashboard/mjengo/assistant", "Assistant"],
	["/dashboard/mjengo/design", "Design"],
	["/dashboard/mjengo/content", "Content"],
];

const browser = await launch();
const page = await newPage(browser);
try {
	await signIn(page, "admin");
	for (const [path, label] of SECTIONS) {
		page.errors.length = 0;
		const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
		await page.waitForTimeout(1500);
		const body = (await page.textContent("body")) ?? "";
		const crashed = /This page couldn.t load|Application error|Something went wrong/i.test(body);
		check(`${label} opens`, !!res && res.status() < 400 && !crashed && page.errors.length === 0, page.errors[0]?.slice(0, 120) ?? `status ${res?.status()}`);
	}

	// The side navigation on /meet matches the suite (not the public site menu).
	await page.goto(`${BASE}/meet`, { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(1500);
	const nav = (await page.textContent("body")) ?? "";
	check("Meet shows the suite navigation", /Mail/.test(nav) && /Grants/.test(nav) && !/Weather Safety/.test(nav));

	// Forms: templates are offered.
	await page.goto(`${BASE}/dashboard/mjengo/forms`, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: /New form/i }).click();
	await page.waitForTimeout(500);
	const dlg = (await page.textContent("[role=dialog]")) ?? "";
	check("Forms offers a media consent template", /Media consent/.test(dlg) && /Application form/.test(dlg) && /Feedback/.test(dlg));

	// Calendar: a new event has a reminders list.
	await page.goto(`${BASE}/dashboard/mjengo/calendar`, { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(1500);
	await page.getByRole("button", { name: /^(New|Create|\+)/i }).first().click().catch(() => undefined);
	await page.waitForTimeout(600);
	const cal = (await page.textContent("body")) ?? "";
	check("Calendar event has reminders", /Add a reminder/.test(cal) || /Reminders/.test(cal));

	// Design: layers button and the brand colour field.
	await page.goto(`${BASE}/dashboard/mjengo/design/editor?size=instagram`, { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(2500);
	check("Design editor has Layers", (await page.getByRole("button", { name: "Layers" }).count()) > 0);
} finally {
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
