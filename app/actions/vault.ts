'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor } from '@/lib/access/super-admin';
import {
  RANK, adminByEmail, atLeast, descendants, levelFor, loadIndex, oversightFor, pathTo,
  recipientLevels,
  type FileNode, type FolderNode, type General, type Level, type ResType, type RecipientLevel,
} from '@/lib/vault/access';

const BUCKET = 'mjengo-docs';
const MAX_BYTES = 50 * 1024 * 1024;

export interface VaultItem {
  type: ResType;
  id: string;
  name: string;
  /** Your effective level here. */
  level: Level;
  ownerId: string;
  ownerName: string;
  shared: boolean;
  general: General;
  size?: number;
  mime?: string | null;
  createdAt?: string;
}

export interface VaultListing {
  /** Breadcrumb from the root. */
  path: { id: string; name: string }[];
  /** Your level on the open folder (null at the root, where you may always create). */
  here: Level | null;
  items: VaultItem[];
}

async function ctx() {
  const actor = await requireAdminActor();
  const [ix, oversight, names] = await Promise.all([loadIndex(), oversightFor(actor.email), adminNames()]);
  return { actor, ix, oversight, names };
}
type Ctx = Awaited<ReturnType<typeof ctx>>;

async function adminNames(): Promise<Map<string, string>> {
  const { data } = await looseAdmin().from('profiles').select('id, first_name, last_name, email').eq('is_admin', true);
  return new Map((data ?? []).map((p: { id: string; first_name: string | null; last_name: string | null; email: string | null }) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Admin']));
}

const lvl = (c: Ctx, type: ResType, id: string) => levelFor(c.ix, c.actor.id, type, id, c.oversight);

function need(c: Ctx, type: ResType, id: string, min: Level, what: string): Level {
  const l = lvl(c, type, id);
  if (!atLeast(l, min)) throw new Error(l ? `You can only ${l === 'view' ? 'view' : 'view and share'} this, so you cannot ${what}.` : 'You do not have access to this.');
  return l!;
}

function toItems(c: Ctx, folders: FolderNode[], files: FileNode[]): VaultItem[] {
  const sharedIds = new Set(c.ix.perms.map((p) => `${p.resource_type}:${p.resource_id}`));
  const out: VaultItem[] = [];
  for (const f of folders) {
    const l = lvl(c, 'folder', f.id);
    if (l) out.push({ type: 'folder', id: f.id, name: f.name, level: l, ownerId: f.owner_id, ownerName: c.names.get(f.owner_id) ?? 'Unknown', shared: f.general_access !== 'restricted' || sharedIds.has(`folder:${f.id}`), general: f.general_access });
  }
  for (const f of files) {
    const l = lvl(c, 'file', f.id);
    if (l) out.push({ type: 'file', id: f.id, name: f.name, level: l, ownerId: f.owner_id, ownerName: c.names.get(f.owner_id) ?? 'Unknown', shared: f.general_access !== 'restricted' || sharedIds.has(`file:${f.id}`), general: f.general_access, size: f.size, mime: f.mime, createdAt: f.created_at });
  }
  return out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1));
}

/** mine: top level of what you own. folder: children of a folder you can open. shared: things others gave you. */
async function listVault_(view: 'mine' | 'folder' | 'shared', folderId: string | null = null): Promise<VaultListing> {
  const c = await ctx();
  const all = { folders: [...c.ix.folders.values()], files: [...c.ix.files.values()] };
  if (view === 'folder' && folderId) {
    const here = need(c, 'folder', folderId, 'view', 'open it');
    const items = toItems(c, all.folders.filter((f) => f.parent_id === folderId), all.files.filter((f) => f.folder_id === folderId));
    return { path: pathTo(c.ix, folderId).map((f) => ({ id: f.id, name: f.name })), here, items };
  }
  if (view === 'shared') {
    // Not yours, you can open it, and the folder it sits in is not already shown to you.
    const visibleFolder = (id: string | null) => !!id && !!lvl(c, 'folder', id);
    const items = toItems(
      c,
      all.folders.filter((f) => f.owner_id !== c.actor.id && !visibleFolder(f.parent_id)),
      all.files.filter((f) => f.owner_id !== c.actor.id && !visibleFolder(f.folder_id))
    );
    return { path: [], here: null, items };
  }
  const items = toItems(c, all.folders.filter((f) => !f.parent_id && f.owner_id === c.actor.id), all.files.filter((f) => !f.folder_id && f.owner_id === c.actor.id));
  return { path: [], here: null, items };
}

