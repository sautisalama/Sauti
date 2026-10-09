import webpush from 'web-push';
import { createAdminClient } from '@/utils/supabase/admin-client';
import { categoryOfType, type NotificationCategoryId } from './catalog';
import { allows, getPrefsByUserId } from './prefs';

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:info@sautisalama.org', pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path opened when the notification is tapped. */
  url?: string;
  /** Same tag replaces an earlier notification instead of stacking. */
  tag?: string;
  /** Chat the push is about, so the device can acknowledge delivery (double tick). */
  chatId?: string;
  /** Which Notifications-settings kind this is; the person's push switches are checked against it. */
  category?: NotificationCategoryId;
  /** Skip the preference check (the settings page's own test push). */
  force?: boolean;
}

/**
 * Deliver a notification to every device the user has enabled push on, so it lands in the
 * phone's notification drawer, and set the app-icon badge to their unread count.
 * Never throws: push is best-effort on top of the in-app row and email.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number }> {
  if (!configured && !configure()) return { sent: 0 };
  try {
    if (!payload.force && !allows(await getPrefsByUserId(userId), payload.category ?? 'reminders', 'push')) return { sent: 0 };
    const db = createAdminClient();
    const { data: subs } = await db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);
    if (!subs?.length) return { sent: 0 };

    const { count } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    const body = JSON.stringify({ ...payload, url: payload.url || '/dashboard', badge: count ?? 1 });
    const dead: string[] = [];
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60 * 24, urgency: 'high' }
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) dead.push(s.id); // unsubscribed / expired
          else console.error('Push delivery failed:', status ?? err);
        }
      })
    );
    if (dead.length) await db.from('push_subscriptions').delete().in('id', dead);
    return { sent };
  } catch (err) {
    console.error('Push error:', err);
    return { sent: 0 };
  }
}

type NotificationRow = {
  user_id: string;
  title?: string | null;
  message?: string | null;
  link?: string | null;
  type?: string;
  metadata?: unknown;
  [k: string]: unknown;
};

/**
 * Insert in-app notification row(s) with the service role and push each to the recipient's devices.
 * Drop-in for `createAdminClient().from('notifications').insert(...)`.
 */
export async function insertNotificationsWithPush(rows: NotificationRow | NotificationRow[]) {
  const list = Array.isArray(rows) ? rows : [rows];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await createAdminClient().from('notifications').insert(list as any);
  if (!result.error) {
    await Promise.all(
      list.map((r) =>
        sendPushToUser(r.user_id, {
          title: r.title || 'Sauti Salama',
          body: r.message || '',
          url: r.link || undefined,
          tag: r.type,
          category: categoryOfType(r.type || '', (r.metadata as Record<string, unknown> | undefined) ?? null),
        })
      )
    );
  }
  return result;
}
