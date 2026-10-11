'use server';

import { revalidatePath } from 'next/cache';
import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor } from '@/lib/access/super-admin';
import { guard } from '@/lib/action-result';
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
      layout: s.layout === 'single' ? 'single' : 'page',
      allowAnonymous: s.allowAnonymous !== false,
      poster: s.poster ?? null,
      images: (s.images ?? []).filter((u) => typeof u === 'string' && /^https:\/\//.test(u)).slice(0, 6),
      style: {
        accent: /^#[0-9a-fA-F]{6}$/.test(s.style?.accent ?? '') ? s.style!.accent : undefined,
        background: /^#[0-9a-fA-F]{6}$/.test(s.style?.background ?? '') ? s.style!.background : undefined,
        designSystem: s.style?.designSystem ?? null,
      },
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

/** A one-time upload link for an image shown with a form. The image is public, like the form itself. */
export async function formImageUpload(formId: string, fileName: string): Promise<{ signedUrl: string; publicUrl: string }> {
  await requireAdminActor();
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-80) || 'image';
  const path = `forms/${formId}/${Date.now()}-${safe}`;
  const db = looseAdmin();
  const { data, error } = await db.storage.from('mjengo-public').createSignedUploadUrl(path);
  if (error || !data) throw new Error('Could not start the upload.');
  return { signedUrl: data.signedUrl, publicUrl: db.storage.from('mjengo-public').getPublicUrl(path).data.publicUrl };
}

/** Colours and notes from the saved design systems, for styling a form. */
export async function designSystemsForForms(): Promise<{ id: string; name: string; colors: string[] }[]> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_design_systems').select('id, name, colors').order('name');
  return (data ?? []) as { id: string; name: string; colors: string[] }[];
}

const QUESTION_TYPES = 'short, paragraph, choice, checkbox, dropdown, scale, date, email, number';

/** A first draft of a form from a plain description. The questions can be edited afterwards like any other. */
async function generate_(prompt: string): Promise<string> {
  const actor = await requireAdminActor();
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('AI is not set up on this site yet.');
  const about = prompt.trim().slice(0, 1500);
  if (about.length < 8) throw new Error('Describe what the form is for.');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(40_000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Sauti Salama Forms' },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'qwen/qwen3.7-flash',
      temperature: 0.4,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You design short, respectful forms for Sauti Salama, a survivor-led organisation in Kenya. Reply with one JSON object: {"title": string, "description": string, "questions": [{"type": one of ${QUESTION_TYPES}, "label": string, "help"?: string, "required": boolean, "options"?: string[] (for choice, checkbox, dropdown), "scale"?: {"min": number, "max": number, "minLabel"?: string, "maxLabel"?: string}}]}. Ask only what is needed, between 4 and 12 questions, in plain words. Never ask for identifying details unless the description requires them. Never use em dashes or en dashes.`,
        },
        { role: 'user', content: about },
      ],
    }),
  });
  if (!res.ok) throw new Error('The AI service is unavailable right now.');
  let parsed: { title?: string; description?: string; questions?: unknown };
  try {
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    parsed = JSON.parse(j.choices?.[0]?.message?.content ?? '{}');
  } catch {
    throw new Error('The AI answer could not be read. Please try again.');
  }
  const questions = sanitiseQuestions(parsed.questions);
  if (!questions.length) throw new Error('No questions came back. Try describing the form differently.');
  const clean = (t: string) => t.replace(/\s*[\u2013\u2014]\s*/g, ', ');

  const db = looseAdmin();
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db
      .from('mjengo_forms')
      .insert({
        slug: makeSlug(),
        title: clean((parsed.title || 'New form').toString()).slice(0, 120),
        description: parsed.description ? clean(String(parsed.description)).slice(0, 2000) : null,
        created_by: actor.id,
        questions,
        settings: { confirmation: 'Thank you. Your response has been recorded.' },
      })
      .select('id, title')
      .single();
    if (!error && data) {
      await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.form.generated', targetType: 'form', targetId: data.id, targetLabel: data.title });
      refresh();
      return data.id as string;
    }
  }
  throw new Error('Could not create the form.');
}

/** Link a poster from Studio to a form: it is copied where the public can see it and shown at the top. */
async function poster_(formId: string, assetId: string | null): Promise<{ url: string | null }> {
  await requireAdminActor();
  const db = looseAdmin();
  const { data: f } = await db.from('mjengo_forms').select('settings').eq('id', formId).maybeSingle();
  if (!f) throw new Error('That form no longer exists.');
  const settings = (f.settings ?? {}) as FormSettings & { poster?: string | null };
  const rest = (settings.images ?? []).filter((u) => !u.includes('/poster-'));
  if (!assetId) {
    await db.from('mjengo_forms').update({ settings: { ...settings, poster: null, images: rest } }).eq('id', formId);
    return { url: null };
  }
  const { data: a } = await db.from('mjengo_assets').select('path').eq('id', assetId).maybeSingle();
  if (!a?.path) throw new Error('That image no longer exists.');
  const { data: blob } = await db.storage.from('mjengo-docs').download(a.path);
  if (!blob) throw new Error('Could not read the image.');
  const path = `forms/${formId}/poster-${Date.now()}.png`;
  const up = await db.storage.from('mjengo-public').upload(path, Buffer.from(await blob.arrayBuffer()), { contentType: 'image/png' });
  if (up.error) throw new Error('Could not publish the poster.');
  const url = db.storage.from('mjengo-public').getPublicUrl(path).data.publicUrl;
  await db.from('mjengo_forms').update({ settings: { ...settings, poster: assetId, images: [url, ...rest].slice(0, 6) } }).eq('id', formId);
  refresh();
  return { url };
}

export const generateForm = guard(generate_);
export const linkPoster = guard(poster_);

async function seen_(formId: string) {
  await requireAdminActor();
  await looseAdmin().from('mjengo_forms').update({ responses_seen_at: new Date().toISOString() }).eq('id', formId);
}

export const markResponsesSeen = guard(seen_);
