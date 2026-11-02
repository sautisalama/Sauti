'use server';

import { guard } from '@/lib/action-result';
import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { requireModule, type Level, type ModuleKey } from '@/lib/access/permissions';
import { entitiesFor, entityText, type EntityLite } from '@/lib/mjengo/entity-view';
import { fetchPageOrPdf, pageText } from '@/lib/mjengo/safe-fetch';
import { extractText, readableFile, textFromBytes } from '@/lib/mjengo/files-text';
import { saveToVault, linkFileToRecord } from '@/lib/mjengo/vault-save';
import { gatherSources } from '@/lib/mjengo/salama';
import { askAi } from '@/lib/mjengo/ai';
import { markdownDocx } from '@/lib/mjengo/md-docx';
import { driveToken } from '@/lib/google-drive';
import { fileInfo } from '@/lib/google-drive-search';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import { documentPreview, type DocPreview } from '@/app/actions/mjengo-attach';

type Kind = 'grant' | 'opportunity';
const MODULE_OF: Record<Kind, ModuleKey> = { grant: 'grants', opportunity: 'opportunities' };
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ID = /^[0-9a-f-]{36}$/i;

export interface ContextItem {
  id: string;
  kind: 'link' | 'skill' | 'note' | 'file' | 'drive';
  title: string;
  body: string;
  url: string | null;
  vaultFileId: string | null;
  driveFileId: string | null;
  include: boolean;
  mime: string | null;
  size: number | null;
  at: string;
}
export interface AiInfo { available: boolean; models: { id: string; label: string }[]; defaultModel: string }
export interface Workbench { instructions: string; items: ContextItem[]; ai: AiInfo }
export interface Suggestion { fileId: string; name: string; why: string; size: number; folder: string | null }
export interface AgentResult { docId: string; fileId: string; name: string; text: string; gaps: number; usedContext: string[]; model: string }

async function open(kind: string, id: string, need: Level = 'view') {
  if (kind !== 'grant' && kind !== 'opportunity') throw new Error('The application workspace works on grants and opportunities.');
  if (!ID.test(id)) throw new Error('That could not be found.');
  const a = await requireModule(MODULE_OF[kind], need);
  const actor = { id: a.id, email: a.email };
  const entity = (await entitiesFor(actor, [kind])).find((e) => e.id === id);
  if (!entity) throw new Error('That does not exist, or it is private to someone else.');
  return { actor, entity: entity as EntityLite, kind: kind as Kind };
}

/** The AI models people can pick from: set in OPENROUTER_MODELS as "id|Label,id|Label", else the one the site uses. */
function aiInfo(): AiInfo {
  const def = process.env.OPENROUTER_MODEL || 'qwen/qwen3.7-flash';
  const listed = (process.env.OPENROUTER_MODELS ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [id, label] = s.split('|'); return { id: id.trim(), label: (label ?? id).trim() }; });
  const models = listed.length ? listed : [{ id: def, label: 'Standard' }];
  if (!models.some((m) => m.id === def)) models.unshift({ id: def, label: 'Standard' });
  return { available: !!process.env.OPENROUTER_API_KEY, models, defaultModel: def };
}

const clip = (s: string, n: number) => s.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);

type Row = { id: string; kind: ContextItem['kind'] | 'instruction'; title: string; body: string; url: string | null; vault_file_id: string | null; drive_file_id: string | null; include: boolean; created_at: string };

async function rows(kind: Kind, id: string): Promise<Row[]> {
  const { data } = await looseAdmin().from('mjengo_context_items').select('id, kind, title, body, url, vault_file_id, drive_file_id, include, created_at').eq('entity_type', kind).eq('entity_id', id).order('created_at');
  return (data ?? []) as Row[];
}

