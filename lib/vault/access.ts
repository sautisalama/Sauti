import { looseAdmin } from '@/lib/loose-db';
import { isSuperAdminEmail } from '@/lib/access/super-admin';

/** view < share (view + pass it on) < edit (rename, upload, delete, manage people). */
export type Level = 'view' | 'share' | 'edit';
export type General = 'restricted' | 'admins_view' | 'admins_share';
export type ResType = 'folder' | 'file';

export const RANK: Record<Level, number> = { view: 1, share: 2, edit: 3 };
export const atLeast = (have: Level | null, need: Level) => !!have && RANK[have] >= RANK[need];
const max = (a: Level | null, b: Level | null): Level | null => (!a ? b : !b ? a : RANK[a] >= RANK[b] ? a : b);
const fromGeneral = (g: General): Level | null => (g === 'admins_share' ? 'share' : g === 'admins_view' ? 'view' : null);

export interface FolderNode { id: string; parent_id: string | null; name: string; owner_id: string; general_access: General }
export interface FileNode { id: string; folder_id: string | null; name: string; storage_path: string; mime: string | null; size: number; owner_id: string; general_access: General; created_at: string }
interface Perm { resource_type: ResType; resource_id: string; user_id: string; level: Level }

/** Everything needed to answer "what can this person do here" without further queries. */
export interface VaultIndex {
  folders: Map<string, FolderNode>;
  files: Map<string, FileNode>;
  perms: Perm[];
}

export async function loadIndex(): Promise<VaultIndex> {
  const db = looseAdmin();
  const [f, fl, p] = await Promise.all([
    db.from('vault_folders').select('id, parent_id, name, owner_id, general_access'),
    db.from('vault_files').select('id, folder_id, name, storage_path, mime, size, owner_id, general_access, created_at'),
    db.from('vault_permissions').select('resource_type, resource_id, user_id, level'),
  ]);
  return {
    folders: new Map(((f.data ?? []) as FolderNode[]).map((x) => [x.id, x])),
    files: new Map(((fl.data ?? []) as FileNode[]).map((x) => [x.id, { ...x, size: Number(x.size) }])),
    perms: (p.data ?? []) as Perm[],
  };
}

/**
 * Effective level of one user on a file or folder: the owner, an explicit grant, a grant or ownership on any
 * parent folder, or general access. The highest one wins. `oversight` (super admins) always gets edit.
 */
export function levelFor(ix: VaultIndex, userId: string, type: ResType, id: string, oversight = false): Level | null {
  if (oversight) return 'edit';
  let level: Level | null = null;
  let t: ResType | null = type;
  let cur: string | null = id;
  const seen = new Set<string>();
  while (t && cur && !seen.has(cur)) {
    seen.add(cur);
    const node: FolderNode | FileNode | undefined = t === 'file' ? ix.files.get(cur) : ix.folders.get(cur);
    if (!node) break;
    if (node.owner_id === userId) return 'edit';
    level = max(level, fromGeneral(node.general_access));
    for (const p of ix.perms) if (p.user_id === userId && p.resource_type === t && p.resource_id === cur) level = max(level, p.level);
    cur = t === 'file' ? (node as FileNode).folder_id : (node as FolderNode).parent_id;
    t = 'folder';
  }
  return level;
}

/** Chain from the root down to a folder, for breadcrumbs. */
export function pathTo(ix: VaultIndex, folderId: string | null): FolderNode[] {
  const out: FolderNode[] = [];
  const seen = new Set<string>();
  let cur = folderId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const f = ix.folders.get(cur);
    if (!f) break;
    out.unshift(f);
    cur = f.parent_id;
  }
  return out;
}

export function descendants(ix: VaultIndex, folderId: string): { folders: string[]; files: FileNode[] } {
  const folders = [folderId];
  for (let i = 0; i < folders.length; i++) for (const f of ix.folders.values()) if (f.parent_id === folders[i] && !folders.includes(f.id)) folders.push(f.id);
  return { folders, files: [...ix.files.values()].filter((x) => x.folder_id && folders.includes(x.folder_id)) };
}

/** Profile for an email, only if they are an administrator (the vault is for the Mjengo suite). */
export async function adminByEmail(email: string): Promise<{ id: string; email: string; name: string } | null> {
  const { data } = await looseAdmin().from('profiles').select('id, email, first_name, last_name, is_admin').ilike('email', email.trim()).maybeSingle();
  if (!data || !data.is_admin) return null;
  return { id: data.id, email: data.email, name: [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email };
}

export async function oversightFor(email: string): Promise<boolean> {
  return isSuperAdminEmail(email);
}
