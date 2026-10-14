'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor, isSuperAdminEmail } from '@/lib/access/super-admin';
import { requireModule } from '@/lib/access/permissions';
import { sendAccessEmail } from '@/lib/mjengo/invite-email';
import { askAi } from '@/lib/mjengo/ai';

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
  /** 'team': every administrator sees it. 'private': only the people it was shared with, and its owner. */
  visibility: 'team' | 'private';
  created_by: string | null;
  /** Your own part in it. */
  mine: 'owner' | 'edit' | 'view' | 'team';
  sharedWith: number;
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

const COLS = 'id, name, email, phone, organisation, title, tags, notes, source, last_contacted_at, created_at, visibility, created_by';
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

/** Contacts this person may see: everything shared with the team, their own, those shared with them, and (super admins) all. */
async function visible(actor: { id: string; email: string }) {
  const db = looseAdmin();
  const [{ data: mine }, oversight] = await Promise.all([
    db.from('mjengo_contact_access').select('contact_id, level').eq('user_id', actor.id),
    isSuperAdminEmail(actor.email),
  ]);
  const access = new Map(((mine ?? []) as { contact_id: string; level: 'view' | 'edit' }[]).map((m) => [m.contact_id, m.level]));
  return { access, oversight };
}

function shape(row: Record<string, unknown>, actor: { id: string }, access: Map<string, 'view' | 'edit'>, shared: Map<string, number>, oversight: boolean): ContactRow | null {
  const id = row.id as string;
  const owner = row.created_by === actor.id;
  const vis = (row.visibility as 'team' | 'private') ?? 'team';
  const lvl = access.get(id);
  if (vis === 'private' && !owner && !lvl && !oversight) return null;
  return { ...(row as unknown as ContactRow), visibility: vis, mine: owner ? 'owner' : lvl ?? (vis === 'team' ? 'team' : oversight ? 'edit' : 'view'), sharedWith: shared.get(id) ?? 0 };
}