async function createFolder_(parentId: string | null, name: string): Promise<VaultItem> {
  const c = await ctx();
  const n = name.trim().slice(0, 120);
  if (!n) throw new Error('Name the folder.');
  if (parentId) need(c, 'folder', parentId, 'edit', 'add a folder here');
  const { data, error } = await looseAdmin().from('vault_folders').insert({ parent_id: parentId, name: n, owner_id: c.actor.id }).select('id').single();
  if (error || !data) throw new Error('Could not create the folder.');
  await logAudit({ actorId: c.actor.id, actorEmail: c.actor.email, action: 'vault.folder_created', targetType: 'vault_folder', targetId: data.id, targetLabel: n });
  return { type: 'folder', id: data.id, name: n, level: 'edit', ownerId: c.actor.id, ownerName: c.actor.name, shared: false, general: 'restricted' };
}

/** Step 1 of an upload: a one-time signed URL under vault/<you>/, after checking you may write to the folder. */
async function prepareUpload_(folderId: string | null, fileName: string, size: number): Promise<{ path: string; signedUrl: string }> {
  const c = await ctx();
  if (folderId) need(c, 'folder', folderId, 'edit', 'upload here');
  if (!(size > 0) || size > MAX_BYTES) throw new Error('Files can be up to 50 MB.');
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'file';
  const path = `vault/${c.actor.id}/${crypto.randomUUID()}-${safe}`;
  const { data, error } = await looseAdmin().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error('Could not start the upload.');
  return { path, signedUrl: data.signedUrl };
}

/** Step 2: record the uploaded object. The path must be one we handed out to this person. */
async function registerUpload_(folderId: string | null, path: string, name: string, size: number, mime: string | null): Promise<VaultItem> {
  const c = await ctx();
  if (!path.startsWith(`vault/${c.actor.id}/`)) throw new Error('That upload does not belong to you.');
  if (folderId) need(c, 'folder', folderId, 'edit', 'upload here');
  const n = name.trim().slice(0, 200) || 'Untitled';
  const { data, error } = await looseAdmin().from('vault_files').insert({ folder_id: folderId, name: n, storage_path: path, mime, size, owner_id: c.actor.id }).select('id, created_at').single();
  if (error || !data) throw new Error('Could not save the file.');
  await logAudit({ actorId: c.actor.id, actorEmail: c.actor.email, action: 'vault.file_uploaded', targetType: 'vault_file', targetId: data.id, targetLabel: n });
  return { type: 'file', id: data.id, name: n, level: 'edit', ownerId: c.actor.id, ownerName: c.actor.name, shared: false, general: 'restricted', size, mime, createdAt: data.created_at };
}

async function renameItem_(type: ResType, id: string, name: string) {
  const c = await ctx();
  const n = name.trim().slice(0, 200);
  if (!n) throw new Error('Enter a name.');
  need(c, type, id, 'edit', 'rename it');
  await looseAdmin().from(type === 'folder' ? 'vault_folders' : 'vault_files').update({ name: n }).eq('id', id);
  await logAudit({ actorId: c.actor.id, actorEmail: c.actor.email, action: 'vault.renamed', targetType: `vault_${type}`, targetId: id, targetLabel: n });
}

