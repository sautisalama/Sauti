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

/** Events starting in the next quarter of an hour: a reminder to the creator and to guests on the team. */
export async function remindEvents(): Promise<{ sent: number }> {
  const db = looseAdmin();
  const now = new Date();
  const soon = new Date(now.getTime() + 16 * 60_000);
  const { data } = await db
    .from('mjengo_events')
    .select('id, title, starts_at, kind, meeting_code, attendees, created_by')
    .is('reminded_at', null)
    .neq('kind', 'block')
    .gte('starts_at', now.toISOString())
    .lte('starts_at', soon.toISOString());
  let sent = 0;
  for (const e of (data ?? []) as { id: string; title: string; starts_at: string; kind: string; meeting_code: string | null; attendees: string[]; created_by: string | null }[]) {
    const ids = new Set<string>();
    if (e.created_by) ids.add(e.created_by);
    if (e.attendees?.length) {
      const { data: ps } = await db.from('profiles').select('id, email').eq('is_admin', true).in('email', e.attendees);
      (ps ?? []).forEach((p: { id: string }) => ids.add(p.id));
    }
    const mins = Math.max(1, Math.round((new Date(e.starts_at).getTime() - now.getTime()) / 60_000));
    await Promise.all([...ids].map((userId) => sendNotification({
      userId, type: 'todo_due', title: `Starting in ${mins} minute${mins === 1 ? '' : 's'}`, message: e.title,
      link: '/dashboard/mjengo/calendar', sendEmail: false,
    }).catch(() => undefined)));
    await db.from('mjengo_events').update({ reminded_at: now.toISOString() }).eq('id', e.id);
    sent += ids.size;
  }
  return { sent };
}
