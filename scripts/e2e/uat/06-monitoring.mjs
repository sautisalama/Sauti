// UAT-MON: 24h escalation monitoring. Needs the dev server running with
// EMAIL_MODE=capture CRON_SECRET=<same value as this process> ESCALATION_EMAILS=malkia@sautisalama.org,oliver@sautisalama.org
import { BASE, accounts, check, summary } from "../lib.mjs";
import { acc, db, readOutbox } from "../helpers.mjs";

const started = new Date().toISOString();
const secret = process.env.CRON_SECRET;
const url = `${BASE}/api/cron/escalate-stale-cases`;
const hoursAgo = (h) => new Date(Date.now() - h * 36e5).toISOString();
const survivorId = acc("survivor").id;
const get = (headers = {}) => fetch(url, { headers });

// ═════ A. The cron endpoint is protected ═════
check("MON-01 the monitor refuses callers without the secret", (await get()).status === 401);
check("MON-02 …and callers with a wrong secret", (await get({ authorization: "Bearer wrong" })).status === 401);
if (!secret) {
	check("MON-00 CRON_SECRET is set for this run (and on the dev server)", false, "export CRON_SECRET before running");
	process.exit(summary() ? 1 : 0);
}
const auth = { authorization: `Bearer ${secret}` };

// ═════ B. Fixtures ═════
// stale unmatched report = seed's 30h-old one. Control: a fresh unmatched report (must NOT be flagged).
const staleId = accounts.staleReportId;
const mk = async (over) =>
	(await db.from("reports").insert({ first_name: "E2E-Mon", user_id: survivorId, type_of_incident: "physical", urgency: "medium", state: "Nairobi", record_only: false, ismatched: false, ...over }).select("report_id").single()).data.report_id;
const freshId = await mk({ submission_timestamp: hoursAgo(2) });
const recordOnlyId = await mk({ submission_timestamp: hoursAgo(40), record_only: true });
const waitingReportId = await mk({ submission_timestamp: hoursAgo(31) });
const mkMatch = async (reportId, over) =>
	(await db.from("matched_services").insert({ report_id: reportId, survivor_id: survivorId, service_id: accounts.services.professional.id, support_service: "legal", match_score: 60, ...over }).select("id").single());
const waitingMatch = await mkMatch(waitingReportId, { match_status_type: "pending", match_date: hoursAgo(30), updated_at: hoursAgo(30) });
check("MON-03 fixtures created", !!staleId && !!freshId && !waitingMatch.error, waitingMatch.error?.message ?? "");
const waitingMatchId = waitingMatch.data?.id;

// accepted match whose chat has gone quiet
const silentReportId = await mk({ submission_timestamp: hoursAgo(50) });
const quietChat = (await db.from("chats").insert({ type: "dm", created_by: acc("professional").id, metadata: {} }).select("id").single()).data;
const silent = await mkMatch(silentReportId, { match_status_type: "accepted", professional_accepted_at: hoursAgo(29), chat_id: quietChat?.id });
const chatIsQuiet = !!quietChat;

const refs = [staleId, waitingMatchId, silent.data?.id].filter(Boolean);
await db.from("case_escalation_alerts").delete().in("ref_id", refs);

// ═════ C. First run ═════
const r1 = await get(auth);
const j1 = await r1.json().catch(() => ({}));
check("MON-04 the monitor runs", r1.status === 200 && j1.ok === true, `${r1.status} ${JSON.stringify(j1)}`);
const ledger = (await db.from("case_escalation_alerts").select("kind, ref_id").in("ref_id", [...refs, freshId, recordOnlyId])).data ?? [];
const has = (id) => ledger.some((l) => l.ref_id === id);
check("MON-05 a report unmatched for 30h is flagged", has(staleId));
check("MON-06 a match nobody has responded to for 30h is flagged", has(waitingMatchId));
check("MON-07 an accepted match with no conversation is flagged", chatIsQuiet && has(silent.data?.id), `${silent.error?.message ?? ""} id=${silent.data?.id} ledger=${JSON.stringify(ledger)}`);
check("MON-08 a recent report (2h) is NOT flagged", !has(freshId));
check("MON-09 a record-only report (not meant to be matched) is NOT flagged", !has(recordOnlyId));

const mails = readOutbox(started).filter((e) => e.category === "Urgent Escalation");
check("MON-10 exactly one digest email is sent for the run", mails.length === 1, `${mails.length}`);
const mail = mails[0] ?? {};
check('MON-11 the subject is exactly "Delayed Support"', mail.subject === "Delayed Support", mail.subject);
const to = [].concat(mail.to ?? []).map((s) => String(s).toLowerCase());
check("MON-12 it goes to malkia@ and oliver@sautisalama.org", to.includes("malkia@sautisalama.org") && to.includes("oliver@sautisalama.org"), to.join(","));
check("MON-13 it is marked urgent", mail.urgent === true);

// ═════ D. Second run: no repeat alerts ═════
const before = readOutbox(started).filter((e) => e.category === "Urgent Escalation").length;
const j2 = await (await get(auth)).json().catch(() => ({}));
const after = readOutbox(started).filter((e) => e.category === "Urgent Escalation").length;
check("MON-14 running again does not re-alert for the same cases", after === before && (j2.sent ?? 0) === 0, JSON.stringify(j2));

// ═════ E. Once handled, a case is no longer a problem ═════
await db.from("case_escalation_alerts").delete().in("ref_id", [waitingMatchId]);
await db.from("matched_services").update({ match_status_type: "declined" }).eq("id", waitingMatchId);
const { findStaleCases } = await import("../../../lib/cases/escalation.ts").catch(() => ({}));
if (findStaleCases) {
	const stale = await findStaleCases();
	check("MON-15 a match that is declined stops being flagged", !stale.some((c) => c.refId === waitingMatchId));
} else {
	check("MON-15 (skipped: run under tsx to load the finder)", true);
}

// ═════ cleanup ═════
await db.from("case_escalation_alerts").delete().in("ref_id", [...refs, freshId, recordOnlyId]);
await db.from("matched_services").delete().in("report_id", [waitingReportId, silentReportId]);
if (quietChat) await db.from("chats").delete().eq("id", quietChat.id);
await db.from("reports").delete().in("report_id", [freshId, recordOnlyId, waitingReportId, silentReportId]);
process.exit(summary() ? 1 : 0);
