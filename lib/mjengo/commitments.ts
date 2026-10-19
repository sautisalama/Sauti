import { looseAdmin } from '@/lib/loose-db';
import { sendNotification } from '@/lib/notifications';
import { askAi } from '@/lib/mjengo/ai';
import { autoLinkMeeting } from '@/lib/mjengo/auto-link';
import { quoteInSource, resolveSaidDate } from '@/lib/mjengo/evidence';

interface Line { id: string; name: string; text: string; at: string }
export interface Commitment { title: string; owner: string | null; due: string | null }
interface Said { title: string; owner: string | null; due_words?: string | null }

const TRACK_NAME = 'From calls';

/** The promises made in a call: what, who owns it (only when the transcript says so) and by when (only when it says so). */
export async function extractCommitments(title: string | null, lines: Line[], today = new Date()): Promise<Commitment[]> {
  const transcript = lines.map((l) => `${l.name}: ${l.text}`).join('\n').slice(0, 24_000);
  const raw = await askAi(
    `You find commitments in a call transcript for a small team. Return JSON: {"items":[{"title":string,"owner":string|null,"due_words":string|null}]}. A commitment is something a person agreed to do after the call. "title" is a short imperative sentence. "owner" is the first name of the person who took it on, exactly as it appears in the transcript, or null if unclear. "due_words" is the exact words from the transcript that gave the deadline (for example "by Friday", "on 15 March", "tomorrow"), copied letter for letter, or null when no deadline was said. Do not work out the date yourself. Never invent items, names or dates. At most 8 items. If there are none, return {"items":[]}.`,
    `Call: ${title || 'Untitled call'}\n\nTranscript:\n${transcript}`,
    700,
    { json: true, temperature: 0.1 },
  );
  try {
    const items = (JSON.parse(raw) as { items?: Said[] }).items ?? [];
    return items
      .filter((i) => i && typeof i.title === 'string' && i.title.trim())
      .slice(0, 8)
      .map((i) => ({
        title: i.title.trim().slice(0, 160),
        owner: typeof i.owner === 'string' && i.owner.trim() ? i.owner.trim() : null,
        // The date comes from the words that were said, worked out here, and only if those words are really in the call.
        due: typeof i.due_words === 'string' && quoteInSource(i.due_words, transcript) ? resolveSaidDate(i.due_words, today) : null,
      }));
  } catch {
    return [];
  }
}

/**
 * Turn a finished call's commitments into to-dos on the "From calls" track, owned by the people who took them on
 * and told about it. Safe to run twice for the same call: a commitment already made is not made again.
 */
export async function commitmentsToTodos(meeting: { code: string; title: string | null; participants: string[]; created_by: string | null }, lines: Line[]): Promise<number> {
  if (lines.length < 3) return 0;
  const db = looseAdmin();
  // The call joins the timeline of every grant, project and so on it speaks about; when it speaks about exactly one,
  // its promises belong to that record too.
  const linked = await autoLinkMeeting(meeting, lines).catch(() => []);
  const only = linked.length === 1 ? linked[0] : null;
  const found = await extractCommitments(meeting.title, lines);
  if (!found.length) return 0;

  const ids = [...new Set([...(meeting.participants ?? []), ...(meeting.created_by ? [meeting.created_by] : [])])];
  const { data: profs } = ids.length ? await db.from('profiles').select('id, first_name, last_name, email').in('id', ids) : { data: [] };
  const people = (profs ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[];
  const ownerId = (name: string | null): string | null => {
    if (!name) return null;
    const n = name.toLowerCase();
    const hits = people.filter((p) => (p.first_name ?? '').toLowerCase() === n || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim().toLowerCase() === n);
    return hits.length === 1 ? hits[0].id : null; // two people with that first name: nobody is guessed
  };

  let { data: track } = await db.from('mjengo_todo_tracks').select('id').eq('name', TRACK_NAME).maybeSingle();
  if (!track) ({ data: track } = await db.from('mjengo_todo_tracks').insert({ name: TRACK_NAME, color: 'blue', created_by: meeting.created_by }).select('id').single());
  if (!track) return 0;

  const marker = `From the call ${meeting.code}`;
  const { data: existing } = await db.from('mjengo_todos').select('title').eq('track_id', track.id).like('notes', `${marker}%`);
  const have = new Set(((existing ?? []) as { title: string }[]).map((t) => t.title.toLowerCase()));

  let made = 0;
  for (const c of found) {
    if (have.has(c.title.toLowerCase())) continue;
    const owner = ownerId(c.owner);
    const { error } = await db.from('mjengo_todos').insert({
      track_id: track.id, title: c.title, status: 'todo', due_date: c.due, assignee_ids: owner ? [owner] : [], entity_type: only?.kind ?? null, entity_id: only?.id ?? null,
      notes: `${marker}${meeting.title ? `: ${meeting.title}` : ''}. Open it at /dashboard/mjengo/meetings?code=${meeting.code}`, created_by: meeting.created_by,
    });
    if (error) continue;
    made += 1;
    if (owner) {
      await sendNotification({
        userId: owner, type: 'system_alert', title: 'You took this on in a call', message: `${c.title}${c.due ? `, due ${c.due}` : ''}`,
        link: '/dashboard/mjengo/todos', sendEmail: false,
      }).catch(() => undefined);
    }
  }
  return made;
}
