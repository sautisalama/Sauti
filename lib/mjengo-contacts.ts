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

const DOMAIN = (process.env.ORG_EMAIL_DOMAIN || 'sautisalama.org').toLowerCase();
const titleCase = (s: string) => s.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

/**
 * Everyone on the organisation's own domain that was written to is kept in Contacts. Such contacts are
 * private to the people on that message (the sender, and teammates in To and Cc); anyone else gets access
 * only when someone shares the contact, as with files. Best effort: never blocks sending.
 */
export async function autoAddTeamContacts(senderId: string, senderEmail: string, recipients: string[]) {
  try {
    const all = [...new Set(recipients.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    const own = all.filter((e) => e.endsWith(`@${DOMAIN}`) && e !== senderEmail.toLowerCase());
    if (!own.length) return;
    const db = looseAdmin();
    const { data: profs } = await db.from('profiles').select('id, email, first_name, last_name, is_admin').in('email', all);
    const people = (profs ?? []) as { id: string; email: string | null; first_name: string | null; last_name: string | null; is_admin: boolean }[];
    const byEmail = new Map(people.map((p) => [String(p.email).toLowerCase(), p]));
    const viewers = [...new Set([senderId, ...people.filter((p) => p.is_admin).map((p) => p.id)])];
    for (const email of own) {
      const { data: have } = await db.from('mjengo_contacts').select('id, visibility').ilike('email', email).maybeSingle();
      let id = have?.id as string | undefined;
      let visibility = have?.visibility as string | undefined;
      if (!id) {
        const p = byEmail.get(email);
        const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || titleCase(email.split('@')[0]);
        const { data: created } = await db.from('mjengo_contacts').insert({ name, email, source: 'mail', visibility: 'private', created_by: senderId, last_contacted_at: new Date().toISOString() }).select('id, visibility').single();
        id = created?.id;
        visibility = created?.visibility;
      }
      if (id && visibility === 'private') {
        await db.from('mjengo_contact_access').upsert(viewers.map((user_id) => ({ contact_id: id, user_id, level: 'view', granted_by: senderId })), { onConflict: 'contact_id,user_id', ignoreDuplicates: true });
      }
    }
  } catch {
    /* contacts are a convenience */
  }
}
