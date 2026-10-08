// One-command UAT run against the DEV project. Reseeds before every suite, aggregates results, writes docs/uat/RESULTS.md.
//
//   Terminal 1:  EMAIL_MODE=capture CRON_SECRET=e2e-cron-secret PUBLICATIONS_EMAIL=publications@sautisalama.org \
//                ESCALATION_EMAILS=malkia@sautisalama.org,oliver@sautisalama.org DATA_ENCRYPTION_KEY=$(openssl rand -base64 32) npm run dev
//   Terminal 2:  node --env-file=.env.local scripts/e2e/run-all.mjs [filter]      e.g. filter "05" or "security"
import { spawn } from "node:child_process";
import fs from "node:fs";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const SECRET = process.env.CRON_SECRET || "e2e-cron-secret";
const SUITES = [
	["scripts/e2e/public.mjs", "Public site (SEO, access control, anonymous reporting)"],
	["scripts/e2e/security.mjs", "Security / row-level security attacks"],
	["scripts/e2e/uat/01-verification.mjs", "UAT-VER  Admin verification of professionals, NGOs and services"],
	["scripts/e2e/uat/02-reporting-matching.mjs", "UAT-RPT  Reporting and matching"],
	["scripts/e2e/uat/03-case-delivery.mjs", "UAT-CAS  Case delivery end to end"],
	["scripts/e2e/uat/04-communication.mjs", "UAT-COM  Messages, communities, AI assistant"],
	["scripts/e2e/uat/05-scheduling.mjs", "UAT-SCH  Booking and availability"],
	["scripts/e2e/uat/06-monitoring.mjs", "UAT-MON  24h escalation monitoring"],
	["scripts/e2e/uat/08-case-outcome.mjs", "UAT-OUT  Survivor confirms completion and rates support"],
	["scripts/e2e/uat/09-account-and-alerts.mjs", "UAT-ACC  Account control, verification alerts, certificates"],
	["scripts/e2e/uat/07-content.mjs", "UAT-PUB/LRN  Publications, courses, learner progress"],
];
const filter = process.argv[2];

const run = (args, env = {}) =>
	new Promise((resolve) => {
		const p = spawn(process.execPath, args, { env: { ...process.env, CRON_SECRET: SECRET, ...env }, shell: false });
		let out = "";
		p.stdout.on("data", (d) => (out += d));
		p.stderr.on("data", (d) => (out += d));
		p.on("close", (code) => resolve({ code, out }));
	});

try {
	const r = await fetch(`${BASE}/api/cron/escalate-stale-cases`);
	if (r.status !== 401) throw new Error(`cron answered ${r.status}; dev server must run with CRON_SECRET set`);
} catch (e) {
	console.error(`Dev server not ready at ${BASE}: ${e.message}`);
	process.exit(2);
}

const rows = [];
for (const [file, title] of SUITES) {
	if (filter && !file.includes(filter)) continue;
	process.stdout.write(`▶ ${title} … `);
	await run(["--env-file=.env.local", "scripts/e2e/seed.mjs"]);
	const t0 = Date.now();
	let { out } = await run(["--env-file=.env.local", file]);
	let m = out.match(/(\d+)\/(\d+) passed/);
	let fails = out.split("\n").filter((l) => l.startsWith("FAIL"));
	let retried = false;
	// Real-time suites can miss a message by a moment on a busy machine: a failing suite gets ONE clean retry, and the report says so.
	if (!m || +m[1] !== +m[2]) {
		retried = true;
		await run(["--env-file=.env.local", "scripts/e2e/seed.mjs"]);
		({ out } = await run(["--env-file=.env.local", file]));
		m = out.match(/(\d+)\/(\d+) passed/);
		fails = out.split("\n").filter((l) => l.startsWith("FAIL"));
	}
	const row = { title, file, passed: m ? +m[1] : 0, total: m ? +m[2] : 0, crashed: !m, fails, retried, secs: Math.round((Date.now() - t0) / 1000) };
	rows.push(row);
	console.log(row.crashed ? "CRASHED" : `${row.passed}/${row.total}`, `(${row.secs}s)`, row.retried && !row.crashed && row.passed === row.total ? "[passed on a clean retry]" : "");
	for (const f of fails) console.log("   " + f);
	if (row.crashed) console.log(out.split("\n").slice(-8).map((l) => "   " + l).join("\n"));
}

const total = rows.reduce((a, r) => a + r.total, 0), passed = rows.reduce((a, r) => a + r.passed, 0);
const bad = rows.filter((r) => r.crashed || r.passed !== r.total);
if (!filter) {
	const md = [
		"# UAT run results",
		"",
		`Run: ${new Date().toISOString()} · Target: dev project · App: ${BASE}`,
		"",
		`**${passed}/${total} automated checks passed** across ${rows.length} suites${bad.length ? ` — ${bad.length} suite(s) need attention` : ""}.`,
		"",
		"| Suite | Result | Time |",
		"|---|---|---|",
		...rows.map((r) => `| ${r.title} | ${r.crashed ? "❌ crashed" : r.passed === r.total ? `✅ ${r.passed}/${r.total}${r.retried ? " (passed on a clean retry)" : ""}` : `❌ ${r.passed}/${r.total}`} | ${r.secs}s |`),
		...(bad.length ? ["", "## Failures", "", ...bad.flatMap((r) => [`**${r.title}**`, ...r.fails.map((f) => `- ${f}`), ""])] : []),
		"",
	].join("\n");
	fs.writeFileSync("docs/uat/RESULTS.md", md);
}
console.log(`\n${passed}/${total} checks passed${bad.length ? `, ${bad.length} suite(s) failing` : ""}`);
process.exit(bad.length ? 1 : 0);
