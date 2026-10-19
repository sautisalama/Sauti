'use server';

import { after } from 'next/server';
import { guard } from '@/lib/action-result';
import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { requireModule, type ModuleKey } from '@/lib/access/permissions';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import { autoTag, cleanTags } from '@/lib/mjengo/autotag';
import { ENTITY_KINDS, entitiesFor, type EntityKind } from '@/lib/mjengo/entity-view';
import { excalidrawText, extractText } from '@/lib/mjengo/files-text';
import { designFlowFromText, nameFromText, type FlowGraph } from '@/lib/mjengo/flow-design';
import { fileLink } from '@/lib/mjengo/links';
import { indexSource } from '@/lib/mjengo/search-index';
import { linkFileToRecord, saveToVault } from '@/lib/mjengo/vault-save';

const MIME = 'application/vnd.excalidraw+json';
const MODULE_OF: Record<EntityKind, ModuleKey> = { grant: 'grants', opportunity: 'opportunities', project: 'projects', fellowship: 'fellowships' };

export interface FlowSaved { id: string; name: string; link: string; tags: string[]; linkedTo: string | null; /** The name was written from the drawing. */ named: boolean }

/**
 * Save a drawing (a flow, a diagram) in the vault as an .excalidraw file: a new one in the person's Flows folder, or the
 * same file again. It can be put on a grant, opportunity, project or fellowship so everyone working on that sees it with its
 * other documents. Its words are read and tagged by the autotagger, so it is found by search and filtered like any file.
 */
async function saveFlow_(input: { fileId: string | null; name: string; json: string; entity?: string | null }): Promise<FlowSaved> {
  const a = await requireModule('files', 'write');
  const actor = { id: a.id, email: a.email };
  const name = String(input.name ?? '').replace(/\.excalidraw$/i, '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled flow';
  const untitled = /^untitled( flow)?$/i.test(name);
  let scene: { type?: string; elements?: unknown[] };
  try { scene = JSON.parse(input.json); } catch { throw new Error('That drawing could not be read.'); }
  if (scene.type !== 'excalidraw' || !Array.isArray(scene.elements)) throw new Error('That is not a drawing.');
  // A drawing that still has the default name is named from what it says (once it says enough).
  let finalName = name;
  let named = false;
  if (untitled) {
    const made = await nameFromText('flow', excalidrawText(input.json, 3000), null);
    if (made) { finalName = made; named = true; }
  }
  const bytes = new TextEncoder().encode(input.json);
  if (bytes.byteLength > 18_000_000) throw new Error('The drawing is too large to save. Remove some pictures from it.');

  const db = looseAdmin();
  let id: string;
  if (input.fileId) {
    const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(actor.email)]);
    const f = ix.files.get(input.fileId);
    if (!f || !atLeast(levelFor(ix, actor.id, 'file', input.fileId, oversight), 'edit')) throw new Error('You can only save drawings you can edit.');
    const up = await db.storage.from('mjengo-docs').upload(f.storage_path, bytes, { contentType: MIME, upsert: true });
    if (up.error) throw new Error('Could not save the drawing.');
    await db.from('vault_files').update({ name: `${finalName}.excalidraw`, size: bytes.byteLength, mime: MIME, updated_at: new Date().toISOString() }).eq('id', f.id);
    id = f.id;
  } else {
    id = (await saveToVault(actor, { name: `${finalName}.excalidraw`, bytes, mime: MIME, folder: 'Flows', tags: ['flow'] })).id;
  }

  let linkedTo: string | null = null;
  if (input.entity) {
    const [kind, eid] = String(input.entity).split(':');
    if (ENTITY_KINDS.includes(kind as EntityKind) && /^[0-9a-f-]{36}$/i.test(eid ?? '')) {
      const k = kind as EntityKind;
      await requireModule(MODULE_OF[k]);
      const rec = (await entitiesFor(actor, [k])).find((e) => e.id === eid);
      if (rec) { await linkFileToRecord(k, eid!, id, actor.id, false); linkedTo = `${k}:${rec.title}`; }
    }
  }

  // Tagged from what the drawing says (its boxes and labels), on top of its own "flow" tag.
  const { data: cur } = await db.from('vault_files').select('tags').eq('id', id).maybeSingle();
  const found = await autoTag({ title: finalName, text: excalidrawText(input.json), kind: 'diagram' }).catch(() => []);
  const tags = cleanTags([...((cur?.tags as string[] | null) ?? []), 'flow', ...found], 8);
  await db.from('vault_files').update({ tags }).eq('id', id);
  after(() => indexSource('file', id).then(() => undefined).catch(() => undefined));
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'vault.flow_saved', targetType: 'vault_file', targetId: id, targetLabel: finalName, details: linkedTo ? { linkedTo } : {} });
  return { id, name: `${finalName}.excalidraw`, link: fileLink(`${finalName}.excalidraw`, id), tags, linkedTo, named };
}

