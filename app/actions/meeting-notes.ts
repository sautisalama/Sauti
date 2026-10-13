'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { getActor } from '@/lib/access/super-admin';
import { askAi } from '@/lib/mjengo/ai';
import { notesFor } from '@/lib/mjengo/meeting-jobs';
import { appOrigin, sendNoticeEmail } from '@/lib/mjengo/invite-email';

/**
 * Notes of a call for the people who were in it. Only the organisation's own people (its email domain, or an
 * administrator) who took part can read them, with the transcript. Guests get a summary only if someone sends
 * it, and only once.
 */

const DOMAIN = (process.env.ORG_EMAIL_DOMAIN || 'sautisalama.org').toLowerCase();

export interface StructuredNotes {
  tldr: string;
  summary: string;
  decisions: string[];
  actions: { text: string; owner: string | null }[];
  questions: string[];
}

export interface MyNotes {
  code: string;
  title: string;
  date: string;
  tldr: string;
  summary: string;
  decisions: string[];
  /** Actions that name this reader (or everyone), then the rest. */
  mine: { text: string; owner: string | null }[];
  others: { text: string; owner: string | null }[];
  questions: string[];
  transcript: { id: string; name: string; text: string; at: string }[];
  /** Names of people who joined without an account (guests). */
  guests: string[];
  emailed: { at: string; to: string[] } | null;
  canEmail: boolean;
  ready: boolean;
}

async function allowed(code: string) {
  const a = await getActor();
  if (!a) throw new Error('Sign in to read the notes of a call.');
  const sauti = a.email.endsWith(`@${DOMAIN}`);
  if (!sauti && !a.isAdmin) throw new Error('Call notes are only for the organisation\'s own people.');
  const db = looseAdmin();
  const { data: m } = await db.from('mjengo_meetings').select('id, code, title, created_at, created_by, invitees, participants, transcript, notes, notes_json, notes_emailed_at, notes_emailed_to').eq('code', code).maybeSingle();
  if (!m) throw new Error('That call does not exist.');
  const { data: ev } = await db.from('mjengo_events').select('attendees').eq('meeting_code', code);
  const attendees = ((ev ?? []) as { attendees: string[] | null }[]).flatMap((e) => e.attendees ?? []).map((x) => x.toLowerCase());
  const took = m.created_by === a.id || ((m.participants ?? []) as string[]).includes(a.id) || ((m.invitees ?? []) as string[]).map((x) => x.toLowerCase()).includes(a.email) || attendees.includes(a.email);
  if (!took) throw new Error('You were not in this call, so its notes are not shared with you.');
  return { actor: a, m, db };
}

async function structuredFor(m: { id: string; title: string | null; notes: string | null; notes_json: StructuredNotes | null; transcript: { name: string; text: string; at: string }[] }, db: ReturnType<typeof looseAdmin>): Promise<StructuredNotes | null> {
  if (m.notes_json) return m.notes_json;
  let notes = m.notes;
  const lines = Array.isArray(m.transcript) ? m.transcript : [];
  if (!notes) {
    if (lines.length < 3) return null;
    notes = await notesFor(m.title, lines as never);
    await db.from('mjengo_meetings').update({ notes, notes_shared_at: new Date().toISOString() }).eq('id', m.id);
  }
  const raw = await askAi(
    'You turn meeting notes into a structure. Reply with one JSON object {"tldr": string (one sentence, at most 25 words), "summary": string (three to five sentences), "decisions": string[], "actions": [{"text": string, "owner": string or null}], "questions": string[]}. "owner" is the first name or full name given in the notes, "everyone" if it is for all, or null if no one is named. Use only what the notes say.',
    notes.slice(0, 8000),
    900,
    { json: true, temperature: 0.1 }
  );
  let j: Partial<StructuredNotes> = {};
  try { j = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}'); } catch { /* fall back below */ }
  const out: StructuredNotes = {
    tldr: String(j.tldr ?? '').slice(0, 300) || notes.split('\n').find((l) => l.trim().length > 20)?.slice(0, 200) || 'Notes are ready.',
    summary: String(j.summary ?? '').slice(0, 1500),
    decisions: (Array.isArray(j.decisions) ? j.decisions : []).map(String).slice(0, 12),
    actions: (Array.isArray(j.actions) ? j.actions : []).slice(0, 20).map((a) => ({ text: String((a as { text?: string }).text ?? '').slice(0, 300), owner: (a as { owner?: string | null }).owner ? String((a as { owner?: string }).owner).slice(0, 60) : null })).filter((a) => a.text),
    questions: (Array.isArray(j.questions) ? j.questions : []).map(String).slice(0, 8),
  };
  await db.from('mjengo_meetings').update({ notes_json: out }).eq('id', m.id);
  return out;
}

async function myNotes_(code: string): Promise<MyNotes> {
  const { actor, m, db } = await allowed(code);
  const s = await structuredFor(m as never, db);
  const first = actor.name.split(/\s+/)[0]?.toLowerCase() ?? '';
  const last = actor.name.split(/\s+/).slice(1).join(' ').toLowerCase();
  const isMine = (o: string | null) => {
    if (!o) return false;
    const x = o.toLowerCase();
    return x === 'everyone' || x === 'all' || x === 'team' || (!!first && (x === first || x.includes(first))) || (!!last && x.includes(last)) || x === actor.email;
  };
  const actions = s?.actions ?? [];
  const { data: knocks } = await db.from('mjengo_meeting_knocks').select('name, user_id').eq('code', code).eq('status', 'admitted');
  const guests = ((knocks ?? []) as { name: string; user_id: string | null }[]).filter((k) => !k.user_id).map((k) => k.name);
  const mine = actions.filter((a) => isMine(a.owner));
  const emailedAt = (m as { notes_emailed_at: string | null }).notes_emailed_at;
  return {
    code,
    title: m.title || 'Call',
    date: m.created_at,
    tldr: s?.tldr ?? '',
    summary: s?.summary ?? '',
    decisions: s?.decisions ?? [],
    mine,
    others: actions.filter((a) => !mine.includes(a)),
    questions: s?.questions ?? [],
    transcript: (m.transcript ?? []) as MyNotes['transcript'],
    guests,
    emailed: emailedAt ? { at: emailedAt, to: ((m as { notes_emailed_to: string[] }).notes_emailed_to ?? []) } : null,
    canEmail: !emailedAt && !!s,
    ready: !!s,
  };
}

/** Email a summary (not the transcript) to the people who joined as guests. Possible once per call. */
async function emailSummary_(code: string, emails: string[]): Promise<{ sent: number }> {
  const { actor, m, db } = await allowed(code);
  if ((m as { notes_emailed_at: string | null }).notes_emailed_at) throw new Error('A summary of this call was already sent.');
  const to = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].slice(0, 30);
  if (!to.length) throw new Error('Add at least one email address.');
  const s = await structuredFor(m as never, db);
  if (!s) throw new Error('There is not enough in this call to summarise yet.');
  await sendNoticeEmail({
    to,
    by: actor.name,
    always: true,
    subject: `Summary: ${m.title || 'our call'}`,
    heading: `Summary of ${m.title || 'our call'}`,
    lines: [s.tldr, s.summary, s.decisions.length ? `Decisions: ${s.decisions.join('; ')}` : ''].filter(Boolean),
    button: { label: 'Visit Sauti Salama', url: appOrigin() },
  });
  await db.from('mjengo_meetings').update({ notes_emailed_at: new Date().toISOString(), notes_emailed_to: to }).eq('code', code);
  return { sent: to.length };
}

export const getMyNotes = guard(myNotes_);
export const emailMeetingSummary = guard(emailSummary_);
