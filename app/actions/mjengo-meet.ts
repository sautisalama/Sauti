'use server';

import { randomBytes } from 'node:crypto';
import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor } from '@/lib/access/super-admin';

export interface TranscriptLine { id: string; name: string; text: string; at: string }
export interface MeetingRow { id: string; code: string; title: string | null; mode: 'video' | 'voice'; created_at: string; ended_at: string | null; created_by: string | null; lines: number }

const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
function newCode(): string {
  const bytes = randomBytes(10);
  const pick = (n: number) => Array.from({ length: n }, (_, i) => alphabet[bytes[i] % alphabet.length]).join('');
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
}

/** Start a call. The returned code is the shareable link: /meet/<code>. */
async function createMeeting_(mode: 'video' | 'voice', title: string | null): Promise<{ code: string }> {
  const a = await requireAdminActor();
  const db = looseAdmin();
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const { error } = await db.from('mjengo_meetings').insert({ code, mode, title: title?.trim().slice(0, 120) || null, created_by: a.id });
    if (!error) {
      await logAudit({ actorId: a.id, actorEmail: a.email, action: 'meeting.started', targetType: 'meeting', targetLabel: code, details: { mode } });
      return { code };
    }
  }
  throw new Error('Could not start the call.');
}

async function listMeetings_(): Promise<MeetingRow[]> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_meetings').select('id, code, title, mode, created_at, ended_at, created_by, transcript, notes').order('created_at', { ascending: false }).limit(60);
  return ((data ?? []) as (Omit<MeetingRow, 'lines'> & { transcript: unknown[]; notes?: string | null })[])
    .map(({ transcript, ...m }) => ({ ...m, lines: Array.isArray(transcript) ? transcript.length : 0 }))
    // Only calls that were actually held and written down.
    .filter((m) => m.lines > 0 || !!m.notes);
}

/** Keep what was said. Several people may save: lines are merged by id. */
async function saveTranscript_(code: string, lines: TranscriptLine[], end: boolean) {
  const actor = await requireAdminActor();
  const db = looseAdmin();
  const { data } = await db.from('mjengo_meetings').select('id, transcript, participants').eq('code', code).maybeSingle();
  if (!data) throw new Error('That call does not exist.');
  const participants = [...new Set([...((data.participants ?? []) as string[]), actor.id])];
  const have = new Map<string, TranscriptLine>(((data.transcript ?? []) as TranscriptLine[]).map((l) => [l.id, l]));
  for (const l of lines.slice(0, 5000)) have.set(String(l.id).slice(0, 60), { id: String(l.id).slice(0, 60), name: String(l.name).slice(0, 80), text: String(l.text).slice(0, 2000), at: String(l.at).slice(0, 40) });
  const merged = [...have.values()].sort((a, b) => a.at.localeCompare(b.at));
  await db.from('mjengo_meetings').update({ transcript: merged, participants, ...(end ? { ended_at: new Date().toISOString() } : {}) }).eq('id', data.id);
}

async function getTranscript_(code: string): Promise<{ title: string | null; lines: TranscriptLine[] }> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_meetings').select('title, transcript').eq('code', code).maybeSingle();
  if (!data) throw new Error('That call does not exist.');
  return { title: data.title, lines: (data.transcript ?? []) as TranscriptLine[] };
}

export interface MeetingDetail extends MeetingRow { notes: string | null; transcript: TranscriptLine[]; notes_shared_at: string | null }

async function meetingDetail_(code: string): Promise<MeetingDetail> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_meetings').select('id, code, title, mode, created_at, ended_at, created_by, transcript, notes, notes_shared_at').eq('code', code).maybeSingle();
  if (!data) throw new Error('That call does not exist.');
  const transcript = (data.transcript ?? []) as TranscriptLine[];
  return { ...data, transcript, lines: transcript.length } as MeetingDetail;
}

