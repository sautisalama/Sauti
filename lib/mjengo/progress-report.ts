import { askAi } from '@/lib/mjengo/ai';
import { brandAsPrompt, loadBrandRow } from '@/lib/mjengo/brand';
import { entitiesFor, entityText, type EntityKind } from '@/lib/mjengo/entity-view';
import { timelineFor } from '@/lib/mjengo/timeline';
import { applicationDocx } from '@/lib/mjengo/grant-agent';
import { looseAdmin } from '@/lib/loose-db';
import type { Draft, Requirements } from '@/lib/mjengo/grant-agent-shared';

export const REPORT_SECTIONS = ['Summary', 'Progress against the plan', 'Key activities and results', 'Challenges and how we responded', 'Next steps', 'Financial note'] as const;

/** The report as the sections of a Word file. */
export function reportRequirements(): Requirements {
  return { sections: REPORT_SECTIONS.map((title, i) => ({ id: `r${i + 1}`, title, guidance: '', wordLimit: null })), criteria: [], eligibility: [], attachments: [], notes: '' };
}

/**
 * A progress report for a record, written from what the team has recorded and nothing else: its timeline over the
 * period (status changes, completed to-dos, calls and what was decided in them, documents), what is still to do, and
 * the figures on the record. Anything the record does not say is left as "[to confirm: ...]" for a person to fill in.
 */
export async function draftProgressReport(asker: { id: string; email: string }, kind: EntityKind, id: string, months = 6): Promise<{ title: string; text: Record<string, string>; docx: Uint8Array; words: number }> {
  const entity = (await entitiesFor(asker, [kind])).find((e) => e.id === id);
  if (!entity) throw new Error('That does not exist, or it is private to someone else.');
  const tl = await timelineFor(asker, kind, id);
  const since = new Date(Date.now() - months * 30 * 86400_000).toISOString();
  const past = tl.items.filter((i) => !i.upcoming && i.at >= since && i.kind !== 'added');
  const coming = tl.items.filter((i) => i.upcoming).slice(0, 12);
  const { data: open } = await looseAdmin().from('mjengo_todos').select('title, due_date, status').eq('entity_type', kind).eq('entity_id', id).neq('status', 'done').limit(25);
  const line = (i: { at: string; title: string; detail?: string; who?: string | null }) => `- ${i.at.slice(0, 10)} ${i.title}${i.detail ? `: ${i.detail}` : ''}${i.who ? ` (${i.who})` : ''}`;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = ((open ?? []) as { title: string; due_date: string | null }[]).filter((t) => t.due_date && t.due_date < today);

  const raw = await askAi(
    `You write progress reports for Sauti Salama, a survivor-led organisation in Kenya working on gender-based violence, to send to a funder or partner. Reply with one JSON object whose keys are exactly: ${REPORT_SECTIONS.map((s) => `"${s}"`).join(', ')}, each a plain-text string (short paragraphs; short "- " bullets only for lists of activities). Use ONLY the facts given below. Where a number, name, date or result is needed and not given, write [to confirm: what is needed] instead of inventing it. Be honest about delays and gaps (they belong under challenges). Never identify survivors. "Financial note": give figures only if they appear in the record, otherwise say what the team must add. Keep the whole report under 450 words.\n\nHow the organisation presents itself:\n${brandAsPrompt(await loadBrandRow())}`,
    `Report for: ${entity.title} (${kind}). Period: the last ${months} months, to ${today}.\n\nThe record:\n${entityText(entity).slice(0, 1800)}\n\nWhat happened in the period:\n${past.length ? past.slice(0, 40).map(line).join('\n') : '(nothing is recorded)'}\n\nStill coming up:\n${coming.length ? coming.map(line).join('\n') : '(nothing is scheduled)'}\n\nOverdue to-dos: ${overdue.length ? overdue.map((t) => `${t.title} (due ${t.due_date})`).join('; ') : 'none'}`,
    1800,
    { json: true, temperature: 0.3 },
  );
  let j: Record<string, unknown> = {};
  try { j = JSON.parse(raw); } catch { const m = /\{[\s\S]*\}/.exec(raw); if (m) j = JSON.parse(m[0]); }
  const text: Record<string, string> = {};
  for (const s of REPORT_SECTIONS) text[s] = typeof j[s] === 'string' ? (j[s] as string).trim().slice(0, 4000) : '';
  const words = Object.values(text).join(' ').split(/\s+/).filter(Boolean).length;
  if (!words) throw new Error('The report could not be written. Try again in a moment.');
  const req = reportRequirements();
  const drafts: Record<string, Draft> = Object.fromEntries(req.sections.map((s) => [s.id, { text: text[s.title], updatedAt: new Date().toISOString() }]));
  const title = `${entity.title} progress report`;
  return { title, text, docx: await applicationDocx(title, null, req, drafts), words };
}
