import { looseAdmin } from '@/lib/loose-db';
import { decryptField, encryptField } from '@/lib/security/crypto';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export const DRIVE_ROOT_NAME = 'Sauti Salama';

export interface DriveFolder {
  id: string;
  name: string;
  link: string | null;
  people: { email: string | null; name: string | null; role: string; photo: string | null }[];
  modified: string | null;
}

/** Keep a person's Drive refresh token (encrypted). */
export async function saveDriveConnection(ownerId: string, refreshToken: string, email: string | null) {
  await looseAdmin().from('mjengo_drive_connections').upsert(
    { owner_id: ownerId, refresh_token_enc: encryptField(refreshToken), google_email: email, connected_at: new Date().toISOString() },
    { onConflict: 'owner_id' }
  );
}

export async function driveConnection(ownerId: string): Promise<{ email: string | null } | null> {
  const { data } = await looseAdmin().from('mjengo_drive_connections').select('google_email').eq('owner_id', ownerId).maybeSingle();
  return data ? { email: data.google_email } : null;
}

export async function dropDriveConnection(ownerId: string) {
  await looseAdmin().from('mjengo_drive_connections').delete().eq('owner_id', ownerId);
}

/** A fresh access token for this person, or null when they have not connected (or revoked access). */
export async function driveToken(ownerId: string): Promise<string | null> {
  const { data } = await looseAdmin().from('mjengo_drive_connections').select('refresh_token_enc').eq('owner_id', ownerId).maybeSingle();
  const refresh = data ? decryptField(data.refresh_token_enc) : null;
  if (!refresh || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res) return null;
  if (!res.ok) {
    // Access was revoked: forget the connection so the app asks again.
    if (res.status === 400 || res.status === 401) await dropDriveConnection(ownerId);
    return null;
  }
  const j = (await res.json()) as { access_token?: string };
  return j.access_token ?? null;
}

const H = (token: string) => ({ Authorization: `Bearer ${token}` });

/** The "Sauti Salama" folder, created on first use. With the drive.file scope only folders this app made are visible. */
export async function ensureRootFolder(token: string): Promise<string> {
  const q = new URLSearchParams({ q: `name='${DRIVE_ROOT_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)', pageSize: '1' });
  const found = await fetch(`${API}/files?${q}`, { headers: H(token), signal: AbortSignal.timeout(20_000) });
  if (found.ok) {
    const id = ((await found.json()) as { files?: { id: string }[] }).files?.[0]?.id;
    if (id) return id;
  }
  const made = await fetch(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { ...H(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_ROOT_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!made.ok) throw new Error('Could not create the folder in Google Drive.');
  return ((await made.json()) as { id: string }).id;
}

export async function createFolder(token: string, name: string, parent?: string): Promise<{ id: string; link: string | null }> {
  const res = await fetch(`${API}/files?fields=id,webViewLink`, {
    method: 'POST',
    headers: { ...H(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : {}) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error('Could not create the folder in Google Drive.');
  const j = (await res.json()) as { id: string; webViewLink?: string };
  return { id: j.id, link: j.webViewLink ?? null };
}

export async function renameFolder(token: string, id: string, name: string) {
  const res = await fetch(`${API}/files/${encodeURIComponent(id)}?fields=id`, {
    method: 'PATCH',
    headers: { ...H(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error('Google Drive did not accept the new name.');
}

/** Folders this app created in the person's Drive, with who can open each. */
export async function listFolders(token: string): Promise<DriveFolder[]> {
  const q = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id,name,webViewLink,modifiedTime,permissions(emailAddress,displayName,role,photoLink,type))',
    pageSize: '100',
    orderBy: 'name',
  });
  const res = await fetch(`${API}/files?${q}`, { headers: H(token), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error('Could not read your Google Drive folders.');
  const j = (await res.json()) as { files?: { id: string; name: string; webViewLink?: string; modifiedTime?: string; permissions?: { emailAddress?: string; displayName?: string; role: string; photoLink?: string; type?: string }[] }[] };
  return (j.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    link: f.webViewLink ?? null,
    modified: f.modifiedTime ?? null,
    people: (f.permissions ?? []).filter((p) => p.type === 'user' || p.type === 'group' || p.type === 'anyone').map((p) => ({ email: p.emailAddress ?? null, name: p.displayName ?? (p.type === 'anyone' ? 'Anyone with the link' : null), role: p.role, photo: p.photoLink ?? null })),
  }));
}

/** Put new content over a file this app already copied to Drive. */
export async function updateFileContent(token: string, driveFileId: string, bytes: Uint8Array, mime: string): Promise<void> {
  const res = await fetch(`${UPLOAD}/${encodeURIComponent(driveFileId)}?uploadType=media&fields=id`, {
    method: 'PATCH',
    headers: { ...H(token), 'Content-Type': mime || 'application/octet-stream' },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error('Google Drive did not accept the update.');
}

/** Upload a new file into a folder. Returns the Drive id and link. */
export async function uploadFile(token: string, name: string, bytes: Uint8Array, mime: string, parent?: string): Promise<{ id: string; link: string | null }> {
  const start = await fetch(`${UPLOAD}?uploadType=resumable&fields=id,webViewLink`, {
    method: 'POST',
    headers: { ...H(token), 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(bytes.byteLength) },
    body: JSON.stringify({ name, ...(parent ? { parents: [parent] } : {}) }),
    signal: AbortSignal.timeout(20_000),
  });
  const session = start.headers.get('location');
  if (!start.ok || !session) throw new Error('Google Drive did not accept the file.');
  const up = await fetch(session, { method: 'PUT', headers: { 'Content-Type': mime, 'Content-Length': String(bytes.byteLength) }, body: Buffer.from(bytes), signal: AbortSignal.timeout(45_000) });
  if (!up.ok) throw new Error('Google Drive did not accept the file.');
  const j = (await up.json()) as { id: string; webViewLink?: string };
  return { id: j.id, link: j.webViewLink ?? null };
}
