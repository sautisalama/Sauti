'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireSuperAdmin } from '@/lib/access/super-admin';
import { MODULES, moduleLabel, parsePermission } from '@/lib/access/permissions';
import { sendNoticeEmail } from '@/lib/mjengo/invite-email';
import { addDefaultRoles, seedDefaultRolesOnce } from '@/lib/mjengo/default-roles';

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
export const notifyAccessChange = guard(notifyChange_);
export const roleModules = guard(async () => MODULES.map((m) => ({ key: m.key as string, label: m.label as string, hint: m.hint as string })));
