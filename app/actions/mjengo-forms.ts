'use server';

import { revalidatePath } from 'next/cache';
import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor } from '@/lib/access/super-admin';
import { requireModule } from '@/lib/access/permissions';
import { guard } from '@/lib/action-result';
import { askAi } from '@/lib/mjengo/ai';
import { sanitiseQuestions, sanitiseTheme, sanitiseWelcome, type FormSettings, type Question } from '@/lib/forms/schema';
import { questionsFrom, templateById } from '@/lib/forms/templates';

export interface FormRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: 'draft' | 'open' | 'closed';
  questions: Question[];
  settings: FormSettings;
  created_by?: string | null;
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

/**
 * Who is acting on a form: an administrator with the forms module, or someone holding the form's edit link
 * (which may be outside the organisation). Edit-link holders can edit and read responses, nothing else.
 */
async function formActor(formId: string, key: string | null | undefined, need: 'view' | 'write' = 'view'): Promise<{ id: string | null; email: string; viaLink: boolean }> {
  if (key) {
    const { data } = await looseAdmin().from('mjengo_forms').select('edit_token').eq('id', formId).maybeSingle();
    if (data?.edit_token && data.edit_token === key) return { id: null, email: 'edit link', viaLink: true };
    throw new Error('This edit link is no longer valid.');
  }
  const a = await requireModule('forms', need);
  return { id: a.id, email: a.email, viaLink: false };
}

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
  await requireModule('forms');
  const { data } = await looseAdmin().from('mjengo_forms').select('*').order('updated_at', { ascending: false });
  return withCounts((data ?? []) as Omit<FormRow, 'response_count' | 'last_response_at'>[]);
}

export async function getForm(id: string, key?: string | null): Promise<FormRow | null> {
  await formActor(id, key);
  const { data } = await looseAdmin().from('mjengo_forms').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  return (await withCounts([data as Omit<FormRow, 'response_count' | 'last_response_at'>]))[0];
}

