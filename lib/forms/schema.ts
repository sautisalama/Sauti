import { humanizeOption, toOptionValue } from '@/lib/other-option';

/** Shared by the builder, the public form page and the server-side validation. No server-only imports. */

export type QuestionType = 'short' | 'paragraph' | 'choice' | 'checkbox' | 'dropdown' | 'scale' | 'date' | 'email' | 'number';

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  help?: string;
  required: boolean;
  /** choice, checkbox, dropdown */
  options?: string[];
  /** Adds an "Other" choice that asks the person to type what it is. */
  allowOther?: boolean;
  /** scale */
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string };
}

export interface FormSettings {
  confirmation?: string;
  collectEmail?: boolean;
  /** ISO date-time after which the form stops accepting responses. */
  closeAt?: string | null;
  /** Stop after this many responses. */
  limit?: number | null;
}

export type Answer = string | string[] | number | null;
export type Answers = Record<string, Answer>;

export const TYPE_LABEL: Record<QuestionType, string> = {
  short: 'Short answer',
  paragraph: 'Paragraph',
  choice: 'Multiple choice',
  checkbox: 'Checkboxes',
  dropdown: 'Dropdown',
  scale: 'Linear scale',
  date: 'Date',
  email: 'Email',
  number: 'Number',
};

export const hasOptions = (t: QuestionType) => t === 'choice' || t === 'checkbox' || t === 'dropdown';
export const OTHER_LABEL = 'Other';

const uid = () => Math.random().toString(36).slice(2, 10);

export function newQuestion(type: QuestionType): Question {
  return {
    id: uid(),
    type,
    label: '',
    required: false,
    ...(hasOptions(type) ? { options: ['Option 1', 'Option 2'] } : {}),
    ...(type === 'scale' ? { scale: { min: 1, max: 5, minLabel: '', maxLabel: '' } } : {}),
  };
}

/** How an answer is shown: custom "Other" tokens become readable text. */
export function displayAnswer(q: Question, value: Answer | undefined): string {
  if (value == null || value === '') return '';
  const show = (v: string) => (q.options?.includes(v) ? v : hasOptions(q.type) ? humanizeOption(v) : v);
  return Array.isArray(value) ? value.map(show).join(', ') : typeof value === 'number' ? String(value) : show(value);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Check a submission against the form's own questions. Returns cleaned answers (only known questions,
 * correct types, "Other" text normalised to the same lowercase_token format used elsewhere) or the errors.
 */
export function validateAnswers(questions: Question[], raw: Record<string, unknown>): { ok: true; clean: Answers } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const clean: Answers = {};

  for (const q of questions) {
    const v = raw[q.id];
    const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (q.required) errors[q.id] = 'This question is required.';
      continue;
    }

    // A pick from the list, or typed text for "Other" (kept as a token like the listed values).
    const pick = (x: unknown): string | null => {
      if (typeof x !== 'string') return null;
      if (q.options?.includes(x) && x !== OTHER_LABEL) return x;
      if (q.allowOther) {
        const t = toOptionValue(x);
        if (t && t !== 'other') return t;
      }
      return null;
    };

    switch (q.type) {
      case 'short':
      case 'paragraph': {
        const s = String(v).trim();
        if (s.length > (q.type === 'short' ? 500 : 5000)) errors[q.id] = 'That is too long.';
        else if (s) clean[q.id] = s;
        else if (q.required) errors[q.id] = 'This question is required.';
        break;
      }
      case 'email':
        if (typeof v === 'string' && EMAIL.test(v.trim()) && v.length <= 200) clean[q.id] = v.trim();
        else errors[q.id] = 'Enter a valid email address.';
        break;
      case 'number': {
        const n = Number(v);
        if (Number.isFinite(n) && Math.abs(n) < 1e12) clean[q.id] = n;
        else errors[q.id] = 'Enter a number.';
        break;
      }
      case 'date':
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) clean[q.id] = v;
        else errors[q.id] = 'Choose a date.';
        break;
      case 'scale': {
        const n = Number(v);
        const { min = 1, max = 5 } = q.scale ?? {};
        if (Number.isInteger(n) && n >= min && n <= max) clean[q.id] = n;
        else errors[q.id] = `Choose a number from ${min} to ${max}.`;
        break;
      }
      case 'choice':
      case 'dropdown': {
        const p = pick(v);
        if (p) clean[q.id] = p;
        else errors[q.id] = 'Choose one of the options.';
        break;
      }
      case 'checkbox': {
        const arr = Array.isArray(v) ? v.slice(0, 50) : [v];
        const picked = arr.map(pick);
        if (picked.some((x) => x == null)) errors[q.id] = 'One of the choices is not valid.';
        else clean[q.id] = Array.from(new Set(picked as string[]));
        break;
      }
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, clean };
}

/** Make sure a form definition coming from the builder is well-formed before it is saved. */
export function sanitiseQuestions(input: unknown): Question[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.slice(0, 100).flatMap((raw): Question[] => {
    const q = raw as Partial<Question>;
    if (!q || typeof q !== 'object' || !q.type || !(q.type in TYPE_LABEL)) return [];
    let id = typeof q.id === 'string' && /^[a-z0-9]{4,16}$/.test(q.id) ? q.id : uid();
    while (seen.has(id)) id = uid();
    seen.add(id);
    const options = hasOptions(q.type)
      ? Array.from(new Set((q.options ?? []).map((o) => String(o).trim().slice(0, 120)).filter((o) => o && o !== OTHER_LABEL))).slice(0, 60)
      : undefined;
    const scale = q.type === 'scale'
      ? { min: Math.min(Math.max(Math.round(q.scale?.min ?? 1), 0), 1), max: Math.min(Math.max(Math.round(q.scale?.max ?? 5), 2), 10), minLabel: (q.scale?.minLabel ?? '').slice(0, 40), maxLabel: (q.scale?.maxLabel ?? '').slice(0, 40) }
      : undefined;
    return [{ id, type: q.type, label: String(q.label ?? '').slice(0, 300), help: q.help ? String(q.help).slice(0, 500) : undefined, required: !!q.required, options, allowOther: hasOptions(q.type) ? !!q.allowOther : undefined, scale }];
  });
}
