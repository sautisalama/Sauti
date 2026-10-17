import { looseAdmin } from '@/lib/loose-db';
import { ENTITY_KINDS, ENTITY_LABEL_FIELD, ENTITY_TABLE, type EntityKind } from '@/lib/mjengo/entity-view';
import { recordsMentioned } from '@/lib/mjengo/timeline';

/**
 * Link a call to the grants, opportunities, projects and fellowships it speaks about (their title appears in the
 * call's title, notes or transcript), so each record's timeline gathers it without anyone filing it. Safe to run
 * twice. Returns every record the call is now linked to by the system.
 */
export async function autoLinkMeeting(meeting: { code: string; title: string | null; notes?: string | null }, lines: { text: string }[]): Promise<{ kind: EntityKind; id: string }[]> {
  const db = looseAdmin();
  const records: { kind: EntityKind; id: string; title: string }[] = [];
  await Promise.all(ENTITY_KINDS.map(async (kind) => {
    const { data } = await db.from(ENTITY_TABLE[kind]).select(`id, ${ENTITY_LABEL_FIELD[kind]}`);
    for (const r of (data ?? []) as unknown as Record<string, unknown>[]) records.push({ kind, id: String(r.id), title: String(r[ENTITY_LABEL_FIELD[kind]] ?? '') });
  }));
  const text = [meeting.title ?? '', meeting.notes ?? '', ...lines.map((l) => l.text)].join(' \n ');
  const found = recordsMentioned(text, records);
  if (found.length) {
    await db.from('mjengo_links').upsert(
      found.map((f) => ({ entity_type: f.kind, entity_id: f.id, item_type: 'meeting', item_id: meeting.code, auto: true })),
      { onConflict: 'entity_type,entity_id,item_type,item_id', ignoreDuplicates: true },
    );
  }
  return found;
}