async function listContacts_(q = ''): Promise<ContactRow[]> {
  const actor = await requireModule('contacts');
  const db = looseAdmin();
  let query = db.from('mjengo_contacts').select(COLS).order('name').limit(1500);
  const term = q.trim().replace(/[%,()]/g, ' ');
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,organisation.ilike.%${term}%,tags.cs.{${term.toLowerCase()}}`);
  const [{ data, error }, v] = await Promise.all([query, visible(actor)]);
  if (error) throw new Error('Could not load contacts.');
  const { data: counts } = await db.from('mjengo_contact_access').select('contact_id');
  const shared = new Map<string, number>();
  for (const c of (counts ?? []) as { contact_id: string }[]) shared.set(c.contact_id, (shared.get(c.contact_id) ?? 0) + 1);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => shape(r, actor, v.access, shared, v.oversight)).filter((r): r is ContactRow => !!r);
}

async function saveContact_(id: string | null, v: ContactInput): Promise<ContactRow> {
  const actor = await requireModule('contacts', 'write');
  const row = normalise(v);
  const db = looseAdmin();
  if (id) {
    const { data: cur } = await db.from('mjengo_contacts').select('visibility, created_by').eq('id', id).maybeSingle();
    if (!cur) throw new Error('That contact no longer exists.');
    if (cur.visibility === 'private' && cur.created_by !== actor.id) {
      const v = await visible(actor);
      if (v.access.get(id) !== 'edit' && !v.oversight) throw new Error('You can see this contact but not change it.');
    }
  }
  const q = id
    ? db.from('mjengo_contacts').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
    : db.from('mjengo_contacts').insert({ ...row, source: 'manual', created_by: actor.id });
  const { data, error } = await q.select(COLS).single();
  if (error || !data) {
    if (error?.code === '23505') throw new Error('A contact with that email already exists.');
    throw new Error('Could not save the contact.');
  }
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: id ? 'contact.updated' : 'contact.created', targetType: 'contact', targetId: data.id, targetLabel: data.name });
  return { ...(data as unknown as ContactRow), mine: 'owner', sharedWith: 0 };
}

async function deleteContact_(id: string) {
  const actor = await requireModule('contacts', 'owner');
  const { data } = await looseAdmin().from('mjengo_contacts').delete().eq('id', id).select('name').maybeSingle();
  if (data) await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'contact.deleted', targetType: 'contact', targetId: id, targetLabel: data.name });
}

/** Bulk add (CSV or mail): contacts whose email already exists are skipped, not overwritten. */
async function importContacts_(rows: ContactInput[], source: 'csv' | 'google' | 'mail'): Promise<{ added: number; skipped: number }> {
  const actor = await requireModule('contacts', 'write');
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
  const actor = await requireModule('contacts', 'write');
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

const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|aol|proton|protonmail|zoho|gmx|mail|yandex|rocketmail|inbox)\./i;

/** "info@sautisalama.org" gives "Sautisalama": a guess from the domain, empty for personal mail providers. */
function organisationFromDomain(email: string): string {
  const host = email.split('@')[1]?.toLowerCase() ?? '';
  if (!host || FREE_MAIL.test(host)) return '';
  const parts = host.split('.').filter(Boolean);
  const second = ['co', 'com', 'org', 'ac', 'go', 'or', 'ne', 'sc', 'net', 'gov', 'edu'];
  const core = parts.length > 2 && second.includes(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2] ?? parts[0];
  return core ? core.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
}

/**
 * The organisation a person writes from, for the "add to contacts" card. The signature or text of the email they
 * sent (when given) is read first; the domain is the fallback. It is only a suggestion: the person edits it.
 */
async function suggestOrganisation_(name: string, email: string, context?: string): Promise<{ organisation: string; title: string | null; source: 'text' | 'domain' | 'none' }> {
  await requireModule('contacts', 'write');
  const addr = email.trim().toLowerCase();
  if (!emailOk(addr)) throw new Error('That is not a valid email address.');
  const fallback = organisationFromDomain(addr);
  const text = (context ?? '').replace(/\s+/g, ' ').trim().slice(-1800);
  if (text.length < 20) return { organisation: fallback, title: null, source: fallback ? 'domain' : 'none' };
  try {
    const raw = await askAi(
      'You read the end of an email and say which organisation its sender works for, and their job title if it is written. Reply with one JSON object {"organisation": string | null, "title": string | null}. Use only what the text says (a signature, a letterhead line, a footer); if it is not clear, use null. Never invent. Keep the organisation name as written, without legal suffixes such as "Ltd".',
      `Sender: ${name || '(no name)'} <${addr}>\nEmail domain: ${addr.split('@')[1]}\n\nText:\n${text}`,
      200,
      { json: true, temperature: 0 },
    );
    const j = JSON.parse(/\{[\s\S]*\}/.exec(raw)?.[0] ?? '{}') as { organisation?: string | null; title?: string | null };
    const org = (j.organisation ?? '').toString().trim().slice(0, 120);
    const title = (j.title ?? '').toString().trim().slice(0, 100) || null;
    if (org) return { organisation: org, title, source: 'text' };
    return { organisation: fallback, title, source: fallback ? 'domain' : 'none' };
  } catch {
    return { organisation: fallback, title: null, source: fallback ? 'domain' : 'none' };
  }
}

/** Add someone from an email with the details confirmed by the person: name, organisation, title. */
async function addContactDetailed_(v: { name: string; email: string; organisation?: string | null; title?: string | null }): Promise<ContactRow> {
  const actor = await requireModule('contacts', 'write');
  const addr = v.email.trim().toLowerCase();
  if (!emailOk(addr)) throw new Error('That is not a valid email address.');
  const db = looseAdmin();
  const { data: have } = await db.from('mjengo_contacts').select(COLS).ilike('email', addr).maybeSingle();
  if (have) return have as ContactRow;
  const { data, error } = await db
    .from('mjengo_contacts')
    .insert({ name: clean(v.name) ?? addr, email: addr, organisation: clean(v.organisation), title: clean(v.title), source: 'mail', created_by: actor.id })
    .select(COLS)
    .single();
  if (error || !data) throw new Error('Could not add the contact.');
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'contact.created', targetType: 'contact', targetId: data.id, targetLabel: data.name, details: { via: 'mail' } });
  return data as ContactRow;
}

/** For recipient pickers: teammates and contacts matching what has been typed, teammates first. */
async function suggestContacts_(q: string): Promise<{ name: string; email: string; avatar?: string | null; kind?: 'team' | 'contact' }[]> {
  const me = await requireModule('contacts', 'write');
  const term = q.trim().replace(/[%,()]/g, ' ');
  const db = looseAdmin();
  let contactQ = db.from('mjengo_contacts').select('name, email, id, visibility, created_by').not('email', 'is', null).order('last_contacted_at', { ascending: false, nullsFirst: false }).limit(8);
  let teamQ = db.from('profiles').select('first_name, last_name, email, avatar_url').eq('is_admin', true).not('email', 'is', null).limit(6);
  if (term) {
    contactQ = contactQ.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
    teamQ = teamQ.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  const [{ data: contactRows }, { data: team }, vis] = await Promise.all([contactQ, teamQ, visible(me)]);
  const contacts = ((contactRows ?? []) as { name: string; email: string; id: string; visibility: string; created_by: string | null }[])
    .filter((c) => c.visibility !== 'private' || c.created_by === me.id || vis.access.has(c.id) || vis.oversight);
  const out: { name: string; email: string; avatar?: string | null; kind: 'team' | 'contact' }[] = [];
  const seen = new Set<string>();
  for (const t of (team ?? []) as { first_name: string | null; last_name: string | null; email: string; avatar_url: string | null }[]) {
    const email = t.email.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ name: [t.first_name, t.last_name].filter(Boolean).join(' ') || email, email, avatar: t.avatar_url, kind: 'team' });
  }
  for (const c of (contacts ?? []) as { name: string; email: string }[]) {
    const email = c.email.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ name: c.name, email, kind: 'contact' });
  }
  return out.slice(0, 10);
}

export interface ContactAccess {
  visibility: 'team' | 'private';
  owner: { id: string; name: string } | null;
  people: { id: string; name: string; email: string; avatar: string | null; level: 'view' | 'edit' }[];
  canManage: boolean;
}

async function ownerOrEditor(contactId: string, actor: { id: string; email: string }) {
  const { data } = await looseAdmin().from('mjengo_contacts').select('name, visibility, created_by').eq('id', contactId).maybeSingle();
  if (!data) throw new Error('That contact no longer exists.');
  const v = await visible(actor);
  const ok = data.created_by === actor.id || v.access.get(contactId) === 'edit' || v.oversight || data.visibility === 'team';
  return { row: data as { name: string; visibility: 'team' | 'private'; created_by: string | null }, canManage: ok };
}

async function contactAccess_(contactId: string): Promise<ContactAccess> {
  const actor = await requireModule('contacts');
  const { row, canManage } = await ownerOrEditor(contactId, actor);
  const db = looseAdmin();
  const { data: rows } = await db.from('mjengo_contact_access').select('user_id, level').eq('contact_id', contactId);
  const ids = [...new Set([...(rows ?? []).map((r: { user_id: string }) => r.user_id), ...(row.created_by ? [row.created_by] : [])])];
  const { data: profs } = ids.length ? await db.from('profiles').select('id, first_name, last_name, email, avatar_url').in('id', ids) : { data: [] };
  const info = new Map(((profs ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; avatar_url: string | null }[]).map((p) => [p.id, { name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Someone', email: p.email ?? '', avatar: p.avatar_url }]));
  return {
    visibility: row.visibility,
    owner: row.created_by ? { id: row.created_by, name: info.get(row.created_by)?.name ?? 'Someone' } : null,
    canManage,
    people: ((rows ?? []) as { user_id: string; level: 'view' | 'edit' }[]).filter((r) => r.user_id !== row.created_by).map((r) => ({ id: r.user_id, level: r.level, name: info.get(r.user_id)?.name ?? 'Someone', email: info.get(r.user_id)?.email ?? '', avatar: info.get(r.user_id)?.avatar ?? null })),
  };
}

async function setAccess_(contactId: string, userId: string, level: 'view' | 'edit' | null, notify = true): Promise<void> {
  const actor = await requireModule('contacts', 'write');
  const { row, canManage } = await ownerOrEditor(contactId, actor);
  if (!canManage) throw new Error('Only the owner or an editor can change who sees this contact.');
  const db = looseAdmin();
  const { data: target } = await db.from('profiles').select('email, is_admin').eq('id', userId).maybeSingle();
  if (!target?.is_admin) throw new Error('Contacts can only be shared with administrators.');
  if (level) await db.from('mjengo_contact_access').upsert({ contact_id: contactId, user_id: userId, level, granted_by: actor.id }, { onConflict: 'contact_id,user_id' });
  else await db.from('mjengo_contact_access').delete().eq('contact_id', contactId).eq('user_id', userId);
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: level ? 'contact.shared' : 'contact.unshared', targetType: 'contact', targetId: contactId, targetLabel: row.name, details: { with: target.email, level } });
  if (notify && level && target.email) void sendAccessEmail({ kind: 'contact', to: [target.email], by: actor.name, title: row.name, url: '/dashboard/mjengo/contacts', detail: level === 'edit' ? 'You can view and edit this contact.' : 'You can view this contact.' });
}

async function setVisibility_(contactId: string, visibility: 'team' | 'private'): Promise<void> {
  const actor = await requireModule('contacts', 'write');
  const { row, canManage } = await ownerOrEditor(contactId, actor);
  if (!canManage) throw new Error('Only the owner or an editor can change who sees this contact.');
  if (visibility !== 'team' && visibility !== 'private') throw new Error('Unknown setting.');
  const db = looseAdmin();
  await db.from('mjengo_contacts').update({ visibility }).eq('id', contactId);
  // Going private keeps the person doing it able to see it.
  if (visibility === 'private') await db.from('mjengo_contact_access').upsert({ contact_id: contactId, user_id: actor.id, level: 'edit', granted_by: actor.id }, { onConflict: 'contact_id,user_id', ignoreDuplicates: true });
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'contact.visibility', targetType: 'contact', targetId: contactId, targetLabel: row.name, details: { visibility } });
}

export const listContacts = guard(listContacts_);
export const contactAccess = guard(contactAccess_);
export const setContactAccess = guard(setAccess_);
export const setContactVisibility = guard(setVisibility_);
export const saveContact = guard(saveContact_);
export const deleteContact = guard(deleteContact_);
export const importContacts = guard(importContacts_);
export const addContactFromMail = guard(addContactFromMail_);
export const suggestOrganisation = guard(suggestOrganisation_);
export const addContactDetailed = guard(addContactDetailed_);
export const suggestContacts = guard(suggestContacts_);
