'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { encryptField } from '@/lib/security/crypto';
import { ensurePrivateDocs, readableFile } from '@/lib/mjengo/files-text';

const BUCKET = 'mjengo-docs';
const FREE_TOKENS = Number(process.env.MJENGO_AI_FREE_TOKENS ?? 500);

export interface ThreadRow { id: string; title: string; design_system_id: string | null; updated_at: string; status: 'idle' | 'running' | 'failed'; error: string | null }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; asset_id: string | null; created_at: string }
export interface AiSettings { provider: 'openrouter' | 'openai' | 'chatgpt' | null; chatgptAvailable: boolean; hasKey: boolean; model: string | null; freeLimit: number; freeUsed: number; sharedAvailable: boolean }
export interface DesignSystem { id: string; name: string; description: string | null; colors: string[]; fonts: string | null; voice: string | null; notes: string | null }
export interface AssetRow { id: string; name: string; prompt: string | null; mime: string | null; kind: string; created_at: string; url: string | null; design_system_id: string | null }

async function listThreads_(): Promise<ThreadRow[]> {
  const a = await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_ai_threads').select('id, title, design_system_id, updated_at, status, error').eq('owner_id', a.id).order('updated_at', { ascending: false }).limit(100);
  return (data ?? []) as ThreadRow[];
}

async function getThread_(id: string): Promise<{ thread: ThreadRow; messages: ChatMessage[]; assets: Record<string, string> }> {
  const a = await requireAdminActor();
  const db = looseAdmin();
  const { data: thread } = await db.from('mjengo_ai_threads').select('id, title, design_system_id, updated_at, status, error').eq('id', id).eq('owner_id', a.id).maybeSingle();
  if (!thread) throw new Error('That chat no longer exists.');
  const { data: msgs } = await db.from('mjengo_ai_messages').select('id, role, content, asset_id, created_at').eq('thread_id', id).order('created_at');
  const messages = (msgs ?? []) as ChatMessage[];
  return { thread: thread as ThreadRow, messages, assets: await signAssets(messages.map((m) => m.asset_id).filter(Boolean) as string[]) };
}

async function signAssets(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const db = looseAdmin();
  const { data } = await db.from('mjengo_assets').select('id, path').in('id', ids);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { id: string; path: string }[]) {
    const s = await db.storage.from(BUCKET).createSignedUrl(r.path, 3600);
    if (s.data?.signedUrl) out[r.id] = s.data.signedUrl;
  }
  return out;
}

async function renameThread_(id: string, title: string) {
  const a = await requireAdminActor();
  const t = title.trim().slice(0, 80);
  if (!t) throw new Error('Give the chat a name.');
  await looseAdmin().from('mjengo_ai_threads').update({ title: t }).eq('id', id).eq('owner_id', a.id);
}

async function deleteThread_(id: string) {
  const a = await requireAdminActor();
  await looseAdmin().from('mjengo_ai_threads').delete().eq('id', id).eq('owner_id', a.id);
}

async function setThreadDesign_(id: string, designSystemId: string | null) {
  const a = await requireAdminActor();
  await looseAdmin().from('mjengo_ai_threads').update({ design_system_id: designSystemId }).eq('id', id).eq('owner_id', a.id);
}

async function getSettings_(): Promise<AiSettings> {
  const a = await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_ai_settings').select('provider, api_key_enc, model, free_tokens_used').eq('owner_id', a.id).maybeSingle();
  return {
    provider: (data?.provider as AiSettings['provider']) ?? null,
    chatgptAvailable: !!process.env.OPENAI_SIWC_CLIENT_ID,
    hasKey: !!data?.api_key_enc,
    model: data?.model ?? null,
    freeLimit: FREE_TOKENS,
    freeUsed: data?.free_tokens_used ?? 0,
    sharedAvailable: !!process.env.OPENROUTER_API_KEY,
  };
}

async function saveKey_(provider: 'openrouter' | 'openai', apiKey: string, model: string | null) {
  const a = await requireAdminActor();
  const key = apiKey.trim();
  if (key.length < 20 || /\s/.test(key)) throw new Error('That does not look like an API key.');
  if (provider === 'openai' && !key.startsWith('sk-')) throw new Error('OpenAI keys start with "sk-".');
  // Check it works before keeping it.
  const probe = await fetch(provider === 'openai' ? 'https://api.openai.com/v1/models' : 'https://openrouter.ai/api/v1/auth/key', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!probe || probe.status === 401 || probe.status === 403) throw new Error('The provider did not accept that key.');
  await looseAdmin().from('mjengo_ai_settings').upsert(
    { owner_id: a.id, provider, api_key_enc: encryptField(key), model: model?.trim().slice(0, 100) || null, updated_at: new Date().toISOString() },
    { onConflict: 'owner_id' }
  );
}

async function removeKey_() {
  const a = await requireAdminActor();
  await looseAdmin().from('mjengo_ai_settings').update({ provider: null, api_key_enc: null, refresh_token_enc: null, model: null }).eq('owner_id', a.id);
}

