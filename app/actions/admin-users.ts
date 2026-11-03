"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { sendNotification } from "@/lib/notifications";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { looseAdmin } from "@/lib/loose-db";
import { logAudit } from "@/lib/access/audit";
import { requireSuperAdmin } from "@/lib/access/super-admin";

type Result = { ok: true } | { ok: false; error: string };
const TYPES = ["survivor", "professional", "ngo"] as const;
export type AccountType = (typeof TYPES)[number];

/** Who may be changed: not yourself, and not a super admin (they are managed in Mjengo, People and access). */
async function guard(actorId: string, userId: string) {
	if (actorId === userId) return { error: "You cannot change your own account here." } as const;
	const db = createAdminClient();
	const { data: p } = await db.from("profiles").select("id, email, first_name, last_name, user_type, is_banned").eq("id", userId).maybeSingle();
	if (!p) return { error: "That account no longer exists." } as const;
	if (p.email) {
		const { data: sup } = await looseAdmin().from("super_admins").select("id").ilike("email", p.email).maybeSingle();
		if (sup) return { error: "This person is a super admin. Remove them as a super admin first." } as const;
	}
	return { db, p } as const;
}

type Who = { email?: string | null; first_name?: string | null; last_name?: string | null; user_type?: string | null };
/** Who the action was about, kept in the log even after the account is gone. */
const who = (p: Who) => ({ person_email: p.email ?? null, person_name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || null, person_account_type: p.user_type ?? null });
const whoLabel = (p: Who, id: string) => p.email || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || id;

async function logBan(adminId: string, ban: boolean, userId: string, reason: string | null, p: Who) {
	await createAdminClient().from("admin_actions").insert({ admin_id: adminId, action_type: ban ? "ban_user" : "unban_user", target_type: "user", target_id: userId, details: { action: ban ? "banned" : "unbanned", reason, ...who(p) } });
}

/** Ban or unban an account. Checks that the change really happened, instead of trusting a silent no-op. */
export async function setUserBan(userId: string, ban: boolean, reason?: string): Promise<Result> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const g = await guard(auth.user.id, userId);
	if ("error" in g && g.error) return { ok: false, error: g.error };

	const { data, error } = await g.db
		.from("profiles")
		.update({
			is_banned: ban,
			banned_at: ban ? new Date().toISOString() : null,
			banned_by: ban ? auth.user.id : null,
			ban_reason: ban ? reason?.trim() || "Banned by admin" : null,
		})
		.eq("id", userId)
		.select("id, is_banned")
		.maybeSingle();
	if (error) return { ok: false, error: error.message };
	if (!data || data.is_banned !== ban) return { ok: false, error: "The change did not save. Please try again." };

	await logBan(auth.user.id, ban, userId, reason ?? null, g.p);
		await logAudit({ actorId: auth.user.id, actorEmail: auth.user.email ?? null, action: ban ? "user.banned" : "user.unbanned", targetType: "user", targetId: userId, targetLabel: whoLabel(g.p, userId), details: { reason: reason ?? null, ...who(g.p) } });
	revalidatePath("/dashboard/admin/users");
	revalidatePath("/dashboard/admin/professionals");
	return { ok: true };
}

/** Change what kind of account someone has. The person is told, and the change is verified before it is reported. */
export async function setUserType(userId: string, type: AccountType): Promise<Result> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	if (!TYPES.includes(type)) return { ok: false, error: "Unknown account type." };
	const g = await guard(auth.user.id, userId);
	if ("error" in g && g.error) return { ok: false, error: g.error };
	if (g.p.user_type === type) return { ok: true };

	// Survivors are never verified. Moving someone to a provider account starts them at "pending" so they can be reviewed.
	const patch: Record<string, unknown> = { user_type: type };
	if (type === "survivor") Object.assign(patch, { verification_status: "pending", isVerified: false });
	const { data, error } = await g.db.from("profiles").update(patch as never).eq("id", userId).select("id, user_type").maybeSingle();
	if (error) return { ok: false, error: error.message };
	if (!data || data.user_type !== type) return { ok: false, error: "The change did not save. Please try again." };

	await logAudit({ actorId: auth.user.id, actorEmail: auth.user.email ?? null, action: "role.account_type_changed", targetType: "user", targetId: userId, targetLabel: whoLabel(g.p, userId), details: { from: g.p.user_type, to: type, ...who(g.p) } });
	const label = { survivor: "a survivor", professional: "a service provider", ngo: "an organisation" }[type];
	after(async () => {
		try {
			await sendNotification({ userId, type: "system_alert", title: "Your account type has changed", message: `An administrator has changed your account to ${label}. Refresh your dashboard to see what is available to you.`, link: "/dashboard", metadata: { kind: "role_change" }, sendEmail: true });
		} catch (e) {
			console.error("[admin-users] could not notify of type change:", e instanceof Error ? e.message : e);
		}
	});
	revalidatePath("/dashboard/admin/users");
	revalidatePath("/dashboard/admin/professionals");
	return { ok: true };
}

/**
 * Permanently delete an account. Super admins only. Refuses accounts that still own services, so nothing is
 * left pointing at a person who no longer exists; remove or reassign those first.
 */
export async function deleteUserAccount(userId: string): Promise<Result> {
	let actor: Awaited<ReturnType<typeof requireSuperAdmin>>;
	try {
		actor = await requireSuperAdmin();
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : "Only super admins can delete accounts." };
	}
	const g = await guard(actor.id, userId);
	if ("error" in g && g.error) return { ok: false, error: g.error };
	if (!("db" in g)) return { ok: false, error: "That account no longer exists." };

	const { count } = await g.db.from("support_services").select("id", { count: "exact", head: true }).eq("user_id", userId);
	if ((count ?? 0) > 0) return { ok: false, error: `This person still owns ${count} service${count === 1 ? "" : "s"}. Remove or reassign them first.` };

	const { error: profileErr } = await g.db.from("profiles").delete().eq("id", userId);
	if (profileErr) return { ok: false, error: profileErr.message.includes("foreign key") ? "This account still has linked records (reports, chats or appointments), so it cannot be deleted. Ban it instead." : profileErr.message };
	const { error: authErr } = await g.db.auth.admin.deleteUser(userId);
	if (authErr) return { ok: false, error: `The profile was removed but the sign-in could not be: ${authErr.message}` };

	await logAudit({ actorId: actor.id, actorEmail: actor.email, action: "user.deleted", targetType: "user", targetId: userId, targetLabel: whoLabel(g.p, userId), details: who(g.p) });
	revalidatePath("/dashboard/admin/users");
	revalidatePath("/dashboard/admin/professionals");
	return { ok: true };
}