async function workbench_(kind: string, id: string): Promise<Workbench> {
  const { actor, kind: k } = await open(kind, id);
  const all = await rows(k, id);
  const ix = await loadIndex();
  const oversight = await oversightFor(actor.email);
  const items = all.filter((r) => r.kind !== 'instruction').flatMap((r): ContextItem[] => {
    let mime: string | null = null;
    let size: number | null = null;
    let title = r.title;
    if (r.vault_file_id) {
      const f = ix.files.get(r.vault_file_id);
      if (!f || !atLeast(levelFor(ix, actor.id, 'file', f.id, oversight), 'view')) return [];
      mime = f.mime; size = f.size; title = f.name;
    }
    return [{ id: r.id, kind: r.kind as ContextItem['kind'], title, body: r.body, url: r.url, vaultFileId: r.vault_file_id, driveFileId: r.drive_file_id, include: r.include, mime, size, at: r.created_at }];
  });
  return { instructions: all.find((r) => r.kind === 'instruction')?.body ?? '', items, ai: aiInfo() };
}
export const getWorkbench = guard(workbench_);

async function saveInstructions_(kind: string, id: string, text: string): Promise<void> {
  const { actor, kind: k } = await open(kind, id, 'write');
  const body = clip(String(text ?? ''), 4000);
  const db = looseAdmin();
  const { data } = await db.from('mjengo_context_items').select('id').eq('entity_type', k).eq('entity_id', id).eq('kind', 'instruction').maybeSingle();
  if (data) await db.from('mjengo_context_items').update({ body, updated_at: new Date().toISOString() }).eq('id', data.id);
  else if (body) await db.from('mjengo_context_items').insert({ entity_type: k, entity_id: id, kind: 'instruction', title: 'Instructions', body, created_by: actor.id });
}
export const saveInstructions = guard(saveInstructions_);

export type AddInput =
  | { type: 'link'; url: string }
  | { type: 'skill'; title?: string; body: string }
  | { type: 'note'; title?: string; body: string }
  | { type: 'file'; fileId: string }
  | { type: 'drive'; driveId?: string; link?: string; name?: string };

/** One thing added for the agent to read. A file stays where it is; only a link to it is kept. */
async function add_(kind: string, id: string, input: AddInput): Promise<void> {
  const { actor, kind: k } = await open(kind, id, 'write');
  const db = looseAdmin();
  const base = { entity_type: k, entity_id: id, created_by: actor.id };
  if (input.type === 'link') {
    const raw = input.url.trim();
    if (!/^https?:\/\//i.test(raw)) throw new Error('Paste a full web address that starts with https://');
    let title = new URL(raw).hostname.replace(/^www\./, '');
    let body = '';
    try {
      const p = await fetchPageOrPdf(raw);
      if (p.kind === 'html') {
        title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(p.html)?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 140) || title;
        body = clip(pageText(p.html), 9000);
      } else {
        body = clip(await textFromBytes(p.bytes, 'page.pdf', 'application/pdf', 9000), 9000);
      }
    } catch { /* the link is kept even when the page could not be read; the agent is told so */ }
    await db.from('mjengo_context_items').insert({ ...base, kind: 'link', title, body, url: raw });
  } else if (input.type === 'skill' || input.type === 'note') {
    const body = clip(input.body, 6000);
    if (body.length < 2) throw new Error(input.type === 'skill' ? 'Write the skill, for example "Google Tag Manager and Microsoft Clarity".' : 'Write something for the agent to know.');
    const title = (input.title ?? '').trim().slice(0, 80) || (input.type === 'skill' ? 'Skills' : body.split('\n')[0].slice(0, 60));
    await db.from('mjengo_context_items').insert({ ...base, kind: input.type, title, body });
  } else if (input.type === 'file') {
    if (!ID.test(input.fileId)) throw new Error('That file could not be found.');
    const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(actor.email)]);
    const f = ix.files.get(input.fileId);
    if (!f || !atLeast(levelFor(ix, actor.id, 'file', f.id, oversight), 'view')) throw new Error('You do not have access to that file.');
    const { data: have } = await db.from('mjengo_context_items').select('id').eq('entity_type', k).eq('entity_id', id).eq('vault_file_id', f.id).maybeSingle();
    if (!have) await db.from('mjengo_context_items').insert({ ...base, kind: 'file', title: f.name, vault_file_id: f.id });
  } else {
    let driveId = (input.driveId ?? '').trim();
    const pasted = (input.link ?? '').trim();
    if (!driveId && pasted) {
      const m = pasted.match(/^https:\/\/(?:docs|drive|sheets|slides)\.google\.com\/.*?(?:\/d\/|[?&]id=)([A-Za-z0-9_-]{10,})/i);
      if (!m) throw new Error('That does not look like a Google Drive link.');
      driveId = m[1];
    }
    if (!/^[A-Za-z0-9_-]{10,}$/.test(driveId)) throw new Error('Choose a file from Google Drive.');
    const token = await driveToken(actor.id);
    const info = token ? await fileInfo(token, driveId) : null;
    await db.from('mjengo_context_items').insert({ ...base, kind: 'drive', title: (info?.name ?? input.name ?? 'Google Drive file').slice(0, 200), url: info?.link ?? (pasted || `https://drive.google.com/file/d/${driveId}/view`), drive_file_id: driveId });
  }
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.context.added', targetType: k, targetId: id, targetLabel: input.type });
}
export const addContext = guard(add_);

