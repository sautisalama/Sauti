import { looseAdmin } from '@/lib/loose-db';
import { askAi } from '@/lib/mjengo/ai';
import { extractText } from '@/lib/mjengo/files-text';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import { may, permissionsFor, type ModuleKey } from '@/lib/access/permissions';

/**
 * Salama, the team's AI member. This is her one brain: she finds what the asker may see across calls, documents,
 * to-dos, events, grants, opportunities and projects, and answers from that with numbered sources. She never
 * answers from memory about the organisation: if the sources do not say it, she says so.
 */
export { SALAMA, addressedToSalama } from '@/lib/mjengo/salama-shared';

export type SourceKind = 'call' | 'document' | 'todo' | 'event' | 'grant' | 'opportunity' | 'project' | 'now' | 'comment';
export interface Source { n: number; kind: SourceKind; title: string; snippet: string; link: string | null }
export interface Asker { id: string; email: string }

const STOP = new Set('the and for with that this what when where which who whom whose was were are is be been being have has had did does do can could should would will shall may might from about into over under after before again then than also just only some any all each other our your their his her its not but how why who our out off per via yes please tell show give find let know need want like get got any'.split(' '));

/** The words worth searching for in a question. */
export function termsOf(q: string): string[] {
  const words = q.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  return [...new Set(words)].slice(0, 8);
}

const hits = (text: string, terms: string[]) => { const t = text.toLowerCase(); return terms.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0); };

/** The part of a text that says most about the question: a couple of windows around the best lines. */
export function passage(text: string, terms: string[], width = 380): string {
  const clean = text.replace(/\r/g, '').trim();
  if (!clean) return '';
  const lines = clean.split(/\n+/).flatMap((l) => (l.length > 400 ? l.match(/.{1,400}(\s|$)/g) ?? [l] : [l]));
  const scored = lines.map((l, i) => ({ l, i, s: hits(l, terms) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 2).sort((a, b) => a.i - b.i);
  const out = (scored.length ? scored.map((x) => x.l) : lines.slice(0, 2)).join(' … ').replace(/\s+/g, ' ').trim();
  return out.length > width * 2 ? `${out.slice(0, width * 2)}…` : out;
}

const ilike = (cols: string[], terms: string[]) => cols.flatMap((c) => terms.map((t) => `${c}.ilike.%${t.replace(/[%,()]/g, ' ')}%`)).join(',');

interface Raw { kind: SourceKind; title: string; text: string; link: string | null; score: number }

/** What the asker may see that bears on the question, best first. Each part is gated by the asker's own access. */
export async function gatherSources(asker: Asker, question: string, max = 8): Promise<Source[]> {
  const terms = termsOf(question);
  if (!terms.length) return [];
  const perms = await permissionsFor(asker.id, asker.email);
  const db = looseAdmin();
  const can = (k: ModuleKey) => may(perms, k);
  const found: Raw[] = [];

  const tasks: Promise<void>[] = [];

  if (can('meet')) tasks.push((async () => {
    const { data } = await db.from('mjengo_meetings').select('code, title, notes, transcript, created_at').order('created_at', { ascending: false }).limit(60);
    for (const m of (data ?? []) as { code: string; title: string | null; notes: string | null; transcript: { name: string; text: string }[] | null; created_at: string }[]) {
      const said = (Array.isArray(m.transcript) ? m.transcript : []).map((l) => `${l.name}: ${l.text}`).join('\n');
      const body = `${m.notes ?? ''}\n${said}`;
      const s = hits(`${m.title ?? ''} ${body}`, terms);
      if (s) found.push({ kind: 'call', title: `${m.title || 'Call'} (${m.created_at.slice(0, 10)})`, text: passage(m.notes && hits(m.notes, terms) ? m.notes : body, terms), link: `/dashboard/mjengo/meetings?code=${m.code}`, score: s + 0.5 });
    }
  })());

  if (can('files')) tasks.push((async () => {
    const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(asker.email)]);
    const mine = [...ix.files.values()].filter((f) => atLeast(levelFor(ix, asker.id, 'file', f.id, oversight), 'view'));
    const readable = (f: { name: string; mime: string | null }) => /\.(pdf|docx|txt|md|csv|json|html)$/i.test(f.name) || (f.mime ?? '').startsWith('text/');
    const byName = mine.map((f) => ({ f, s: hits(`${f.name} ${(f.tags ?? []).join(' ')}`, terms) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.f);
    // Names rarely hold the answer, so a few of the most recently changed documents are read as well.
    const recent = mine.filter(readable).sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).slice(0, 4);
    const pick = [...new Map([...byName, ...recent].map((f) => [f.id, f])).values()].filter(readable).slice(0, 6);
    await Promise.all(pick.map(async (f) => {
      const text = await extractText(f.storage_path, f.name, f.mime, 12000).catch(() => '');
      const s = hits(`${f.name} ${text}`, terms);
      if (s) found.push({ kind: 'document', title: f.name, text: passage(text, terms), link: /\.docx$/i.test(f.name) ? `/dashboard/mjengo/documents/editor?file=${f.id}` : '/dashboard/mjengo/files', score: s + (byName.some((b) => b.id === f.id) ? 1 : 0) });
    }));
  })());

  const table = (key: ModuleKey, name: string, cols: string, searchCols: string[], kind: SourceKind, title: (r: Record<string, unknown>) => string, text: (r: Record<string, unknown>) => string, link: string) => {
    if (!can(key)) return;
    tasks.push((async () => {
      const { data } = await db.from(name).select(cols).or(ilike(searchCols, terms)).limit(6);
      for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
        const t = text(r);
        found.push({ kind, title: title(r), text: passage(t, terms), link, score: hits(`${title(r)} ${t}`, terms) });
      }
    })());
  };
  const s = (v: unknown) => (v == null ? '' : String(v));
  table('todos', 'mjengo_todos', 'title, notes, status, due_date', ['title', 'notes'], 'todo', (r) => s(r.title), (r) => `${s(r.title)}. Status ${s(r.status)}${r.due_date ? `, due ${s(r.due_date)}` : ''}. ${s(r.notes)}`, '/dashboard/mjengo/todos');
  table('calendar', 'mjengo_events', 'title, description, location, starts_at', ['title', 'description', 'location'], 'event', (r) => `${s(r.title)} (${s(r.starts_at).slice(0, 10)})`, (r) => `${s(r.title)} on ${s(r.starts_at).slice(0, 16).replace('T', ' ')}${r.location ? ` at ${s(r.location)}` : ''}. ${s(r.description)}`, '/dashboard/mjengo/calendar');
  table('grants', 'mjengo_grants', 'title, funder, status, amount, currency, deadline, description, notes', ['title', 'funder', 'description', 'notes'], 'grant', (r) => s(r.title), (r) => `${s(r.title)} from ${s(r.funder) || 'a funder'}. Status ${s(r.status)}${r.amount ? `, ${s(r.currency)} ${s(r.amount)}` : ''}${r.deadline ? `, deadline ${s(r.deadline)}` : ''}. ${s(r.description)} ${s(r.notes)}`, '/dashboard/mjengo/grants');
  table('opportunities', 'mjengo_opportunities', 'title, organisation, kind, status, value, currency, deadline, description, notes', ['title', 'organisation', 'description', 'notes'], 'opportunity', (r) => s(r.title), (r) => `${s(r.title)} (${s(r.kind)}) with ${s(r.organisation) || 'an organisation'}. Status ${s(r.status)}${r.deadline ? `, deadline ${s(r.deadline)}` : ''}. ${s(r.description)} ${s(r.notes)}`, '/dashboard/mjengo/opportunities');
  table('projects', 'mjengo_projects', 'name, status, progress, start_date, end_date, description, notes', ['name', 'description', 'notes'], 'project', (r) => s(r.name), (r) => `${s(r.name)}. Status ${s(r.status)}, ${s(r.progress)}% done${r.end_date ? `, ends ${s(r.end_date)}` : ''}. ${s(r.description)} ${s(r.notes)}`, '/dashboard/mjengo/projects');

  await Promise.all(tasks.map((t) => t.catch(() => undefined)));
  return found
    .filter((f) => f.text)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((f, i) => ({ n: i + 1, kind: f.kind, title: f.title, snippet: f.text, link: f.link }));
}

