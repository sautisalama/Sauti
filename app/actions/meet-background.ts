'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { getActor } from '@/lib/access/super-admin';

/** A person's call background choices and photos, kept on their account so they follow them to any device. */

export type StoredBackground = { settings: Record<string, unknown>; photos: string[] };

const MAX_PHOTOS = 6;
const MAX_PHOTO_CHARS = 250_000;

async function load_(): Promise<StoredBackground | null> {
  const a = await getActor();
  if (!a) return null;
  const { data } = await looseAdmin().from('meet_background_prefs').select('prefs').eq('user_id', a.id).maybeSingle();
  const p = (data as { prefs?: StoredBackground } | null)?.prefs;
  if (!p || typeof p !== 'object') return null;
  return { settings: (p.settings ?? {}) as Record<string, unknown>, photos: Array.isArray(p.photos) ? p.photos.filter((x) => typeof x === 'string') : [] };
}

async function save_(settings: Record<string, unknown>, photos: string[] | null): Promise<void> {
  const a = await getActor();
  if (!a) return;
  const db = looseAdmin();
  const cur = await load_();
  const keep = photos ?? cur?.photos ?? [];
  const clean = keep.filter((p) => typeof p === 'string' && p.startsWith('data:image/') && p.length <= MAX_PHOTO_CHARS).slice(0, MAX_PHOTOS);
  const { error } = await db.from('meet_background_prefs').upsert({ user_id: a.id, prefs: { settings, photos: clean }, updated_at: new Date().toISOString() });
  if (error) throw new Error('Could not save your background choices.');
}

export const loadBackgroundPrefsRemote = guard(load_);
export const saveBackgroundPrefsRemote = guard(save_);
