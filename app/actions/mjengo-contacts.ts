'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor } from '@/lib/access/super-admin';

export interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  organisation: string | null;
  title: string | null;
  tags: string[];
  notes: string | null;
  source: 'manual' | 'google' | 'csv' | 'mail';
  last_contacted_at: string | null;
  created_at: string;
}

export interface ContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  organisation?: string | null;
  title?: string | null;
  tags?: string[];
  notes?: string | null;
}

const COLS = 'id, name, email, phone, organisation, title, tags, notes, source, last_contacted_at, created_at';
const clean = (s: string | null | undefined, max = 200) => (s ?? '').trim().slice(0, max) || null;
const emailOk = (e: string) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e);

function normalise(v: ContactInput) {
  const email = clean(v.email, 254)?.toLowerCase() ?? null;
  if (email && !emailOk(email)) throw new Error(`"${email}" is not a valid email address.`);
  const name = clean(v.name) ?? email;
  if (!name) throw new Error('Add a name or an email address.');
  return {
    name,
    email,
    phone: clean(v.phone, 40),
    organisation: clean(v.organisation),
    title: clean(v.title),
    tags: [...new Set((v.tags ?? []).map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 12),
    notes: clean(v.notes, 2000),
  };
}

async function listContacts_(q = ''): Promise<ContactRow[]> {
  await requireAdminActor();
  let query = looseAdmin().from('mjengo_contacts').select(COLS).order('name').limit(1000);
  const term = q.trim().replace(/[%,()]/g, ' ');
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,organisation.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error('Could not load contacts.');
  return (data ?? []) as ContactRow[];
}

async function saveContact_(id: string | null, v: ContactInput): Promise<ContactRow> {
  const actor = await requireAdminActor();
  const row = normalise(v);
  const db = looseAdmin();
  const q = id
    ? db.from('mjengo_contacts').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
    : db.from('mjengo_contacts').insert({ ...row, source: 'manual', created_by: actor.id });
  const { data, error } = await q.select(COLS).single();
  if (error || !data) {
    if (error?.code === '23505') throw new Error('A contact with that email already exists.');
    throw new Error('Could not save the contact.');
  }
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: id ? 'contact.updated' : 'contact.created', targetType: 'contact', targetId: data.id, targetLabel: data.name });
  return data as ContactRow;
}

async function deleteContact_(id: string) {
  const actor = await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_contacts').delete().eq('id', id).select('name').maybeSingle();
  if (data) await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'contact.deleted', targetType: 'contact', targetId: id, targetLabel: data.name });
}

/** Bulk add (CSV or mail): contacts whose email already exists are skipped, not overwritten. */
async function importContacts_(rows: ContactInput[], source: 'csv' | 'google' | 'mail'): Promise<{ added: number; skipped: number }> {
  const actor = await requireAdminActor();
  const db = looseAdmin();
  const prepared: ReturnType<typeof normalise>[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const r of rows.slice(0, 5000)) {
    try {
      const n = normalise(r);
      if (n.email) {
        if (seen.has(n.email)) { skipped++; continue; }
        seen.add(n.email);
      }
      prepared.push(n);
    } catch {
      skipped++;
    }
  }
  const emails = prepared.map((p) => p.email).filter(Boolean) as string[];
  const existing = new Set<string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await db.from('mjengo_contacts').select('email').in('email', emails.slice(i, i + 200));
    (data ?? []).forEach((d: { email: string }) => existing.add(d.email.toLowerCase()));
  }
  const fresh = prepared.filter((p) => !p.email || !existing.has(p.email));
  skipped += prepared.length - fresh.length;
  for (let i = 0; i < fresh.length; i += 200) {
    await db.from('mjengo_contacts').insert(fresh.slice(i, i + 200).map((p) => ({ ...p, source, created_by: actor.id })));
  }
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'contact.imported', targetType: 'contact', details: { source, added: fresh.length, skipped } });
  return { added: fresh.length, skipped };
}

/** Add someone seen in a received email. Returns the existing contact if there is one. */
async function addContactFromMail_(name: string, email: string): Promise<ContactRow> {
  const actor = await requireAdminActor();
  const addr = email.trim().toLowerCase();
  if (!emailOk(addr)) throw new Error('That is not a valid email address.');
  const db = looseAdmin();
  const { data: have } = await db.from('mjengo_contacts').select(COLS).ilike('email', addr).maybeSingle();
  if (have) return have as ContactRow;
  const { data, error } = await db
    .from('mjengo_contacts')
    .insert({ name: clean(name) ?? addr, email: addr, source: 'mail', created_by: actor.id })
    .select(COLS)
    .single();
  if (error || !data) throw new Error('Could not add the contact.');
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'contact.created', targetType: 'contact', targetId: data.id, targetLabel: data.name, details: { via: 'mail' } });
  return data as ContactRow;
}

/** For recipient pickers: a few contacts matching what has been typed. */
async function suggestContacts_(q: string): Promise<{ name: string; email: string }[]> {
  await requireAdminActor();
  const term = q.trim().replace(/[%,()]/g, ' ');
  let query = looseAdmin().from('mjengo_contacts').select('name, email').not('email', 'is', null).order('last_contacted_at', { ascending: false, nullsFirst: false }).limit(8);
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
  const { data } = await query;
  return (data ?? []) as { name: string; email: string }[];
}

export const listContacts = guard(listContacts_);
export const saveContact = guard(saveContact_);
export const deleteContact = guard(deleteContact_);
export const importContacts = guard(importContacts_);
export const addContactFromMail = guard(addContactFromMail_);
export const suggestContacts = guard(suggestContacts_);
