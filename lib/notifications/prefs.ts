import { createAdminClient } from '@/utils/supabase/admin-client';
import { NOTIFICATION_CATEGORIES, type NotificationCategoryId } from './catalog';

export type Channel = 'email' | 'push';

export interface NotificationPrefs {
  /** Master switches. */
  email: boolean;
  push: boolean;
  /** Per-category overrides; missing means "on". */
  categories: Partial<Record<NotificationCategoryId, Partial<Record<Channel, boolean>>>>;
  /** Hours in which pushes stay silent (they are still in the bell). */
  quiet: QuietHours;
}

/** Local clock times as "HH:MM"; `tz` is an IANA zone such as "Africa/Nairobi". */
export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  tz: string;
}

export const DEFAULT_QUIET: QuietHours = { enabled: false, start: '21:00', end: '07:00', tz: 'Africa/Nairobi' };
export const DEFAULT_PREFS: NotificationPrefs = { email: true, push: true, categories: {}, quiet: DEFAULT_QUIET };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Is `now` inside the quiet window? Windows may cross midnight (21:00 to 07:00). */
export function inQuietHours(q: QuietHours | undefined, now = new Date()): boolean {
  if (!q?.enabled || !HHMM.test(q.start) || !HHMM.test(q.end) || q.start === q.end) return false;
  let local: number;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: q.tz || DEFAULT_QUIET.tz }).format(now);
    local = minutes(parts);
  } catch {
    return false;
  }
  const a = minutes(q.start);
  const b = minutes(q.end);
  return a < b ? local >= a && local < b : local >= a || local < b;
}

/** Urgent things still break through quiet hours: account/safety notices and high-urgency cases. */
export function breaksQuiet(category: NotificationCategoryId, urgency?: unknown): boolean {
  return category === 'account' || (category === 'cases' && urgency === 'high');
}

function quietFrom(v: unknown): QuietHours {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return {
    enabled: o.enabled === true,
    start: typeof o.start === 'string' && HHMM.test(o.start) ? o.start : DEFAULT_QUIET.start,
    end: typeof o.end === 'string' && HHMM.test(o.end) ? o.end : DEFAULT_QUIET.end,
    tz: typeof o.tz === 'string' && o.tz ? o.tz : DEFAULT_QUIET.tz,
  };
}

/** Read the preferences out of a profile's `settings` JSON. Safe on any shape. */
export function prefsFromSettings(settings: unknown): NotificationPrefs {
  const s = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
  const cats = s.notification_categories && typeof s.notification_categories === 'object' ? (s.notification_categories as NotificationPrefs['categories']) : {};
  return {
    email: s.email_notifications !== false,
    push: s.push_notifications !== false,
    categories: cats,
    quiet: quietFrom(s.quiet_hours),
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
