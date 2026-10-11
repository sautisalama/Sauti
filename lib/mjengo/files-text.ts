import { looseAdmin } from '@/lib/loose-db';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';

const BUCKET = 'mjengo-docs';

/** Plain text from a stored file: PDFs, Word documents and text files. Empty when the type is not readable. */
export async function extractText(path: string, name: string, mime: string | null, max = 8000): Promise<string> {
  const { data } = await looseAdmin().storage.from(BUCKET).download(path);
  if (!data) return '';
  const bytes = new Uint8Array(await data.arrayBuffer());
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
    if (['txt', 'md', 'csv', 'json', 'html'].includes(ext) || (mime ?? '').startsWith('text/')) {
      return Buffer.from(bytes).toString('utf8').slice(0, max);
    }
  } catch {
    /* unreadable: the file is still kept, just not read */
  }
  return '';
}

/** A vault file the person may open, with its text. Throws when they have no access. */
export async function readableFile(actorId: string, actorEmail: string, fileId: string, max = 8000) {
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(actorEmail)]);
  const f = ix.files.get(fileId);
  if (!f) throw new Error('That file no longer exists.');
  if (!atLeast(levelFor(ix, actorId, 'file', fileId, oversight), 'view')) throw new Error('You do not have access to that file.');
  return { id: f.id, name: f.name, text: await extractText(f.storage_path, f.name, f.mime, max) };
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
