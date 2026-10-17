'use server';

import { guard } from '@/lib/action-result';
import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { requireModule, type Level, type ModuleKey } from '@/lib/access/permissions';
import { entitiesFor, entityText, type EntityKind, type EntityLite } from '@/lib/mjengo/entity-view';
import { fetchHtml, pageText } from '@/lib/mjengo/safe-fetch';
import { extractText } from '@/lib/mjengo/files-text';
import { timelineFor } from '@/lib/mjengo/timeline';
import {
  applicationHtml, cleanRequirements, draftSection, extractRequirements, reviewApplication, wordCount,
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

async function upsert(kind: AgentKind, id: string, entity: EntityLite, actorId: string, patch: Record<string, unknown>) {
  const { error } = await looseAdmin().from('mjengo_grant_briefs').upsert(
    { entity_type: kind, entity_id: id, funder: funderOf(entity), created_by: actorId, updated_at: new Date().toISOString(), ...patch },
    { onConflict: 'entity_type,entity_id' },
  );
  if (error) throw new Error('Could not save that.');
}

/** What the agent knows about this application so far. */
async function getBrief_(kind: AgentKind, id: string): Promise<Brief> {
  const { entity, kind: k } = await open(kind, id);
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
  if (url) { try { const page = await fetchHtml(url); text = pageText(page.html); } catch { /* the documents may still say it */ } }
  const { data: docs } = await db.from('mjengo_documents').select('name, file_name, file_path, mime_type').eq('entity_type', k).eq('entity_id', id).not('file_path', 'is', null).limit(4);
  const read: { name: string; text: string }[] = [];
  for (const d of (docs ?? []) as { name: string; file_name: string | null; file_path: string; mime_type: string | null }[]) {
    const t = await extractText(d.file_path, d.file_name ?? d.name, d.mime_type, 9000).catch(() => '');
    if (t) read.push({ name: d.name, text: t });
  }
  const before = await briefRow(k, id);
  const req = await extractRequirements({ title: entity.title, funder: funderOf(entity), pageText: text, docs: read, previous: before?.requirements ?? null });
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

export const getBrief = guard(getBrief_);
export const readCall = guard(readCall_);
export const saveRequirements = guard(saveRequirements_);
export const draftForFunder = guard(draft_);
export const saveDraft = guard(saveDraft_);
export const saveFeedback = guard(saveFeedback_);
export const reviewApplicationAction = guard(review_);
export const exportApplication = guard(exportApplication_);
