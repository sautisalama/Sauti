'use server';

import { after } from 'next/server';
import { guard } from '@/lib/action-result';
import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { requireModule, type Level, type ModuleKey } from '@/lib/access/permissions';
import { entitiesFor, entityText, type EntityKind, type EntityLite } from '@/lib/mjengo/entity-view';
import { fetchPageOrPdf, guidelinePdfLinks, pageText } from '@/lib/mjengo/safe-fetch';
import { extractText, textFromBytes } from '@/lib/mjengo/files-text';
import { saveToVault, linkFileToRecord } from '@/lib/mjengo/vault-save';
import { indexSource } from '@/lib/mjengo/search-index';
import { fileLink } from '@/lib/mjengo/links';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import { timelineFor } from '@/lib/mjengo/timeline';
import {
  applicationDocx, applicationHtml, cleanRequirements, draftSection, extractRequirements, reviewApplication, wordCount,
  EMPTY_REQUIREMENTS, type Draft, type Requirements, type Review,
} from '@/lib/mjengo/grant-agent';

type AgentKind = 'grant' | 'opportunity';
const MODULE_OF: Record<AgentKind, ModuleKey> = { grant: 'grants', opportunity: 'opportunities' };
const LINK_FIELD: Record<AgentKind, string> = { grant: 'link', opportunity: 'source_url' };

export interface Brief {
  funder: string | null;
  sourceUrl: string | null;
  hasLink: boolean;
  requirements: Requirements;
  drafts: Record<string, Draft>;
  review: Review | null;
  funderFeedback: string;
  /** Feedback kept on other applications to the same funder. */
  earlierFeedback: string[];
  readAt: string | null;
  attached: string[];
  /** Files in the vault that belong to this application: the funder's guidelines read from a PDF, the saved draft. */
  files: { id: string; name: string; link: string; tags: string[] }[];
}

async function open(kind: string, id: string, need: Level = 'view'): Promise<{ actor: { id: string; email: string }; entity: EntityLite; kind: AgentKind }> {
  if (kind !== 'grant' && kind !== 'opportunity') throw new Error('The grant agent works on grants and opportunities.');
  const a = await requireModule(MODULE_OF[kind], need);
  const actor = { id: a.id, email: a.email };
  const entity = (await entitiesFor(actor, [kind])).find((e) => e.id === id);
  if (!entity) throw new Error('That does not exist, or it is private to someone else.');
  return { actor, entity, kind };
}

const funderOf = (e: EntityLite) => String(e.kind === 'grant' ? e.row.funder ?? '' : e.row.organisation ?? '').trim() || null;
const draftsOf = (v: unknown): Record<string, Draft> => (v && typeof v === 'object' ? (v as Record<string, Draft>) : {});

async function briefRow(kind: AgentKind, id: string) {
  const { data } = await looseAdmin().from('mjengo_grant_briefs').select('*').eq('entity_type', kind).eq('entity_id', id).maybeSingle();
  return data as { requirements: Requirements | null; drafts: unknown; review: Review | null; funder_feedback: string | null; source_url: string | null; read_at: string | null } | null;
}

async function attachedNames(kind: AgentKind, id: string): Promise<string[]> {
  const { data } = await looseAdmin().from('mjengo_documents').select('name, file_name, file_path').eq('entity_type', kind).eq('entity_id', id);
  return ((data ?? []) as { name: string; file_name: string | null; file_path: string | null }[]).filter((d) => d.file_path).flatMap((d) => [d.name, d.file_name ?? '']).filter(Boolean);
}

/** The vault files linked to this record that the person may open. */
async function vaultFilesOf(kind: AgentKind, id: string, asker: { id: string; email: string }): Promise<Brief['files']> {
  if (!asker.id) return [];
  const { data } = await looseAdmin().from('mjengo_links').select('item_id').eq('entity_type', kind).eq('entity_id', id).eq('item_type', 'file');
  const ids = ((data ?? []) as { item_id: string }[]).map((l) => l.item_id);
  if (!ids.length) return [];
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(asker.email)]);
  return ids.flatMap((fid) => {
    const f = ix.files.get(fid);
    return f && atLeast(levelFor(ix, asker.id, 'file', fid, oversight), 'view') ? [{ id: f.id, name: f.name, link: fileLink(f.name, f.id), tags: f.tags ?? [] }] : [];
  });
}

