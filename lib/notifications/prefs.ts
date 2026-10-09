import { createAdminClient } from '@/utils/supabase/admin-client';
import { NOTIFICATION_CATEGORIES, type NotificationCategoryId } from './catalog';

export type Channel = 'email' | 'push';

export interface NotificationPrefs {
  /** Master switches. */
  email: boolean;
  push: boolean;
  /** Per-category overrides; missing means "on". */
  categories: Partial<Record<NotificationCategoryId, Partial<Record<Channel, boolean>>>>;
}

export const DEFAULT_PREFS: NotificationPrefs = { email: true, push: true, categories: {} };

/** Read the preferences out of a profile's `settings` JSON. Safe on any shape. */
export function prefsFromSettings(settings: unknown): NotificationPrefs {
  const s = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
  const cats = s.notification_categories && typeof s.notification_categories === 'object' ? (s.notification_categories as NotificationPrefs['categories']) : {};
  return {
    email: s.email_notifications !== false,
    push: s.push_notifications !== false,
    categories: cats,
  };
}

/** Pure rule: may we send `category` over `channel` to someone with these prefs? */
export function allows(prefs: NotificationPrefs, category: NotificationCategoryId, channel: Channel): boolean {
  const def = NOTIFICATION_CATEGORIES.find((c) => c.id === category);
  if (def?.locked && channel === 'email') return true;
  if (!prefs[channel]) return false;
  return prefs.categories[category]?.[channel] !== false;
}

export async function getPrefsByUserId(userId: string): Promise<NotificationPrefs> {
  const { data } = await createAdminClient().from('profiles').select('settings').eq('id', userId).maybeSingle();
  return prefsFromSettings(data?.settings);
}

/** Emails are addressed by address; look up who they belong to (if anyone). */
export async function getPrefsByEmails(emails: string[]): Promise<Map<string, NotificationPrefs>> {
  const out = new Map<string, NotificationPrefs>();
  if (!emails.length) return out;
  const { data } = await createAdminClient().from('profiles').select('email, settings').in('email', emails);
  for (const row of data ?? []) if (row.email) out.set(row.email.toLowerCase(), prefsFromSettings(row.settings));
  return out;
}
