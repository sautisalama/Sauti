'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { getActor } from '@/lib/access/super-admin';
import { atLeast, levelFor, loadIndex, oversightFor, type Level } from '@/lib/vault/access';
import { fileLink } from '@/lib/mjengo/links';

/**
 * Documents attached to a call. They live in the call's resources as links to the file, so a document attached before
 * the call and one attached during it are the same thing. Everyone in the call who is an administrator is given edit
 * rights on what is attached, so it can be opened and changed together, live.
 */

const CODE = /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/;
const FILE_ID = /[?&]file=([0-9a-f-]{36})/i;

export interface MeetingDoc { id: string; name: string; ext: string; href: string; level: Level | null; addedBy?: string }

async function loadMeeting(code: string) {
  if (!CODE.test(code)) throw new Error('That is not a valid call link.');
  const db = looseAdmin();
  const { data } = await db.from('mjengo_meetings').select('id, code, created_by, invitees, participants, resources').eq('code', code).maybeSingle();
  if (!data) throw new Error('That call does not exist.');
  const { data: ev } = await db.from('mjengo_events').select('attendees').eq('meeting_code', code);
  const attendees = ((ev ?? []) as { attendees: string[] | null }[]).flatMap((e) => e.attendees ?? []);
  const invited = new Set([...((data.invitees ?? []) as string[]), ...attendees].map((x) => String(x).toLowerCase()));
  return { ...data, invited } as { id: string; code: string; created_by: string | null; participants: string[] | null; resources: { label: string; url: string }[] | null; invited: Set<string> };
}

/** Signed in, and in the invitation (or the host, or already in the call). */
async function member(m: Awaited<ReturnType<typeof loadMeeting>>) {
  const a = await getActor();
  if (!a) throw new Error('Sign in to work on documents in a call.');
  const ok = m.created_by === a.id || m.invited.has(a.email.toLowerCase()) || (m.participants ?? []).includes(a.id);
  if (!ok) throw new Error('Only people in the invitation can work on the documents.');
  return a;
}

const idOf = (url: string) => FILE_ID.exec(url)?.[1] ?? null;
const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

async function grantEdit(userId: string, fileIds: string[], by: string) {
  if (!fileIds.length) return;
  await looseAdmin().from('vault_permissions').upsert(
    fileIds.map((id) => ({ resource_type: 'file', resource_id: id, user_id: userId, level: 'edit', granted_by: by })),
    { onConflict: 'resource_type,resource_id,user_id' },
  );
}

async function docs_(code: string): Promise<MeetingDoc[]> {
  const m = await loadMeeting(code);
  const a = await member(m);
  const ids = [...new Set((m.resources ?? []).map((r) => idOf(r.url)).filter(Boolean) as string[])];
  if (!ids.length) return [];
  const { data: files } = await looseAdmin().from('vault_files').select('id, name, owner_id').in('id', ids);
  const rows = (files ?? []) as { id: string; name: string; owner_id: string }[];
  if (!rows.length) return [];
  // An administrator in the call may edit what the call works on; others see it as far as their access reaches.
  if (a.isAdmin) {
    const ix = await loadIndex();
    const oversight = await oversightFor(a.email);
    const need = rows.filter((f) => !atLeast(levelFor(ix, a.id, 'file', f.id, oversight), 'edit')).map((f) => f.id);
    await grantEdit(a.id, need, m.created_by ?? a.id);
  }
  const ix = await loadIndex();
  const oversight = await oversightFor(a.email);
  return ids.flatMap((id) => {
    const f = rows.find((r) => r.id === id);
    return f ? [{ id, name: f.name, ext: extOf(f.name), href: fileLink(f.name, id), level: a.isAdmin ? levelFor(ix, a.id, 'file', id, oversight) : null }] : [];
  });
}

/** Attach a file from Files to the call, before or after it has started. Needs the right to share the file. */
async function attach_(code: string, fileId: string): Promise<MeetingDoc[]> {
  const m = await loadMeeting(code);
  const a = await member(m);
  if (!a.isAdmin) throw new Error('Only administrators can attach files.');
  const ix = await loadIndex();
  const oversight = await oversightFor(a.email);
  const f = ix.files.get(fileId);
  if (!f) throw new Error('That file no longer exists.');
  if (!atLeast(levelFor(ix, a.id, 'file', fileId, oversight), 'share')) throw new Error('You can only attach files you can share.');
  const have = (m.resources ?? []).some((r) => idOf(r.url) === fileId);
  if (!have) {
    const resources = [...(m.resources ?? []), { label: f.name, url: fileLink(f.name, fileId) }].slice(-20);
    const { error } = await looseAdmin().from('mjengo_meetings').update({ resources }).eq('code', code);
    if (error) throw new Error('Could not attach the file.');
    if (!f.meeting_code) await looseAdmin().from('vault_files').update({ meeting_code: code }).eq('id', fileId);
    await logAudit({ actorId: a.id, actorEmail: a.email, action: 'meeting.document_attached', targetType: 'meeting', targetLabel: code, details: { fileId, name: f.name } });
  }
  return docs_(code);
}

async function detach_(code: string, fileId: string): Promise<MeetingDoc[]> {
  const m = await loadMeeting(code);
  const a = await member(m);
  const resources = (m.resources ?? []).filter((r) => idOf(r.url) !== fileId);
  await looseAdmin().from('mjengo_meetings').update({ resources }).eq('code', code);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'meeting.document_removed', targetType: 'meeting', targetLabel: code, details: { fileId } });
  return docs_(code);
}

export const meetingDocs = guard(docs_);
export const attachMeetingDoc = guard(attach_);
export const detachMeetingDoc = guard(detach_);
