'use server';

import { revalidatePath } from 'next/cache';
import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { MAX_ADDED_PER_SUPER_ADMIN, requireSuperAdmin, type SuperAdminRow } from '@/lib/access/super-admin';

export interface SuperAdminView extends SuperAdminRow {
  name: string | null;
  hasAccount: boolean;
  canRemove: boolean;
}

export interface PersonView {
  id: string;
  name: string;
  email: string | null;
  userType: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  sautiId: string | null;
}

export interface AccessOverview {
  me: { email: string; isProtected: boolean; added: number; canAdd: boolean; limit: number };
  superAdmins: SuperAdminView[];
  admins: PersonView[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAUTI_ID = /^SS-?[A-Z0-9]{4}-?[A-Z0-9]{4}$/;
const fullName = (p: { first_name?: string | null; last_name?: string | null } | null | undefined) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(' ') || null;

export async function getAccessOverview(): Promise<AccessOverview> {
  const actor = await requireSuperAdmin();
  const db = looseAdmin();

  const { data: rows } = await db.from('super_admins').select('*').order('created_at');
  const supers = (rows ?? []) as SuperAdminRow[];

  // Attach each super admin to their account (if they have one) and make sure it carries admin rights.
  const { data: profs } = await db
    .from('profiles')
    .select('id, email, first_name, last_name, is_admin')
    .in('email', supers.map((s) => s.email));
  const byEmail = new Map((profs ?? []).map((p: { email: string }) => [p.email.toLowerCase(), p as { id: string; email: string; first_name: string | null; last_name: string | null; is_admin: boolean }]));
  for (const s of supers) {
    const p = byEmail.get(s.email.toLowerCase());
    if (!p) continue;
    if (s.user_id !== p.id) await db.from('super_admins').update({ user_id: p.id }).eq('id', s.id);
    if (!p.is_admin) await db.from('profiles').update({ is_admin: true }).eq('id', p.id);
  }

  const superEmails = new Set(supers.map((s) => s.email.toLowerCase()));
  const added = supers.filter((s) => s.added_by?.toLowerCase() === actor.email).length;

  const { data: adminProfiles } = await db
    .from('profiles')
    .select('id, email, first_name, last_name, user_type, is_admin, sauti_id')
    .eq('is_admin', true)
    .order('first_name');

  return {
    me: { email: actor.email, isProtected: actor.row.is_protected, added, canAdd: added < MAX_ADDED_PER_SUPER_ADMIN, limit: MAX_ADDED_PER_SUPER_ADMIN },
    superAdmins: supers.map((s) => ({
      ...s,
      name: fullName(byEmail.get(s.email.toLowerCase())),
      hasAccount: byEmail.has(s.email.toLowerCase()),
      canRemove: !s.is_protected && (actor.row.is_protected || s.added_by?.toLowerCase() === actor.email),
    })),
    admins: (adminProfiles ?? []).map((p: { id: string; email: string | null; first_name: string | null; last_name: string | null; user_type: string | null; sauti_id: string | null }) => ({
      id: p.id,
      name: fullName(p) ?? p.email ?? 'Admin',
      email: p.email,
      userType: p.user_type,
      isAdmin: true,
      isSuperAdmin: !!p.email && superEmails.has(p.email.toLowerCase()),
      sautiId: p.sauti_id,
    })),
  };
}

/** Add a super admin by email address or by Sauti ID. */
export async function addSuperAdmin(identifier: string) {
  const actor = await requireSuperAdmin();
  const db = looseAdmin();
  const raw = (identifier ?? '').trim();
  if (!raw) throw new Error('Enter an email address or a Sauti ID.');

  const { count } = await db.from('super_admins').select('id', { count: 'exact', head: true }).ilike('added_by', actor.email);
  if ((count ?? 0) >= MAX_ADDED_PER_SUPER_ADMIN) throw new Error(`You have already added ${MAX_ADDED_PER_SUPER_ADMIN} super admins. Remove one first, or ask another super admin.`);

  let email: string;
  let profileId: string | null = null;
  if (EMAIL.test(raw)) {
    email = raw.toLowerCase();
    const { data: p } = await db.from('profiles').select('id').ilike('email', email).maybeSingle();
    profileId = p?.id ?? null;
  } else if (SAUTI_ID.test(raw.toUpperCase().replace(/\s/g, ''))) {
    const c = raw.toUpperCase().replace(/\s/g, '').replace(/^SS-?/, '').replace(/-/g, '');
    const { data: p } = await db.from('profiles').select('id, email').eq('sauti_id', `SS-${c.slice(0, 4)}-${c.slice(4)}`).maybeSingle();
    if (!p?.email) throw new Error('No account has that Sauti ID.');
    email = p.email.toLowerCase();
    profileId = p.id;
  } else {
    throw new Error('Enter a valid email address or a Sauti ID like SS-ABCD-2345.');
  }

  if (email.endsWith('@anon.sautisalama.org')) throw new Error('That account cannot be a super admin.');
  const { data: existing } = await db.from('super_admins').select('id').ilike('email', email).maybeSingle();
  if (existing) throw new Error('They are already a super admin.');

  const { error } = await db.from('super_admins').insert({ email, user_id: profileId, added_by: actor.email, is_protected: false });
  if (error) throw new Error('Could not add the super admin.');
  if (profileId) await db.from('profiles').update({ is_admin: true }).eq('id', profileId);

  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'super_admin.added', targetType: 'super_admin', targetId: profileId ?? email, targetLabel: email, details: { has_account: !!profileId } });
  revalidatePath('/dashboard/admin/mjengo/people');
  return { success: true };
}

