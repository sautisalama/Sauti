'use server';

import { after } from 'next/server';
import { guard } from '@/lib/action-result';
import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { requireModule, type ModuleKey } from '@/lib/access/permissions';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import { autoTag, cleanTags } from '@/lib/mjengo/autotag';
import { ENTITY_KINDS, entitiesFor, type EntityKind } from '@/lib/mjengo/entity-view';
import { excalidrawText } from '@/lib/mjengo/files-text';
import { fileLink } from '@/lib/mjengo/links';
import { indexSource } from '@/lib/mjengo/search-index';
import { linkFileToRecord, saveToVault } from '@/lib/mjengo/vault-save';

const MIME = 'application/vnd.excalidraw+json';
const MODULE_OF: Record<EntityKind, ModuleKey> = { grant: 'grants', opportunity: 'opportunities', project: 'projects', fellowship: 'fellowships' };

export interface FlowSaved { id: string; name: string; link: string; tags: string[]; linkedTo: string | null }

/**
 * Save a drawing (a flow, a diagram) in the vault as an .excalidraw file: a new one in the person's Flows folder, or the
 * same file again. It can be put on a grant, opportunity, project or fellowship so everyone working on that sees it with its
 * other documents. Its words are read and tagged by the autotagger, so it is found by search and filtered like any file.
 */
async function saveFlow_(input: { fileId: string | null; name: string; json: string; entity?: string | null }): Promise<FlowSaved> {
  const a = await requireModule('files', 'write');
  const actor = { id: a.id, email: a.email };
  const name = String(input.name ?? '').replace(/\.excalidraw$/i, '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled flow';
  let scene: { type?: string; elements?: unknown[] };
  try { scene = JSON.parse(input.json); } catch { throw new Error('That drawing could not be read.'); }
  if (scene.type !== 'excalidraw' || !Array.isArray(scene.elements)) throw new Error('That is not a drawing.');
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
    await db.from('vault_files').update({ name: `${name}.excalidraw`, size: bytes.byteLength, mime: MIME, updated_at: new Date().toISOString() }).eq('id', f.id);
    id = f.id;
  } else {
    id = (await saveToVault(actor, { name: `${name}.excalidraw`, bytes, mime: MIME, folder: 'Flows', tags: ['flow'] })).id;
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
  const found = await autoTag({ title: name, text: excalidrawText(input.json), kind: 'diagram' }).catch(() => []);
  const tags = cleanTags([...((cur?.tags as string[] | null) ?? []), 'flow', ...found], 8);
  await db.from('vault_files').update({ tags }).eq('id', id);
  after(() => indexSource('file', id).then(() => undefined).catch(() => undefined));
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'vault.flow_saved', targetType: 'vault_file', targetId: id, targetLabel: name, details: linkedTo ? { linkedTo } : {} });
  return { id, name: `${name}.excalidraw`, link: fileLink(`${name}.excalidraw`, id), tags, linkedTo };
}

export const saveFlow = guard(saveFlow_);
