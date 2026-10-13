import { looseAdmin } from '@/lib/loose-db';
import { sendNotification } from '@/lib/notifications';
import { askAi } from '@/lib/mjengo/ai';

interface Line { id: string; name: string; text: string; at: string }

/** Notes for one call from its transcript: a summary, decisions and actions. */
export async function notesFor(title: string | null, lines: Line[]): Promise<string> {
  const transcript = lines.map((l) => `${l.name}: ${l.text}`).join('\n').slice(0, 24_000);
  return askAi(
    'You write meeting notes for a small team at Sauti Salama. Use these headings in plain Markdown: **Summary** (three to five sentences), **Decisions** (bullets), **Actions** (bullets with the person responsible when it is clear), **Open questions** (bullets). Only use what is in the transcript; do not invent names, dates or decisions. If a section has nothing, write "None".',
    `Call: ${title || 'Untitled call'}\n\nTranscript:\n${transcript}`,
    900
  );
}

/**
 * Calls whose conversation has gone quiet (no new words for ten minutes) and have no notes yet: write the
 * notes and tell everyone who took part. Runs with the five-minute job.
 */
export async function shareMeetingNotes(): Promise<{ done: number }> {
  const db = looseAdmin();
  const since = new Date(Date.now() - 3 * 86400_000).toISOString();
  const { data } = await db
    .from('mjengo_meetings')
    .select('id, code, title, transcript, participants, created_by')
    .is('notes_shared_at', null)
    .gte('created_at', since)
    .limit(10);
  let done = 0;
  for (const m of (data ?? []) as { id: string; code: string; title: string | null; transcript: Line[]; participants: string[]; created_by: string | null }[]) {
    const lines = Array.isArray(m.transcript) ? m.transcript : [];
    if (lines.length < 3) continue;
    const last = lines.reduce((a, l) => (l.at > a ? l.at : a), '');
    if (Date.now() - new Date(last).getTime() < 10 * 60_000) continue; // still talking
    try {
      const notes = await notesFor(m.title, lines);
      await db.from('mjengo_meetings').update({ notes, notes_shared_at: new Date().toISOString(), ended_at: new Date().toISOString() }).eq('id', m.id);
      const people = [...new Set([...(m.participants ?? []), ...(m.created_by ? [m.created_by] : [])])];
      await Promise.all(people.map((userId) => sendNotification({
        userId, type: 'system_alert', title: 'Call notes are ready', message: `${m.title || 'Your call'}: summary, decisions and actions.`,
        link: `/dashboard/mjengo/meetings?code=${m.code}`, sendEmail: false,
      }).catch(() => undefined)));
      done += 1;
    } catch { /* tried again at the next run */ }
  }
  return { done };
}

/**
 * Event reminders. Each event has a list of offsets (minutes before the start, as many as the person chose,
 * like Google Calendar). Older events that only have "N alerts, M minutes apart" are read as the same thing.
 */
export async function remindEvents(): Promise<{ sent: number }> {
  const db = looseAdmin();
  const now = new Date();
  // Events that start within the longest possible reminder window (a week and a bit, or ten legacy alerts a day apart).
  const horizon = new Date(now.getTime() + 14 * 1440 * 60_000);
  const { data } = await db
    .from('mjengo_events')
    .select('id, title, starts_at, kind, meeting_code, attendees, created_by, alerts, alert_every_min, alerts_sent, reminders, reminders_sent')
    .neq('kind', 'block')
    .gt('starts_at', now.toISOString())
    .lte('starts_at', horizon.toISOString());
  type Row = { id: string; title: string; starts_at: string; kind: string; meeting_code: string | null; attendees: string[]; created_by: string | null; alerts: number; alert_every_min: number; alerts_sent: number; reminders: number[]; reminders_sent: number[] };
  let sent = 0;
  for (const e of (data ?? []) as Row[]) {
    const start = new Date(e.starts_at).getTime();
    const legacy = !e.reminders?.length;
    const offsets = legacy ? Array.from({ length: Math.max(0, e.alerts) }, (_, i) => (e.alerts - i) * Math.max(1, e.alert_every_min)) : e.reminders;
    const done = new Set<number>(legacy ? offsets.slice(0, e.alerts_sent) : e.reminders_sent ?? []);
    const due = offsets.filter((o) => !done.has(o) && now.getTime() >= start - o * 60_000);
    if (!due.length) continue;
    const ids = new Set<string>();
    if (e.created_by) ids.add(e.created_by);
    if (e.attendees?.length) {
      const { data: ps } = await db.from('profiles').select('id, email').eq('is_admin', true).in('email', e.attendees);
      (ps ?? []).forEach((p: { id: string }) => ids.add(p.id));
    }
    const mins = Math.max(1, Math.round((start - now.getTime()) / 60_000));
    const when = mins >= 2880 ? `${Math.round(mins / 1440)} days` : mins >= 120 ? `${Math.round(mins / 60)} hours` : mins >= 60 ? `1 hour ${mins % 60} min` : `${mins} minute${mins === 1 ? '' : 's'}`;
    await Promise.all([...ids].map((userId) => sendNotification({
      userId, type: 'todo_due', title: `Starting in ${when}`, message: e.title,
      link: e.meeting_code ? `/meet/${e.meeting_code}` : '/dashboard/mjengo/calendar', sendEmail: false,
    }).catch(() => undefined)));
    const patch = legacy ? { alerts_sent: Math.min(e.alerts, e.alerts_sent + due.length) } : { reminders_sent: [...done, ...due] };
    await db.from('mjengo_events').update({ ...patch, reminded_at: now.toISOString() }).eq('id', e.id);
    sent += ids.size;
  }
  return { sent };
}