async function update_(kind: string, id: string, itemId: string, patch: { include?: boolean; title?: string; body?: string }): Promise<void> {
  const { kind: k } = await open(kind, id, 'write');
  if (!ID.test(itemId)) throw new Error('That could not be found.');
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.include === 'boolean') row.include = patch.include;
  if (typeof patch.title === 'string') row.title = patch.title.trim().slice(0, 140);
  if (typeof patch.body === 'string') row.body = clip(patch.body, 9000);
  await looseAdmin().from('mjengo_context_items').update(row).eq('id', itemId).eq('entity_type', k).eq('entity_id', id);
}
export const updateContext = guard(update_);

async function remove_(kind: string, id: string, itemId: string): Promise<void> {
  const { kind: k } = await open(kind, id, 'write');
  if (!ID.test(itemId)) throw new Error('That could not be found.');
  await looseAdmin().from('mjengo_context_items').delete().eq('id', itemId).eq('entity_type', k).eq('entity_id', id);
}
export const removeContext = guard(remove_);

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'you', 'your', 'our', 'job', 'role', 'fund', 'call', 'application', 'apply', 'new', 'foundation', 'organisation', 'organization', 'programme', 'program', 'global', 'international']);
const PAPERWORK = /\b(cv|resume|curriculum|cover.?letter|portfolio|profile|bio|brochure|annual.?report|budget|capacity|proposal|reference|certificate|template)\b/i;

