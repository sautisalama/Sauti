// Seeds (or removes) throw-away end-to-end test data in the DEV Supabase project.
//
//   node --env-file=.env.local scripts/e2e/seed.mjs            # create accounts + fixtures
//   node --env-file=.env.local scripts/e2e/seed.mjs --cleanup  # delete everything it created
//
// Safety: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is the dev project.
// Passwords are generated here and written ONLY to .e2e-accounts.local.json
// (git-ignored); they are never printed.

import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEV_REF = "xtzpoyoymgwagrmpfwom";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY;
if (!url.includes(DEV_REF)) {
	console.error(`Refusing to run: ${url || "(no url)"} is not the dev project.`);
	process.exit(1);
}
if (!key) {
	console.error("Missing service role key.");
	process.exit(1);
}

const FILE = new URL("../../.e2e-accounts.local.json", import.meta.url);
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const TAG = "e2e-sauti";
const NAIROBI = { latitude: -1.2921, longitude: 36.8219 };

/**
 * The cast. `service` creates a support service owned by the account.
 * verified=true → ready for matching; verified=false → waiting for admin approval.
 */
const ACCOUNTS = [
	{ role: "admin", first: "E2E", last: "Admin", user_type: "professional", is_admin: true },
	{ role: "professional", first: "E2E", last: "Lawyer", user_type: "professional", title: "Lawyer", publicBooking: true, verified: true, service: { name: "E2E Legal Aid Clinic", type: "legal" } },
	{ role: "medic", first: "E2E", last: "Nurse", user_type: "professional", title: "Nurse", verified: true, service: { name: "E2E Medical Centre", type: "medical" } },
	{ role: "ngo", first: "E2E", last: "Shelter", user_type: "ngo", title: "NGO", verified: true, service: { name: "E2E Safe Shelter", type: "shelter" } },
	{ role: "pending_pro", first: "E2E", last: "Counsellor", user_type: "professional", title: "Counsellor", verified: false, service: { name: "E2E Counselling Practice", type: "mental_health" } },
	{ role: "pending_ngo", first: "E2E", last: "Fund", user_type: "ngo", title: "NGO", verified: false, service: { name: "E2E Finance Support NGO", type: "financial_assistance" } },
	{ role: "survivor", first: "E2E", last: "Learner", user_type: "survivor" },
	{ role: "survivor2", first: "E2E", last: "Neighbour", user_type: "survivor" },
].map((a) => ({ ...a, email: `${TAG}.${a.role.replace("_", "-")}@example.com`, is_admin: !!a.is_admin }));

async function findUserByEmail(email) {
	for (let page = 1; page < 20; page++) {
		const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
		if (error) throw error;
		const hit = data.users.find((u) => u.email === email);
		if (hit) return hit;
		if (data.users.length < 200) return null;
	}
	return null;
}

const del = async (q) => {
	const { error } = await q;
	if (error && !/does not exist|schema cache/i.test(error.message)) console.warn("cleanup warning:", error.message);
};

async function cleanup() {
	// Anonymous reporters created through the public form during tests.
	const anonUsers = [];
	for (let page = 1; page < 20; page++) {
		const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
		if (!data?.users?.length) break;
		anonUsers.push(...data.users.filter((u) => /^e2e-anon-/.test(u.user_metadata?.anon_username ?? "") || (u.email ?? "").startsWith("e2e-anon-")));
		if (data.users.length < 200) break;
	}

	const ids = [];
	for (const a of ACCOUNTS) {
		const u = await findUserByEmail(a.email);
		if (u) ids.push(u.id);
	}
	const allIds = [...ids, ...anonUsers.map((u) => u.id)];
	if (allIds.length) {
		const { data: svcs } = await admin.from("support_services").select("id").in("user_id", ids);
		const svcIds = (svcs ?? []).map((s) => s.id);
		const { data: reps } = await admin.from("reports").select("report_id").in("user_id", allIds);
		const repIds = (reps ?? []).map((r) => r.report_id);

		const { data: chats } = await admin.from("chat_participants").select("chat_id").in("user_id", allIds);
		const chatIds = [...new Set((chats ?? []).map((c) => c.chat_id))];
		if (chatIds.length) {
			await del(admin.from("messages").delete().in("chat_id", chatIds));
			await del(admin.from("chat_participants").delete().in("chat_id", chatIds));
			await del(admin.from("matched_services").update({ chat_id: null }).in("chat_id", chatIds));
			await del(admin.from("chats").delete().in("id", chatIds));
		}
		const matchIds = [];
		if (repIds.length) matchIds.push(...((await admin.from("matched_services").select("id").in("report_id", repIds)).data ?? []).map((m) => m.id));
		if (svcIds.length) matchIds.push(...((await admin.from("matched_services").select("id").in("service_id", svcIds)).data ?? []).map((m) => m.id));
		if (matchIds.length) {
			await del(admin.from("appointments").delete().in("matched_services", matchIds));
			await del(admin.from("case_shares").delete().in("match_id", matchIds));
			await del(admin.from("case_recommendations").delete().in("match_id", matchIds));
			await del(admin.from("matched_services").delete().in("id", matchIds));
		}
		if (repIds.length) await del(admin.from("case_escalation_alerts").delete().in("report_id", repIds));
		await del(admin.from("case_escalation_alerts").delete().not("id", "is", null));
		await del(admin.from("appointments").delete().in("professional_id", allIds));
		await del(admin.from("appointments").delete().in("survivor_id", allIds));
		await del(admin.from("notifications").delete().in("user_id", allIds));
		await del(admin.from("admin_actions").delete().in("admin_id", allIds));
		if (svcIds.length) await del(admin.from("admin_actions").delete().in("target_id", svcIds));
		await del(admin.from("admin_actions").delete().in("target_id", allIds));
		await del(admin.from("reports").delete().in("user_id", allIds));
		await del(admin.from("reports").delete().like("first_name", "E2E-%"));
		await del(admin.from("community_members").delete().in("user_id", allIds));
		await del(admin.from("communities").delete().like("name", "E2E %"));
		await del(admin.from("publications").delete().like("title", "E2E %"));
		await del(admin.from("courses").delete().like("title", "E2E %"));
		await del(admin.from("lesson_progress").delete().in("user_id", allIds));
		await del(admin.from("course_enrollments").delete().in("user_id", allIds));
		await del(admin.from("availability_blocks").delete().in("user_id", allIds));
		await del(admin.from("profile_calendar_tokens").delete().in("user_id", allIds));
		if (svcIds.length) await del(admin.from("support_services").delete().in("id", svcIds));
		for (const id of allIds) {
			await del(admin.from("profiles").delete().eq("id", id));
			await admin.auth.admin.deleteUser(id);
		}
	}
	fs.rmSync(FILE, { force: true });
	console.log(`cleanup done (${allIds.length} accounts removed)`);
}

