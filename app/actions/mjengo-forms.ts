'use server';

import { revalidatePath } from 'next/cache';
import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor } from '@/lib/access/super-admin';
import { sanitiseQuestions, type FormSettings, type Question } from '@/lib/forms/schema';

export interface FormRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: 'draft' | 'open' | 'closed';
  questions: Question[];
  settings: FormSettings;
  created_at: string;
  updated_at: string;
  response_count: number;
  last_response_at: string | null;
}

export interface ResponseRow {
  id: string;
  answers: Record<string, string | string[] | number | null>;
  respondent_email: string | null;
  created_at: string;
}

const SLUG_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const makeSlug = () => Array.from({ length: 8 }, () => SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)]).join('');
const refresh = () => revalidatePath('/dashboard/mjengo/forms', 'layout');

async function withCounts(rows: Omit<FormRow, 'response_count' | 'last_response_at'>[]): Promise<FormRow[]> {
  if (!rows.length) return [];
  const db = looseAdmin();
  const out: FormRow[] = [];
  for (const r of rows) {
    const [{ count }, { data: last }] = await Promise.all([
      db.from('mjengo_form_responses').select('id', { count: 'exact', head: true }).eq('form_id', r.id),
      db.from('mjengo_form_responses').select('created_at').eq('form_id', r.id).order('created_at', { ascending: false }).limit(1),
    ]);
    out.push({ ...r, response_count: count ?? 0, last_response_at: last?.[0]?.created_at ?? null });
  }
  return out;
}

export async function listForms(): Promise<FormRow[]> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_forms').select('*').order('updated_at', { ascending: false });
  return withCounts((data ?? []) as Omit<FormRow, 'response_count' | 'last_response_at'>[]);
}

export async function getForm(id: string): Promise<FormRow | null> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_forms').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  return (await withCounts([data as Omit<FormRow, 'response_count' | 'last_response_at'>]))[0];
}

export async function createForm(title?: string): Promise<string> {
  const actor = await requireAdminActor();
  const db = looseAdmin();
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db
      .from('mjengo_forms')
      .insert({ slug: makeSlug(), title: (title || 'Untitled form').slice(0, 120), created_by: actor.id, questions: [], settings: { confirmation: 'Thank you. Your response has been recorded.' } })
      .select('id')
      .single();
    if (!error && data) {
      await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.form.created', targetType: 'form', targetId: data.id, targetLabel: title || 'Untitled form' });
      refresh();
      return data.id as string;
    }
  }
  throw new Error('Could not create the form.');
}

export async function saveForm(id: string, patch: { title?: string; description?: string | null; questions?: Question[]; settings?: FormSettings }) {
  const actor = await requireAdminActor();
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.trim().slice(0, 120) || 'Untitled form';
  if (patch.description !== undefined) update.description = patch.description ? patch.description.slice(0, 2000) : null;
  if (patch.questions !== undefined) update.questions = sanitiseQuestions(patch.questions);
  if (patch.settings !== undefined) {
    const s = patch.settings;
    update.settings = {
      confirmation: (s.confirmation ?? '').slice(0, 500),
      collectEmail: !!s.collectEmail,
      closeAt: s.closeAt || null,
      limit: s.limit && s.limit > 0 ? Math.min(Math.round(s.limit), 100000) : null,
    };
  }
  const { data, error } = await looseAdmin().from('mjengo_forms').update(update).eq('id', id).select('title, questions').single();
  if (error || !data) throw new Error('Could not save the form.');
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.form.updated', targetType: 'form', targetId: id, targetLabel: data.title });
  refresh();
  return { questions: data.questions as Question[] };
}

export async function setFormStatus(id: string, status: 'draft' | 'open' | 'closed') {
  const actor = await requireAdminActor();
  const db = looseAdmin();
  if (status === 'open') {
    const { data } = await db.from('mjengo_forms').select('questions').eq('id', id).maybeSingle();
    const qs = (data?.questions ?? []) as Question[];
    if (!qs.length) throw new Error('Add at least one question before opening the form.');
    if (qs.some((q) => !q.label.trim())) throw new Error('Every question needs a title.');
  }
  const { data, error } = await db.from('mjengo_forms').update({ status }).eq('id', id).select('title').single();
  if (error || !data) throw new Error('Could not change the status.');
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.form.status_changed', targetType: 'form', targetId: id, targetLabel: data.title, details: { to: status } });
  refresh();
}

export async function deleteForm(id: string) {
  const actor = await requireAdminActor();
  const db = looseAdmin();
  const { data } = await db.from('mjengo_forms').select('title').eq('id', id).maybeSingle();
  await db.from('mjengo_forms').delete().eq('id', id);
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.form.deleted', targetType: 'form', targetId: id, targetLabel: data?.title });
  refresh();
}

/** Up to 5,000 newest responses: enough for the table, export and analytics. */
export async function getResponses(formId: string): Promise<ResponseRow[]> {
  await requireAdminActor();
  const { data } = await looseAdmin()
    .from('mjengo_form_responses')
    .select('id, answers, respondent_email, created_at')
    .eq('form_id', formId)
    .order('created_at', { ascending: false })
    .limit(5000);
  return (data ?? []) as ResponseRow[];
}

export async function deleteResponse(formId: string, responseId: string) {
  const actor = await requireAdminActor();
  await looseAdmin().from('mjengo_form_responses').delete().eq('id', responseId).eq('form_id', formId);
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.form.response_deleted', targetType: 'form', targetId: formId });
}

export async function exportedCsv(formId: string): Promise<void> {
  const actor = await requireAdminActor();
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.form.exported', targetType: 'form', targetId: formId });
}