/** Write (or rewrite) the notes now, and tell everyone who took part. */
async function makeNotes_(code: string): Promise<string> {
  const a = await requireAdminActor();
  const { notesFor } = await import('@/lib/mjengo/meeting-jobs');
  const { sendNotification } = await import('@/lib/notifications');
  const db = looseAdmin();
  const { data } = await db.from('mjengo_meetings').select('id, title, transcript, participants, created_by').eq('code', code).maybeSingle();
  if (!data) throw new Error('That call does not exist.');
  const lines = (data.transcript ?? []) as TranscriptLine[];
  if (lines.length < 3) throw new Error('There is not enough in the transcript yet.');
  const notes = await notesFor(data.title, lines);
  await db.from('mjengo_meetings').update({ notes, notes_shared_at: new Date().toISOString() }).eq('id', data.id);
  const people = [...new Set([...((data.participants ?? []) as string[]), ...(data.created_by ? [data.created_by as string] : [])])].filter((id) => id !== a.id);
  await Promise.all(people.map((userId) => sendNotification({ userId, type: 'system_alert', title: 'Call notes are ready', message: `${data.title || 'Your call'}: summary, decisions and actions.`, link: `/dashboard/mjengo/meetings?code=${code}`, sendEmail: false }).catch(() => undefined)));
  return notes;
}

export interface MeetHomeItem { key: string; title: string; code: string | null; start: string; end: string | null; kind: 'scheduled' | 'link' }

/** What is on for one day: calendar meetings, and links made for later that day. */
async function meetHome_(dayStart: string, dayEnd: string): Promise<MeetHomeItem[]> {
  const a = await requireAdminActor();
  const db = looseAdmin();
  const [{ data: ev }, { data: mt }] = await Promise.all([
    db.from('mjengo_events').select('id, title, starts_at, ends_at, meeting_code').not('meeting_code', 'is', null).gte('starts_at', dayStart).lt('starts_at', dayEnd).order('starts_at'),
    db.from('mjengo_meetings').select('id, code, title, created_at').eq('created_by', a.id).gte('created_at', dayStart).lt('created_at', dayEnd).is('ended_at', null),
  ]);
  const events = (ev ?? []) as { id: string; title: string; starts_at: string; ends_at: string; meeting_code: string }[];
  const have = new Set(events.map((e) => e.meeting_code));
  return [
    ...events.map((e) => ({ key: `e${e.id}`, title: e.title, code: e.meeting_code, start: e.starts_at, end: e.ends_at, kind: 'scheduled' as const })),
    ...((mt ?? []) as { id: string; code: string; title: string | null; created_at: string }[])
      .filter((m) => !have.has(m.code))
      .map((m) => ({ key: `m${m.id}`, title: m.title || 'Meeting link', code: m.code, start: m.created_at, end: null, kind: 'link' as const })),
  ].sort((x, y) => x.start.localeCompare(y.start));
}

export interface MeetingResource { label: string; url: string }
export interface MeetingPlan { code: string; title: string | null; description: string; invitees: string[]; resources: MeetingResource[] }

async function getPlan_(code: string): Promise<MeetingPlan> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_meetings').select('code, title, description, invitees, resources').eq('code', code).maybeSingle();
  if (!data) throw new Error('That call does not exist.');
  return { code: data.code, title: data.title, description: data.description ?? '', invitees: (data.invitees ?? []) as string[], resources: (data.resources ?? []) as MeetingResource[] };
}

/** Description, invited people and resources for a meeting. People and links are cleaned before they are kept. */
async function savePlan_(code: string, plan: { title?: string | null; description: string; invitees: string[]; resources: MeetingResource[] }): Promise<MeetingPlan> {
  const a = await requireAdminActor();
  const invitees = [...new Set(plan.invitees.map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))].slice(0, 50);
  const resources = plan.resources
    .map((r) => ({ label: String(r.label ?? '').trim().slice(0, 120), url: String(r.url ?? '').trim().slice(0, 1000) }))
    .filter((r) => /^https?:\/\//i.test(r.url) || r.url.startsWith('/'))
    .map((r) => ({ ...r, label: r.label || r.url }))
    .slice(0, 20);
  const { error } = await looseAdmin().from('mjengo_meetings').update({
    description: plan.description.trim().slice(0, 4000) || null,
    invitees,
    resources,
    ...(plan.title !== undefined ? { title: plan.title?.trim().slice(0, 120) || null } : {}),
  }).eq('code', code);
  if (error) throw new Error('Could not save the meeting details.');
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'meeting.planned', targetType: 'meeting', targetLabel: code });
  return getPlan_(code);
}

export const getMeetingPlan = guard(getPlan_);
export const saveMeetingPlan = guard(savePlan_);
export const meetHome = guard(meetHome_);
export const meetingDetail = guard(meetingDetail_);
export const makeMeetingNotes = guard(makeNotes_);
export const createMeeting = guard(createMeeting_);
export const listMeetings = guard(listMeetings_);
export const saveTranscript = guard(saveTranscript_);
export const getTranscript = guard(getTranscript_);