/** A flow drawn by the AI from a description, or from the text of a document or sheet. The board lays it out. */
async function designFlow_(input: { prompt: string; source?: string }): Promise<FlowGraph> {
  await requireModule('files', 'write');
  const prompt = String(input.prompt ?? '').trim();
  const source = String(input.source ?? '').trim();
  if (!prompt && !source) throw new Error('Say what the flow is about, or choose a document to draw it from.');
  return designFlowFromText(prompt, source);
}

/** The words of a document in the vault (Word, PDF, text), for drawing a flow from it. */
async function readForFlow_(fileId: string): Promise<{ name: string; text: string }> {
  const a = await requireModule('files');
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(a.email)]);
  const f = ix.files.get(fileId);
  if (!f || !atLeast(levelFor(ix, a.id, 'file', fileId, oversight), 'view')) throw new Error('You cannot open that file.');
  const text = await extractText(f.storage_path, f.name, f.mime ?? null, 9000);
  if (!text.trim()) throw new Error('I could not read any text in that file.');
  return { name: f.name, text };
}

/**
 * The steps of a flow as a spreadsheet in the vault (Flows folder): one row per step with what it leads to, ready to be
 * filtered, shared or edited in Excel. Opens in the sheet editor.
 */
async function flowToSheet_(input: { name: string; rows: { step: number; label: string; kind: string; next: string; condition: string }[] }): Promise<{ id: string; name: string }> {
  const a = await requireModule('files', 'write');
  const XLSX = await import('xlsx');
  const rows = (Array.isArray(input.rows) ? input.rows : []).slice(0, 200);
  if (!rows.length) throw new Error('There are no steps in this flow yet.');
  const title = String(input.name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Flow';
  const ws = XLSX.utils.aoa_to_sheet([
    ['Step', 'What happens', 'Type', 'Leads to', 'Condition'],
    ...rows.map((r) => [Number(r.step) || 0, String(r.label ?? '').slice(0, 200), String(r.kind ?? '').slice(0, 20), String(r.next ?? '').slice(0, 200), String(r.condition ?? '').slice(0, 100)]),
  ]);
  ws['!cols'] = [{ wch: 6 }, { wch: 48 }, { wch: 12 }, { wch: 32 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Steps');
  const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  const saved = await saveToVault({ id: a.id, email: a.email }, { name: `${title} steps.xlsx`, bytes, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', folder: 'Flows', tags: ['flow', 'steps'] });
  return { id: saved.id, name: saved.name };
}

/**
 * A new document that still has a placeholder name is named from what it says, and labelled. Only the person who may edit
 * the file can do this, and a name they chose themselves is never replaced.
 */
async function nameNewDocument_(fileId: string, text: string): Promise<{ name: string; tags: string[]; renamed: boolean }> {
  const a = await requireModule('files', 'write');
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(a.email)]);
  const f = ix.files.get(fileId);
  if (!f || !atLeast(levelFor(ix, a.id, 'file', fileId, oversight), 'edit')) throw new Error('You can only name documents you can edit.');
  const ext = (f.name.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? '').toLowerCase();
  const base = f.name.slice(0, f.name.length - ext.length);
  const db = looseAdmin();
  const body = String(text ?? '').slice(0, 6000);
  let name = f.name;
  let renamed = false;
  if (/^(untitled|new|document|doc)[\s_-]*(document|doc)?[\s_-]*\d*$/i.test(base.trim())) {
    const made = await nameFromText('document', body, null);
    if (made) {
      name = `${made}${ext}`;
      await db.from('vault_files').update({ name }).eq('id', fileId);
      renamed = true;
    }
  }
  const { data: cur } = await db.from('vault_files').select('tags').eq('id', fileId).maybeSingle();
  let tags = (cur?.tags as string[] | null) ?? [];
  if (!tags.length && body.split(/\s+/).length >= 5) {
    const found = await autoTag({ title: name.replace(/\.[^.]+$/, ''), text: body, kind: 'document' }).catch(() => []);
    tags = cleanTags(found, 8);
    if (tags.length) await db.from('vault_files').update({ tags }).eq('id', fileId);
  }
  after(() => indexSource('file', fileId).then(() => undefined).catch(() => undefined));
  return { name, tags, renamed };
}

export const saveFlow = guard(saveFlow_);
export const designFlow = guard(designFlow_);
export const readForFlow = guard(readForFlow_);
export const flowToSheet = guard(flowToSheet_);
export const nameNewDocument = guard(nameNewDocument_);
