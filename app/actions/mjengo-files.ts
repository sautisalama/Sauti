'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor } from '@/lib/access/super-admin';
import { requireModule } from '@/lib/access/permissions';
import { atLeast, descendants, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import {
  createFolder as driveCreateFolder, driveConnection, driveToken, dropDriveConnection, ensureRootFolder, listFolders, renameFolder, uploadFile,
  type DriveFolder,
} from '@/lib/google-drive';

const BUCKET = 'mjengo-docs';

export interface RecentFile { id: string; name: string; location: string; opened: string; size: number; driveLink: string | null }
export interface FilesHub {
  recent: RecentFile[];
  drive: { connected: boolean; email: string | null; folders: DriveFolder[]; error: string | null; available: boolean };
}

/** The top of the Files page: your five most recent files and your Google Drive folders. */
async function filesHub_(): Promise<FilesHub> {
  const a = await requireModule('files');
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(a.email)]);
  const recent = [...ix.files.values()]
    .filter((f) => atLeast(levelFor(ix, a.id, 'file', f.id, oversight), 'view'))
    .sort((x, y) => (y.last_opened_at ?? y.updated_at ?? y.created_at).localeCompare(x.last_opened_at ?? x.updated_at ?? x.created_at))
    .slice(0, 5)
    .map((f) => ({
      id: f.id,
      name: f.name,
      location: f.folder_id ? ix.folders.get(f.folder_id)?.name ?? 'Mine' : 'Mine',
      opened: f.last_opened_at ?? f.updated_at ?? f.created_at,
      size: f.size,
      driveLink: f.drive_link,
    }));

  const available = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  const conn = await driveConnection(a.id);
  let folders: DriveFolder[] = [];
  let error: string | null = null;
  if (conn) {
    const token = await driveToken(a.id);
    if (!token) error = 'Google Drive access ended. Connect it again.';
    else {
      try { folders = await listFolders(token); } catch (e) { error = e instanceof Error ? e.message : 'Could not read Google Drive.'; }
    }
  }
  return { recent, drive: { connected: !!conn && !error?.includes('ended'), email: conn?.email ?? null, folders, error, available } };
}

async function renameDriveFolder_(id: string, name: string) {
  const a = await requireModule('files', 'write');
  const n = name.trim().slice(0, 120);
  if (!n) throw new Error('Give the folder a name.');
  const token = await driveToken(a.id);
  if (!token) throw new Error('Connect Google Drive first.');
  await renameFolder(token, id, n);
  await looseAdmin().from('vault_folders').update({ name: n }).eq('drive_folder_id', id).eq('owner_id', a.id);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'drive.folder_renamed', targetType: 'drive_folder', targetId: id, targetLabel: n });
}

async function disconnectDrive_() {
  const a = await requireModule('files', 'owner');
  await dropDriveConnection(a.id);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'drive.disconnected', targetType: 'drive' });
}

/** Copy a vault folder (and its files) to Google Drive as a folder of the same name. */
async function shareFolderToDrive_(folderId: string): Promise<{ link: string | null; copied: number; skipped: number }> {
  const a = await requireModule('files', 'write');
  const token = await driveToken(a.id);
  if (!token) throw new Error('Connect Google Drive first.');
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(a.email)]);
  const folder = ix.folders.get(folderId);
  if (!folder) throw new Error('That folder no longer exists.');
  if (!atLeast(levelFor(ix, a.id, 'folder', folderId, oversight), 'view')) throw new Error('You do not have access to that folder.');

  const db = looseAdmin();
  const root = await ensureRootFolder(token);
  const target = folder.drive_folder_id ? { id: folder.drive_folder_id, link: folder.drive_link } : await driveCreateFolder(token, folder.name, root);
  if (!folder.drive_folder_id) await db.from('vault_folders').update({ drive_folder_id: target.id, drive_link: target.link }).eq('id', folderId);

  const files = descendants(ix, folderId).files.filter((f) => !f.drive_file_id && f.size <= 25 * 1024 * 1024).slice(0, 8);
  let copied = 0;
  for (const f of files) {
    const { data } = await db.storage.from(BUCKET).download(f.storage_path);
    if (!data) continue;
    const up = await uploadFile(token, f.name, new Uint8Array(await data.arrayBuffer()), f.mime || data.type || 'application/octet-stream', target.id);
    await db.from('vault_files').update({ drive_file_id: up.id, drive_link: up.link, drive_saved_at: new Date().toISOString() }).eq('id', f.id);
    copied += 1;
  }
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'vault.folder_to_drive', targetType: 'vault_folder', targetId: folderId, targetLabel: folder.name, details: { copied } });
  return { link: target.link, copied, skipped: descendants(ix, folderId).files.filter((f) => !f.drive_file_id).length - copied };
}

export const filesHub = guard(filesHub_);
export const renameDriveFolder = guard(renameDriveFolder_);
export const disconnectDrive = guard(disconnectDrive_);
export const shareFolderToDrive = guard(shareFolderToDrive_);
