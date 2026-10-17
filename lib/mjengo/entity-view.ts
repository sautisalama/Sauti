import { looseAdmin } from '@/lib/loose-db';
import { isSuperAdminEmail } from '@/lib/access/super-admin';

export type EntityKind = 'grant' | 'opportunity' | 'project' | 'fellowship';
export const ENTITY_KINDS: EntityKind[] = ['grant', 'opportunity', 'project', 'fellowship'];
export const ENTITY_TABLE: Record<EntityKind, string> = { grant: 'mjengo_grants', opportunity: 'mjengo_opportunities', project: 'mjengo_projects', fellowship: 'mjengo_fellowships' };
export const ENTITY_LABEL_FIELD: Record<EntityKind, string> = { grant: 'title', opportunity: 'title', project: 'name', fellowship: 'title' };
export const ENTITY_HREF: Record<EntityKind, string> = { grant: '/dashboard/mjengo/grants', opportunity: '/dashboard/mjengo/opportunities', project: '/dashboard/mjengo/projects', fellowship: '/dashboard/mjengo/fellowships' };

export interface EntityLite { kind: EntityKind; id: string; title: string; row: Record<string, unknown> }

/**
 * The grants, opportunities, projects and fellowships one person may see, with the details their owner keeps hidden
 * left out. This follows the rules of the lists themselves: the owner and super admins see everything; a record made
 * "only me" is seen only by the people it was given to; anyone else on the team sees the rest minus hidden details.
 * Everything that reads these records on someone's behalf (Salama, the timeline) goes through here.
 */
export async function entitiesFor(actor: { id: string; email: string }, kinds: EntityKind[] = ENTITY_KINDS): Promise<EntityLite[]> {
  const db = looseAdmin();
  const oversight = await isSuperAdminEmail(actor.email);
  const { data: acc } = await db.from('mjengo_entity_access').select('entity_type, entity_id').eq('user_id', actor.id);
  const given = new Set(((acc ?? []) as { entity_type: string; entity_id: string }[]).map((r) => `${r.entity_type}:${r.entity_id}`));
  const out: EntityLite[] = [];
  await Promise.all(kinds.map(async (kind) => {
    const { data } = await db.from(ENTITY_TABLE[kind]).select('*');
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const id = String(r.id);
      const owner = r.created_by === actor.id;
      if (!owner && !oversight && r.visibility === 'restricted' && !given.has(`${kind}:${id}`)) continue;
      const row = { ...r };
      if (!owner && !oversight) for (const k of (r.hidden_fields as string[] | null) ?? []) row[k] = null;
      out.push({ kind, id, title: String(row[ENTITY_LABEL_FIELD[kind]] ?? ''), row });
    }
  }));
  return out;
}

const SKIP = new Set(['id', 'created_by', 'created_at', 'updated_at', 'visibility', 'hidden_fields', 'owner_id', 'lead_id', 'grant_id']);

/** The words of a record, for searching and for reading aloud to the AI. */
export function entityText(e: EntityLite): string {
  return Object.entries(e.row)
    .filter(([k, v]) => !SKIP.has(k) && v != null && v !== '' && typeof v !== 'object')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`)
    .join('. ');
}
