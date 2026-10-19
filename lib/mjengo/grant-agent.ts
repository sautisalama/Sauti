import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { askAi } from '@/lib/mjengo/ai';
import { brandAsPrompt, loadBrandRow } from '@/lib/mjengo/brand';
import { gatherSources, type Asker } from '@/lib/mjengo/salama';
import { wordCount, type Criterion, type Draft, type Requirements, type Review, type Section } from '@/lib/mjengo/grant-agent-shared';

export * from '@/lib/mjengo/grant-agent-shared';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v: unknown): number | null => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const slug = (s: string, i: number) => `${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'section'}-${i + 1}`;

/** What a model returned, made safe: capped lengths and counts, ids made here, nothing else let through. */
export function cleanRequirements(raw: unknown): Requirements {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const sections = (Array.isArray(r.sections) ? r.sections : []).slice(0, 14).map((s, i): Section | null => {
    const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const title = str(o.title, 120);
    return title ? { id: slug(title, i), title, guidance: str(o.guidance, 600), wordLimit: num(o.wordLimit) } : null;
  }).filter((s): s is Section => !!s);
  const criteria = (Array.isArray(r.criteria) ? r.criteria : []).slice(0, 12).map((c): Criterion | null => {
    const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    const name = str(o.name, 120);
    return name ? { name, weight: num(o.weight), description: str(o.description, 400) } : null;
  }).filter((c): c is Criterion => !!c);
  return { sections, criteria, eligibility: list(r.eligibility, 12, 300), attachments: list(r.attachments, 12, 160), notes: str(r.notes, 800) };
}

/** Cut a text at a sentence end so it is within `limit` words. */
export function trimToWords(text: string, limit: number): string {
  if (wordCount(text) <= limit) return text;
  const words = text.trim().split(/\s+/).slice(0, limit).join(' ');
  const end = Math.max(words.lastIndexOf('. '), words.lastIndexOf('.\n'), words.endsWith('.') ? words.length - 1 : -1);
  return end > words.length * 0.6 ? words.slice(0, end + 1) : `${words.replace(/[,;:]$/, '')}.`;
}

const PROJECT = 'Sauti Salama is a survivor-led organisation in Kenya working on gender-based violence.';

/**
 * Read a funder's call (the page and any guideline documents) into what an application must contain: the sections
 * and their limits, how it is scored, who may apply and what must be attached. Only what the text says.
 */
export async function extractRequirements(input: { title: string; funder: string | null; pageText: string; docs: { name: string; text: string }[]; previous?: Requirements | null }): Promise<Requirements> {
  const sources = [input.pageText ? `THE FUNDER'S PAGE:\n${input.pageText.slice(0, 14_000)}` : '', ...input.docs.map((d) => `DOCUMENT "${d.name}":\n${d.text.slice(0, 9_000)}`)].filter(Boolean).join('\n\n');
  if (!sources) throw new Error('There is nothing to read yet. Add the funder\'s link to the grant, or attach its guidelines under Documents.');
  const raw = await askAi(
    `You read a funder's call for proposals and list what an application must contain. Reply with one JSON object: {"sections":[{"title":string,"guidance":string,"wordLimit":number|null}],"criteria":[{"name":string,"weight":number|null,"description":string}],"eligibility":[string],"attachments":[string],"notes":string}. "sections" are the parts the applicant writes, in the funder's order, with the funder's own guidance for each and its word or character limit as words (characters divided by 6) only when stated. "criteria" are how applications are scored, with the weight as a percentage only when stated. "eligibility" are the rules for who may apply. "attachments" are the documents that must accompany it. "notes" is anything else an applicant must not miss (deadline, format, language), in two sentences at most. Use only what the text says; if the funder gives no sections, propose the usual ones (summary, need, approach, outcomes, team, budget, risks) and say so in notes. Never invent limits, weights or rules.`,
    `Grant: ${input.title}${input.funder ? ` (funder: ${input.funder})` : ''}\n\n${sources}`,
    2800,
    { json: true, temperature: 0.1 },
  );
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { const m = /\{[\s\S]*\}/.exec(raw); parsed = m ? JSON.parse(m[0]) : null; }
  const req = cleanRequirements(parsed);
  if (!req.sections.length && !req.criteria.length) throw new Error('Nothing about what to submit could be found in that text. Try the funder\'s guidelines document instead.');
  return req;
}

