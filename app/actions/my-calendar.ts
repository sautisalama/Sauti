'use server';

import { createClient } from '@/utils/supabase/server';
import { guard } from '@/lib/action-result';

export interface MyCalItem {
  id: string;
  kind: 'appointment' | 'block';
  title: string;
  /** Who it is with, shown to the survivor only; providers see "Client session". */
  detail: string | null;
  start: string;
  end: string;
  status: string | null;
  href: string | null;
}

/**
 * The signed-in person's own calendar for a stretch of time: their appointments (as survivor or as
 * provider) and, for providers, the time they have blocked. Nothing about anyone else is exposed:
 * a provider sees "Client session", never the survivor's name.
 */
async function load_(fromIso: string, toIso: string): Promise<MyCalItem[]> {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || +to - +from > 100 * 86_400_000) throw new Error('Invalid dates.');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const [{ data: asPro }, { data: asSurvivor }, { data: blocks }] = await Promise.all([
    supabase.from('appointments').select('appointment_id, appointment_date, duration_minutes, status, appointment_type, matched_services').eq('professional_id', user.id).gte('appointment_date', from.toISOString()).lte('appointment_date', to.toISOString()),
    supabase.from('appointments').select('appointment_id, appointment_date, duration_minutes, status, appointment_type, matched_services, professional_id').eq('survivor_id', user.id).gte('appointment_date', from.toISOString()).lte('appointment_date', to.toISOString()),
    supabase.from('availability_blocks').select('id, start_time, end_time, reason').eq('user_id', user.id).gte('end_time', from.toISOString()).lte('start_time', to.toISOString()),
  ]);

  // Names of the providers, for the survivor's own appointments.
  const proIds = [...new Set((asSurvivor ?? []).map((a) => a.professional_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (proIds.length) {
    const { data: people } = await supabase.from('profiles').select('id, first_name, last_name').in('id', proIds);
    for (const p of people ?? []) names.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(' '));
  }

  const out: MyCalItem[] = [];
  const add = (a: { appointment_id: string; appointment_date: string | null; duration_minutes: number | null; status: string | null; appointment_type: string | null; matched_services: string | null }, mine: 'pro' | 'survivor', professionalId?: string | null) => {
    if (!a.appointment_date || a.status === 'cancelled') return;
    const start = new Date(a.appointment_date);
    const end = new Date(+start + (a.duration_minutes ?? 60) * 60_000);
    const kindLabel = (a.appointment_type ?? '').replace(/_/g, ' ');
    out.push({
      id: a.appointment_id,
      kind: 'appointment',
      title: mine === 'pro' ? 'Client session' : 'Session',
      detail: mine === 'survivor' ? (professionalId ? names.get(professionalId) || null : null) || (kindLabel ? kindLabel[0].toUpperCase() + kindLabel.slice(1) : null) : kindLabel || null,
      start: start.toISOString(),
      end: end.toISOString(),
      status: a.status,
      href: a.matched_services ? (mine === 'pro' ? `/dashboard/cases/${a.matched_services}` : '/dashboard/matches') : null,
    });
  };
  for (const a of asPro ?? []) add(a, 'pro');
  for (const a of asSurvivor ?? []) add(a, 'survivor', a.professional_id);
  for (const b of blocks ?? []) {
    out.push({ id: b.id, kind: 'block', title: 'Blocked', detail: b.reason ?? null, start: b.start_time, end: b.end_time, status: null, href: null });
  }
  return out.sort((x, y) => +new Date(x.start) - +new Date(y.start));
}

export const myCalendar = guard(load_);
