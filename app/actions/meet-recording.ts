'use server';

import { createHmac, randomBytes } from 'node:crypto';
import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { getActor } from '@/lib/access/super-admin';

/**
 * Call recordings kept on the organisation's own host (see docs/cpanel/mjengo-rec-index.php). The browser sends
 * the recording straight there with a short-lived signed address, so it never passes through this server.
 */

const DOMAIN = (process.env.ORG_EMAIL_DOMAIN || 'sautisalama.org').toLowerCase();
const CODE = /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/;

function cfg(): { base: string; secret: string } | null {
  const base = process.env.RECORDINGS_BASE_URL;
  const secret = process.env.RECORDINGS_SECRET;
  return base && secret ? { base, secret } : null;
}

function signed(c: { base: string; secret: string }, action: 'put' | 'get', name: string, ttl: number, extra: Record<string, string> = {}): string {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = createHmac('sha256', c.secret).update(`${action}|${name}|${exp}`).digest('hex');
  const q = new URLSearchParams({ a: action, f: name, exp: String(exp), sig, ...extra });
  return `${c.base}?${q.toString()}`;
}

async function allowed(code: string) {
  if (!CODE.test(code)) throw new Error('That is not a valid call link.');
  const a = await getActor();
  if (!a) throw new Error('Sign in first.');
  const { data: m } = await looseAdmin().from('mjengo_meetings').select('id, created_by, invitees, participants, remote_recording').eq('code', code).maybeSingle();
  if (!m) throw new Error('That call does not exist.');
  const took = m.created_by === a.id || ((m.participants ?? []) as string[]).includes(a.id) || ((m.invitees ?? []) as string[]).map((x) => x.toLowerCase()).includes(a.email);
  return { a, m, took, team: a.email.endsWith(`@${DOMAIN}`) || a.isAdmin };
}

/** Is the recordings host set up? The recorder falls back to Files when it is not. */
async function available_(): Promise<boolean> {
  return !!cfg();
}

/** An address the browser can send the recording to, valid for two hours. */
async function begin_(code: string): Promise<{ name: string; put: string }> {
  const c = cfg();
  if (!c) throw new Error('Recordings storage is not set up.');
  const { a, took } = await allowed(code);
  if (!took && !a.isAdmin) throw new Error('Only people in the call can record it.');
  const name = `${code}-${Date.now()}-${randomBytes(4).toString('hex')}.webm`;
  return { name, put: signed(c, 'put', name, 2 * 3600) };
}

/** The recording has been sent: keep its name with the meeting. */
async function finish_(code: string, name: string, size: number): Promise<void> {
  const { a, took } = await allowed(code);
  if (!took && !a.isAdmin) throw new Error('Only people in the call can record it.');
  if (!name.startsWith(`${code}-`) || !/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error('Unknown recording.');
  const { error } = await looseAdmin().from('mjengo_meetings').update({ remote_recording: name, remote_recording_size: Math.max(0, Math.floor(size)), recorded_at: new Date().toISOString(), recorded_by: a.id }).eq('code', code);
  if (error) throw new Error('Could not attach the recording to the meeting.');
}

/** A viewing address, valid for an hour, for the organisation's people who took part (or administrators). */
async function watch_(code: string): Promise<{ url: string; size: number | null }> {
  const c = cfg();
  if (!c) throw new Error('Recordings storage is not set up.');
  const { a, m, took, team } = await allowed(code);
  if (!team || (!took && !a.isAdmin)) throw new Error('The recording is only for the organisation\'s people who were in the call.');
  const name = (m as { remote_recording?: string | null }).remote_recording;
  if (!name) throw new Error('This call has no recording on the storage host.');
  return { url: signed(c, 'get', name, 3600), size: null };
}

export const recordingStoreAvailable = guard(available_);
export const beginRemoteRecording = guard(begin_);
export const finishRemoteRecording = guard(finish_);
export const watchRecording = guard(watch_);
