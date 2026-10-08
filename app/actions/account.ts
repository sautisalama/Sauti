"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { sendNotification } from "@/lib/notifications";
import { matchReport, nextCascadeLevel } from "@/lib/matching-engine/service";

type Result = { ok: true } | { ok: false; error: string };

const LIVE_STATUSES = ["pending", "proposed", "pending_survivor", "reschedule_requested", "accepted"] as const;

/** Storage paths of the voice notes attached to a user's reports (bucket "report-audio"). */
function audioPaths(media: unknown): string[] {
	const out: string[] = [];
	const items = Array.isArray(media) ? media : media ? [media] : [];
	for (const m of items as { url?: string }[]) {
		const url = typeof m === "string" ? m : m?.url;
		const hit = url?.match(/report-audio\/(.+?)(?:\?|$)/);
		if (hit) out.push(decodeURIComponent(hit[1]));
	}
	return out;
}

/**
 * Permanently delete the signed-in person's account and everything that belongs to it: profile, reports
 * and voice notes, messages they sent (kept but unattributed), appointments, progress, certificates,
 * notifications and calendar connection. Cases that are in progress are cancelled first; survivors who
 * were being helped by a provider who leaves are told and re-matched.
 *
 * Admins cannot delete themselves (another admin must remove them) so the platform is never left
 * without one by accident.
 */
export async function deleteMyAccount(confirmation: string): Promise<Result> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { ok: false, error: "Please sign in again." };
	if (confirmation.trim().toUpperCase() !== "DELETE") return { ok: false, error: 'Type DELETE to confirm.' };

	const admin = createAdminClient();
	const { data: me } = await admin.from("profiles").select("id, is_admin, user_type").eq("id", user.id).maybeSingle();
	if (me?.is_admin) return { ok: false, error: "Admin accounts must be removed by another administrator." };

	// 1. Providers: cancel cases in progress so survivors are not left waiting on someone who has gone.
	const { data: services } = await admin.from("support_services").select("id").eq("user_id", user.id);
	const serviceIds = (services ?? []).map((s) => s.id);
	const filter = [serviceIds.length ? `service_id.in.(${serviceIds.join(",")})` : null, `hrd_profile_id.eq.${user.id}`].filter(Boolean).join(",");
	const { data: live } = await admin.from("matched_services").select("id, report_id, survivor_id").or(filter).in("match_status_type", [...LIVE_STATUSES]);
	const toRematch = new Set<string>();
	for (const m of live ?? []) {
		await admin.from("matched_services").update({ match_status_type: "cancelled" }).eq("id", m.id);
		if (m.survivor_id && m.survivor_id !== user.id) {
			await sendNotification({
				userId: m.survivor_id,
				type: "system_alert",
				title: "Your support is being reassigned",
				message: "A provider you were matched with is no longer available. We are finding you someone new, and you do not need to do anything.",
				link: "/dashboard/reports",
				metadata: { match_id: m.id },
				sendEmail: false,
			}).catch(() => undefined);
		}
		if (m.report_id) toRematch.add(m.report_id);
	}

	// 2. References that would block the deletion.
	await admin.from("case_shares").delete().eq("to_professional_id", user.id);
	await admin.from("service_shares").delete().or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
	await admin.from("matched_services").update({ hrd_profile_id: null }).eq("hrd_profile_id", user.id);

	// 3. Voice notes live in storage, not in a table the cascade reaches.
	const { data: reports } = await admin.from("reports").select("media").eq("user_id", user.id);
	const paths = (reports ?? []).flatMap((r) => audioPaths(r.media));
	if (paths.length) await admin.storage.from("report-audio").remove(paths).catch(() => undefined);

	// 4. Delete the sign-in; the profile and everything attached cascades.
	const { error } = await admin.auth.admin.deleteUser(user.id);
	if (error) return { ok: false, error: "We could not delete your account. Please try again or contact support." };

	// 5. Survivors whose provider left: look for someone else (best effort; the 24 hour monitor is the safety net).
	for (const reportId of toRematch) {
		try {
			await matchReport(reportId, admin, { cascade_level: await nextCascadeLevel(reportId, admin) });
		} catch (e) {
			console.error("[delete-account] re-match failed:", e);
		}
	}
	return { ok: true };
}
