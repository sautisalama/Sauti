'use server';

import { createHmac, randomBytes } from 'node:crypto';
import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { getActor, isSuperAdminEmail } from '@/lib/access/super-admin';
import { logAudit } from '@/lib/access/audit';

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

function signed(c: { base: string; secret: string }, action: 'put' | 'get' | 'delete', name: string, ttl: number, extra: Record<string, string> = {}): string {
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

/**
 * A super administrator removes a call's recording: the file on the recordings host, the copy in Files, and the
 * link to both. The call, its notes and its transcript stay. `fileRemoved` is false when the host could not be
 * reached or does not yet know how to delete (the link is gone either way, so no one can open it).
 */
async function remove_(code: string): Promise<{ fileRemoved: boolean }> {
  if (!CODE.test(code)) throw new Error('That is not a valid call link.');
  const a = await getActor();
  if (!a || !(await isSuperAdminEmail(a.email))) throw new Error('Only a super administrator can delete a recording.');
  const db = looseAdmin();
  const { data: m } = await db.from('mjengo_meetings').select('id, remote_recording, recording_file_id').eq('code', code).maybeSingle();
  if (!m) throw new Error('That call does not exist.');
  const name = (m as { remote_recording?: string | null }).remote_recording ?? null;
  const fileId = (m as { recording_file_id?: string | null }).recording_file_id ?? null;
  if (!name && !fileId) throw new Error('This call has no recording.');
  let fileRemoved = true;
  const c = cfg();
  if (name) {
    fileRemoved = false;
    if (c) {
      try {
        const r = await fetch(signed(c, 'delete', name, 300), { method: 'POST' });
        fileRemoved = r.ok || r.status === 404;
      } catch { /* the link is removed below regardless */ }
    }
  }
  if (fileId) {
    const { data: f } = await db.from('vault_files').select('storage_path').eq('id', fileId).maybeSingle();
    const path = (f as { storage_path?: string | null } | null)?.storage_path;
    if (path) await db.storage.from('mjengo-docs').remove([path]).catch(() => undefined);
    await db.from('vault_files').delete().eq('id', fileId);
  }
  const { error } = await db.from('mjengo_meetings').update({ remote_recording: null, remote_recording_size: null, recording_file_id: null, recorded_at: null, recorded_by: null }).eq('id', (m as { id: string }).id);
  if (error) throw new Error('Could not remove the recording from the call.');
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'meeting.recording_deleted', targetType: 'meeting', targetLabel: code, details: { fileRemoved } });
  return { fileRemoved };
}

/** Is this person allowed to delete recordings? Used to show the button. */
async function canDelete_(): Promise<boolean> {
  const a = await getActor();
  return !!a && (await isSuperAdminEmail(a.email));
}

export const deleteRecording = guard(remove_);
export const canDeleteRecordings = guard(canDelete_);
export const recordingStoreAvailable = guard(available_);
export const beginRemoteRecording = guard(begin_);
export const finishRemoteRecording = guard(finish_);
export const watchRecording = guard(watch_);