const baseName = (u: string) => { try { return decodeURIComponent(new URL(u).pathname.split('/').pop() ?? 'guidelines').replace(/\.pdf$/i, '').replace(/[-_+]+/g, ' ').trim() || 'guidelines'; } catch { return 'guidelines'; } };

async function upsert(kind: AgentKind, id: string, entity: EntityLite, actorId: string, patch: Record<string, unknown>) {
  const { error } = await looseAdmin().from('mjengo_grant_briefs').upsert(
    { entity_type: kind, entity_id: id, funder: funderOf(entity), created_by: actorId, updated_at: new Date().toISOString(), ...patch },
    { onConflict: 'entity_type,entity_id' },
  );
  if (error) throw new Error('Could not save that.');
}

/** What the agent knows about this application so far. */
async function getBrief_(kind: AgentKind, id: string): Promise<Brief> {
  const { actor, entity, kind: k } = await open(kind, id);
  const row = await briefRow(k, id);
  const funder = funderOf(entity);
  let earlier: string[] = [];
  if (funder) {
    const { data } = await looseAdmin().from('mjengo_grant_briefs').select('funder_feedback, entity_id').ilike('funder', funder).neq('entity_id', id).not('funder_feedback', 'is', null);
    earlier = ((data ?? []) as { funder_feedback: string | null }[]).map((r) => r.funder_feedback ?? '').filter(Boolean).slice(0, 5);
  }
  return {
    funder,
    sourceUrl: row?.source_url ?? (String(entity.row[LINK_FIELD[k]] ?? '') || null),
    hasLink: !!String(entity.row[LINK_FIELD[k]] ?? '').trim(),
    requirements: row?.requirements && Array.isArray(row.requirements.sections) ? cleanRequirements(row.requirements) : EMPTY_REQUIREMENTS,
    drafts: draftsOf(row?.drafts),
    review: row?.review ?? null,
    funderFeedback: row?.funder_feedback ?? '',
    earlierFeedback: earlier,
    readAt: row?.read_at ?? null,
    attached: await attachedNames(k, id),
    files: await vaultFilesOf(k, id, actor),
  };
}

/**
 * Read the funder's call: its page, and any guideline documents attached to the record, into what the application
 * must contain. Drafts already written stay with the sections that keep their name.
 */