async function deleteItem_(type: ResType, id: string) {
  const c = await ctx();
  need(c, type, id, 'edit', 'delete it');
  const db = looseAdmin();
  let paths: string[] = [];
  let label = '';
  if (type === 'file') {
    const f = c.ix.files.get(id);
    paths = f ? [f.storage_path] : [];
    label = f?.name ?? '';
  } else {
    const d = descendants(c.ix, id);
    // Deleting a folder deletes what is inside, so you must be able to edit every part of it.
    for (const sub of d.folders) if (!atLeast(lvl(c, 'folder', sub), 'edit')) throw new Error('This folder contains items you cannot delete.');
    for (const f of d.files) if (!atLeast(lvl(c, 'file', f.id), 'edit')) throw new Error('This folder contains files you cannot delete.');
    paths = d.files.map((f) => f.storage_path);
    label = c.ix.folders.get(id)?.name ?? '';
  }
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
  await db.from(type === 'folder' ? 'vault_folders' : 'vault_files').delete().eq('id', id);
  await db.from('vault_permissions').delete().eq('resource_type', type).eq('resource_id', id);
  await logAudit({ actorId: c.actor.id, actorEmail: c.actor.email, action: 'vault.deleted', targetType: `vault_${type}`, targetId: id, targetLabel: label });
}

async function getFileUrl_(id: string): Promise<{ url: string; name: string; level: Level; folderId: string | null; mime: string | null }> {
  const c = await ctx();
  const level = need(c, 'file', id, 'view', 'open it');
  const f = c.ix.files.get(id);
  if (!f) throw new Error('That file no longer exists.');
  const { data, error } = await looseAdmin().storage.from(BUCKET).createSignedUrl(f.storage_path, 300, { download: f.name });
  if (error || !data) throw new Error('Could not open the file.');
  if (f.owner_id !== c.actor.id) await logAudit({ actorId: c.actor.id, actorEmail: c.actor.email, action: 'vault.file_opened', targetType: 'vault_file', targetId: id, targetLabel: f.name });
  return { url: data.signedUrl, name: f.name, level, folderId: f.folder_id, mime: f.mime };
}

/** Overwrite a file's contents (the document editor saving): a one-time signed URL that may replace the object. */
async function prepareReplace_(id: string): Promise<{ signedUrl: string }> {
  const c = await ctx();
  need(c, 'file', id, 'edit', 'save changes to it');
  const f = c.ix.files.get(id);
  if (!f) throw new Error('That file no longer exists.');
  const { data, error } = await looseAdmin().storage.from(BUCKET).createSignedUploadUrl(f.storage_path, { upsert: true });
  if (error || !data) throw new Error('Could not start the save.');
  return { signedUrl: data.signedUrl };
}

async function finishReplace_(id: string, size: number) {
  const c = await ctx();
  need(c, 'file', id, 'edit', 'save changes to it');
  const f = c.ix.files.get(id);
  await looseAdmin().from('vault_files').update({ size }).eq('id', id);
  await logAudit({ actorId: c.actor.id, actorEmail: c.actor.email, action: 'vault.file_saved', targetType: 'vault_file', targetId: id, targetLabel: f?.name });
}

export interface AccessEntry { userId: string; name: string; email: string; level: Level; inherited: boolean }
export interface AccessView {
  name: string;
  owner: { id: string; name: string };
  general: General;
  people: AccessEntry[];
  /** What you may change here. */
  myLevel: Level;
}

