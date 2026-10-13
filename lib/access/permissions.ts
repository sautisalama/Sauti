import { looseAdmin } from '@/lib/loose-db';
import { getActor, isSuperAdminEmail, type Actor } from '@/lib/access/super-admin';

/**
 * What an administrator may use in the suite. Super admins create roles (a name and a set of these) and
 * assign them. An administrator with no role keeps full access, as before roles existed; once a role is
 * assigned, they get exactly the union of their roles. Super admins always have everything.
 */
export const MODULES = [
  { key: 'mail', label: 'Mail', hint: 'Read and send email, labels, views' },
  { key: 'contacts', label: 'Contacts', hint: 'The contact book' },
  { key: 'calendar', label: 'Calendar', hint: 'Events and reminders' },
  { key: 'meet', label: 'Meet', hint: 'Start, join and record calls' },
  { key: 'files', label: 'Files', hint: 'The vault, documents, sheets and slides' },
  { key: 'grants', label: 'Grants', hint: 'See and manage grants' },
  { key: 'opportunities', label: 'Opportunities', hint: 'Funding and partnership leads' },
  { key: 'projects', label: 'Projects', hint: 'Projects and milestones' },
  { key: 'fellowships', label: 'Fellowships', hint: 'Fellowships and their assignments' },
  { key: 'todos', label: 'To-dos', hint: 'Tasks and tracks' },
  { key: 'forms', label: 'Forms', hint: 'Build forms, read responses' },
  { key: 'design', label: 'Design and content', hint: 'Design editor, scheduling and posting' },
  { key: 'assistant', label: 'Assistant', hint: 'The AI assistant' },
] as const;

export type ModuleKey = (typeof MODULES)[number]['key'];
export const MODULE_KEYS = MODULES.map((m) => m.key) as ModuleKey[];
export const moduleLabel = (k: string) => MODULES.find((m) => m.key === k)?.label ?? k;

/** Everything this person may use. 'all' for super admins and for administrators without a role. */
export async function permissionsFor(userId: string, email: string): Promise<'all' | Set<ModuleKey>> {
  if (await isSuperAdminEmail(email)) return 'all';
  const db = looseAdmin();
  const { data: mem } = await db.from('mjengo_role_members').select('role_id').eq('user_id', userId);
  const roleIds = ((mem ?? []) as { role_id: string }[]).map((m) => m.role_id);
  if (!roleIds.length) return 'all';
  const { data: roles } = await db.from('mjengo_roles').select('permissions').in('id', roleIds);
  const out = new Set<ModuleKey>();
  for (const r of (roles ?? []) as { permissions: string[] }[]) for (const p of r.permissions ?? []) if (MODULE_KEYS.includes(p as ModuleKey)) out.add(p as ModuleKey);
  return out;
}

export const may = (perms: 'all' | Set<ModuleKey>, key: ModuleKey) => perms === 'all' || perms.has(key);

/** An administrator who is allowed this part of the suite. Replaces requireAdminActor in that part's actions. */
export async function requireModule(key: ModuleKey): Promise<Actor> {
  const actor = await getActor();
  if (!actor?.isAdmin) throw new Error('Only administrators can do this.');
  const perms = await permissionsFor(actor.id, actor.email);
  if (!may(perms, key)) throw new Error(`You do not have access to ${moduleLabel(key)}. Ask a super admin to add it to your role.`);
  return actor;
}
