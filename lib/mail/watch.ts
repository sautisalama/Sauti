import { looseAdmin } from '@/lib/loose-db';
import { withImap, type MailAccount } from './client';
import { sortMessage } from './sort';

export interface NewMail { account: string; accountEmail: string; accountLabel: string; uid: number; from: string; subject: string; date: string | null }

/**
 * Mail that arrived in a mailbox's inbox since the last look and needs a person (not a newsletter, receipt or
 * automated notice). The first look only records where the inbox stands, so old mail never floods the alerts.
 */
export async function newMailIn(a: MailAccount, notifyUid: number | null): Promise<{ items: NewMail[]; uid: number | null }> {
  if (a.protocol === 'pop3') return { items: [], uid: notifyUid };
  return withImap(a, async (c) => {
    const st = await c.status('INBOX', { uidNext: true });
    const top = (st && typeof st === 'object' && st.uidNext ? st.uidNext : 1) - 1;
    if (notifyUid == null) return { items: [], uid: top };
    if (top <= notifyUid) return { items: [], uid: notifyUid };
    const lock = await c.getMailboxLock('INBOX');
    const items: NewMail[] = [];
    try {
      for await (const m of c.fetch(`${notifyUid + 1}:*`, { uid: true, envelope: true, flags: true, internalDate: true, headers: ['list-unsubscribe', 'precedence'] }, { uid: true })) {
        if (m.uid <= notifyUid || m.flags?.has('\\Seen')) continue;
        const f = m.envelope?.from?.[0];
        const from = { name: f?.name || '', address: f?.address || '' };
        const subject = m.envelope?.subject || '(no subject)';
        const bulk = /list-unsubscribe|precedence:\s*(bulk|list|junk)/i.test(m.headers ? m.headers.toString() : '');
        const kind = sortMessage({ from, subject, bulk, flagged: m.flags?.has('\\Flagged'), answered: m.flags?.has('\\Answered') }).kind;
        if (kind !== 'person' && kind !== 'payment') continue;
        const date = m.envelope?.date ?? (m.internalDate ? new Date(m.internalDate) : null);
        items.push({ account: a.id, accountEmail: a.email, accountLabel: a.label, uid: m.uid, from: from.name || from.address, subject, date: date ? new Date(date).toISOString() : null });
      }
    } finally {
      lock.release();
    }
    return { items: items.slice(-10), uid: top };
  });
}

/** Look at every mailbox of one person that has alerts on, and move each watermark forward. */
export async function newMailFor(ownerId: string): Promise<NewMail[]> {
  const db = looseAdmin();
  const { data: pref } = await db.from('mail_preferences').select('notify_all').eq('owner_id', ownerId).maybeSingle();
  if (pref && pref.notify_all === false) return [];
  const { data: accts } = await db.from('mail_accounts').select('*').eq('owner_id', ownerId).eq('notify', true);
  const out: NewMail[] = [];
  await Promise.all(((accts ?? []) as (MailAccount & { notify_uid: number | null })[]).map(async (a) => {
    try {
      const r = await Promise.race([
        newMailIn(a, a.notify_uid ?? null),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('slow')), 20_000)),
      ]);
      if (r.uid != null) await db.from('mail_accounts').update({ notify_uid: r.uid, notify_checked_at: new Date().toISOString() }).eq('id', a.id);
      out.push(...r.items);
    } catch (e) {
      console.error('[mail-watch]', a.email, e instanceof Error ? e.message : e);
    }
  }));
  return out.sort((x, y) => (x.date ? Date.parse(x.date) : 0) - (y.date ? Date.parse(y.date) : 0));
}

