import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';

/**
 * Roles a super admin can give to people. Each sets a level (view, write, owner) for the parts of the suite; a part left
 * out is not shown to that person. They never include People & access or Logs: those belong to super admins alone, whatever
 * roles someone has. They are a starting point: each can be edited, and deleted.
 */
const everything = (level: 'view' | 'write') => ['mail', 'contacts', 'calendar', 'meet', 'files', 'grants', 'opportunities', 'projects', 'fellowships', 'finance', 'todos', 'forms', 'design', 'assistant'].map((m) => `${m}:${level}`);
const team = ['mail:write', 'contacts:write', 'calendar:write', 'meet:write', 'todos:write', 'assistant:write'];

export const DEFAULT_ROLES: { name: string; description: string; permissions: string[] }[] = [
  { name: 'Operations Lead', description: 'Works across the whole suite, finance included. Cannot manage people and access.', permissions: everything('write').map((p) => (p.startsWith('finance') ? 'finance:write' : p)) },
  { name: 'Fundraising Lead', description: 'Finds and applies for funding: opportunities and grants, with the files and writing help they need.', permissions: [...team, 'files:write', 'opportunities:write', 'grants:write', 'projects:view', 'fellowships:view', 'finance:view', 'forms:view', 'design:view'] },
  { name: 'Programme Manager', description: 'Runs projects and fellowships day to day, and sees the funding behind them.', permissions: [...team, 'files:write', 'projects:write', 'fellowships:write', 'grants:view', 'opportunities:view', 'forms:write', 'design:view'] },
  { name: 'Finance Officer', description: 'Invoices, receipts and budgets, with read access to the work they relate to.', permissions: [...team, 'files:write', 'finance:write', 'grants:view', 'projects:view', 'opportunities:view'] },
  { name: 'Communications Officer', description: 'Designs and schedules content, writes and sends mail, builds forms.', permissions: [...team, 'files:write', 'design:write', 'forms:write', 'opportunities:view', 'grants:view', 'projects:view'] },
  { name: 'Community & Case Officer', description: 'Safe Voice and community work: forms and responses, contacts, files, calls. No funding or finance.', permissions: [...team, 'files:write', 'forms:write', 'projects:view'] },
  { name: 'Volunteer or Intern', description: 'Joins calls, keeps a to-do list, reads shared files and leads. Cannot change records.', permissions: ['meet:write', 'todos:write', 'calendar:view', 'files:view', 'contacts:view', 'assistant:view', 'opportunities:view'] },
  { name: 'Read only', description: 'Can look but not change anything (no finance).', permissions: everything('view').filter((p) => !p.startsWith('finance')) },
];

/** Add the default roles that are missing (matched by name). Returns how many were added. */
export async function addDefaultRoles(actor?: { id: string; email: string }): Promise<number> {
  const db = looseAdmin();
  const { data } = await db.from('mjengo_roles').select('name');
  const have = new Set(((data ?? []) as { name: string }[]).map((r) => r.name.toLowerCase()));
  const missing = DEFAULT_ROLES.filter((r) => !have.has(r.name.toLowerCase()));
  if (!missing.length) return 0;
  await db.from('mjengo_roles').insert(missing.map((r) => ({ ...r, created_by: actor?.id ?? null })));
  await logAudit({ actorId: actor?.id ?? null, actorEmail: actor?.email ?? null, action: 'roles.defaults_added', details: { added: missing.map((r) => r.name) } });
  return missing.length;
}

/** The first time roles are looked at the defaults are added, once. A role deleted afterwards stays deleted. */
export async function seedDefaultRolesOnce(): Promise<void> {
  const db = looseAdmin();
  const { count } = await db.from('audit_logs').select('*', { count: 'exact', head: true }).eq('action', 'roles.defaults_added');
  if ((count ?? 0) > 0) return;
  await addDefaultRoles();
}