export async function createForm(title?: string): Promise<string> {
  const actor = await requireModule('forms', 'write');
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

export async function saveForm(id: string, patch: { title?: string; description?: string | null; questions?: Question[]; settings?: FormSettings }, key?: string | null) {
  const actor = await formActor(id, key, 'write');
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
      theme: sanitiseTheme(s.theme),
      welcome: sanitiseWelcome(s.welcome),
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

export async function setFormStatus(id: string, status: 'draft' | 'open' | 'closed', key?: string | null) {
  const actor = await formActor(id, key, 'write');
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
  const actor = await requireModule('forms', 'owner');
  const db = looseAdmin();
  const { data } = await db.from('mjengo_forms').select('title').eq('id', id).maybeSingle();
  await db.from('mjengo_forms').delete().eq('id', id);
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.form.deleted', targetType: 'form', targetId: id, targetLabel: data?.title });
  refresh();
}

/** Up to 5,000 newest responses: enough for the table, export and analytics. */
export async function getResponses(formId: string, key?: string | null): Promise<ResponseRow[]> {
  await formActor(formId, key);
  const { data } = await looseAdmin()
    .from('mjengo_form_responses')
    .select('id, answers, respondent_email, created_at')
    .eq('form_id', formId)
    .order('created_at', { ascending: false })
    .limit(5000);
  return (data ?? []) as ResponseRow[];
}

export async function deleteResponse(formId: string, responseId: string) {
  const actor = await requireModule('forms', 'owner');
  await looseAdmin().from('mjengo_form_responses').delete().eq('id', responseId).eq('form_id', formId);
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.form.response_deleted', targetType: 'form', targetId: formId });
}

export async function exportedCsv(formId: string): Promise<void> {
  const actor = await requireModule('forms');
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.form.exported', targetType: 'form', targetId: formId });
}

/** A one-time upload link for an image shown with a form. The image is public, like the form itself. */
export async function formImageUpload(formId: string, fileName: string, key?: string | null): Promise<{ signedUrl: string; publicUrl: string }> {
  await formActor(formId, key, 'write');
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-80) || 'image';
  const path = `forms/${formId}/${Date.now()}-${safe}`;
  const db = looseAdmin();
  const { data, error } = await db.storage.from('mjengo-public').createSignedUploadUrl(path);
  if (error || !data) throw new Error('Could not start the upload.');
  return { signedUrl: data.signedUrl, publicUrl: db.storage.from('mjengo-public').getPublicUrl(path).data.publicUrl };
}

/** Colours and notes from the saved design systems, for styling a form. */
export async function designSystemsForForms(): Promise<{ id: string; name: string; colors: string[] }[]> {
  await requireModule('forms');
  const { data } = await looseAdmin().from('mjengo_design_systems').select('id, name, colors').order('name');
  return (data ?? []) as { id: string; name: string; colors: string[] }[];
}

const QUESTION_TYPES = 'short, paragraph, choice, checkbox, dropdown, scale, date, email, number';

/** A first draft of a form from a plain description. The questions can be edited afterwards like any other. */
export interface FormStartOptions {
  /** A ready-made form to start from (the AI adapts it to the description). */
  templateId?: string | null;
  /** A saved design system whose colours style the form. */
  designSystemId?: string | null;
  /** Brand guideline text or a short description of the look. */
  guidelines?: string | null;
}

/** Accent colour (and button colour) for a new form, from a design system or from guideline text. */
async function designFor(opts: FormStartOptions): Promise<Partial<FormSettings>> {
  let colours: string[] = [];
  if (opts.designSystemId) {
    const { data } = await looseAdmin().from('mjengo_design_systems').select('colors').eq('id', opts.designSystemId).maybeSingle();
    colours = ((data?.colors ?? []) as string[]).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  }
  if (!colours.length && opts.guidelines?.trim()) {
    try {
      const raw = await askAi('Pick the main brand colours named or implied by the text. Answer with JSON {"colours": ["#RRGGBB", ...]} with 1 to 4 colours, the primary first.', opts.guidelines.slice(0, 4000), 200, { json: true, temperature: 0.2 });
      colours = ((JSON.parse(raw) as { colours?: string[] }).colours ?? []).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
    } catch { /* default look */ }
  }
  if (!colours.length) return {};
  return { style: { accent: colours[0], designSystem: opts.designSystemId ?? null }, theme: { buttonColor: colours[0] } };
}

async function insertForm(actor: { id: string; email: string }, title: string, description: string | null, questions: Question[], settings: Record<string, unknown>, action: string): Promise<string> {
  const db = looseAdmin();
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db
      .from('mjengo_forms')
      .insert({ slug: makeSlug(), title: title.slice(0, 120), description, created_by: actor.id, questions, settings })
      .select('id, title')
      .single();
    if (!error && data) {
      await logAudit({ actorId: actor.id, actorEmail: actor.email, action, targetType: 'form', targetId: data.id, targetLabel: data.title });
      refresh();
      return data.id as string;
    }
  }
  throw new Error('Could not create the form.');
}

/** A new form from a template, as it is or in the colours of a design system. */
async function fromTemplate_(templateId: string, opts: FormStartOptions = {}): Promise<string> {
  const actor = await requireModule('forms', 'write');
  const t = templateById(templateId);
  if (!t) throw new Error('That template does not exist.');
  const design = await designFor(opts);
  const settings = { confirmation: 'Thank you. Your response has been recorded.', ...t.settings, ...design };
  return insertForm(actor, t.title, t.description, questionsFrom(t), settings, 'mjengo.form.from_template');
}

