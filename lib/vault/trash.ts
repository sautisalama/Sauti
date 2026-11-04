import { looseAdmin } from '@/lib/loose-db';
import { descendants, loadIndex, type ResType, type VaultIndex } from '@/lib/vault/access';

/** How long something stays in the trash before it is removed for good. */
export const TRASH_DAYS = 21;
const BUCKET = 'mjengo-docs';

/** Remove trashed things for good: the stored bytes, the rows and the sharing. Returns the name it had. */
export async function eraseTrashed(c: { ix: VaultIndex }, type: ResType, id: string): Promise<string> {
  const db = looseAdmin();
  let paths: string[] = [];
  let label = '';
  if (type === 'file') {
    const f = c.ix.files.get(id);
    paths = f ? [f.storage_path] : [];
    label = f?.name ?? '';
    await db.from('vault_files').delete().eq('id', id);
    await db.from('vault_permissions').delete().eq('resource_type', 'file').eq('resource_id', id);
  } else {
    const d = descendants(c.ix, id);
    paths = d.files.map((f) => f.storage_path);
    label = c.ix.folders.get(id)?.name ?? '';
    if (d.files.length) {
      await db.from('vault_files').delete().in('id', d.files.map((f) => f.id));
      await db.from('vault_permissions').delete().eq('resource_type', 'file').in('resource_id', d.files.map((f) => f.id));
    }
    await db.from('vault_folders').delete().in('id', d.folders);
    await db.from('vault_permissions').delete().eq('resource_type', 'folder').in('resource_id', d.folders);
  }
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
  return label;
}

/** Remove everything that has been in the trash longer than 21 days. Safe to call any time; the daily job does. */
export async function purgeExpired(): Promise<number> {
  const before = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();
  const ix = await loadIndex({ withTrashed: true });
  let n = 0;
  for (const f of ix.folders.values()) if (f.deleted_at && f.deleted_root && f.deleted_at < before) { await eraseTrashed({ ix }, 'folder', f.id); n++; }
  for (const f of ix.files.values()) if (f.deleted_at && f.deleted_root && f.deleted_at < before) { await eraseTrashed({ ix }, 'file', f.id); n++; }
  return n;
}
