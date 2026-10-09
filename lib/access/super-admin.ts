import { createClient } from '@/utils/supabase/server';
import { looseAdmin } from '@/lib/loose-db';

/** These two can never be removed from the super-admin list, by anyone. Mirrors super_admins.is_protected. */
export const PROTECTED_SUPER_ADMINS = ['oliver@sautisalama.org', 'oliverwai9na@gmail.com'] as const;
/** How many other super admins each super admin may add. */
export const MAX_ADDED_PER_SUPER_ADMIN = 2;

export interface Actor {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface SuperAdminRow {
  id: string;
  email: string;
  user_id: string | null;
  is_protected: boolean;
  added_by: string | null;
  created_at: string;
}

/** The signed-in person, or null. Email comes from the auth account (verified), never from a form. */
export async function getActor(): Promise<Actor | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: p } = await supabase.from('profiles').select('first_name, last_name, is_admin, is_banned').eq('id', user.id).maybeSingle();
  if (p?.is_banned) return null;
  return {
    id: user.id,
    email: user.email.toLowerCase(),
    name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || user.email,
    isAdmin: !!p?.is_admin,
  };
}

/** Super-admin row for an email, if any. */
export async function findSuperAdmin(email: string): Promise<SuperAdminRow | null> {
  const { data } = await looseAdmin().from('super_admins').select('*').ilike('email', email).maybeSingle();
  return (data as SuperAdminRow | null) ?? null;
}

export async function isSuperAdminEmail(email: string | undefined | null): Promise<boolean> {
  if (!email) return false;
  return !!(await findSuperAdmin(email.toLowerCase()));
}

/** Any administrator (the Mjengo suite). */
export async function requireAdminActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor?.isAdmin) throw new Error('Only administrators can do this.');
  return actor;
}

/** Super admins only (permission management, logs). Must also be signed in as an admin account. */
export async function requireSuperAdmin(): Promise<Actor & { row: SuperAdminRow }> {
  const actor = await getActor();
  if (!actor) throw new Error('Please sign in.');
  const row = await findSuperAdmin(actor.email);
  if (!row) throw new Error('Only super admins can do this.');
  return { ...actor, row };
}
