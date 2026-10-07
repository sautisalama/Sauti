// Security regression suite: attacks the database API the way a malicious signed-in user,
// an anonymous visitor and a curious professional would, using the PUBLIC anon key.
//   node --env-file=.env.local scripts/e2e/security.mjs     (after seed.mjs)
import { createClient } from "@supabase/supabase-js";
import { accounts, check, summary } from "./lib.mjs";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = createClient(URL_, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function as(role) {
	const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
	const { error } = await c.auth.signInWithPassword({ email: accounts.accounts[role].email, password: accounts.accounts[role].password });
	if (error) throw new Error(`sign-in failed for ${role}: ${error.message}`);
	return c;
}
const anon = () => createClient(URL_, ANON, { auth: { persistSession: false } });
const id = (r) => accounts.accounts[r].id;
const prof = async (uid) => (await svc.from("profiles").select("*").eq("id", uid).single()).data;

// ───────── privilege escalation ─────────
{
	const sur = await as("survivor");
	let r = await sur.from("profiles").update({ is_admin: true }).eq("id", id("survivor"));
	check("SEC-01 a user cannot make themselves admin", !!r.error && (await prof(id("survivor"))).is_admin === false, r.error?.message ?? "no error");

	const unverified = await as("pending_pro");
	r = await unverified.from("profiles").update({ verification_status: "verified", isVerified: true }).eq("id", id("pending_pro"));
	check("SEC-02 an unverified professional cannot self-verify", !!r.error && (await prof(id("pending_pro"))).verification_status === "pending", r.error?.message ?? "no error");

	await svc.from("profiles").update({ is_banned: true, ban_reason: "e2e" }).eq("id", id("survivor"));
	r = await sur.from("profiles").update({ is_banned: false, ban_reason: null }).eq("id", id("survivor"));
	check("SEC-03 a banned user cannot lift their own ban", !!r.error && (await prof(id("survivor"))).is_banned === true, r.error?.message ?? "no error");
	await svc.from("profiles").update({ is_banned: false, ban_reason: null }).eq("id", id("survivor"));

	r = await sur.from("profiles").update({ first_name: "E2E", bio: "updated by owner" }).eq("id", id("survivor"));
	check("SEC-04 a user CAN still edit their own ordinary profile fields", !r.error && (await prof(id("survivor"))).bio === "updated by owner");

	r = await sur.from("profiles").update({ verification_status: "under_review" }).eq("id", id("survivor"));
	check("SEC-05 submitting documents (→ under_review) is still allowed", !r.error, r.error?.message ?? "");
	await svc.from("profiles").update({ verification_status: "verified", isVerified: true }).eq("id", id("survivor"));

	// delete + re-insert trick
	const s2 = await as("survivor2");
	await s2.from("profiles").delete().eq("id", id("survivor2"));
	r = await s2.from("profiles").insert({ id: id("survivor2"), email: accounts.accounts.survivor2.email, first_name: "E2E", last_name: "Neighbour", user_type: "survivor", is_admin: true, isVerified: true, verification_status: "verified" });
	const p2 = await prof(id("survivor2"));
	check("SEC-06 re-creating a profile cannot smuggle in admin/verified flags", p2 && p2.is_admin === false && p2.isVerified === false && p2.verification_status !== "verified", JSON.stringify({ admin: p2?.is_admin, v: p2?.isVerified, st: p2?.verification_status, err: r.error?.message }));
	r = await s2.from("profiles").insert({ id: crypto.randomUUID(), first_name: "ghost" });
	check("SEC-07 a user cannot create a profile row for someone else's id", !!r.error, r.error?.message ?? "no error");
}

// ───────── services & matches ─────────
{
	const pend = await as("pending_pro");
	const svcId = accounts.services.pending_pro.id;
	let r = await pend.from("support_services").update({ verification_status: "verified", is_active: true }).eq("id", svcId);
	const row = (await svc.from("support_services").select("verification_status").eq("id", svcId).single()).data;
	check("SEC-08 a provider cannot verify their own service", !!r.error && row.verification_status === "pending", r.error?.message ?? "no error");
	r = await pend.from("support_services").update({ is_banned: false, verified_by: id("pending_pro") }).eq("id", svcId);
	check("SEC-09 a provider cannot set admin-only service fields", !!r.error, r.error?.message ?? "no error");
	r = await pend.from("support_services").insert({ user_id: id("pending_pro"), name: "E2E sneaky", service_types: "legal", verification_status: "verified", is_active: true, latitude: -1.29, longitude: 36.82 }).select("id, verification_status").single();
	check("SEC-10 a new service is always created as pending", r.data?.verification_status === "pending", JSON.stringify(r.data ?? r.error?.message));
	if (r.data?.id) await svc.from("support_services").delete().eq("id", r.data.id);

	const sur = await as("survivor");
	const lawyerSvc = accounts.services.professional.id;
	r = await sur.from("matched_services").insert({ survivor_id: id("survivor"), service_id: lawyerSvc, match_status_type: "accepted", support_service: "legal" });
	check("SEC-11 a survivor cannot fabricate a match with a provider", !!r.error, r.error?.message ?? "no error");

	// real match to attack
	const { data: rep } = await svc.from("reports").insert({ first_name: "E2E-Sec", user_id: id("survivor"), type_of_incident: "physical", urgency: "low", record_only: true, ismatched: false }).select("report_id").single();
	const { data: m } = await svc.from("matched_services").insert({ report_id: rep.report_id, survivor_id: id("survivor"), service_id: lawyerSvc, match_status_type: "pending", support_service: "legal", match_score: 50 }).select("id").single();
	r = await sur.from("matched_services").update({ service_id: accounts.services.medic.id }).eq("id", m.id);
	check("SEC-12 a party cannot re-point a match at another service", !!r.error, r.error?.message ?? "no error");
	r = await sur.from("matched_services").update({ match_score: 999 }).eq("id", m.id);
	check("SEC-13 a party cannot edit a match score", !!r.error, r.error?.message ?? "no error");
	const lawyer = await as("professional");
	r = await lawyer.from("matched_services").update({ match_status_type: "proposed" }).eq("id", m.id).select("id");
	check("SEC-14 the provider CAN progress their own match", !r.error && r.data?.length === 1, r.error?.message ?? "");
	const other = await as("medic");
	r = await other.from("matched_services").update({ match_status_type: "accepted" }).eq("id", m.id).select("id");
	check("SEC-15 an unrelated provider cannot touch someone else's match", (r.data?.length ?? 0) === 0, r.error?.message ?? "rows=" + r.data?.length);
	r = await other.from("matched_services").select("id").eq("id", m.id);
	check("SEC-16 an unrelated provider cannot even read it", (r.data?.length ?? 0) === 0);
	r = await other.from("reports").select("report_id").eq("report_id", rep.report_id);
	check("SEC-17 an unrelated provider cannot read the report", (r.data?.length ?? 0) === 0);
	await svc.from("matched_services").delete().eq("id", m.id);
	await svc.from("reports").delete().eq("report_id", rep.report_id);
}

// ───────── notifications, tokens, storage, profiles ─────────
{
	const a = anon();
	let r = await a.from("notifications").insert({ user_id: id("survivor"), type: "x", title: "phish", message: "click" });
	check("SEC-18 anonymous visitors cannot create notifications", !!r.error, r.error?.message ?? "no error");
	const sur = await as("survivor");
	r = await sur.from("notifications").insert({ user_id: id("professional"), type: "x", title: "spoof", message: "from nobody" });
	check("SEC-19 a user cannot notify someone else", !!r.error, r.error?.message ?? "no error");
	r = await sur.from("notifications").insert({ user_id: id("survivor"), type: "note", title: "mine", message: "self" });
	check("SEC-20 a user can still create a notification for themselves", !r.error, r.error?.message ?? "");
	await svc.from("notifications").delete().eq("user_id", id("survivor"));

	r = await sur.from("profile_calendar_tokens").select("*");
	check("SEC-21 calendar tokens are not readable from the browser", (r.data?.length ?? 0) === 0);
	r = await sur.from("profile_calendar_tokens").insert({ user_id: id("survivor"), access_token: "x" });
	check("SEC-22 calendar tokens cannot be written from the browser", !!r.error);
	const conn = await sur.rpc("get_calendar_connection");
	check("SEC-23 browsers can ask 'am I connected?' without seeing tokens", !conn.error && (Array.isArray(conn.data) ? conn.data[0] : conn.data)?.connected === false, JSON.stringify(conn.data ?? conn.error?.message));

	const list = await a.storage.from("report-audio").list("reports");
	check("SEC-24 anonymous visitors cannot list survivors' voice notes", !!list.error || (list.data?.length ?? 0) === 0, `entries=${list.data?.length ?? "error"}`);
	await svc.storage.from("report-audio").upload("reports/e2e-sec.webm", Buffer.from("x"), { contentType: "audio/webm", upsert: true });
	const del = await a.storage.from("report-audio").remove(["reports/e2e-sec.webm"]);
	const still = await svc.storage.from("report-audio").download("reports/e2e-sec.webm");
	check("SEC-25 anonymous visitors cannot delete a voice note", !still.error, JSON.stringify(del.data?.length ?? del.error));
	await svc.storage.from("report-audio").remove(["reports/e2e-sec.webm"]);

	// Verified public-booking providers are intentionally readable by signed-in users (see docs/uat/KNOWN-GAPS.md #11).
	r = await sur.from("profiles").select("id, google_calendar_token, is_public_booking").neq("id", id("survivor")).limit(20);
	const leaked = (r.data ?? []).filter((p) => !p.is_public_booking);
	check("SEC-26 a user cannot read other people's private profile rows", leaked.length === 0, `rows=${leaked.length}`);
	check("SEC-26b …and no calendar token is ever exposed on a readable profile", (r.data ?? []).every((p) => p.google_calendar_token == null));
	r = await a.from("profiles").select("id").limit(1);
	check("SEC-27 anonymous visitors cannot read profiles", (r.data?.length ?? 0) === 0);
	r = await a.from("reports").select("report_id").limit(1);
	check("SEC-28 anonymous visitors cannot read reports", (r.data?.length ?? 0) === 0);
	r = await a.from("matched_services").select("id").limit(1);
	check("SEC-29 anonymous visitors cannot read matches", (r.data?.length ?? 0) === 0);
	r = await a.from("admin_actions").select("id").limit(1);
	check("SEC-30 anonymous visitors cannot read the admin audit log", (r.data?.length ?? 0) === 0);
	r = await sur.from("admin_actions").select("id").limit(1);
	check("SEC-31 ordinary users cannot read the admin audit log", (r.data?.length ?? 0) === 0);
	r = await a.rpc("revoke_device_session", { p_user_id: id("survivor"), p_device_id: "x" });
	check("SEC-32 anonymous visitors cannot call device-session functions", !!r.error);
	r = await sur.rpc("get_user_role_context", { target_user_id: id("admin") });
	check("SEC-33 a user cannot look up another user's role context", (r.data?.length ?? 0) === 0, JSON.stringify(r.data));
}

// ───────── admin CAN ─────────
{
	const adm = await as("admin");
	const target = accounts.accounts.pending_ngo.id;
	let r = await adm.from("profiles").update({ verification_status: "verified", isVerified: true, admin_verified_by: id("admin"), admin_verified_at: new Date().toISOString() }).eq("id", target).select("id");
	check("SEC-34 an admin CAN verify a profile", !r.error && r.data?.length === 1, r.error?.message ?? "");
	await svc.from("profiles").update({ verification_status: "pending", isVerified: false, admin_verified_by: null, admin_verified_at: null }).eq("id", target);
	r = await adm.from("support_services").update({ verification_status: "verified", is_active: true, verified_by: id("admin"), verified_at: new Date().toISOString() }).eq("id", accounts.services.pending_ngo.id).select("id");
	check("SEC-35 an admin CAN verify a service", !r.error && r.data?.length === 1, r.error?.message ?? "");
	await svc.from("support_services").update({ verification_status: "pending", is_active: false, verified_by: null, verified_at: null }).eq("id", accounts.services.pending_ngo.id);
	r = await adm.from("publications").select("id").limit(1);
	check("SEC-36 an admin can read the publications table", !r.error);
}

process.exit(summary() ? 1 : 0);
