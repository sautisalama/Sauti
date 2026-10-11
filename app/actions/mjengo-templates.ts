'use server';

import { randomUUID } from 'node:crypto';
import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { BUILTIN_DOCUMENTS, BUILTIN_POSTS, type TemplateLite } from '@/lib/mjengo/templates';

export type TemplateKind = 'document' | 'post' | 'design';
export interface TemplateRow extends TemplateLite { kind: TemplateKind; data: Record<string, unknown>; created_by: string | null }

/** Built-in templates first, then the team's own. Design templates are all the team's own (the built-ins live in the editor). */
async function list_(kind: TemplateKind): Promise<TemplateRow[]> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_templates').select('id, kind, name, description, body, data, created_by').eq('kind', kind).order('created_at', { ascending: false });
  const own = ((data ?? []) as { id: string; kind: TemplateKind; name: string; description: string | null; body: string | null; data: Record<string, unknown>; created_by: string | null }[]).map((r) => ({
    id: r.id, kind: r.kind, name: r.name, description: r.description ?? '', body: r.body ?? '', builtin: false, data: r.data ?? {}, created_by: r.created_by,
  }));
  const builtin = (kind === 'document' ? BUILTIN_DOCUMENTS : kind === 'post' ? BUILTIN_POSTS : []).map((t) => ({ ...t, kind, data: {}, created_by: null }));
  return [...builtin, ...own];
}

async function save_(id: string | null, v: { kind: TemplateKind; name: string; description?: string; body?: string; data?: Record<string, unknown> }): Promise<TemplateRow> {
  const a = await requireAdminActor();
  const name = v.name.trim().slice(0, 80);
  if (!name) throw new Error('Name the template.');
  const row = { kind: v.kind, name, description: v.description?.slice(0, 200) ?? null, body: v.body?.slice(0, 100_000) ?? null, data: v.data ?? {} };
  const q = id ? looseAdmin().from('mjengo_templates').update(row).eq('id', id) : looseAdmin().from('mjengo_templates').insert({ ...row, created_by: a.id });
  const { data, error } = await q.select('id, kind, name, description, body, data, created_by').single();
  if (error || !data) throw new Error('Could not save the template.');
  return { id: data.id, kind: data.kind, name: data.name, description: data.description ?? '', body: data.body ?? '', builtin: false, data: data.data ?? {}, created_by: data.created_by };
}

async function remove_(id: string) {
  await requireAdminActor();
  await looseAdmin().from('mjengo_templates').delete().eq('id', id);
}

/** Save a finished design into Studio: a one-time upload link, then record the image. */
async function studioUpload_(): Promise<{ path: string; signedUrl: string }> {
  const a = await requireAdminActor();
  const path = `studio/${a.id}-${randomUUID()}.png`;
  const { data, error } = await looseAdmin().storage.from('mjengo-docs').createSignedUploadUrl(path);
  if (error || !data) throw new Error('Could not start the save.');
  return { path, signedUrl: data.signedUrl };
}

async function studioRegister_(path: string, name: string, prompt: string | null): Promise<{ id: string }> {
  const a = await requireAdminActor();
  if (!path.startsWith('studio/')) throw new Error('That upload is not valid.');
  const { data, error } = await looseAdmin().from('mjengo_assets').insert({ name: name.slice(0, 80) || 'Design', path, mime: 'image/png', kind: 'image', prompt, created_by: a.id }).select('id').single();
  if (error || !data) throw new Error('Could not save the image.');
  return { id: data.id };
}

export const listTemplates = guard(list_);
export const saveTemplate = guard(save_);
export const deleteTemplate = guard(remove_);
export const studioUpload = guard(studioUpload_);
export const studioRegister = guard(studioRegister_);
