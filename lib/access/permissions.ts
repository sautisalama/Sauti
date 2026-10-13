import { cache } from 'react';
import { looseAdmin } from '@/lib/loose-db';
import { getActor, isSuperAdminEmail, type Actor } from '@/lib/access/super-admin';

/**
 * What an administrator may do in each part of the suite, at three levels:
 *   view   read it,
 *   write  create and change things, share what they made,
 *   owner  everything, including deleting and managing other people's items.
 * Super admins make roles (a name and a level per module) and give them to people. An administrator with no
 * role keeps full access, as before roles existed; once a role is given, they get exactly the highest level of
 * each module across their roles. Super admins always have everything.
 */
export const MODULES = [
  { key: 'mail', label: 'Mail', hint: 'Read and send email, labels, views' },
  { key: 'contacts', label: 'Contacts', hint: 'The contact book' },
  { key: 'calendar', label: 'Calendar', hint: 'Events and reminders' },
  { key: 'meet', label: 'Meet', hint: 'Start, join and record calls' },
  { key: 'files', label: 'Files', hint: 'The vault, documents, sheets and slides' },
  { key: 'grants', label: 'Grants', hint: 'Grants and their documents' },
  { key: 'opportunities', label: 'Opportunities', hint: 'Funding and partnership leads' },
  { key: 'projects', label: 'Projects', hint: 'Projects and milestones' },
  { key: 'fellowships', label: 'Fellowships', hint: 'Fellowships and their assignments' },
  { key: 'finance', label: 'Finance', hint: 'Invoices, receipts and budgets' },
  { key: 'todos', label: 'To-dos', hint: 'Tasks and tracks' },
  { key: 'forms', label: 'Forms', hint: 'Build forms, read responses' },
  { key: 'design', label: 'Design and content', hint: 'Design editor, brand, scheduling and posting' },
  { key: 'assistant', label: 'Assistant', hint: 'The AI assistant' },
] as const;

export type ModuleKey = (typeof MODULES)[number]['key'];
export type Level = 'view' | 'write' | 'owner';
export const LEVELS: Level[] = ['view', 'write', 'owner'];
const RANK: Record<Level, number> = { view: 1, write: 2, owner: 3 };

export const MODULE_KEYS = MODULES.map((m) => m.key) as ModuleKey[];
export const moduleLabel = (k: string) => MODULES.find((m) => m.key === k)?.label ?? k;

/** "grants:write" in a role; a bare "grants" (from before levels) means write. */
export function parsePermission(p: string): { key: ModuleKey; level: Level } | null {
  const [k, l] = p.split(':');
  if (!MODULE_KEYS.includes(k as ModuleKey)) return null;
  const level = (LEVELS as string[]).includes(l) ? (l as Level) : 'write';
  return { key: k as ModuleKey, level };
}

export type Perms = 'all' | Map<ModuleKey, Level>;

/** Everything this person may do. 'all' for super admins and for administrators without a role. */
export const permissionsFor = cache(async function permissionsFor(userId: string, email: string): Promise<Perms> {
  if (await isSuperAdminEmail(email)) return 'all';
  const db = looseAdmin();
  const { data: mem } = await db.from('mjengo_role_members').select('role_id').eq('user_id', userId);
  const roleIds = ((mem ?? []) as { role_id: string }[]).map((m) => m.role_id);
  if (!roleIds.length) return 'all';
  const { data: roles } = await db.from('mjengo_roles').select('permissions').in('id', roleIds);
  const out = new Map<ModuleKey, Level>();
  for (const r of (roles ?? []) as { permissions: string[] }[]) {
    for (const raw of r.permissions ?? []) {
      const p = parsePermission(raw);
      const cur = p ? out.get(p.key) : undefined;
      if (p && (!cur || RANK[p.level] > RANK[cur])) out.set(p.key, p.level);
    }
  }
  return out;
});

export const levelOf = (perms: Perms, key: ModuleKey): Level | null => (perms === 'all' ? 'owner' : perms.get(key) ?? null);
export const may = (perms: Perms, key: ModuleKey, need: Level = 'view') => {
  const l = levelOf(perms, key);
  return !!l && RANK[l] >= RANK[need];
};

/** An administrator who may do this much in this part of the suite. Replaces requireAdminActor there. */
export async function requireModule(key: ModuleKey, need: Level = 'view'): Promise<Actor> {
  const actor = await getActor();
  if (!actor?.isAdmin) throw new Error('Only administrators can do this.');
  const perms = await permissionsFor(actor.id, actor.email);
  if (!may(perms, key, need)) {
    const have = levelOf(perms, key);
    throw new Error(have
      ? `You can only ${have === 'view' ? 'view' : 'view and edit'} ${moduleLabel(key)}, so you cannot do this. Ask a super admin for ${need} access.`
      : `You do not have access to ${moduleLabel(key)}. Ask a super admin to add it to your role.`);
  }
  return actor;
}
