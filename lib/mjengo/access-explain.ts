import { looseAdmin } from '@/lib/loose-db';
import { isSuperAdminEmail } from '@/lib/access/super-admin';
import { atLeast, levelFor, loadIndex, type FileNode, type FolderNode, type VaultIndex } from '@/lib/vault/access';

export type AccessLevel = 'view' | 'share' | 'edit';
export interface WhoCanSee { id: string; name: string; level: AccessLevel; reasons: string[]; you: boolean }
export interface AccessExplanation {
  /** Everyone who can open it, with why. Only the people who may share it see the full list; others see themselves. */
  people: WhoCanSee[];
  fullList: boolean;
  /** The setting that opens it to the team, if any, in words. */
  general: string | null;
  /** Anyone with the link, if the link is on. */
  link: string | null;
}

const RANK: Record<AccessLevel, number> = { view: 1, share: 2, edit: 3 };
const GENERAL: Record<string, AccessLevel | null> = { restricted: null, admins_view: 'view', admins_share: 'share' };
const word = (l: AccessLevel) => (l === 'view' ? 'view' : l === 'share' ? 'view and share' : 'edit');

/** Every reason one person can open a file, walking up from the file through its folders, strongest first. */
export function reasonsFor(ix: VaultIndex, userId: string, fileId: string, names: Map<string, string>): { level: AccessLevel | null; reasons: string[] } {
  const reasons: { level: AccessLevel; text: string; rank: number }[] = [];
  let t: 'file' | 'folder' | null = 'file';
  let cur: string | null = fileId;
  const seen = new Set<string>();
  while (t && cur && !seen.has(cur)) {
    seen.add(cur);
    const node: FolderNode | FileNode | undefined = t === 'file' ? ix.files.get(cur) : ix.folders.get(cur);
    if (!node) break;
    const here = t === 'file' ? 'this file' : `the folder "${node.name}"`;
    if (node.owner_id === userId) { reasons.push({ level: 'edit', text: t === 'file' ? 'Owns this file' : `Owns the folder "${node.name}" it is in`, rank: 9 }); }
    for (const p of ix.perms) {
      if (p.user_id === userId && p.resource_type === t && p.resource_id === cur) {
        const by = (p as { granted_by?: string | null }).granted_by ? names.get((p as { granted_by?: string | null }).granted_by!) : null;
        reasons.push({ level: p.level, text: `Was given ${word(p.level)} access to ${here}${by ? ` by ${by}` : ''}`, rank: RANK[p.level] });
      }
    }
    const g = GENERAL[node.general_access] ?? null;
    if (g) reasons.push({ level: g, text: `${here === 'this file' ? 'This file is' : `The folder "${node.name}" is`} open to the whole team to ${word(g)}`, rank: RANK[g] });
    cur = t === 'file' ? (node as FileNode).folder_id : (node as FolderNode).parent_id;
    t = 'folder';
  }
  const best = reasons.reduce<AccessLevel | null>((m, r) => (m === null || RANK[r.level] > RANK[m] ? r.level : m), null);
  return { level: best, reasons: reasons.sort((a, b) => b.rank - a.rank).map((r) => r.text) };
}

/** Who can open a file and why. People who may share it see everyone; anyone else sees only why they themselves can. */
export async function explainFileAccess(asker: { id: string; email: string }, fileId: string, ix?: VaultIndex): Promise<AccessExplanation> {
  const index = ix ?? (await loadIndex());
  const file = index.files.get(fileId);
  if (!file) throw new Error('That file no longer exists.');
  const askerOversight = await isSuperAdminEmail(asker.email);
  const my = levelFor(index, asker.id, 'file', fileId, askerOversight);
  if (!my) throw new Error('You cannot open that file.');
  const db = looseAdmin();
  const { data: admins } = await db.from('profiles').select('id, first_name, last_name, email').eq('is_admin', true);
  const people = (admins ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[];
  const names = new Map(people.map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Someone']));
  const full = atLeast(my, 'share');
  const out: WhoCanSee[] = [];
  for (const p of people) {
    if (!full && p.id !== asker.id) continue;
    const r = reasonsFor(index, p.id, fileId, names);
    const oversight = !!p.email && (await isSuperAdminEmail(p.email));
    const reasons = [...r.reasons, ...(oversight ? ['Is a super admin, who can open everything for oversight'] : [])];
    const level = oversight ? 'edit' : r.level;
    if (!level) continue;
    out.push({ id: p.id, name: names.get(p.id) ?? 'Someone', level, reasons, you: p.id === asker.id });
  }
  out.sort((a, b) => Number(b.you) - Number(a.you) || RANK[b.level] - RANK[a.level] || a.name.localeCompare(b.name));
  const g = GENERAL[file.general_access] ?? null;
  const link = file.link_access && file.link_access !== 'off' ? `Anyone with the link can ${file.link_access === 'edit' ? 'edit' : 'view'} it` : null;
  return { people: out, fullList: full, general: g ? `Open to the whole team to ${word(g)}` : null, link };
}
