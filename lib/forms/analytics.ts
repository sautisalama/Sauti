import { humanizeOption, toOptionValue } from '@/lib/other-option';
import type { Answer, Question } from './schema';
import { hasOptions } from './schema';

export interface ResponseLike {
  answers: Record<string, Answer | undefined>;
  created_at: string;
}

export interface Tally {
  value: string;
  label: string;
  count: number;
  /** Share of the people who answered this question (not of all responses). */
  pct: number;
}

export interface QuestionSummary {
  question: Question;
  answered: number;
  skipped: number;
  /** choice / dropdown / checkbox / scale: how often each value was picked. */
  tallies?: Tally[];
  /** scale / number */
  stats?: { avg: number; min: number; max: number };
  /** short / paragraph / email / date: the newest answers. */
  samples?: string[];
}

const present = (v: Answer | undefined): v is Exclude<Answer, null> => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);

/**
 * Turn raw responses into per-question summaries. Choices that people typed under "Other" are grouped
 * case-insensitively with the same spelling, so "Kikuyu" and "kikuyu " count together.
 */
export function summarise(questions: Question[], responses: ResponseLike[]): QuestionSummary[] {
  return questions.map((q) => {
    const answers = responses.map((r) => r.answers[q.id]).filter(present);
    const base: QuestionSummary = { question: q, answered: answers.length, skipped: responses.length - answers.length };

    if (hasOptions(q.type)) {
      const counts = new Map<string, number>();
      for (const a of answers) {
        for (const v of Array.isArray(a) ? a : [String(a)]) {
          const key = q.options?.includes(v) ? v : toOptionValue(v) || v;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      const listed = (q.options ?? []).map((o) => ({ value: o, label: o, count: counts.get(o) ?? 0 }));
      const typed = [...counts.entries()].filter(([k]) => !q.options?.includes(k)).map(([k, c]) => ({ value: k, label: `${humanizeOption(k)} (other)`, count: c }));
      base.tallies = [...listed, ...typed.sort((a, b) => b.count - a.count)].map((t) => ({ ...t, pct: answers.length ? Math.round((t.count / answers.length) * 100) : 0 }));
    } else if (q.type === 'scale') {
      const nums = answers.map(Number).filter(Number.isFinite);
      const { min = 1, max = 5 } = q.scale ?? {};
      const counts = new Map<number, number>();
      nums.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));
      base.tallies = Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => ({ value: String(n), label: String(n), count: counts.get(n) ?? 0, pct: nums.length ? Math.round(((counts.get(n) ?? 0) / nums.length) * 100) : 0 }));
      if (nums.length) base.stats = { avg: nums.reduce((s, n) => s + n, 0) / nums.length, min: Math.min(...nums), max: Math.max(...nums) };
    } else if (q.type === 'number') {
      const nums = answers.map(Number).filter(Number.isFinite);
      if (nums.length) base.stats = { avg: nums.reduce((s, n) => s + n, 0) / nums.length, min: Math.min(...nums), max: Math.max(...nums) };
    } else {
      base.samples = answers.slice(0, 8).map(String);
    }
    return base;
  });
}

/** Responses per day for the last `days` days (oldest first), including empty days. */
export function perDay(responses: ResponseLike[], days = 30): { date: string; count: number }[] {
  const out = new Map<string, number>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of responses) {
    const k = r.created_at.slice(0, 10);
    if (out.has(k)) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return [...out].map(([date, count]) => ({ date, count }));
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v);
  // Guard against spreadsheet formula injection from public input.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV (with BOM so Excel reads UTF-8) of every response, one column per question. */
export function toCsv(questions: Question[], responses: (ResponseLike & { respondent_email?: string | null })[], collectEmail: boolean): string {
  const header = ['Submitted', ...(collectEmail ? ['Email'] : []), ...questions.map((q) => q.label || q.type)];
  const rows = responses.map((r) => [
    r.created_at,
    ...(collectEmail ? [r.respondent_email ?? ''] : []),
    ...questions.map((q) => {
      const v = r.answers[q.id];
      return Array.isArray(v) ? v.map((x) => (q.options?.includes(x) ? x : humanizeOption(x))) : typeof v === 'string' && hasOptions(q.type) && !q.options?.includes(v) ? humanizeOption(v) : v;
    }),
  ]);
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
