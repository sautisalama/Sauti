export type Lvl = 'view' | 'write' | 'owner';
export const RANK: Record<Lvl, number> = { view: 1, write: 2, owner: 3 };
export const LEVEL_ORDER: Lvl[] = ['view', 'write', 'owner'];
export type PermMap = Map<string, Lvl>;

export function toMap(perms: string[]): PermMap {
  const out: PermMap = new Map();
  for (const raw of perms) {
    const [k, l] = raw.split(':');
    if (!k) continue;
    const level: Lvl = l === 'view' || l === 'owner' ? l : 'write';
    const cur = out.get(k);
    if (!cur || RANK[level] > RANK[cur]) out.set(k, level);
  }
  return out;
}

export const toList = (m: PermMap) => [...m.entries()].map(([k, l]) => `${k}:${l}`);

/** True when `have` allows everything `need` asks for. */
export const covers = (have: PermMap, need: PermMap) => [...need.entries()].every(([k, l]) => (have.get(k) ? RANK[have.get(k)!] >= RANK[l] : false));

export interface RoleLite { id: string; name: string; permissions: string[] }

/**
 * A person's permissions were changed to `desired` (one area just went to `changed.level`, or to nothing). Roles are the
 * shared way to hold permissions, so: keep the roles they have that still fit, add a role that this change completes (its
 * permissions are all now held, and the change was part of it, or it matches exactly), and hold whatever no role covers as
 * personal extras. Returns the roles they end up with, which were added or taken away, and the extras.
 */
export function reconcile(args: { desired: PermMap; previous: PermMap; roles: RoleLite[]; current: string[]; changed: { module: string; level: Lvl | null } }): { roleIds: string[]; added: RoleLite[]; removed: RoleLite[]; extras: string[] } {
  const { desired, previous, roles, current, changed } = args;
  const maps = new Map(roles.map((r) => [r.id, toMap(r.permissions)]));
  const fits = (r: RoleLite) => { const m = maps.get(r.id)!; return m.size > 0 && covers(desired, m); };
  const keep = roles.filter((r) => current.includes(r.id) && fits(r));
  const removed = roles.filter((r) => current.includes(r.id) && !fits(r));

  const before = previous.get(changed.module);
  const grants = changed.level !== null && (!before || RANK[changed.level] > RANK[before]);
  const exact = (r: RoleLite) => { const m = maps.get(r.id)!; return m.size === desired.size && [...desired.entries()].every(([k, l]) => m.get(k) === l); };
  const completed = roles.filter((r) => {
    if (current.includes(r.id) || !fits(r)) return false;
    const m = maps.get(r.id)!;
    const part = grants && m.has(changed.module) && RANK[m.get(changed.module)!] <= RANK[changed.level!] && (!before || RANK[m.get(changed.module)!] > RANK[before]);
    return part || exact(r);
  });

  const assigned = [...keep, ...completed];
  const cover: PermMap = new Map();
  for (const r of assigned) for (const [k, l] of maps.get(r.id)!) { const c = cover.get(k); if (!c || RANK[l] > RANK[c]) cover.set(k, l); }
  const extras: string[] = [];
  for (const [k, l] of desired) { const c = cover.get(k); if (!c || RANK[l] > RANK[c]) extras.push(`${k}:${l}`); }
  return { roleIds: assigned.map((r) => r.id), added: completed, removed, extras };
}
