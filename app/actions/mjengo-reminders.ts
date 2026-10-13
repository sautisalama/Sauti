'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { REMINDER_TABLE, type ReminderEntity } from '@/lib/mjengo/entity-reminders';

/** The reminders this person has set on one item, as minutes before it is due. */
async function get_(type: ReminderEntity, id: string): Promise<number[]> {
  const a = await requireAdminActor();
  if (!REMINDER_TABLE[type]) throw new Error('Unknown item.');
  const { data } = await looseAdmin().from('mjengo_reminders').select('offset_minutes').eq('entity_type', type).eq('entity_id', id).eq('user_id', a.id).order('offset_minutes', { ascending: false });
  return ((data ?? []) as { offset_minutes: number }[]).map((r) => r.offset_minutes);
}

/** Replace this person's reminders on one item. Offsets that are kept are not sent again. */
async function set_(type: ReminderEntity, id: string, offsets: number[]): Promise<number[]> {
  const a = await requireAdminActor();
  const cfg = REMINDER_TABLE[type];
  if (!cfg) throw new Error('Unknown item.');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Unknown item.');
  const db = looseAdmin();
  const { data: ent } = await db.from(cfg.table).select('id').eq('id', id).maybeSingle();
  if (!ent) throw new Error('That item no longer exists.');
  const next = [...new Set(offsets.map((o) => Math.round(Number(o))).filter((o) => Number.isFinite(o) && o >= 0 && o <= 525600))].slice(0, 10);
  const { data: have } = await db.from('mjengo_reminders').select('offset_minutes').eq('entity_type', type).eq('entity_id', id).eq('user_id', a.id);
  const had = new Set(((have ?? []) as { offset_minutes: number }[]).map((r) => r.offset_minutes));
  const drop = [...had].filter((o) => !next.includes(o));
  if (drop.length) await db.from('mjengo_reminders').delete().eq('entity_type', type).eq('entity_id', id).eq('user_id', a.id).in('offset_minutes', drop);
  const add = next.filter((o) => !had.has(o));
  if (add.length) await db.from('mjengo_reminders').insert(add.map((o) => ({ entity_type: type, entity_id: id, user_id: a.id, offset_minutes: o })));
  return next.sort((x, y) => y - x);
}

export const getReminders = guard(get_);
export const setReminders = guard(set_);