async function seed() {
	const out = { createdAt: new Date().toISOString(), accounts: {}, services: {} };
	for (const a of ACCOUNTS) {
		const password = crypto.randomBytes(18).toString("base64url");
		let user = await findUserByEmail(a.email);
		if (user) {
			const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
			if (error) throw error;
		} else {
			const { data, error } = await admin.auth.admin.createUser({
				email: a.email,
				password,
				email_confirm: true,
				user_metadata: { first_name: a.first, last_name: a.last, user_type: a.user_type },
			});
			if (error) throw error;
			user = data.user;
		}
		const verified = a.user_type === "survivor" || a.verified !== false;
		const { error: pe } = await admin.from("profiles").upsert(
			{
				id: user.id,
				email: a.email,
				first_name: a.first,
				last_name: a.last,
				user_type: a.user_type,
				is_admin: a.is_admin,
				professional_title: a.title ?? null,
				is_public_booking: !!a.publicBooking,
				verification_status: verified ? "verified" : "pending",
				isVerified: verified,
				phone: a.user_type === "survivor" ? null : `+2547000${Math.floor(10000 + Math.random() * 89999)}`,
				bio: a.title ? `E2E ${a.title} used for automated testing.` : null,
				// Onboarded like a real user, so dashboards show their normal views.
				policies: { all_policies_accepted: true, accepted_policies: ["terms", "privacy", "safety"], policies_accepted_at: new Date().toISOString() },
				accreditation_files_metadata: verified || !a.service ? [] : [{ id: crypto.randomUUID(), name: "e2e-licence.pdf", type: "application/pdf", status: "under_review" }],
			},
			{ onConflict: "id" }
		);
		if (pe) throw new Error(`profile upsert failed for ${a.role}: ${pe.message}`);
		out.accounts[a.role] = { id: user.id, email: a.email, password };

		if (a.service) {
			const { data: svc, error: se } = await admin
				.from("support_services")
				.insert({
					user_id: user.id,
					name: a.service.name,
					service_types: a.service.type,
					is_active: a.verified,
					verification_status: a.verified ? "verified" : "pending",
					verified_at: a.verified ? new Date().toISOString() : null,
					...NAIROBI,
					coverage_area_radius: 80000, // metres, as the profile form stores it
					availability: "flexible",
					email: a.email,
					phone_number: "+254700000000",
					accreditation_files_metadata: a.verified ? [] : [{ id: crypto.randomUUID(), name: "e2e-service-licence.pdf", type: "application/pdf", status: "under_review" }],
				})
				.select("id")
				.single();
			if (se) throw new Error(`service insert failed for ${a.role}: ${se.message}`);
			out.services[a.role] = { id: svc.id, type: a.service.type, name: a.service.name };
		}
	}

	// A direct chat between the lawyer and the learner, with one opening message.
	const pro = out.accounts.professional;
	const survivor = out.accounts.survivor;
	const { data: chat, error: ce } = await admin.from("chats").insert({ type: "dm", created_by: pro.id, metadata: {} }).select("id").single();
	if (ce) throw ce;
	await admin.from("chat_participants").insert([
		{ chat_id: chat.id, user_id: pro.id, status: { role: "admin" } },
		{ chat_id: chat.id, user_id: survivor.id, status: { role: "member" } },
	]);
	await admin.from("messages").insert({ chat_id: chat.id, sender_id: pro.id, content: "E2E hello from your professional", type: "text" });
	out.chatId = chat.id;

	// A report that has sat unmatched for 30 hours (for the escalation finder).
	const { data: rep, error: re } = await admin
		.from("reports")
		.insert({
			first_name: "E2E-Stale",
			ismatched: false,
			record_only: false,
			type_of_incident: "physical",
			urgency: "high",
			state: "Nairobi",
			submission_timestamp: new Date(Date.now() - 30 * 36e5).toISOString(),
			user_id: survivor.id,
		})
		.select("report_id")
		.single();
	if (re) throw re;
	out.staleReportId = rep.report_id;

	fs.writeFileSync(FILE, JSON.stringify(out, null, 2));
	console.log(`seeded: ${Object.keys(out.accounts).join(", ")} + ${Object.keys(out.services).length} services + chat + stale report. Credentials in .e2e-accounts.local.json`);
}

if (process.argv.includes("--cleanup")) await cleanup();
else {
	await cleanup().catch((e) => console.warn("pre-clean warning:", e.message));
	await seed();
}
