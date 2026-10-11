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
  const { data } = await looseAdmin().from('mjengo_meetings').select('id, code, title, mode, created_at, ended_at, created_by, transcript').order('created_at', { ascending: false }).limit(30);
  return ((data ?? []) as (Omit<MeetingRow, 'lines'> & { transcript: unknown[] })[]).map(({ transcript, ...m }) => ({ ...m, lines: Array.isArray(transcript) ? transcript.length : 0 }));
}

/** Keep what was said. Several people may save: lines are merged by id. */
async function saveTranscript_(code: string, lines: TranscriptLine[], end: boolean) {
  await requireAdminActor();
  const db = looseAdmin();
  const { data } = await db.from('mjengo_meetings').select('id, transcript').eq('code', code).maybeSingle();
  if (!data) throw new Error('That call does not exist.');
  const have = new Map<string, TranscriptLine>(((data.transcript ?? []) as TranscriptLine[]).map((l) => [l.id, l]));
  for (const l of lines.slice(0, 5000)) have.set(String(l.id).slice(0, 60), { id: String(l.id).slice(0, 60), name: String(l.name).slice(0, 80), text: String(l.text).slice(0, 2000), at: String(l.at).slice(0, 40) });
  const merged = [...have.values()].sort((a, b) => a.at.localeCompare(b.at));
  await db.from('mjengo_meetings').update({ transcript: merged, ...(end ? { ended_at: new Date().toISOString() } : {}) }).eq('id', data.id);
}

async function getTranscript_(code: string): Promise<{ title: string | null; lines: TranscriptLine[] }> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_meetings').select('title, transcript').eq('code', code).maybeSingle();
  if (!data) throw new Error('That call does not exist.');
  return { title: data.title, lines: (data.transcript ?? []) as TranscriptLine[] };
}

export const createMeeting = guard(createMeeting_);
export const listMeetings = guard(listMeetings_);
export const saveTranscript = guard(saveTranscript_);
export const getTranscript = guard(getTranscript_);
