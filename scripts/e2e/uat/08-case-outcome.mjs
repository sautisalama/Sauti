// UAT-OUT: the survivor confirms that support is complete and rates it (either before or after the provider closes the case).
import { BASE, check, launch, newPage, signIn, summary } from "../lib.mjs";
import { acc, db, notificationsFor, poll, resetMatches, svcOf } from "../helpers.mjs";

const browser = await launch();
const survivor = await newPage(browser);
await signIn(survivor, "survivor");
await resetMatches();
const proId = acc("professional").id, surId = acc("survivor").id;

const mk = async (name, status, extra = {}) => {
	const { data: rep, error: re } = await db.from("reports").insert({ first_name: name, incident_description: name, user_id: surId, type_of_incident: "physical", urgency: "low", record_only: false, ismatched: true, submission_timestamp: new Date().toISOString() }).select("report_id").single();
	if (re) throw re;
	const { data: chat } = await db.from("chats").insert({ type: "dm", created_by: proId, metadata: {} }).select("id").single();
	await db.from("chat_participants").insert([{ chat_id: chat.id, user_id: proId }, { chat_id: chat.id, user_id: surId }]);
	const { data: m, error } = await db.from("matched_services").insert({ report_id: rep.report_id, survivor_id: surId, service_id: svcOf("professional").id, hrd_profile_id: proId, support_service: "legal", match_score: 70, match_status_type: status, chat_id: chat.id, professional_accepted_at: new Date().toISOString(), ...extra }).select("id").single();
	if (error) throw error;
	return { reportId: rep.report_id, matchId: m.id };
};
const feedback = async (id) => {
	const m = (await db.from("matched_services").select("feedback, match_status_type").eq("id", id).single()).data;
	return { fb: m?.feedback ? JSON.parse(m.feedback) : {}, status: m?.match_status_type };
};

async function openAndConfirm(label, rate) {
	await survivor.goto(`${BASE}/dashboard/reports`, { waitUntil: "networkidle", timeout: 120000 });
	await survivor.getByText(label).first().click().catch(() => undefined);
	await survivor.getByRole("button", { name: /support is complete|Rate your support/i }).first().click({ timeout: 30000 });
	const dlg = survivor.getByRole("dialog");
	await dlg.waitFor({ timeout: 15000 });
	if (rate) {
		await dlg.getByRole("radio", { name: "4 stars" }).click();
		await dlg.getByRole("textbox").fill("Very supportive, thank you.");
	}
	await dlg.getByRole("button", { name: /mark complete/i }).click();
	await dlg.waitFor({ state: "hidden", timeout: 20000 });
}

// ═════ A. Survivor confirms first; the provider has not closed the case ═════
const a = await mk("E2E-Outcome-A", "accepted");
await openAndConfirm("E2E-Outcome-A", true);
const A = await poll(async () => { const r = await feedback(a.matchId); return r.fb.is_surv_complete ? r : null; });
check("OUT-01 the survivor can confirm a case is complete from their dashboard", !!A);
check("OUT-02 the rating and note are stored", A?.fb.survivor_rating === 4 && /supportive/.test(A?.fb.survivor_comment ?? ""), JSON.stringify(A?.fb));
check("OUT-03 the case stays open until the provider also confirms", A?.status === "accepted", A?.status);
const note = await poll(async () => (await notificationsFor(proId, "review_received")).find((n) => n.metadata?.match_id === a.matchId));
check("OUT-04 the provider is told", !!note, note?.message ?? "none");

// the provider then confirms (mirrors the cases list): case closes
await db.from("matched_services").update({ feedback: JSON.stringify({ ...A.fb, is_prof_complete: true }) }).eq("id", a.matchId);

// ═════ B. Provider closed first; the survivor can still rate ═════
const b = await mk("E2E-Outcome-B", "completed", { completed_at: new Date().toISOString(), feedback: JSON.stringify({ is_prof_complete: true }) });
await openAndConfirm("E2E-Outcome-B", true);
const B = await poll(async () => { const r = await feedback(b.matchId); return r.fb.is_surv_complete ? r : null; });
check("OUT-05 a survivor can still rate a case the provider already closed", !!B && B.fb.survivor_rating === 4 && B.status === "completed", JSON.stringify(B));
await survivor.goto(`${BASE}/dashboard/reports`, { waitUntil: "networkidle", timeout: 120000 });
await survivor.getByText("E2E-Outcome-B").first().click().catch(() => undefined);
check("OUT-06 once rated, the prompt no longer appears", (await survivor.getByRole("button", { name: /Rate your support|support is complete/i }).count()) === 0);

// ═════ C. Safety ═════
const other = await newPage(browser);
await signIn(other, "survivor2");
await other.goto(`${BASE}/dashboard/reports`, { waitUntil: "networkidle", timeout: 120000 });
check("OUT-07 another survivor never sees the prompt for someone else's case", (await other.getByRole("button", { name: /Rate your support|support is complete/i }).count()) === 0);

// cleanup
for (const x of [a, b]) {
	await db.from("matched_services").delete().eq("id", x.matchId);
	await db.from("reports").delete().eq("report_id", x.reportId);
}
await db.from("reports").delete().like("first_name", "E2E-Outcome-%");
await browser.close();
process.exit(summary() ? 1 : 0);
