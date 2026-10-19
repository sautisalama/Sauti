import { randomUUID } from 'node:crypto';
import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { type EntityKind } from '@/lib/mjengo/entity-view';

const BUCKET = 'mjengo-docs';

/** A top-level folder in this person's own vault, made the first time it is needed and private to them. */
export async function ensureFolder(ownerId: string, name: string): Promise<string> {
  const db = looseAdmin();
  const { data } = await db.from('vault_folders').select('id').eq('owner_id', ownerId).is('parent_id', null).eq('name', name).maybeSingle();
  if (data) return data.id;
  const { data: made, error } = await db.from('vault_folders').insert({ name, owner_id: ownerId, parent_id: null, general_access: 'restricted' }).select('id').single();
  if (error || !made) throw new Error(`Could not create the ${name} folder in your vault.`);
  return made.id;
}

/**
 * Put a file in the person's vault, in a folder of that name. A file of the same name in that folder is replaced, so
 * saving the same application twice keeps one file. Returns its id.
 */
export async function saveToVault(actor: { id: string; email: string }, input: { name: string; bytes: Uint8Array; mime: string; folder: string; tags?: string[] }): Promise<{ id: string; name: string; replaced: boolean }> {
  const db = looseAdmin();
  const folderId = await ensureFolder(actor.id, input.folder);
  const name = input.name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 190) || 'Untitled';
  const { data: have } = await db.from('vault_files').select('id, storage_path, tags').eq('owner_id', actor.id).eq('folder_id', folderId).eq('name', name).maybeSingle();
  if (have) {
    const { error } = await db.storage.from(BUCKET).upload(have.storage_path, input.bytes, { contentType: input.mime, upsert: true });
    if (error) throw new Error('Could not save the file to your vault.');
    await db.from('vault_files').update({ size: input.bytes.byteLength, mime: input.mime, updated_at: new Date().toISOString() }).eq('id', have.id);
    await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'vault.file_replaced', targetType: 'vault_file', targetId: have.id, targetLabel: name });
    return { id: have.id, name, replaced: true };
  }
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'file';
  const path = `vault/${actor.id}/${randomUUID()}-${safe}`;
  const up = await db.storage.from(BUCKET).upload(path, input.bytes, { contentType: input.mime });
  if (up.error) throw new Error('Could not save the file to your vault.');
  const { data, error } = await db.from('vault_files').insert({ folder_id: folderId, name, storage_path: path, mime: input.mime, size: input.bytes.byteLength, owner_id: actor.id, ...(input.tags?.length ? { tags: input.tags } : {}) }).select('id').single();
  if (error || !data) { await db.storage.from(BUCKET).remove([path]); throw new Error('Could not save the file to your vault.'); }
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'vault.file_uploaded', targetType: 'vault_file', targetId: data.id, targetLabel: name });
  return { id: data.id, name, replaced: false };
}

/** Put a vault file on the timeline of a grant, opportunity, project or fellowship. */
export async function linkFileToRecord(kind: EntityKind, entityId: string, fileId: string, actorId: string, auto = true): Promise<void> {
  await looseAdmin().from('mjengo_links').upsert({ entity_type: kind, entity_id: entityId, item_type: 'file', item_id: fileId, auto, created_by: actorId }, { onConflict: 'entity_type,entity_id,item_type,item_id', ignoreDuplicates: true });
}
