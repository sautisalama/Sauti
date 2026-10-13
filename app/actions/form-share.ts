'use server';

import { randomBytes } from 'node:crypto';
import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireModule } from '@/lib/access/permissions';
import { appOrigin, sendNoticeEmail } from '@/lib/mjengo/invite-email';

/**
 * Sharing a form for editing, which is separate from sharing it for filling in. Editors can change the form and
 * read its responses. An edit link can be given to people outside the organisation. The creator is always
 * recorded on the form (`created_by`).
 */

export interface FormSharing {
  owner: { name: string; email: string } | null;
  editUrl: string | null;
  editors: { email: string; at: string; level: 'edit' | 'view' }[];
  /** Only the creator and the people added can open it. */
  restricted: boolean;
}

async function sharing_(formId: string): Promise<FormSharing> {
  await requireModule('forms');
  const db = looseAdmin();
  const { data: f } = await db.from('mjengo_forms').select('slug, created_by, edit_token, restricted').eq('id', formId).maybeSingle();
  if (!f) throw new Error('That form no longer exists.');
  const [{ data: owner }, { data: eds }] = await Promise.all([
    f.created_by ? db.from('profiles').select('first_name, last_name, email').eq('id', f.created_by).maybeSingle() : Promise.resolve({ data: null }),
    db.from('mjengo_form_editors').select('email, created_at, level').eq('form_id', formId).order('created_at'),
  ]);
  const o = owner as { first_name: string | null; last_name: string | null; email: string | null } | null;
  return {
    owner: o ? { name: [o.first_name, o.last_name].filter(Boolean).join(' ') || o.email || 'Someone', email: o.email ?? '' } : null,
    editUrl: f.edit_token ? `${appOrigin()}/f/${f.slug}/edit?k=${f.edit_token}` : null,
    editors: ((eds ?? []) as { email: string; created_at: string; level: 'edit' | 'view' }[]).map((e) => ({ email: e.email, at: e.created_at, level: e.level === 'view' ? 'view' : 'edit' })),
    restricted: !!f.restricted,
  };
}

async function ensureToken(formId: string): Promise<void> {
  const db = looseAdmin();
  const { data } = await db.from('mjengo_forms').select('edit_token').eq('id', formId).maybeSingle();
  if (!data?.edit_token) await db.from('mjengo_forms').update({ edit_token: randomBytes(18).toString('base64url') }).eq('id', formId);
}

/** Turn the edit link on (a new link each time it is turned on) or off. */
async function editLink_(formId: string, on: boolean): Promise<FormSharing> {
  const a = await requireModule('forms', 'write');
  await looseAdmin().from('mjengo_forms').update({ edit_token: on ? randomBytes(18).toString('base64url') : null }).eq('id', formId);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: on ? 'mjengo.form.edit_link_on' : 'mjengo.form.edit_link_off', targetType: 'form', targetId: formId });
  return sharing_(formId);
}

/** Add people who can edit. They are noted on the form; they are emailed the edit link only when email sharing is on. */
async function addEditors_(formId: string, emails: string[], note?: string, level: 'edit' | 'view' = 'edit', notify = true): Promise<FormSharing> {
  const a = await requireModule('forms', 'write');
  const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].slice(0, 30);
  if (!clean.length) throw new Error('Add at least one email address.');
  const db = looseAdmin();
  await ensureToken(formId);
  await db.from('mjengo_form_editors').upsert(clean.map((email) => ({ form_id: formId, email, added_by: a.id, level: level === 'view' ? 'view' : 'edit' })), { onConflict: 'form_id,email' });
  const s = await sharing_(formId);
  const { data: f } = await db.from('mjengo_forms').select('title').eq('id', formId).maybeSingle();
  if (notify && s.editUrl && level === 'edit') {
    await sendNoticeEmail({
      to: clean,
      by: a.name,
      subject: `${a.name} shared a form with you to edit`,
      heading: `You can edit “${f?.title ?? 'a form'}”`,
      lines: [note?.trim() || `${a.name} gave you access to edit this form and see its responses.`],
      button: { label: 'Open the form', url: s.editUrl },
    });
  }
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'mjengo.form.editors_added', targetType: 'form', targetId: formId, details: { count: clean.length } });
  return s;
}

async function removeEditor_(formId: string, email: string): Promise<FormSharing> {
  const a = await requireModule('forms', 'write');
  await looseAdmin().from('mjengo_form_editors').delete().eq('form_id', formId).eq('email', email.toLowerCase());
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'mjengo.form.editor_removed', targetType: 'form', targetId: formId, details: { email } });
  return sharing_(formId);
}

/** Change what an added person can do (edit, or only view the form and its responses). */
async function editorLevel_(formId: string, email: string, level: 'edit' | 'view'): Promise<FormSharing> {
  const a = await requireModule('forms', 'write');
  await looseAdmin().from('mjengo_form_editors').update({ level: level === 'view' ? 'view' : 'edit' }).eq('form_id', formId).eq('email', email.toLowerCase());
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'mjengo.form.editor_level', targetType: 'form', targetId: formId, details: { email, level } });
  return sharing_(formId);
}

/** Limit the form to the people added to it, or open it to every administrator with the Forms module again. */
async function restrict_(formId: string, on: boolean): Promise<FormSharing> {
  const a = await requireModule('forms', 'write');
  await looseAdmin().from('mjengo_forms').update({ restricted: on }).eq('id', formId);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: on ? 'mjengo.form.restricted' : 'mjengo.form.unrestricted', targetType: 'form', targetId: formId });
  return sharing_(formId);
}

/** From an edit link: the form it opens, or null. Anyone may ask; only the right key gets an answer. */
async function byLink_(slug: string, key: string): Promise<{ id: string; title: string } | null> {
  if (!/^[a-z0-9]{6,12}$/.test(slug) || !key) return null;
  const { data } = await looseAdmin().from('mjengo_forms').select('id, title, edit_token').eq('slug', slug).maybeSingle();
  if (!data?.edit_token || data.edit_token !== key) return null;
  return { id: data.id as string, title: data.title as string };
}

export const getFormSharing = guard(sharing_);
export const setFormEditLink = guard(editLink_);
export const addFormEditors = guard(addEditors_);
export const removeFormEditor = guard(removeEditor_);
export const setFormEditorLevel = guard(editorLevel_);
export const setFormRestricted = guard(restrict_);
export const formForEditLink = guard(byLink_);
