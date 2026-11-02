'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor, type Actor } from '@/lib/access/super-admin';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import { driveConnection, driveToken } from '@/lib/google-drive';
import { createForm } from '@/app/actions/mjengo-forms';
import { fileInfo, searchFiles as driveSearch, type DriveFileHit } from '@/lib/google-drive-search';

type Kind = 'grant' | 'opportunity' | 'project' | 'fellowship';
const KINDS = ['grant', 'opportunity', 'project', 'fellowship'];
const ID = /^[0-9a-f-]{36}$/i;

const audit = (actor: Actor, action: string, kind: string, id: string, label?: string) =>
  logAudit({ actorId: actor.id, actorEmail: actor.email, action: `mjengo.${action}`, targetType: kind, targetId: id, targetLabel: label });

/** Put the file on the record: it fills a checklist item when `docId` is given, otherwise it is added as another document. */
async function place(kind: Kind, entityId: string, docId: string | undefined, fields: Record<string, unknown>, name: string, uploadedBy: string) {
  const db = looseAdmin();
  const base = { ...fields, uploaded_by: uploadedBy, uploaded_at: new Date().toISOString() };
  if (docId) {
    if (!ID.test(docId)) throw new Error('That document could not be found.');
    const { data: cur } = await db.from('mjengo_documents').select('entity_type, entity_id').eq('id', docId).maybeSingle();
    if (!cur || cur.entity_type !== kind || cur.entity_id !== entityId) throw new Error('That document is not on this record.');
    const { error } = await db.from('mjengo_documents').update(base).eq('id', docId);
    if (error) throw new Error('Could not add it.');
    return docId;
  }
  const { data, error } = await db.from('mjengo_documents').insert({ entity_type: kind, entity_id: entityId, name, required: false, ...base }).select('id').single();
  if (error || !data) throw new Error('Could not add it.');
  return data.id as string;
}

function check(kind: string, entityId: string) {
  if (!KINDS.includes(kind) || !ID.test(entityId)) throw new Error('That record could not be found.');
}

/** A file from the Files vault: only the link is kept, so the file stays where it is and can be reused elsewhere. */
async function attachVaultFile_(kind: Kind, entityId: string, fileId: string, docId?: string) {
  check(kind, entityId);
  if (!ID.test(fileId)) throw new Error('That file could not be found.');
  const actor = await requireAdminActor();
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(actor.email)]);
  const f = ix.files.get(fileId);
  if (!f) throw new Error('That file no longer exists.');
  if (!atLeast(levelFor(ix, actor.id, 'file', fileId, oversight), 'view')) throw new Error('You do not have access to that file.');
  const id = await place(kind, entityId, docId, { vault_file_id: fileId, file_name: f.name, file_size: f.size, mime_type: f.mime }, f.name, actor.id);
  await audit(actor, 'document.attached_from_files', kind, entityId, f.name);
  return { id };
}

/** A new form made for this record. The form is its own thing: the document only points at it. */
async function createFormFor_(kind: Kind, entityId: string, title: string, docId?: string) {
  check(kind, entityId);
  const actor = await requireAdminActor();
  const formId = await createForm(title.trim().slice(0, 120) || 'Untitled form');
  const id = await place(kind, entityId, docId, { form_id: formId, file_name: title.trim().slice(0, 120) || 'Form', mime_type: 'application/x-form' }, title.trim().slice(0, 120) || 'Form', actor.id);
  await audit(actor, 'document.form_created', kind, entityId, title);
  return { id, formId };
}

export interface DriveSearch { connected: boolean; available: boolean; files: DriveFileHit[]; error: string | null }

/** Search the Google Drive this person connected. The app can see files it created or was given, not the whole Drive. */
async function searchDrive_(q: string): Promise<DriveSearch> {
  const actor = await requireAdminActor();
  const available = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  if (!(await driveConnection(actor.id))) return { connected: false, available, files: [], error: null };
  const token = await driveToken(actor.id);
  if (!token) return { connected: false, available, files: [], error: 'Google Drive access ended. Connect it again.' };
  try { return { connected: true, available, files: await driveSearch(token, q), error: null }; }
  catch (e) { return { connected: true, available, files: [], error: e instanceof Error ? e.message : 'Could not search Google Drive.' }; }
}

