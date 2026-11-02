const API = 'https://www.googleapis.com/drive/v3';
const H = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface DriveFileHit { id: string; name: string; mime: string; link: string | null; modified: string | null }

/** Files (not folders) in the Drive this app can see, newest first, optionally those whose name contains `query`. */
export async function searchFiles(token: string, query: string): Promise<DriveFileHit[]> {
  const term = query.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'").slice(0, 100);
  const q = new URLSearchParams({
    q: `trashed=false and mimeType!='application/vnd.google-apps.folder'${term ? ` and name contains '${term}'` : ''}`,
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
    pageSize: '25',
    orderBy: 'modifiedTime desc',
  });
  const res = await fetch(`${API}/files?${q}`, { headers: H(token), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error('Could not search Google Drive.');
  const j = (await res.json()) as { files?: { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string }[] };
  return (j.files ?? []).map((f) => ({ id: f.id, name: f.name, mime: f.mimeType, link: f.webViewLink ?? null, modified: f.modifiedTime ?? null }));
}

/** One file's details from its Drive id, for a link that was pasted in. */
export async function fileInfo(token: string, id: string): Promise<DriveFileHit | null> {
  const res = await fetch(`${API}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,webViewLink,modifiedTime`, { headers: H(token), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const f = (await res.json()) as { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string };
  return { id: f.id, name: f.name, mime: f.mimeType, link: f.webViewLink ?? null, modified: f.modifiedTime ?? null };
}