export interface Answer { text: string; sources: Source[] }

const PERSONA = `You are Salama, a member of the team at Sauti Salama, a survivor-led organisation in Kenya working on gender-based violence. You work beside the team: calm, warm, direct and brief. You answer from the SOURCES and the LIVE context given, never from memory about the organisation. Cite sources as [1], [2] right after the claim they support. If the sources do not contain the answer, say plainly that you found nothing about it in the team's workspace and invite a more specific question; do not name tools, systems or departments you were not told about; never invent names, numbers, dates or decisions. Never reveal identifying details of survivors. Answer in the language of the question. Keep answers under 150 words unless asked for more; use short bullets for lists.`;

/**
 * Answer one question as Salama. `live` is what is happening right now (a call's transcript, the passage a
 * comment is on) and counts as context, not as a numbered source. Only the sources she actually cites are returned.
 */
export async function answerAsSalama(asker: Asker, question: string, opts: { live?: string; liveLabel?: string; history?: { role: 'user' | 'assistant'; content: string }[]; people?: string[] } = {}): Promise<Answer> {
  const q = question.trim().slice(0, 1000);
  if (q.length < 2) throw new Error('Ask Salama a question.');
  const sources = await gatherSources(asker, q);
  const srcText = sources.length ? sources.map((s) => `[${s.n}] (${s.kind}) ${s.title}\n${s.snippet}`).join('\n\n') : '(nothing relevant was found that this person can see)';
  const hist = (opts.history ?? []).slice(-6).map((m) => `${m.role === 'user' ? 'Asker' : 'Salama'}: ${m.content.slice(0, 600)}`).join('\n');
  const raw = await askAi(
    PERSONA,
    `${opts.live ? `${opts.liveLabel ?? 'LIVE'}:\n${opts.live.slice(0, 12_000)}\n\n` : ''}${opts.people?.length ? `People here: ${opts.people.join(', ')}.\n\n` : ''}SOURCES:\n${srcText}\n\n${hist ? `Conversation so far:\n${hist}\n\n` : ''}Question: ${q}`,
    700,
    { temperature: 0.3 },
  );
  const cited = new Set([...raw.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1])));
  return { text: raw, sources: sources.filter((s) => cited.has(s.n)) };
}