/**
 * One section of the application, written for this funder: its guidance and limit, its scoring criteria, the funder's
 * past feedback, and what the organisation itself has on record (calls, documents, earlier work) with the facts only
 * from there. Anything the record does not say becomes "[to confirm: ...]" for a person to fill in.
 */
export async function draftSection(asker: Asker, input: { title: string; funder: string | null; description: string; req: Requirements; section: Section; instruction?: string; feedback?: string | null; others: { title: string; text: string }[]; timeline?: string }): Promise<{ text: string; sources: string[] }> {
  const { section, req } = input;
  const found = await gatherSources(asker, `${input.title} ${input.funder ?? ''} ${section.title} ${section.guidance}`, 6);
  const brand = brandAsPrompt(await loadBrandRow());
  const limit = section.wordLimit;
  const prompt = `${PROJECT} You write grant applications for the team, in a clear, honest, specific voice a programme officer trusts: concrete, no jargon, no filler, no flattery of the funder. Write ONLY the section asked for, as plain text with short paragraphs (and short bullets only if the funder's guidance asks for a list). Use facts only from the RECORD below and the brief; where a fact, figure, name or date is needed and the record does not give it, write [to confirm: what is needed] instead of inventing it. Do not state any number, percentage, trend or scale (such as "thousands" or "many") about the problem or the organisation's reach unless the RECORD gives it; keep general context to a sentence or two and build the section on the organisation's own facts. If the RECORD is thin, write a shorter section and mark what is missing rather than padding. Never identify survivors. ${limit ? `Stay within ${limit} words; aim for ${Math.round(limit * 0.9)}.` : 'Be as long as the funder\'s guidance needs and no longer.'}\n\nHow the organisation presents itself:\n${brand}`;
  const user = [
    `Grant: ${input.title}${input.funder ? `, funder ${input.funder}` : ''}`,
    input.description ? `What the grant is: ${input.description}` : '',
    req.notes ? `Funder's notes: ${req.notes}` : '',
    req.criteria.length ? `How it is scored:\n${req.criteria.map((c) => `- ${c.name}${c.weight ? ` (${c.weight}%)` : ''}: ${c.description}`).join('\n')}` : '',
    input.feedback ? `What this funder has said before (take it into account):\n${input.feedback.slice(0, 1500)}` : '',
    input.timeline ? `What the team has recorded about this grant so far:\n${input.timeline.slice(0, 2500)}` : '',
    found.length ? `RECORD (the organisation's own material):\n${found.map((s, i) => `[${i + 1}] (${s.kind}) ${s.title}\n${s.snippet}`).join('\n\n')}` : 'RECORD: nothing relevant was found, so every specific fact must be a [to confirm] placeholder.',
    input.others.length ? `Other sections already written (stay consistent, do not repeat them):\n${input.others.map((o) => `## ${o.title}\n${o.text.slice(0, 700)}`).join('\n\n')}` : '',
    `SECTION TO WRITE: ${section.title}\nFunder's guidance: ${section.guidance || '(none given)'}${limit ? `\nLimit: ${limit} words` : ''}`,
    input.instruction ? `Extra instruction from the team: ${input.instruction.slice(0, 500)}` : '',
  ].filter(Boolean).join('\n\n');
  let text = await askAi(prompt, user, Math.min(3500, Math.max(500, (limit ?? 400) * 3)), { temperature: 0.4 });
  if (limit && wordCount(text) > limit) {
    // Over the limit: ask once to tighten without losing the facts, then cut at a sentence if it is still over.
    text = await askAi(`Shorten this application text to at most ${limit} words. Keep every specific fact and every [to confirm] placeholder. Plain text only.`, text, Math.min(3500, limit * 3), { temperature: 0.2 }).catch(() => text);
    text = trimToWords(text, limit);
  }
  return { text: text.trim(), sources: found.map((s) => s.title) };
}

/**
 * Review the whole draft before it goes: the funder's own checks done mechanically (every section written, within its
 * limit, no [to confirm] left, attachments in place, eligibility noted) and each scoring criterion marked honestly.
 */
