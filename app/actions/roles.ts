'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireSuperAdmin } from '@/lib/access/super-admin';
import { MODULES, moduleLabel, parsePermission } from '@/lib/access/permissions';
import { sendNoticeEmail } from '@/lib/mjengo/invite-email';
import { addDefaultRoles, seedDefaultRolesOnce } from '@/lib/mjengo/default-roles';
import { reconcile, toList, toMap, type Lvl, type PermMap } from '@/lib/access/reconcile';

export interface RoleView {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  members: { id: string; name: string; email: string }[];
}

/** Roles with their members. Super admins only. */
async function list_(): Promise<RoleView[]> {
  await requireSuperAdmin();
  // The first time, the default roles (Fundraising Lead, Programme Manager, ...) are added for super admins to give out.
  await seedDefaultRolesOnce().catch(() => undefined);
  const db = looseAdmin();
  const [{ data: roles }, { data: mem }] = await Promise.all([
    db.from('mjengo_roles').select('id, name, description, permissions').order('created_at'),
    db.from('mjengo_role_members').select('role_id, user_id'),
  ]);
  const ids = [...new Set(((mem ?? []) as { user_id: string }[]).map((m) => m.user_id))];
  const { data: profs } = ids.length ? await db.from('profiles').select('id, first_name, last_name, email').in('id', ids) : { data: [] };
  const info = new Map(((profs ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]).map((p) => [p.id, { name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Someone', email: p.email ?? '' }]));
  return ((roles ?? []) as { id: string; name: string; description: string | null; permissions: string[] }[]).map((r) => ({
    ...r,
    members: ((mem ?? []) as { role_id: string; user_id: string }[]).filter((m) => m.role_id === r.id).map((m) => ({ id: m.user_id, name: info.get(m.user_id)?.name ?? 'Someone', email: info.get(m.user_id)?.email ?? '' })),
  }));
}

async function save_(id: string | null, v: { name: string; description?: string | null; permissions: string[] }): Promise<RoleView[]> {
  const a = await requireSuperAdmin();
  const name = v.name.trim().slice(0, 60);
  if (!name) throw new Error('Name the role.');
  const permissions = [...new Set(v.permissions.map((p) => parsePermission(p)).filter((p): p is NonNullable<ReturnType<typeof parsePermission>> => !!p).map((p) => `${p.key}:${p.level}`))];
  const db = looseAdmin();
  const row = { name, description: v.description?.trim().slice(0, 300) || null, permissions };
  const { error } = id ? await db.from('mjengo_roles').update(row).eq('id', id) : await db.from('mjengo_roles').insert({ ...row, created_by: a.id });
  if (error) throw new Error(error.code === '23505' ? 'A role with that name already exists.' : 'Could not save the role.');
  await logAudit({ actorId: a.id, actorEmail: a.email, action: id ? 'role.updated' : 'role.created', targetType: 'role', targetLabel: name, details: { permissions } });
  return list_();
}

async function remove_(id: string): Promise<RoleView[]> {
  const a = await requireSuperAdmin();
  const db = looseAdmin();
  const { data } = await db.from('mjengo_roles').delete().eq('id', id).select('name').maybeSingle();
  if (data) await logAudit({ actorId: a.id, actorEmail: a.email, action: 'role.deleted', targetType: 'role', targetLabel: data.name });
  return list_();
}

/** Give or take away a role. The person is emailed only when the super admin chose to. */
async function assign_(roleId: string, userId: string, on: boolean, notify: boolean): Promise<RoleView[]> {
  const a = await requireSuperAdmin();
  const db = looseAdmin();
  const [{ data: role }, { data: person }] = await Promise.all([
    db.from('mjengo_roles').select('name, permissions').eq('id', roleId).maybeSingle(),
    db.from('profiles').select('email, first_name, is_admin').eq('id', userId).maybeSingle(),
  ]);
  if (!role) throw new Error('That role no longer exists.');
  if (!person?.is_admin) throw new Error('Roles can only be given to administrators.');
  if (on) await db.from('mjengo_role_members').upsert({ role_id: roleId, user_id: userId, assigned_by: a.id }, { onConflict: 'role_id,user_id' });
  else await db.from('mjengo_role_members').delete().eq('role_id', roleId).eq('user_id', userId);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: on ? 'role.assigned' : 'role.removed', targetType: 'role', targetLabel: role.name, details: { user: person.email } });
  if (notify && person.email) {
    const perms = (role.permissions as string[]).map((p) => { const x = parsePermission(p); return x ? `${moduleLabel(x.key)} (${x.level})` : p; });
    await sendNoticeEmail({
      to: [person.email],
      by: a.name,
      subject: on ? `Your access in Sauti Salama changed: ${role.name}` : `Your access in Sauti Salama changed`,
      heading: on ? `You now have the role “${role.name}”` : `The role “${role.name}” was removed from you`,
      lines: on
        ? [`${a.name} gave you this role. You can use: ${perms.join(', ') || 'nothing yet'}.`, 'Parts of the suite that are not listed will no longer appear for you.']
        : [`${a.name} took this role away. Your other roles still apply. If you have none, you can use everything an administrator can.`],
      button: { label: 'Open the suite', url: '/dashboard/mjengo' },
    });
  }
  return list_();
}

/** What was clicked on for single people, on top of their roles: person id to permissions like "grants:write". */
async function listExtras_(): Promise<Record<string, string[]>> {
  await requireSuperAdmin();
  const { data } = await looseAdmin().from('mjengo_user_permissions').select('user_id, permissions');
  return Object.fromEntries(((data ?? []) as { user_id: string; permissions: string[] }[]).filter((r) => r.permissions?.length).map((r) => [r.user_id, r.permissions]));
}

/**
 * Change one area for one person (a level, or none). Roles stay the way permissions are held: a role they have that no longer
 * fits is taken away, a role this change completes is added, and what no role covers is kept for them alone.
 */
async function setPersonLevel_(userId: string, moduleKey: string, level: Lvl | null): Promise<{ roles: RoleView[]; extras: Record<string, string[]>; added: string[]; removed: string[] }> {
  const a = await requireSuperAdmin();
  if (!MODULES.some((m) => m.key === moduleKey)) throw new Error('That is not a part of the suite.');
  if (level !== null && level !== 'view' && level !== 'write' && level !== 'owner') throw new Error('Choose view, write or owner.');
  const db = looseAdmin();
  const { data: person } = await db.from('profiles').select('email, is_admin').eq('id', userId).maybeSingle();
  if (!person?.is_admin) throw new Error('Permissions can only be set for administrators.');
  const { findSuperAdmin } = await import('@/lib/access/super-admin');
  if (person.email && (await findSuperAdmin(person.email))) throw new Error('Super admins always have everything.');

  const [{ data: roles }, { data: mem }, { data: own }] = await Promise.all([
    db.from('mjengo_roles').select('id, name, permissions'),
    db.from('mjengo_role_members').select('role_id').eq('user_id', userId),
    db.from('mjengo_user_permissions').select('permissions').eq('user_id', userId).maybeSingle(),
  ]);
  const all = (roles ?? []) as { id: string; name: string; permissions: string[] }[];
  const current = ((mem ?? []) as { role_id: string }[]).map((m) => m.role_id);
  const extras = ((own as { permissions?: string[] } | null)?.permissions ?? []);

  // What they hold now. Someone with no role and nothing of their own keeps everything, as before roles existed.
  const previous: PermMap = new Map();
  if (!current.length && !extras.length) for (const m of MODULES) previous.set(m.key, 'owner');
  else for (const [k, l] of toMap([...all.filter((r) => current.includes(r.id)).flatMap((r) => r.permissions), ...extras])) previous.set(k, l);
  const desired: PermMap = new Map(previous);
  if (level === null) desired.delete(moduleKey); else desired.set(moduleKey, level);

  const out = reconcile({ desired, previous, roles: all, current, changed: { module: moduleKey, level } });
  for (const r of out.removed) await db.from('mjengo_role_members').delete().eq('role_id', r.id).eq('user_id', userId);
  for (const r of out.added) await db.from('mjengo_role_members').upsert({ role_id: r.id, user_id: userId, assigned_by: a.id }, { onConflict: 'role_id,user_id' });
  // Everything held and no role needed for it is the old "no role" state; keep it as nothing stored.
  const everything = MODULES.every((m) => desired.get(m.key) === 'owner') && out.roleIds.length === 0;
  const keep = everything ? [] : out.extras;
  if (keep.length) await db.from('mjengo_user_permissions').upsert({ user_id: userId, permissions: keep, updated_by: a.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  else await db.from('mjengo_user_permissions').delete().eq('user_id', userId);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'access.person_changed', targetType: 'user', targetId: userId, targetLabel: person.email ?? undefined, details: { area: moduleKey, level, rolesAdded: out.added.map((r) => r.name), rolesRemoved: out.removed.map((r) => r.name), held: toList(desired) } });
  return { roles: await list_(), extras: await listExtras_(), added: out.added.map((r) => r.name), removed: out.removed.map((r) => r.name) };
}

/** Tell someone that their account was changed (admin on or off, account type). Sent only when asked for. */
async function notifyChange_(userId: string, summary: string): Promise<void> {
  const a = await requireSuperAdmin();
  const { data: person } = await looseAdmin().from('profiles').select('email').eq('id', userId).maybeSingle();
  if (!person?.email) return;
  await sendNoticeEmail({
    to: [person.email], by: a.name, subject: 'Your access in Sauti Salama changed', heading: 'Your access changed',
    lines: [summary.slice(0, 400), `The change was made by ${a.name}. If this is a surprise, reply to this email or ask a super admin.`],
    button: { label: 'Open Sauti Salama', url: '/dashboard' },
  });
}

/** Add back any default role that was deleted. */
async function restoreDefaults_(): Promise<RoleView[]> {
  const a = await requireSuperAdmin();
  await addDefaultRoles({ id: a.id, email: a.email });
  return list_();
}

export const listRoles = guard(list_);
export const restoreDefaultRoles = guard(restoreDefaults_);
export const saveRole = guard(save_);
export const deleteRole = guard(remove_);
export const assignRole = guard(assign_);
export const listPersonalPermissions = guard(listExtras_);
export const setPersonLevel = guard(setPersonLevel_);
export const notifyAccessChange = guard(notifyChange_);
export const roleModules = guard(async () => MODULES.map((m) => ({ key: m.key as string, label: m.label as string, hint: m.hint as string })));