/** A Google Drive file, by search result or by a pasted link. The file stays in Drive; this keeps the link and name. */
async function attachDriveFile_(kind: Kind, entityId: string, input: { driveId?: string; link?: string; name?: string }, docId?: string) {
  check(kind, entityId);
  const actor = await requireAdminActor();
  let driveId = (input.driveId ?? '').trim();
  const pasted = (input.link ?? '').trim();
  if (!driveId && pasted) {
    const m = pasted.match(/^https:\/\/(?:docs|drive|sheets|slides)\.google\.com\/.*?(?:\/d\/|[?&]id=)([A-Za-z0-9_-]{10,})/i);
    if (!m) throw new Error('That does not look like a Google Drive link.');
    driveId = m[1];
  }
  if (!/^[A-Za-z0-9_-]{10,}$/.test(driveId)) throw new Error('Choose a file from Google Drive.');
  let name = (input.name ?? '').trim();
  let link: string | null = pasted.startsWith('https://') ? pasted : null;
  let mime: string | null = null;
  const token = await driveToken(actor.id);
  const info = token ? await fileInfo(token, driveId) : null;
  if (info) { name = info.name; link = info.link ?? link; mime = info.mime; }
  link = link ?? `https://drive.google.com/file/d/${driveId}/view`;
  name = (name || 'Google Drive file').slice(0, 200);
  const id = await place(kind, entityId, docId, { drive_file_id: driveId, drive_link: link, file_name: name, mime_type: mime }, name, actor.id);
  await audit(actor, 'document.attached_from_drive', kind, entityId, name);
  return { id };
}

export interface DocPreview {
  name: string;
  mime: string | null;
  size: number | null;
  /** The file itself, to show in place. */
  url: string | null;
  /** The same file as a download. */
  downloadUrl: string | null;
  /** A Google Drive file is shown through Drive's own viewer. */
  embed: string | null;
  link: string | null;
  source: 'upload' | 'files' | 'drive' | 'form';
}

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const mimeOf = (name: string | null, mime: string | null) => (mime && mime !== 'application/octet-stream' ? mime : EXT_MIME[(name ?? '').split('.').pop()?.toLowerCase() ?? ''] ?? mime);

/** What the preview window needs to show one document of a record, wherever its file lives. */
async function documentPreview_(docId: string): Promise<DocPreview> {
  if (!ID.test(docId)) throw new Error('That document could not be found.');
  const actor = await requireAdminActor();
  const db = looseAdmin();
  const { data: d } = await db.from('mjengo_documents').select('name, file_path, file_name, file_size, mime_type, vault_file_id, drive_file_id, drive_link, form_id').eq('id', docId).maybeSingle();
  if (!d) throw new Error('That document could not be found.');
  const sign = async (path: string, download?: string) => {
    const { data, error } = await db.storage.from('mjengo-docs').createSignedUrl(path, 600, download ? { download } : undefined);
    if (error || !data) throw new Error('Could not open the file.');
    return data.signedUrl;
  };
  if (d.file_path) {
    const name = d.file_name || d.name;
    return { name, mime: mimeOf(name, d.mime_type), size: d.file_size, url: await sign(d.file_path), downloadUrl: await sign(d.file_path, name), embed: null, link: null, source: 'upload' };
  }
  if (d.vault_file_id) {
    const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(actor.email)]);
    const f = ix.files.get(d.vault_file_id);
    if (!f) throw new Error('That file no longer exists in Files.');
    if (!atLeast(levelFor(ix, actor.id, 'file', f.id, oversight), 'view')) throw new Error('You do not have access to that file in Files.');
    return { name: f.name, mime: mimeOf(f.name, f.mime), size: f.size, url: await sign(f.storage_path), downloadUrl: await sign(f.storage_path, f.name), embed: null, link: null, source: 'files' };
  }
  if (d.drive_file_id) {
    return { name: d.file_name || d.name, mime: d.mime_type, size: null, url: null, downloadUrl: null, embed: `https://drive.google.com/file/d/${encodeURIComponent(d.drive_file_id)}/preview`, link: d.drive_link, source: 'drive' };
  }
  if (d.form_id) {
    const { data: f } = await db.from('mjengo_forms').select('id, slug, title').eq('id', d.form_id).maybeSingle();
    if (!f) throw new Error('That form no longer exists.');
    return { name: f.title || d.name, mime: 'application/x-form', size: null, url: null, downloadUrl: null, embed: `/f/${encodeURIComponent(f.slug)}`, link: `/dashboard/mjengo/forms/${f.id}`, source: 'form' };
  }
  throw new Error('No file is attached yet.');
}

export const documentPreview = guard(documentPreview_);
export const attachVaultFile = guard(attachVaultFile_);
export const createFormForRecord = guard(createFormFor_);
export const searchDrive = guard(searchDrive_);
export const attachDriveFile = guard(attachDriveFile_);
