// Shared helpers for the UAT suites (built on lib.mjs).
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts } from "./lib.mjs";

export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const acc = (role) => accounts.accounts[role];
export const svcOf = (role) => accounts.services[role];

/** Poll until `fn` returns something truthy (or the timeout passes). Returns the last value. */
export async function poll(fn, { timeout = 30000, interval = 1000 } = {}) {
	const end = Date.now() + timeout;
	let v;
	while (Date.now() < end) {
		v = await fn();
		if (v) return v;
		await sleep(interval);
	}
	return v;
}

/** A client signed in as `role` using only the public anon key (what a browser has). */
export async function apiAs(role) {
	const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
	const { error } = await c.auth.signInWithPassword({ email: acc(role).email, password: acc(role).password });
	if (error) throw new Error(`sign-in failed for ${role}: ${error.message}`);
	return c;
}

/** Submit a report the way the signed-in form does (real route, real session). */
export async function submitReport(page, overrides = {}) {
	const body = {
		first_name: "E2E-Report",
		type_of_incident: "physical",
		incident_description: "e2e test report",
		urgency: "medium",
		consent: "yes",
		contact_preference: "do_not_contact",
		required_services: ["legal"],
		latitude: -1.29,
		longitude: 36.82,
		submission_timestamp: new Date().toISOString(),
		record_only: false,
		...overrides,
	};
	const res = await page.request.post(`${BASE}/api/reports`, { data: body });
	if (!res.ok()) throw new Error(`report submit failed: ${res.status()} ${await res.text()}`);
	const { data } = await db.from("reports").select("report_id").eq("first_name", body.first_name).order("submission_timestamp", { ascending: false }).limit(1).single();
	return data.report_id;
}

export const matchesFor = async (reportId) =>
	(await db.from("matched_services").select("id, service_id, hrd_profile_id, match_status_type, match_score, support_service, cascade_level, chat_id, decline_reason").eq("report_id", reportId)).data ?? [];

export const serviceIdsOf = (matches) => new Set(matches.map((m) => m.service_id).filter(Boolean));

export const notificationsFor = async (userId, type) => {
	let q = db.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
	if (type) q = q.eq("type", type);
	return (await q).data ?? [];
};

export const auditFor = async (targetId) => (await db.from("admin_actions").select("*").eq("target_id", targetId).order("created_at", { ascending: false })).data ?? [];

/**
 * Temporarily take every active service out of matching (so a report has nobody to match).
 * Returns an async `restore()` that puts exactly those services back.
 */
export async function deactivateAllServices() {
	const { data } = await db.from("support_services").select("id").eq("is_active", true);
	const ids = (data ?? []).map((s) => s.id);
	if (ids.length) await db.from("support_services").update({ is_active: false }).in("id", ids);
	return async () => {
		if (ids.length) await db.from("support_services").update({ is_active: true }).in("id", ids);
	};
}

/** Emails captured by EMAIL_MODE=capture (the dev server must run with it). */
import fs from "node:fs";
export function readOutbox(sinceIso = "1970-01-01") {
	try {
		return fs
			.readFileSync(new URL("../../.e2e-outbox.jsonl", import.meta.url), "utf8")
			.split("\n")
			.filter(Boolean)
			.map((l) => JSON.parse(l))
			.filter((e) => e.at >= sinceIso);
	} catch {
		return [];
	}
}

/** Remove anonymous survivor accounts (and their reports) created by a test run. */
export async function deleteAnonUsersSince(sinceIso) {
	const { data } = await db.from("profiles").select("id").eq("is_anonymous", true).gte("created_at", sinceIso);
	for (const { id } of data ?? []) {
		const { data: reps } = await db.from("reports").select("report_id").eq("user_id", id);
		const repIds = (reps ?? []).map((r) => r.report_id);
		if (repIds.length) {
			await db.from("matched_services").delete().in("report_id", repIds);
			await db.from("reports").delete().in("report_id", repIds);
		}
		await db.from("notifications").delete().eq("user_id", id);
		await db.from("profiles").delete().eq("id", id);
		await db.auth.admin.deleteUser(id);
	}
}

/** Clear every match created by earlier scenarios, so provider capacity (5 active cases) doesn't leak between them. */
export async function resetMatches() {
	const { data } = await db.from("reports").select("report_id").like("first_name", "E2E-%");
	const ids = (data ?? []).map((r) => r.report_id);
	if (ids.length) await db.from("matched_services").delete().in("report_id", ids);
	// real (non-test) matches also count toward capacity for the seeded services only through their own ids
}