async function readCall_(kind: AgentKind, id: string): Promise<Brief> {
  const { actor, entity, kind: k } = await open(kind, id, 'write');
  const db = looseAdmin();
  const url = String(entity.row[LINK_FIELD[k]] ?? '').trim();
  let text = '';
  const pdfs: { name: string; bytes: Uint8Array }[] = [];
  let problem = '';
  if (url) {
    try {
      const got = await fetchPageOrPdf(url);
      if (got.kind === 'pdf') pdfs.push({ name: baseName(got.url), bytes: got.bytes });
      else {
        text = pageText(got.html);
        // Guidelines are often a PDF the page links to: those are read too.
        for (const l of guidelinePdfLinks(got.html, got.url)) {
          try { const p = await fetchPageOrPdf(l.url); if (p.kind === 'pdf') pdfs.push({ name: l.label || baseName(l.url), bytes: p.bytes }); } catch { /* the page itself may still say enough */ }
        }
      }
    } catch (e) { problem = e instanceof Error ? e.message : 'The link could not be read.'; }
  }
  const read: { name: string; text: string }[] = [];
  const funder = funderOf(entity);
  for (const p of pdfs.slice(0, 4)) {
    const t = await textFromBytes(p.bytes, 'guidelines.pdf', 'application/pdf', 14_000);
    if (t) read.push({ name: p.name, text: t });
    // The PDF is kept in the vault, with the funder's name, and joins this record's timeline; the autotagger tags it.
    try {
      const saved = await saveToVault(actor, { name: `${funder || entity.title} guidelines, ${p.name}.pdf`, bytes: p.bytes, mime: 'application/pdf', folder: 'Funder guidelines' });
      await linkFileToRecord(k, id, saved.id, actor.id);
      after(() => indexSource('file', saved.id).then(() => undefined).catch(() => undefined));
    } catch { /* reading it still worked */ }
  }
  if (pdfs.length && !read.length && !text) throw new Error('The PDF was saved to your vault, but it has no text I can read (it may be a scan). Attach a text version under Documents, or paste its contents into the grant notes.');
  if (problem && !text && !read.length && !(await db.from('mjengo_documents').select('id').eq('entity_type', k).eq('entity_id', id).not('file_path', 'is', null).limit(1)).data?.length) throw new Error(problem);
  const { data: docs } = await db.from('mjengo_documents').select('name, file_name, file_path, mime_type').eq('entity_type', k).eq('entity_id', id).not('file_path', 'is', null).limit(4);
  for (const d of (docs ?? []) as { name: string; file_name: string | null; file_path: string; mime_type: string | null }[]) {
    const t = await extractText(d.file_path, d.file_name ?? d.name, d.mime_type, 9000).catch(() => '');
    if (t) read.push({ name: d.name, text: t });
  }
  const before = await briefRow(k, id);
  const req = await extractRequirements({ title: entity.title, funder, pageText: text, docs: read, previous: before?.requirements ?? null });
  const kept = draftsOf(before?.drafts);
  const drafts: Record<string, Draft> = {};
  for (const s of req.sections) if (kept[s.id]) drafts[s.id] = kept[s.id];
  await upsert(k, id, entity, actor.id, { requirements: req, drafts, review: null, source_url: url || null, read_at: new Date().toISOString() });
  await logAudit({ actorId: actor.id, action: 'mjengo.grant.call_read', targetType: k, targetId: id, targetLabel: entity.title });
  return getBrief_(k, id);
}

/** Corrections to what the agent read (a limit, a section, a criterion), kept with the drafts that still fit. */
async function saveRequirements_(kind: AgentKind, id: string, requirements: Requirements): Promise<Brief> {
  const { actor, entity, kind: k } = await open(kind, id, 'write');
  const req = cleanRequirements(requirements);
  const before = await briefRow(k, id);
  const kept = draftsOf(before?.drafts);
  const drafts: Record<string, Draft> = {};
  for (const s of req.sections) if (kept[s.id]) drafts[s.id] = kept[s.id];
  await upsert(k, id, entity, actor.id, { requirements: req, drafts });
  return getBrief_(k, id);
}

/** Write one section for this funder, from the organisation's own record, and keep it. */
async function draft_(kind: AgentKind, id: string, sectionId: string, instruction = ''): Promise<{ draft: Draft; sources: string[] }> {
  const { actor, entity, kind: k } = await open(kind, id, 'write');
  const brief = await getBrief_(k, id);
  const section = brief.requirements.sections.find((s) => s.id === sectionId);
  if (!section) throw new Error('That section is not in the brief. Read the funder\'s call first.');
  const others = brief.requirements.sections.filter((s) => s.id !== sectionId && brief.drafts[s.id]?.text).map((s) => ({ title: s.title, text: brief.drafts[s.id].text }));
  let timeline = '';
  try { timeline = (await timelineFor(actor, k, id)).items.filter((i) => i.kind === 'call' || i.kind === 'status' || i.kind === 'done').slice(0, 12).map((i) => `- ${i.at.slice(0, 10)} ${i.title}${i.detail ? `: ${i.detail}` : ''}`).join('\n'); } catch { /* the record's own text is still used */ }
  const feedback = [brief.funderFeedback, ...brief.earlierFeedback].filter(Boolean).join('\n---\n');
  const out = await draftSection(actor, { title: entity.title, funder: brief.funder, description: entityText(entity).slice(0, 1500), req: brief.requirements, section, instruction, feedback, others, timeline });
  const d: Draft = { text: out.text, updatedAt: new Date().toISOString() };
  await upsert(k, id, entity, actor.id, { drafts: { ...brief.drafts, [sectionId]: d }, review: null });
  return { draft: d, sources: out.sources };
}

