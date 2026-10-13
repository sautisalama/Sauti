'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';

export interface PdfComment {
  id: string;
  page: number;
  x: number;
  y: number;
  body: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string;
  resolved: boolean;
  createdAt: string;
  mine: boolean;
}

const UUID = /^[0-9a-f-]{36}$/i;

/** Anyone who can open the file can read and add comments; only the writer or someone who can edit removes one. */
async function levelOnFile(fileId: string) {
  if (!UUID.test(fileId)) throw new Error('That file is not available.');
  const a = await requireAdminActor();
  const ix = await loadIndex();
  const level = levelFor(ix, a.id, 'file', fileId, await oversightFor(a.email));
  if (!level) throw new Error('You do not have access to this file.');
  return { a, level };
}

async function list_(fileId: string): Promise<PdfComment[]> {
  const { a } = await levelOnFile(fileId);
  const db = looseAdmin();
  const { data } = await db.from('mjengo_pdf_comments').select('id, page, x, y, body, parent_id, author_id, resolved, created_at').eq('file_id', fileId).order('created_at', { ascending: true });
  const rows = (data ?? []) as { id: string; page: number; x: number; y: number; body: string; parent_id: string | null; author_id: string | null; resolved: boolean; created_at: string }[];
  const ids = [...new Set(rows.map((r) => r.author_id).filter(Boolean))] as string[];
  const { data: profs } = ids.length ? await db.from('profiles').select('id, first_name, last_name').in('id', ids) : { data: [] };
  const names = new Map(((profs ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map((p) => [p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Someone']));
  return rows.map((r) => ({ id: r.id, page: r.page, x: r.x, y: r.y, body: r.body, parentId: r.parent_id, authorId: r.author_id, authorName: r.author_id ? names.get(r.author_id) ?? 'Someone' : 'Someone', resolved: r.resolved, createdAt: r.created_at, mine: r.author_id === a.id }));
}

async function add_(fileId: string, input: { page: number; x: number; y: number; body: string; parentId?: string | null }): Promise<void> {
  const { a } = await levelOnFile(fileId);
  const body = input.body.trim().slice(0, 2000);
  if (!body) throw new Error('Write a comment first.');
  const db = looseAdmin();
  let { page, x, y } = input;
  if (input.parentId) {
    // A reply sits at its thread's spot.
    const { data: root } = await db.from('mjengo_pdf_comments').select('page, x, y').eq('id', input.parentId).eq('file_id', fileId).maybeSingle();
    if (!root) throw new Error('That comment is gone.');
    ({ page, x, y } = root as { page: number; x: number; y: number });
  }
  const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
  const { error } = await db.from('mjengo_pdf_comments').insert({ file_id: fileId, page: Math.max(0, Math.floor(page) || 0), x: clamp(x), y: clamp(y), body, parent_id: input.parentId ?? null, author_id: a.id });
  if (error) throw new Error('Could not save the comment.');
}

async function resolve_(fileId: string, id: string, resolved: boolean): Promise<void> {
  await levelOnFile(fileId);
  await looseAdmin().from('mjengo_pdf_comments').update({ resolved }).eq('id', id).eq('file_id', fileId).is('parent_id', null);
}

async function remove_(fileId: string, id: string): Promise<void> {
  const { a, level } = await levelOnFile(fileId);
  const db = looseAdmin();
  const { data: c } = await db.from('mjengo_pdf_comments').select('author_id').eq('id', id).eq('file_id', fileId).maybeSingle();
  if (!c) return;
  if (c.author_id !== a.id && !atLeast(level, 'edit')) throw new Error('Only the writer, or someone who can edit, can delete a comment.');
  await db.from('mjengo_pdf_comments').delete().eq('id', id).eq('file_id', fileId);
}

export const listPdfComments = guard(list_);
export const addPdfComment = guard(add_);
export const resolvePdfComment = guard(resolve_);
export const deletePdfComment = guard(remove_);