/** Files in the vault that look useful for this application. The person decides on each one; nothing is added by itself. */
async function suggest_(kind: string, id: string): Promise<Suggestion[]> {
  const { actor, entity, kind: k } = await open(kind, id);
  const [ix, oversight, items, docs] = await Promise.all([
    loadIndex(),
    oversightFor(actor.email),
    rows(k, id),
    looseAdmin().from('mjengo_documents').select('vault_file_id').eq('entity_type', k).eq('entity_id', id),
  ]);
  const taken = new Set<string>([...items.map((r) => r.vault_file_id).filter(Boolean) as string[], ...(((docs.data ?? []) as { vault_file_id: string | null }[]).map((d) => d.vault_file_id).filter(Boolean) as string[])]);
  const words = `${entity.title} ${entityText(entity).slice(0, 600)}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const terms = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([w]) => w);
  const out: (Suggestion & { score: number })[] = [];
  for (const f of ix.files.values()) {
    if (taken.has(f.id) || !atLeast(levelFor(ix, actor.id, 'file', f.id, oversight), 'view')) continue;
    const hay = `${f.name} ${(f.tags ?? []).join(' ')}`.toLowerCase();
    const hits = terms.filter((t) => hay.includes(t));
    const paper = PAPERWORK.test(f.name) || (f.tags ?? []).some((t) => PAPERWORK.test(t));
    if (!hits.length && !paper) continue;
    const score = hits.length * 3 + (paper ? 2 : 0) + (f.owner_id === actor.id ? 1 : 0);
    out.push({ fileId: f.id, name: f.name, size: f.size, folder: f.folder_id ? ix.folders.get(f.folder_id)?.name ?? null : null, why: hits.length ? `Matches ${hits.slice(0, 3).join(', ')}` : 'Application paperwork', score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8).map(({ score: _s, ...x }) => x);
}
export const suggestContext = guard(suggest_);

/** A vault file in the form the preview window shows (access checked). */
async function fileSource_(fileId: string): Promise<DocPreview> {
  const a = await requireModule('opportunities', 'view');
  if (!ID.test(fileId)) throw new Error('That file could not be found.');
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(a.email)]);
  const f = ix.files.get(fileId);
  if (!f) throw new Error('That file no longer exists in Files.');
  if (!atLeast(levelFor(ix, a.id, 'file', f.id, oversight), 'view')) throw new Error('You do not have access to that file.');
  const db = looseAdmin();
  const sign = async (download?: string) => {
    const { data, error } = await db.storage.from('mjengo-docs').createSignedUrl(f.storage_path, 600, download ? { download } : undefined);
    if (error || !data) throw new Error('Could not open the file.');
    return data.signedUrl;
  };
  return { name: f.name, mime: f.mime, size: f.size, url: await sign(), downloadUrl: await sign(f.name), embed: null, link: null, source: 'files' };
}
export const contextFileSource = guard(fileSource_);

/** Several documents' preview details in one go, so a page of full-size previews is one request, not many. */
async function previews_(docIds: string[]): Promise<Record<string, DocPreview | null>> {
  const out: Record<string, DocPreview | null> = {};
  await Promise.all(docIds.slice(0, 12).map(async (d) => { const r = await documentPreview(d); out[d] = r.ok ? r.data : null; }));
  return out;
}
export const documentPreviews = guard(previews_);

const TASKS = {
  cover_letter: {
    label: 'Cover letter',
    guide: 'Write a one page cover letter (about 300 to 380 words). Address it to the named contact if the opportunity gives one, otherwise to the hiring team. Open with why this role or call and this organisation, then match its two or three most important requirements to specific evidence from CONTEXT, then close with a clear, confident ask. If the opportunity asks for something the person lacks (a language, a tool), address it honestly in one sentence instead of hiding it. Start with "# " and the person\'s name, then the contact line, then the letter.',
  },
  cv: {
    label: 'CV',
    guide: 'Rewrite the person\'s CV for this opportunity. Start from the CV found in CONTEXT, keep every role, date and qualification true, reorder and reword so the most relevant evidence comes first, and use the opportunity\'s own keywords only where the person really has the skill. Single column, ATS friendly: "# " name, a contact line, "## Summary", "## Skills", "## Experience" (role, organisation, dates, then bullets that start with an action and show a result), "## Education", and other sections only if CONTEXT has them. Where CONTEXT has no CV, build it from the facts available and mark gaps.',
  },
  custom: { label: 'Document', guide: 'Write the document the person asked for, fit for sending with this application.' },
} as const;

/** The person's name from their profile, for the top of a CV or letter. */
async function personName(userId: string): Promise<string> {
  const { data } = await looseAdmin().from('profiles').select('first_name, last_name').eq('id', userId).maybeSingle();
  return [data?.first_name, data?.last_name].filter(Boolean).join(' ');
}

/**
 * The agent: reads this opportunity, everything added as context, the files already on it, the funder's page, the
 * organisation's own record and an optional template, then writes the document asked for and saves it to Files.
 * It never invents facts: what it cannot find becomes "[to confirm: ...]".
 */
async function run_(kind: string, id: string, input: { task: 'cover_letter' | 'cv' | 'custom'; label?: string; prompt?: string; templateFileId?: string | null; model?: string; refine?: { docId: string; instruction: string } }): Promise<AgentResult> {
  const { actor, entity, kind: k } = await open(kind, id, 'write');
  const ai = aiInfo();
  if (!ai.available) throw new Error('The AI agent needs an OpenRouter key. An administrator can add it in the site settings.');
  const task = TASKS[input.task] ?? TASKS.custom;
  const label = (input.task === 'custom' ? (input.label ?? '').trim().slice(0, 60) || 'Document' : task.label);
  const model = input.model && ai.models.some((m) => m.id === input.model) ? input.model : input.model && /^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(input.model) ? input.model : ai.defaultModel;
  const db = looseAdmin();
  const used: string[] = [];
  const parts: string[] = [];
  let budget = 30_000;
  const take = (title: string, text: string, max: number) => {
    const t = clip(text, Math.min(max, budget));
    if (!t) return;
    budget -= t.length;
    used.push(title);
    parts.push(`### ${title}\n${t}`);
  };

  // 1. The opportunity itself and the page it came from.
  take('The opportunity (what the team recorded)', entityText(entity), 3500);
  const src = String(entity.row[k === 'grant' ? 'link' : 'source_url'] ?? '');
  if (/^https?:\/\//i.test(src)) {
    try {
      const p = await fetchPageOrPdf(src);
      take('The opportunity page', p.kind === 'html' ? pageText(p.html) : await textFromBytes(p.bytes, 'call.pdf', 'application/pdf', 9000), 7000);
    } catch { /* the record text is still there */ }
  }

  // 2. What the team added: instructions are the brief, the rest is context.
  const all = await rows(k, id);
  const instructions = all.find((r) => r.kind === 'instruction')?.body ?? '';
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(actor.email)]);
  for (const r of all.filter((x) => x.kind !== 'instruction' && x.include)) {
    if (r.vault_file_id) {
      const f = ix.files.get(r.vault_file_id);
      if (!f || !atLeast(levelFor(ix, actor.id, 'file', f.id, oversight), 'view')) continue;
      take(`File: ${f.name}`, await extractText(f.storage_path, f.name, f.mime, 9000).catch(() => ''), 7000);
    } else if (r.kind === 'skill') take(`Skills: ${r.title}`, r.body, 3000);
    else if (r.kind === 'note') take(`Note: ${r.title}`, r.body, 4000);
    else if (r.kind === 'link') take(`Link: ${r.title} (${r.url})`, r.body || 'The page could not be read; only its address is known.', 5000);
    else if (r.kind === 'drive') take(`Google Drive file: ${r.title}`, `Kept in Google Drive at ${r.url}. Its text is not available here.`, 400);
  }

  // 3. Files already on the opportunity.
  const { data: docs } = await db.from('mjengo_documents').select('id, name, file_path, file_name, mime_type, vault_file_id').eq('entity_type', k).eq('entity_id', id);
  for (const d of (docs ?? []) as { id: string; name: string; file_path: string | null; file_name: string | null; mime_type: string | null; vault_file_id: string | null }[]) {
    if (d.id === input.refine?.docId) continue;
    if (d.vault_file_id && all.some((r) => r.vault_file_id === d.vault_file_id)) continue;
    try {
      const text = d.file_path ? await extractText(d.file_path, d.file_name || d.name, d.mime_type, 7000)
        : d.vault_file_id ? (await readableFile(actor.id, actor.email, d.vault_file_id, 7000)).text : '';
      take(`On this opportunity: ${d.name}`, text, 5000);
    } catch { /* unreadable files are skipped */ }
  }

  // 4. The template, if one was chosen.
  let template = '';
  if (input.templateFileId) {
    const t = await readableFile(actor.id, actor.email, input.templateFileId, 9000);
    template = clip(t.text, 7000);
    if (template) used.push(`Template: ${t.name}`);
  }

  // 5. What the organisation has on record that bears on this.
  const found = await gatherSources(actor, `${entity.title} ${label} ${instructions}`.slice(0, 300), 5).catch(() => []);
  if (found.length) take('From the organisation\'s own record', found.map((s) => `(${s.kind}) ${s.title}: ${s.snippet}`).join('\n'), 3500);

  // A refinement starts from the document already written.
  let previous = '';
  if (input.refine) {
    const { data: d } = await db.from('mjengo_documents').select('file_path, vault_file_id, file_name, name, mime_type').eq('id', input.refine.docId).eq('entity_type', k).eq('entity_id', id).maybeSingle();
    if (d?.vault_file_id) previous = (await readableFile(actor.id, actor.email, d.vault_file_id, 12_000)).text;
    else if (d?.file_path) previous = await extractText(d.file_path, d.file_name || d.name, d.mime_type, 12_000);
  }

  const who = await personName(actor.id);
  const system = `You write documents a person sends to apply for an opportunity: ${label}. You are careful and honest. Use facts only from CONTEXT: never invent an employer, job title, date, qualification, tool, number or achievement. Where a fact is needed and CONTEXT does not give it, write [to confirm: what is needed]. Tailor the content to this opportunity's own requirements and wording, and show evidence rather than adjectives. No flattery, no filler phrases such as "I am excited to", "passionate" or "leverage". ${template ? 'Follow the structure, headings and order of the TEMPLATE, filling it with this person\'s real content.' : ''} Output the finished document only, as simple markdown: "# " for the person's name or the title, "## " for sections, "- " for bullets, **bold** sparingly. No commentary before or after it.\n\n${task.guide}${input.task === 'custom' ? `\nThe document is: ${label}.` : ''}`;
  const user = [
    `Person: ${who || 'the applicant'} (${actor.email})`,
    instructions ? `INSTRUCTIONS FROM THE TEAM (follow these):\n${instructions}` : '',
    input.prompt?.trim() ? `THIS REQUEST: ${input.prompt.trim().slice(0, 1500)}` : '',
    template ? `TEMPLATE:\n${template}` : '',
    `CONTEXT:\n${parts.join('\n\n') || '(nothing was found beyond the title)'}`,
    previous ? `THE CURRENT VERSION:\n${previous}\n\nCHANGE REQUESTED: ${input.refine?.instruction.slice(0, 1200)}\nRewrite the whole document with that change, keeping everything else that is right.` : '',
  ].filter(Boolean).join('\n\n');

  let text = await askAi(system, user, 4000, { temperature: 0.45, model, timeoutMs: 120_000 });
  text = text.replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/, '').trim();
  if (text.length < 40) throw new Error('The agent returned nothing useful. Try again, or add more context.');
  const gaps = (text.match(/\[to confirm/gi) ?? []).length;

  // Saved as a Word file in the person's vault, on the opportunity, and kept in step when it is refined.
  const bytes = await markdownDocx(text);
  const saved = await saveToVault(actor, { name: `${entity.title} - ${label}.docx`, bytes, mime: DOCX, folder: 'Applications' });
  await linkFileToRecord(k, id, saved.id, actor.id, false);
  const { data: have } = await db.from('mjengo_documents').select('id').eq('entity_type', k).eq('entity_id', id).eq('vault_file_id', saved.id).maybeSingle();
  let docId = have?.id as string | undefined;
  if (!docId) {
    const { data: made, error } = await db.from('mjengo_documents').insert({ entity_type: k, entity_id: id, name: label, required: false, vault_file_id: saved.id, file_name: saved.name, file_size: bytes.byteLength, mime_type: DOCX, uploaded_by: actor.id, uploaded_at: new Date().toISOString() }).select('id').single();
    if (error || !made) throw new Error('The document was written but could not be added to this opportunity.');
    docId = made.id as string;
  } else await db.from('mjengo_documents').update({ file_size: bytes.byteLength, uploaded_at: new Date().toISOString() }).eq('id', docId);
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.agent.document_written', targetType: k, targetId: id, targetLabel: label });
  return { docId, fileId: saved.id, name: saved.name, text, gaps, usedContext: used, model };
}
export const runAgent = guard(run_);