/** A person's own edit of a section. */
async function saveDraft_(kind: AgentKind, id: string, sectionId: string, text: string): Promise<Draft> {
  const { actor, entity, kind: k } = await open(kind, id, 'write');
  const brief = await getBrief_(k, id);
  if (!brief.requirements.sections.some((s) => s.id === sectionId)) throw new Error('That section is not in the brief.');
  const d: Draft = { text: String(text ?? '').slice(0, 30_000), updatedAt: new Date().toISOString() };
  await upsert(k, id, entity, actor.id, { drafts: { ...brief.drafts, [sectionId]: d }, review: null });
  return d;
}

/** What the funder said about an earlier application or this one: kept, and used in every later draft for them. */
async function saveFeedback_(kind: AgentKind, id: string, text: string): Promise<void> {
  const { actor, entity, kind: k } = await open(kind, id, 'write');
  await upsert(k, id, entity, actor.id, { funder_feedback: String(text ?? '').slice(0, 4000) });
}

/** Score the draft against the funder's criteria and check it mechanically before it goes. */
async function review_(kind: AgentKind, id: string): Promise<Review> {
  const { actor, entity, kind: k } = await open(kind, id, 'write');
  const brief = await getBrief_(k, id);
  if (!brief.requirements.sections.length) throw new Error('Read the funder\'s call first, so there is something to check against.');
  const r = await reviewApplication({ title: entity.title, funder: brief.funder, req: brief.requirements, drafts: brief.drafts, attached: brief.attached });
  await upsert(k, id, entity, actor.id, { review: r });
  return r;
}

/** The application as HTML, to open as a Word document in the editor. */
async function exportApplication_(kind: AgentKind, id: string): Promise<{ title: string; html: string; words: number }> {
  const { entity, kind: k } = await open(kind, id);
  const brief = await getBrief_(k, id);
  const words = brief.requirements.sections.reduce((n, s) => n + wordCount(brief.drafts[s.id]?.text ?? ''), 0);
  if (!words) throw new Error('Nothing has been written yet.');
  return { title: `${entity.title} application`, html: applicationHtml(entity.title, brief.funder, brief.requirements, brief.drafts), words };
}

/**
 * Save the application as a Word file in the vault (a file of the same name is replaced), put it on this record's
 * timeline, and let the autotagger tag it so it can be found and filtered with similar applications.
 */
async function saveApplication_(kind: AgentKind, id: string): Promise<{ id: string; name: string; link: string; tags: string[]; replaced: boolean; words: number }> {
  const { actor, entity, kind: k } = await open(kind, id, 'write');
  const brief = await getBrief_(k, id);
  const words = brief.requirements.sections.reduce((n, s) => n + wordCount(brief.drafts[s.id]?.text ?? ''), 0);
  if (!words) throw new Error('Nothing has been written yet.');
  const bytes = await applicationDocx(entity.title, brief.funder, brief.requirements, brief.drafts);
  const saved = await saveToVault(actor, { name: `${entity.title} application.docx`, bytes, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', folder: 'Grant applications' });
  await linkFileToRecord(k, id, saved.id, actor.id, false);
  const r = await indexSource('file', saved.id).catch(() => ({ indexed: false, tags: [] as string[] }));
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.grant.application_saved', targetType: k, targetId: id, targetLabel: entity.title });
  return { id: saved.id, name: saved.name, link: fileLink(saved.name, saved.id), tags: r.tags, replaced: saved.replaced, words };
}

export const getBrief = guard(getBrief_);
export const readCall = guard(readCall_);
export const saveRequirements = guard(saveRequirements_);
export const draftForFunder = guard(draft_);
export const saveDraft = guard(saveDraft_);
export const saveFeedback = guard(saveFeedback_);
export const reviewApplicationAction = guard(review_);
export const exportApplication = guard(exportApplication_);
export const saveApplication = guard(saveApplication_);