async function generate_(prompt: string, opts: FormStartOptions = {}): Promise<string> {
  const actor = await requireModule('forms', 'write');
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('AI is not set up on this site yet.');
  const about = prompt.trim().slice(0, 1500);
  if (about.length < 8) throw new Error('Describe what the form is for.');
  const tpl = opts.templateId ? templateById(opts.templateId) : null;
  const seed = tpl ? { title: tpl.title, questions: tpl.questions.map((x) => ({ type: x.type, label: x.label, required: x.required, options: x.options })) } : null;
  const design = await designFor(opts);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(40_000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Sauti Salama Forms' },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'qwen/qwen3.7-flash',
      reasoning: { enabled: false },
      temperature: 0.4,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You design short, respectful forms for Sauti Salama, a survivor-led organisation in Kenya. Reply with one JSON object: {"title": string, "description": string, "questions": [{"type": one of ${QUESTION_TYPES}, "label": string, "help"?: string, "required": boolean, "options"?: string[] (for choice, checkbox, dropdown), "scale"?: {"min": number, "max": number, "minLabel"?: string, "maxLabel"?: string}}]}. Ask only what is needed, between 4 and 12 questions, in plain words. Never ask for identifying details unless the description requires them. Never use em dashes or en dashes.`,
        },
        { role: 'user', content: about + (seed ? `\n\nStart from this template and adapt it to the description (keep what fits, change or add what does not):\n${JSON.stringify(seed)}` : '') },
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
        settings: { confirmation: 'Thank you. Your response has been recorded.', ...(tpl?.settings ?? {}), ...design },
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
  await requireModule('forms', 'write');
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
export const createFromTemplate = guard(fromTemplate_);
export const linkPoster = guard(poster_);

async function seen_(formId: string, key?: string | null) {
  const a = await formActor(formId, key);
  if (a.viaLink) return;
  await looseAdmin().from('mjengo_forms').update({ responses_seen_at: new Date().toISOString() }).eq('id', formId);
}

export const markResponsesSeen = guard(seen_);


/**
 * A written report from a form's responses: how many, who and when, what each question shows, and the themes
 * in open answers. The numbers come from the data; the AI only writes them up, and is told not to add any.
 */
export async function formReport(formId: string): Promise<{ title: string; markdown: string }> {
  await requireModule('forms');
  const db = looseAdmin();
  const { data: f } = await db.from('mjengo_forms').select('title, description, questions').eq('id', formId).maybeSingle();
  if (!f) throw new Error('That form does not exist.');
  const { data: rs } = await db.from('mjengo_form_responses').select('answers, created_at, respondent_email').eq('form_id', formId).order('created_at', { ascending: false }).limit(2000);
  const responses = (rs ?? []) as { answers: Record<string, unknown>; created_at: string; respondent_email: string | null }[];
  if (responses.length === 0) throw new Error('There are no responses to report on yet.');
  const { summarise } = await import('@/lib/forms/analytics');
  const questions = (f.questions ?? []) as Question[];
  const sums = summarise(questions, responses as never);
  const dates = responses.map((r) => r.created_at).sort();
  const lines: string[] = [
    `Form: ${f.title}`,
    `Responses: ${responses.length} (first ${dates[0].slice(0, 10)}, latest ${dates[dates.length - 1].slice(0, 10)})`,
  ];
  for (const q of sums) {
    const head = `Q: ${q.question.label} [${q.question.type}] answered ${q.answered}, skipped ${q.skipped}`;
    if (q.tallies?.length) lines.push(`${head}\n${q.tallies.map((t) => `  - ${t.label}: ${t.count} (${t.pct}%)`).join('\n')}${q.stats ? `\n  average ${q.stats.avg.toFixed(1)}, range ${q.stats.min} to ${q.stats.max}` : ''}`);
    else if (q.stats) lines.push(`${head}\n  average ${q.stats.avg.toFixed(1)}, range ${q.stats.min} to ${q.stats.max}`);
    else if (q.samples?.length) lines.push(`${head}\n${q.samples.slice(0, 12).map((x) => `  - ${String(x).slice(0, 240)}`).join('\n')}`);
    else lines.push(head);
  }
  const markdown = await askAi(
    'You write a short, clear report for a non-profit team from survey results. Use plain Markdown with these headings: ## Overview, ## What people told us, ## Themes in their own words, ## What to do next. Use only the figures given: never invent numbers, quotes or names. Quote open answers sparingly and only as given. Keep the whole report under 450 words. Do not identify individuals.',
    lines.join('\n\n').slice(0, 14000),
    1100,
    { temperature: 0.3 }
  );
  return { title: `${f.title}: responses report`, markdown };
}
