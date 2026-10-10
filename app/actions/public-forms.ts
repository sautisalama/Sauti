'use server';

import { headers } from 'next/headers';
import { looseAdmin } from '@/lib/loose-db';
import { validateAnswers, type FormSettings, type Question } from '@/lib/forms/schema';

export interface PublicForm {
  slug: string;
  title: string;
  description: string | null;
  questions: Question[];
  collectEmail: boolean;
  /** Why it cannot be filled in right now, if so. */
  unavailable: 'closed' | 'full' | 'ended' | null;
  confirmation: string;
}

const SLUG = /^[a-z0-9]{6,12}$/;

/** Best-effort per-instance limiter against someone hammering a public form. */
const hits = new Map<string, number[]>();
function limited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 10 * 60 * 1000)) hits.delete(k);
  return recent.length > 8;
}

export async function getPublicForm(slug: string): Promise<PublicForm | null> {
  if (!SLUG.test(slug)) return null;
  const db = looseAdmin();
  const { data } = await db.from('mjengo_forms').select('id, slug, title, description, status, questions, settings').eq('slug', slug).maybeSingle();
  if (!data || data.status === 'draft') return null; // drafts are invisible to the public

  const s = (data.settings ?? {}) as FormSettings;
  let unavailable: PublicForm['unavailable'] = data.status === 'closed' ? 'closed' : null;
  if (!unavailable && s.closeAt && new Date(s.closeAt).getTime() < Date.now()) unavailable = 'ended';
  if (!unavailable && s.limit) {
    const { count } = await db.from('mjengo_form_responses').select('id', { count: 'exact', head: true }).eq('form_id', data.id);
    if ((count ?? 0) >= s.limit) unavailable = 'full';
  }
  return {
    slug: data.slug,
    title: data.title,
    description: data.description,
    questions: data.questions as Question[],
    collectEmail: !!s.collectEmail,
    unavailable,
    confirmation: s.confirmation || 'Thank you. Your response has been recorded.',
  };
}

export type SubmitResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function submitFormResponse(slug: string, answers: Record<string, unknown>, extra: { email?: string; website?: string }): Promise<SubmitResult> {
  // Honeypot: real people never fill the hidden "website" field.
  if (extra.website) return { ok: true, message: 'Thank you.' };
  if (!SLUG.test(slug)) return { ok: false, error: 'This form is not available.' };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (limited(`${slug}:${ip}`)) return { ok: false, error: 'Too many submissions from this connection. Please try again in a few minutes.' };

  const form = await getPublicForm(slug);
  if (!form) return { ok: false, error: 'This form is not available.' };
  if (form.unavailable) return { ok: false, error: 'This form is no longer accepting responses.' };

  const result = validateAnswers(form.questions, answers);
  if (!result.ok) return { ok: false, error: 'Please check the highlighted answers.', fieldErrors: result.errors };

  let email: string | null = null;
  if (form.collectEmail) {
    const e = (extra.email ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) return { ok: false, error: 'Enter a valid email address.', fieldErrors: { __email: 'Enter a valid email address.' } };
    email = e;
  }

  const db = looseAdmin();
  const { data: f } = await db.from('mjengo_forms').select('id').eq('slug', slug).maybeSingle();
  if (!f) return { ok: false, error: 'This form is not available.' };
  const { error } = await db.from('mjengo_form_responses').insert({ form_id: f.id, answers: result.clean, respondent_email: email });
  if (error) return { ok: false, error: 'Could not record your response. Please try again.' };
  return { ok: true, message: form.confirmation };
}
