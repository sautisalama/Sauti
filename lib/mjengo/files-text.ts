import { looseAdmin } from '@/lib/loose-db';
import { atLeast, descendants, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';

const BUCKET = 'mjengo-docs';

/** The words in a drawing (its text boxes, the labels on its shapes and arrows, its frame names), one per line. */
export function excalidrawText(json: string, max = 12_000): string {
  try {
    const scene = JSON.parse(json) as { elements?: { type?: string; text?: string; name?: string; isDeleted?: boolean }[] };
    return (scene.elements ?? [])
      .filter((e) => !e.isDeleted)
      .map((e) => (e.type === 'text' ? e.text : e.type === 'frame' ? e.name : ''))
      .filter((t): t is string => !!t && t.trim().length > 0)
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .join('\n')
      .slice(0, max);
  } catch {
    return '';
  }
}

/** Plain text from the bytes of a PDF, Word document or text file. Empty when the type is not readable. */
export async function textFromBytes(bytes: Uint8Array, name: string, mime: string | null, max = 8000): Promise<string> {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  try {
    if (ext === 'pdf' || mime === 'application/pdf') {
      const { extractText: pdfText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(bytes);
      const { text } = await pdfText(pdf, { mergePages: true });
      return (Array.isArray(text) ? text.join('\n') : text).replace(/\s+\n/g, '\n').trim().slice(0, max);
    }
    if (ext === 'docx') {
      const mammoth = await import('mammoth');
      const r = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return r.value.trim().slice(0, max);
    }
    if (ext === 'deck') {
      try {
        const d = JSON.parse(Buffer.from(bytes).toString('utf8')) as { title?: string; slides?: { notes?: string; els?: { type?: string; text?: string }[] }[] };
        return [d.title ?? '', ...(d.slides ?? []).map((s, i) => `Slide ${i + 1}: ${(s.els ?? []).filter((e) => e.type === 'text' && e.text).map((e) => e.text).join(' / ')}${s.notes ? ` (notes: ${s.notes})` : ''}`)].join('\n').slice(0, max);
      } catch { return ''; }
    }
    if (ext === 'excalidraw') return excalidrawText(Buffer.from(bytes).toString('utf8'), max);
    if (['txt', 'md', 'csv', 'json', 'html'].includes(ext) || (mime ?? '').startsWith('text/')) {
      return Buffer.from(bytes).toString('utf8').slice(0, max);
    }
  } catch {
    /* unreadable: the file is still kept, just not read */
  }
  return '';
}

/** Plain text from a stored file: PDFs, Word documents and text files. Empty when the type is not readable. */
export async function extractText(path: string, name: string, mime: string | null, max = 8000): Promise<string> {
  const { data } = await looseAdmin().storage.from(BUCKET).download(path);
  if (!data) return '';
  return textFromBytes(new Uint8Array(await data.arrayBuffer()), name, mime, max);
}

/** A vault file the person may open, with its text. Throws when they have no access. */
export async function readableFile(actorId: string, actorEmail: string, fileId: string, max = 8000) {
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(actorEmail)]);
  const f = ix.files.get(fileId);
  if (!f) throw new Error('That file no longer exists.');
  if (!atLeast(levelFor(ix, actorId, 'file', fileId, oversight), 'view')) throw new Error('You do not have access to that file.');
  return { id: f.id, name: f.name, text: await extractText(f.storage_path, f.name, f.mime, max) };
}

/**
 * The readable files inside a vault folder (and its sub-folders) that this person may open, newest first.
 * Only vault folders can be given; each file is read for a limited amount of text.
 */
export async function readableFolder(actorId: string, actorEmail: string, folderId: string, files = 6, perFile = 3500): Promise<{ folder: string; files: { id: string; name: string; text: string }[]; total: number }> {
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(actorEmail)]);
  const folder = ix.folders.get(folderId);
  if (!folder) throw new Error('That folder no longer exists.');
  if (!atLeast(levelFor(ix, actorId, 'folder', folderId, oversight), 'view')) throw new Error('You do not have access to that folder.');
  const { files: all } = descendants(ix, folderId);
  const mine = all
    .filter((f) => atLeast(levelFor(ix, actorId, 'file', f.id, oversight), 'view'))
    .filter((f) => /\.(pdf|docx|txt|md|csv|json|html)$/i.test(f.name) || (f.mime ?? '').startsWith('text/'))
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
  const out: { id: string; name: string; text: string }[] = [];
  for (const f of mine.slice(0, files)) out.push({ id: f.id, name: f.name, text: await extractText(f.storage_path, f.name, f.mime, perFile) });
  return { folder: folder.name, files: out, total: mine.length };
}

/** The person's private folder for what they feed the assistant; created on first use. */
export async function ensurePrivateDocs(ownerId: string): Promise<string> {
  const db = looseAdmin();
  const { data } = await db.from('vault_folders').select('id').eq('owner_id', ownerId).is('parent_id', null).eq('name', 'Private docs').maybeSingle();
  if (data) return data.id;
  const { data: made, error } = await db.from('vault_folders').insert({ name: 'Private docs', owner_id: ownerId, parent_id: null, general_access: 'restricted' }).select('id').single();
  if (error || !made) throw new Error('Could not create your Private docs folder.');
  return made.id;
}