export async function reviewApplication(input: { title: string; funder: string | null; req: Requirements; drafts: Record<string, Draft>; attached: string[] }): Promise<Review> {
  const { req, drafts } = input;
  const checks: Review['checks'] = [];
  for (const s of req.sections) {
    const d = drafts[s.id]?.text ?? '';
    const n = wordCount(d);
    if (!n) checks.push({ ok: false, text: `${s.title} has not been written.` });
    else {
      if (s.wordLimit && n > s.wordLimit) checks.push({ ok: false, text: `${s.title} is ${n - s.wordLimit} words over its limit (${n} of ${s.wordLimit}).` });
      const open = (d.match(/\[to confirm/gi) ?? []).length;
      if (open) checks.push({ ok: false, text: `${s.title} still has ${open} [to confirm] ${open === 1 ? 'placeholder' : 'placeholders'}.` });
      if (!(s.wordLimit && n > s.wordLimit) && !open) checks.push({ ok: true, text: `${s.title} is written${s.wordLimit ? ` (${n} of ${s.wordLimit} words)` : ''}.` });
    }
  }
  const have = input.attached.map((a) => a.toLowerCase());
  for (const a of req.attachments) {
    const words = a.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const hit = have.some((h) => words.length > 0 && words.filter((w) => h.includes(w)).length >= Math.max(1, Math.ceil(words.length / 2)));
    checks.push({ ok: hit, text: hit ? `${a} is attached.` : `${a} is not attached yet.` });
  }
  if (req.eligibility.length) checks.push({ ok: false, text: `Confirm eligibility yourself: ${req.eligibility.slice(0, 4).join('; ')}.` });

  const written = req.sections.filter((s) => wordCount(drafts[s.id]?.text ?? '') > 0);
  let criteria: Review['criteria'] = [];
  if (req.criteria.length && written.length) {
    const raw = await askAi(
      `You are a strict, fair reviewer scoring a grant application against the funder's criteria. Reply with one JSON object {"criteria":[{"name":string,"score":number,"feedback":string}]} with one entry per criterion in the order given. "score" is 0 to 5 (0 not addressed, 3 adequate, 5 outstanding). "feedback" is one or two plain sentences: what works and the single most useful improvement. A placeholder like [to confirm] is a gap, not evidence. Judge only what is written; do not reward length.`,
      `Grant: ${input.title}${input.funder ? `, funder ${input.funder}` : ''}\n\nCRITERIA:\n${req.criteria.map((c, i) => `${i + 1}. ${c.name}${c.weight ? ` (${c.weight}%)` : ''}: ${c.description}`).join('\n')}\n\nAPPLICATION:\n${written.map((s) => `## ${s.title}\n${drafts[s.id].text.slice(0, 3000)}`).join('\n\n')}`,
      1500,
      { json: true, temperature: 0.2 },
    );
    try {
      const j = JSON.parse(raw) as { criteria?: { name?: unknown; score?: unknown; feedback?: unknown }[] };
      criteria = req.criteria.map((c, i) => {
        const hit = j.criteria?.find((x) => str(x.name, 120).toLowerCase() === c.name.toLowerCase()) ?? j.criteria?.[i];
        const score = Math.max(0, Math.min(5, Math.round(Number(hit?.score) || 0)));
        return { name: c.name, score, max: 5, feedback: str(hit?.feedback, 400) || 'No feedback came back for this criterion.' };
      });
    } catch { criteria = []; }
  }
  const weights = req.criteria.map((c) => c.weight ?? 1);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const overall = criteria.length && totalW ? Math.round((criteria.reduce((a, c, i) => a + (c.score / c.max) * weights[i], 0) / totalW) * 100) : null;
  return { at: new Date().toISOString(), overall, criteria, checks };
}

/** The application as a Word file: the title, then each written section under its heading. */
export async function applicationDocx(title: string, funder: string | null, req: Requirements, drafts: Record<string, Draft>): Promise<Uint8Array> {
  const children: Paragraph[] = [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(title)] })];
  if (funder) children.push(new Paragraph({ children: [new TextRun({ text: `Application to ${funder}`, italics: true })] }));
  for (const s of req.sections) {
    const t = drafts[s.id]?.text?.trim();
    if (!t) continue;
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(s.title)] }));
    for (const block of t.split(/\n{2,}/)) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every((l) => /^[-*•]\s+/.test(l))) {
        for (const l of lines) children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(l.replace(/^[-*•]\s+/, ''))] }));
      } else {
        children.push(new Paragraph({ spacing: { after: 160 }, children: lines.flatMap((l, i) => (i ? [new TextRun({ text: l, break: 1 })] : [new TextRun(l)])) }));
      }
    }
  }
  return new Uint8Array(await Packer.toBuffer(new Document({ sections: [{ children }] })));
}
