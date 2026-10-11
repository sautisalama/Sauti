import { looseAdmin } from '@/lib/loose-db';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import type { Actor } from '@/lib/access/super-admin';

export const DRIVE_BUCKET = 'mjengo-docs';
export const DRIVE_MAX_BYTES = 50 * 1024 * 1024;
export const DRIVE_FOLDER_NAME = 'Sauti Salama';

export interface DriveSource {
  kind: 'vault' | 'entity';
  id: string;
  path: string;
  name: string;
  mime: string | null;
  size: number | null;
}

/** The file to copy to Drive, after checking that this administrator may open it. */
export async function resolveDriveSource(actor: Actor, kind: string, id: string): Promise<DriveSource> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('That file could not be found.');
  const db = looseAdmin();
  if (kind === 'entity') {
    const { data } = await db.from('mjengo_documents').select('file_path, file_name, file_size, name').eq('id', id).maybeSingle();
    if (!data?.file_path) throw new Error('No file is attached to that document yet.');
    return { kind: 'entity', id, path: data.file_path, name: data.file_name || data.name || 'document', mime: null, size: data.file_size ?? null };
  }
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(actor.email)]);
  const f = ix.files.get(id);
  if (!f) throw new Error('That file no longer exists.');
  if (!atLeast(levelFor(ix, actor.id, 'file', id, oversight), 'view')) throw new Error('You do not have access to that file.');
  return { kind: 'vault', id, path: f.storage_path, name: f.name, mime: f.mime, size: f.size };
}

/** Only ever send people back to a page inside the suite. */
export function safeReturn(p: string | null | undefined): string {
  return p && /^\/dashboard\/mjengo(\/[A-Za-z0-9_\-\/]*)?$/.test(p) ? p : '/dashboard/mjengo/vault';
}
