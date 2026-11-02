'use server';

import { guard } from '@/lib/action-result';
import { looseAdmin } from '@/lib/loose-db';
import { requireModule, type ModuleKey } from '@/lib/access/permissions';

type Kind = 'grant' | 'opportunity';
const MODULE_OF: Record<Kind, ModuleKey> = { grant: 'grants', opportunity: 'opportunities' };
const KEY = 'mjengo_panel_hidden';
const ITEM = /^[a-z0-9_-]{1,40}$/i;

function kindOf(kind: string): Kind {
  if (kind !== 'grant' && kind !== 'opportunity') throw new Error('That page has no side panel to adjust.');
  return kind;
}

/** Side panel items this person has switched off. Kept on their profile, so every device they sign in on shows the same. */
export const getPanelHidden = guard(async (kind: string): Promise<string[]> => {
  const k = kindOf(kind);
  const a = await requireModule(MODULE_OF[k], 'view');
  const { data } = await looseAdmin().from('profiles').select('settings').eq('id', a.id).maybeSingle();
  const all = ((data as { settings?: Record<string, unknown> } | null)?.settings?.[KEY] ?? {}) as Record<string, unknown>;
  const list = all[k];
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && ITEM.test(x)) : [];
});

export const setPanelHidden = guard(async (kind: string, hidden: string[]): Promise<string[]> => {
  const k = kindOf(kind);
  const a = await requireModule(MODULE_OF[k], 'view');
  const clean = [...new Set(hidden.filter((x) => ITEM.test(x)))].slice(0, 30);
  const db = looseAdmin();
  const { data } = await db.from('profiles').select('settings').eq('id', a.id).maybeSingle();
  const settings = ((data as { settings?: Record<string, unknown> } | null)?.settings ?? {}) as Record<string, unknown>;
  const all = { ...((settings[KEY] ?? {}) as Record<string, unknown>), [k]: clean };
  const { error } = await db.from('profiles').update({ settings: { ...settings, [KEY]: all } }).eq('id', a.id);
  if (error) throw new Error('That could not be saved.');
  return clean;
});
