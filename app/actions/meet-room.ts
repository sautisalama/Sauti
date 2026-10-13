'use server';

import { createHmac } from 'node:crypto';
import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { getActor } from '@/lib/access/super-admin';

/**
 * Who may be in a call. The creator and everyone invited (by email, on the calendar event, or who was admitted
 * before) walk straight in when signed in. Everyone else, even with the link, knocks and waits until a participant
 * admits them. Admission is enforced with a room key: the realtime channel a call uses carries a key that only
 * the server hands out, so knowing the link alone is not enough to listen in.
 */

const VERSION = 'meet-room-v1';
function roomKey(code: string): string {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY || '';
  if (!secret) throw new Error('The server is not configured for calls.');
  return createHmac('sha256', secret).update(`${VERSION}:${code}`).digest('hex').slice(0, 32);
}

const CODE = /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/;

async function meeting(code: string) {
  if (!CODE.test(code)) throw new Error('That is not a valid call link.');
  const { data } = await looseAdmin().from('mjengo_meetings').select('id, code, created_by, invitees, participants, settings, title').eq('code', code).maybeSingle();
  if (!data) throw new Error('That call does not exist.');
  const { data: ev } = await looseAdmin().from('mjengo_events').select('attendees').eq('meeting_code', code);
  const attendees = ((ev ?? []) as { attendees: string[] | null }[]).flatMap((e) => e.attendees ?? []).map((x) => x.toLowerCase());
  return { ...data, invited: new Set([...((data.invitees ?? []) as string[]).map((x) => x.toLowerCase()), ...attendees]) } as {
    id: string; code: string; created_by: string | null; invitees: string[]; participants: string[]; settings: { locked?: boolean } | null; title: string | null; invited: Set<string>;
  };
}

async function participantOf(m: Awaited<ReturnType<typeof meeting>>): Promise<{ id: string; email: string; name: string; host: boolean } | null> {
  const a = await getActor();
  if (!a) return null;
  const host = m.created_by === a.id;
  const ok = host || m.invited.has(a.email) || (m.participants ?? []).includes(a.id);
  return ok ? { id: a.id, email: a.email, name: a.name, host } : null;
}

export type Entry =
  | { status: 'in'; key: string; host: boolean; name: string | null }
  | { status: 'waiting' }
  | { status: 'denied' };

/** Ask to be in the call. Participants get the room key straight away; everyone else is put in the waiting room. */
async function enter_(code: string, guestKey: string, name: string): Promise<Entry> {
  const m = await meeting(code);
  const me = await participantOf(m);
  if (me) return { status: 'in', key: roomKey(code), host: me.host, name: me.name };
  if (m.settings?.locked) throw new Error('The host has locked this call, so no one new can ask to join.');
  const key = String(guestKey).slice(0, 80);
  if (!key) throw new Error('Missing guest key.');
  const db = looseAdmin();
  const a = await getActor();
  const { data: have } = await db.from('mjengo_meeting_knocks').select('status').eq('code', code).eq('guest_key', key).maybeSingle();
  if (have?.status === 'admitted') return { status: 'in', key: roomKey(code), host: false, name: null };
  if (have?.status === 'denied') return { status: 'denied' };
  const label = name.trim().slice(0, 80) || a?.name || 'Guest';
  await db.from('mjengo_meeting_knocks').upsert({ code, guest_key: key, name: label, user_id: a?.id ?? null, status: 'pending' }, { onConflict: 'code,guest_key' });
  return { status: 'waiting' };
}

/** The guest asks whether they have been let in yet. */
async function check_(code: string, guestKey: string): Promise<Entry> {
  if (!CODE.test(code)) throw new Error('That is not a valid call link.');
  const { data } = await looseAdmin().from('mjengo_meeting_knocks').select('status').eq('code', code).eq('guest_key', String(guestKey).slice(0, 80)).maybeSingle();
  if (data?.status === 'admitted') return { status: 'in', key: roomKey(code), host: false, name: null };
  if (data?.status === 'denied') return { status: 'denied' };
  return { status: 'waiting' };
}

export interface Knock { guestKey: string; name: string; at: string }

/** People waiting to come in. Only participants can see the list. */
async function knocks_(code: string): Promise<Knock[]> {
  const m = await meeting(code);
  if (!(await participantOf(m))) return [];
  const { data } = await looseAdmin().from('mjengo_meeting_knocks').select('guest_key, name, created_at').eq('code', code).eq('status', 'pending').order('created_at');
  return ((data ?? []) as { guest_key: string; name: string; created_at: string }[]).map((k) => ({ guestKey: k.guest_key, name: k.name, at: k.created_at }));
}

async function decide_(code: string, guestKey: string, admit: boolean): Promise<void> {
  const m = await meeting(code);
  const me = await participantOf(m);
  if (!me) throw new Error('Only people in the invitation can let others in.');
  await looseAdmin().from('mjengo_meeting_knocks').update({ status: admit ? 'admitted' : 'denied', decided_by: me.id, decided_at: new Date().toISOString() }).eq('code', code).eq('guest_key', guestKey);
}

/** Let in, or decline, everyone waiting. */
async function decideAll_(code: string, admit: boolean): Promise<void> {
  const m = await meeting(code);
  const me = await participantOf(m);
  if (!me) throw new Error('Only people in the invitation can let others in.');
  await looseAdmin().from('mjengo_meeting_knocks').update({ status: admit ? 'admitted' : 'denied', decided_by: me.id, decided_at: new Date().toISOString() }).eq('code', code).eq('status', 'pending');
}

export interface ChatLine { id: string; name: string; text: string; at: string }

/** Keep the messages written in the call with the meeting. Only participants can save. */
async function saveChat_(code: string, lines: ChatLine[]): Promise<void> {
  const m = await meeting(code);
  if (!(await participantOf(m))) return;
  const db = looseAdmin();
  const { data } = await db.from('mjengo_meetings').select('chat').eq('code', code).maybeSingle();
  const have = new Map<string, ChatLine>(((data?.chat ?? []) as ChatLine[]).map((l) => [l.id, l]));
  for (const l of lines.slice(0, 2000)) have.set(String(l.id).slice(0, 60), { id: String(l.id).slice(0, 60), name: String(l.name).slice(0, 80), text: String(l.text).slice(0, 2000), at: String(l.at).slice(0, 40) });
  await db.from('mjengo_meetings').update({ chat: [...have.values()].sort((a, b) => a.at.localeCompare(b.at)) }).eq('code', code);
}

/** The host locks or unlocks the call: while it is locked nobody new can knock. */
async function lock_(code: string, locked: boolean): Promise<void> {
  const m = await meeting(code);
  const me = await participantOf(m);
  if (!me?.host) throw new Error('Only the host can lock the call.');
  await looseAdmin().from('mjengo_meetings').update({ settings: { ...(m.settings ?? {}), locked } }).eq('code', code);
}

export const lockMeeting = guard(lock_);
export const enterMeeting = guard(enter_);
export const checkMeetingEntry = guard(check_);
export const listKnocks = guard(knocks_);
export const decideKnock = guard(decide_);
export const decideAllKnocks = guard(decideAll_);
export const saveMeetingChat = guard(saveChat_);