async function privateDocsFolder_(): Promise<string> {
  const a = await requireAdminActor();
  return ensurePrivateDocs(a.id);
}

export interface DesignFile { file_id: string; name: string; readable: boolean }

async function designFiles_(designSystemId: string): Promise<DesignFile[]> {
  await requireAdminActor();
  const db = looseAdmin();
  const { data } = await db.from('mjengo_design_system_files').select('file_id, excerpt').eq('design_system_id', designSystemId);
  const rows = (data ?? []) as { file_id: string; excerpt: string | null }[];
  if (!rows.length) return [];
  const { data: files } = await db.from('vault_files').select('id, name').in('id', rows.map((r) => r.file_id));
  const names = new Map(((files ?? []) as { id: string; name: string }[]).map((f) => [f.id, f.name]));
  return rows.map((r) => ({ file_id: r.file_id, name: names.get(r.file_id) ?? 'File', readable: !!r.excerpt }));
}

/** Use a file already in the vault (or one just uploaded to Private docs) to steer a design system. */
async function attachDesignFile_(designSystemId: string, fileId: string): Promise<DesignFile> {
  const a = await requireAdminActor();
  const f = await readableFile(a.id, a.email, fileId, 6000);
  const { error } = await looseAdmin().from('mjengo_design_system_files').upsert(
    { design_system_id: designSystemId, file_id: fileId, excerpt: f.text || null, added_by: a.id },
    { onConflict: 'design_system_id,file_id' }
  );
  if (error) throw new Error('Could not attach the file.');
  return { file_id: f.id, name: f.name, readable: !!f.text };
}

async function detachDesignFile_(designSystemId: string, fileId: string) {
  await requireAdminActor();
  await looseAdmin().from('mjengo_design_system_files').delete().eq('design_system_id', designSystemId).eq('file_id', fileId);
}

async function listDesignSystems_(): Promise<DesignSystem[]> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_design_systems').select('id, name, description, colors, fonts, voice, notes').order('name');
  return (data ?? []) as DesignSystem[];
}

async function saveDesignSystem_(id: string | null, v: { name: string; description?: string | null; colors?: string[]; fonts?: string | null; voice?: string | null; notes?: string | null }): Promise<DesignSystem> {
  const a = await requireAdminActor();
  const name = v.name.trim().slice(0, 80);
  if (!name) throw new Error('Name the design system.');
  const colors = (v.colors ?? []).map((c) => c.trim()).filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c)).slice(0, 12);
  const row = { name, description: v.description?.slice(0, 500) || null, colors, fonts: v.fonts?.slice(0, 200) || null, voice: v.voice?.slice(0, 500) || null, notes: v.notes?.slice(0, 2000) || null };
  const q = id ? looseAdmin().from('mjengo_design_systems').update(row).eq('id', id) : looseAdmin().from('mjengo_design_systems').insert({ ...row, created_by: a.id });
  const { data, error } = await q.select('id, name, description, colors, fonts, voice, notes').single();
  if (error || !data) throw new Error('Could not save the design system.');
  return data as DesignSystem;
}

async function deleteDesignSystem_(id: string) {
  await requireAdminActor();
  await looseAdmin().from('mjengo_design_systems').delete().eq('id', id);
}

async function listAssets_(): Promise<AssetRow[]> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_assets').select('id, name, prompt, mime, kind, created_at, design_system_id, path').order('created_at', { ascending: false }).limit(200);
  const rows = (data ?? []) as (Omit<AssetRow, 'url'> & { path: string })[];
  const urls = await signAssets(rows.map((r) => r.id));
  return rows.map(({ path: _p, ...r }) => ({ ...r, url: urls[r.id] ?? null }));
}

async function deleteAsset_(id: string) {
  await requireAdminActor();
  const db = looseAdmin();
  const { data } = await db.from('mjengo_assets').select('path').eq('id', id).maybeSingle();
  if (data?.path) await db.storage.from(BUCKET).remove([data.path]);
  await db.from('mjengo_assets').delete().eq('id', id);
}

export const listThreads = guard(listThreads_);
export const getThread = guard(getThread_);
export const renameThread = guard(renameThread_);
export const deleteThread = guard(deleteThread_);
export const setThreadDesign = guard(setThreadDesign_);
export const getAiSettings = guard(getSettings_);
export const saveAiKey = guard(saveKey_);
export const removeAiKey = guard(removeKey_);
export const privateDocsFolder = guard(privateDocsFolder_);
export const designFiles = guard(designFiles_);
export const attachDesignFile = guard(attachDesignFile_);
export const detachDesignFile = guard(detachDesignFile_);
export const listDesignSystems = guard(listDesignSystems_);
export const saveDesignSystem = guard(saveDesignSystem_);
export const deleteDesignSystem = guard(deleteDesignSystem_);
export const listAssets = guard(listAssets_);
export const deleteAsset = guard(deleteAsset_);