/** Who has access: the owner, explicit grants and grants inherited from parent folders. Needs share rights. */
async function getAccess_(type: ResType, id: string): Promise<AccessView> {
  const c = await ctx();
  const mine = need(c, type, id, 'share', 'see who has access');
  const node = type === 'file' ? c.ix.files.get(id) : c.ix.folders.get(id);
  if (!node) throw new Error('That item no longer exists.');
  const parents = new Set<string>();
  let cur = type === 'file' ? c.ix.files.get(id)!.folder_id : c.ix.folders.get(id)!.parent_id;
  while (cur && !parents.has(cur)) { parents.add(cur); cur = c.ix.folders.get(cur)?.parent_id ?? null; }
  const { data: profs } = await looseAdmin().from('profiles').select('id, email, first_name, last_name');
  const info = new Map((profs ?? []).map((p: { id: string; email: string | null; first_name: string | null; last_name: string | null }) => [p.id, { email: p.email ?? '', name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown' }]));
  const best = new Map<string, AccessEntry>();
  for (const p of c.ix.perms) {
    const direct = p.resource_type === type && p.resource_id === id;
    const inherited = p.resource_type === 'folder' && parents.has(p.resource_id);
    if (!direct && !inherited) continue;
    const i = info.get(p.user_id);
    if (!i || p.user_id === node.owner_id) continue;
    const prev = best.get(p.user_id);
    if (!prev || RANK[p.level] > RANK[prev.level]) best.set(p.user_id, { userId: p.user_id, name: i.name, email: i.email, level: p.level, inherited: !direct });
  }
  return {
    name: node.name,
    owner: { id: node.owner_id, name: info.get(node.owner_id)?.name ?? 'Unknown' },
    general: node.general_access,
    people: [...best.values()].sort((a, b) => a.name.localeCompare(b.name)),
    myLevel: mine,
  };
}

/** Give, change or (level = null) remove one person's access. Share holders can grant view/share; only editors can grant edit. */
async function setPermission_(type: ResType, id: string, userId: string, level: Level | null) {
  const c = await ctx();
  const mine = need(c, type, id, 'share', 'change who has access');
  const node = type === 'file' ? c.ix.files.get(id) : c.ix.folders.get(id);
  if (!node) throw new Error('That item no longer exists.');
  if (userId === node.owner_id) throw new Error('The owner always has full access.');
  if (level === 'edit' && mine !== 'edit') throw new Error('Only people who can edit may give edit access.');
  const { data: target } = await looseAdmin().from('profiles').select('email, is_admin').eq('id', userId).maybeSingle();
  if (!target?.is_admin) throw new Error('Only Mjengo administrators can be given access.');
  const db = looseAdmin();
  if (level) await db.from('vault_permissions').upsert({ resource_type: type, resource_id: id, user_id: userId, level, granted_by: c.actor.id }, { onConflict: 'resource_type,resource_id,user_id' });
  else {
    const existing = c.ix.perms.find((p) => p.user_id === userId && p.resource_type === type && p.resource_id === id);
    if (existing?.level === 'edit' && mine !== 'edit') throw new Error('Only people who can edit may remove edit access.');
    await db.from('vault_permissions').delete().eq('resource_type', type).eq('resource_id', id).eq('user_id', userId);
  }
  await logAudit({ actorId: c.actor.id, actorEmail: c.actor.email, action: level ? 'vault.shared' : 'vault.unshared', targetType: `vault_${type}`, targetId: id, targetLabel: node.name, details: { with: target.email, level } });
}

async function setGeneralAccess_(type: ResType, id: string, general: General) {
  const c = await ctx();
  need(c, type, id, 'share', 'change general access');
  if (!['restricted', 'admins_view', 'admins_share'].includes(general)) throw new Error('Unknown access setting.');
  const node = type === 'file' ? c.ix.files.get(id) : c.ix.folders.get(id);
  await looseAdmin().from(type === 'folder' ? 'vault_folders' : 'vault_files').update({ general_access: general }).eq('id', id);
  await logAudit({ actorId: c.actor.id, actorEmail: c.actor.email, action: 'vault.general_access', targetType: `vault_${type}`, targetId: id, targetLabel: node?.name, details: { general } });
}

export interface PersonRow { id: string; name: string; email: string }
async function listPeople_(): Promise<PersonRow[]> {
  const actor = await requireAdminActor();
  const { data } = await looseAdmin().from('profiles').select('id, email, first_name, last_name').eq('is_admin', true).order('first_name');
  return (data ?? [])
    .filter((p: { id: string }) => p.id !== actor.id)
    .map((p: { id: string; email: string | null; first_name: string | null; last_name: string | null }) => ({ id: p.id, email: p.email ?? '', name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Admin' }));
}

/** Files you may attach, for the mail composer's picker. */
async function searchFiles_(q: string): Promise<{ id: string; name: string; size: number; level: Level; folder: string | null }[]> {
  const c = await ctx();
  const term = q.trim().toLowerCase();
  return [...c.ix.files.values()]
    .filter((f) => !term || f.name.toLowerCase().includes(term))
    .map((f) => ({ f, l: lvl(c, 'file', f.id) }))
    .filter((x): x is { f: FileNode; l: Level } => !!x.l)
    .sort((a, b) => b.f.created_at.localeCompare(a.f.created_at))
    .slice(0, 40)
    .map(({ f, l }) => ({ id: f.id, name: f.name, size: f.size, level: l, folder: f.folder_id ? c.ix.folders.get(f.folder_id)?.name ?? null : null }));
}

export interface RecipientCheck {
  fileId: string;
  fileName: string;
  /** Your own level: whether you may grant access to others. */
  senderCanShare: boolean;
  recipients: RecipientLevel[];
}

/** For each linked file and each recipient: can they view it? Used before sending so the sender can be told. */
async function checkRecipients_(fileIds: string[], emails: string[]): Promise<RecipientCheck[]> {
  const c = await ctx();
  const out: RecipientCheck[] = [];
  for (const id of fileIds) {
    const f = c.ix.files.get(id);
    if (!f) continue;
    const mine = lvl(c, 'file', id);
    if (!mine) throw new Error(`You do not have access to "${f.name}".`);
    out.push({ fileId: id, fileName: f.name, senderCanShare: atLeast(mine, 'share'), recipients: await recipientLevels(c.ix, id, emails) });
  }
  return out;
}

/** Grant view access to named recipients for these files (sender must hold share rights on each). */
async function grantViewTo_(fileIds: string[], emails: string[]): Promise<{ granted: number; skipped: string[] }> {
  const c = await ctx();
  let granted = 0;
  const skipped: string[] = [];
  const db = looseAdmin();
  for (const id of fileIds) {
    const f = c.ix.files.get(id);
    if (!f || !atLeast(lvl(c, 'file', id), 'share')) { skipped.push(f?.name ?? id); continue; }
    for (const e of emails) {
      const p = await adminByEmail(e);
      if (!p || p.id === f.owner_id) continue;
      if (levelFor(c.ix, p.id, 'file', id)) continue;
      await db.from('vault_permissions').upsert({ resource_type: 'file', resource_id: id, user_id: p.id, level: 'view', granted_by: c.actor.id }, { onConflict: 'resource_type,resource_id,user_id' });
      await logAudit({ actorId: c.actor.id, actorEmail: c.actor.email, action: 'vault.shared', targetType: 'vault_file', targetId: id, targetLabel: f.name, details: { with: p.email, level: 'view', via: 'mail' } });
      granted++;
    }
  }
  return { granted, skipped };
}

export const listVault = guard(listVault_);
export const createFolder = guard(createFolder_);
export const prepareUpload = guard(prepareUpload_);
export const registerUpload = guard(registerUpload_);
export const renameItem = guard(renameItem_);
export const deleteItem = guard(deleteItem_);
export const getFileUrl = guard(getFileUrl_);
export const prepareReplace = guard(prepareReplace_);
export const finishReplace = guard(finishReplace_);
export const getAccess = guard(getAccess_);
export const setPermission = guard(setPermission_);
export const setGeneralAccess = guard(setGeneralAccess_);
export const listPeople = guard(listPeople_);
export const searchFiles = guard(searchFiles_);
export const checkRecipients = guard(checkRecipients_);
export const grantViewTo = guard(grantViewTo_);
