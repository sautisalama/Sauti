import { looseAdmin } from '@/lib/loose-db';

/** Note that these people were just written to (best effort, never blocks sending). */
export async function touchContacts(emails: string[]) {
  try {
    const list = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))].slice(0, 50);
    if (list.length) await looseAdmin().from('mjengo_contacts').update({ last_contacted_at: new Date().toISOString() }).in('email', list);
  } catch {
    /* not important */
  }
}