export async function removeSuperAdmin(id: string) {
  const actor = await requireSuperAdmin();
  const db = looseAdmin();
  const { data: target } = await db.from('super_admins').select('*').eq('id', id).maybeSingle();
  if (!target) throw new Error('Not found.');
  if (target.is_protected) throw new Error('This super admin is protected and cannot be removed by anyone.');
  const mayRemove = actor.row.is_protected || target.added_by?.toLowerCase() === actor.email;
  if (!mayRemove) throw new Error('Only the person who added them, or a protected super admin, can remove them.');

  const { error } = await db.from('super_admins').delete().eq('id', id).eq('is_protected', false);
  if (error) throw new Error('Could not remove the super admin.');
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'super_admin.removed', targetType: 'super_admin', targetId: target.user_id ?? target.email, targetLabel: target.email });
  revalidatePath('/dashboard/admin/mjengo/people');
  return { success: true };
}

/** Find any account by name, email or Sauti ID, to change its role. */
export async function searchPeople(query: string): Promise<PersonView[]> {
  await requireSuperAdmin();
  const term = (query ?? '').trim().slice(0, 60).replace(/[%_\\,()*"']/g, ' ').replace(/\s+/g, ' ').trim();
  if (term.length < 2) return [];
  const db = looseAdmin();
  const { data } = await db
    .from('profiles')
    .select('id, email, first_name, last_name, user_type, is_admin, sauti_id')
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,sauti_id.ilike.%${term}%`)
    .limit(15);
  const { data: supers } = await db.from('super_admins').select('email');
  const superEmails = new Set((supers ?? []).map((s: { email: string }) => s.email.toLowerCase()));
  return (data ?? []).map((p: { id: string; email: string | null; first_name: string | null; last_name: string | null; user_type: string | null; is_admin: boolean | null; sauti_id: string | null }) => ({
    id: p.id,
    name: fullName(p) ?? p.email ?? 'Member',
    email: p.email,
    userType: p.user_type,
    isAdmin: !!p.is_admin,
    isSuperAdmin: !!p.email && superEmails.has(p.email.toLowerCase()),
    sautiId: p.sauti_id,
  }));
}

async function guardTarget(actorId: string, userId: string) {
  if (userId === actorId) throw new Error('You cannot change your own role.');
  const db = looseAdmin();
  const { data: p } = await db.from('profiles').select('id, email, first_name, last_name, user_type, is_admin').eq('id', userId).maybeSingle();
  if (!p) throw new Error('Account not found.');
  const { data: sup } = await db.from('super_admins').select('id').ilike('email', p.email ?? '').maybeSingle();
  if (sup) throw new Error('This person is a super admin. Remove them as a super admin first.');
  return { db, p };
}

export async function setAdminStatus(userId: string, makeAdmin: boolean) {
  const actor = await requireSuperAdmin();
  const { db, p } = await guardTarget(actor.id, userId);
  const { error } = await db.from('profiles').update({ is_admin: makeAdmin }).eq('id', userId);
  if (error) throw new Error('Could not change the role.');
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: makeAdmin ? 'role.admin_granted' : 'role.admin_revoked', targetType: 'user', targetId: userId, targetLabel: p.email ?? fullName(p) ?? userId });
  revalidatePath('/dashboard/admin/mjengo/people');
  return { success: true };
}

export async function setAccountType(userId: string, userType: 'survivor' | 'professional' | 'ngo') {
  const actor = await requireSuperAdmin();
  if (!['survivor', 'professional', 'ngo'].includes(userType)) throw new Error('Invalid account type.');
  const { db, p } = await guardTarget(actor.id, userId);
  const { error } = await db.from('profiles').update({ user_type: userType }).eq('id', userId);
  if (error) throw new Error('Could not change the account type.');
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'role.account_type_changed', targetType: 'user', targetId: userId, targetLabel: p.email ?? userId, details: { from: p.user_type, to: userType } });
  revalidatePath('/dashboard/admin/mjengo/people');
  return { success: true };
}

/* ------------------------------------------------------------------- Logs */

export interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_label: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export async function getAuditLogs(opts: { q?: string; area?: string; before?: string; limit?: number } = {}) {
  await requireSuperAdmin();
  let q = looseAdmin().from('audit_logs').select('id, actor_email, action, target_type, target_label, details, created_at').order('created_at', { ascending: false }).limit(Math.min(opts.limit ?? 50, 100));
  if (opts.area) q = q.like('action', `${opts.area.replace(/[^a-z_]/g, '')}.%`);
  if (opts.before) q = q.lt('created_at', opts.before);
  const term = (opts.q ?? '').trim().replace(/[%_\\,()*"']/g, ' ');
  if (term) q = q.or(`actor_email.ilike.%${term}%,action.ilike.%${term}%,target_label.ilike.%${term}%`);
  const { data } = await q;
  return (data ?? []) as AuditRow[];
}

export interface PlatformEmailRow {
  id: string;
  to_addresses: string[];
  subject: string;
  category: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

/** Every email the platform has sent (notifications, alerts, reminders). Super admins only. */
export async function getPlatformEmails(opts: { q?: string; before?: string } = {}) {
  const actor = await requireSuperAdmin();
  let q = looseAdmin().from('email_log').select('id, to_addresses, subject, category, status, error, created_at').order('created_at', { ascending: false }).limit(50);
  if (opts.before) q = q.lt('created_at', opts.before);
  const term = (opts.q ?? '').trim().replace(/[%_\\,()*"']/g, ' ');
  if (term) q = q.or(`subject.ilike.%${term}%,category.ilike.%${term}%`);
  const { data } = await q;
  void actor;
  return (data ?? []) as PlatformEmailRow[];
}

export async function getPlatformEmailBody(id: string): Promise<string | null> {
  const actor = await requireSuperAdmin();
  const { data } = await looseAdmin().from('email_log').select('html, subject').eq('id', id).maybeSingle();
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'email_log.viewed', targetType: 'email', targetId: id, targetLabel: data?.subject });
  return data?.html ?? null;
}
