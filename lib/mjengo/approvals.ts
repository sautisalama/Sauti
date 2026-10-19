import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { sendNotification } from '@/lib/notifications';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import { fileLink } from '@/lib/mjengo/links';

export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested' | 'withdrawn';
export type Decision = 'pending' | 'approved' | 'changes_requested';
export interface Approval {
  id: string;
  fileId: string;
  note: string | null;
  status: ApprovalStatus;
  requestedBy: { id: string; name: string };
  createdAt: string;
  decidedAt: string | null;
  reviewers: { id: string; name: string; decision: Decision; comment: string | null; decidedAt: string | null }[];
}

/** One approval's overall state from its reviewers: any request for changes wins, otherwise all must approve. */
export function statusOf(decisions: Decision[]): ApprovalStatus {
  if (decisions.some((d) => d === 'changes_requested')) return 'changes_requested';
  if (decisions.length > 0 && decisions.every((d) => d === 'approved')) return 'approved';
  return 'pending';
}

async function names(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return new Map();
  const { data } = await looseAdmin().from('profiles').select('id, first_name, last_name, email').in('id', uniq);
  return new Map(((data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Someone']));
}

/**
 * Ask named people to approve a file. Anyone who cannot open it yet is given view access (that is the point of asking).
 * An earlier request still waiting on the same file is withdrawn, so a file has one live request at a time.
 */
export async function requestApproval(actor: { id: string; email: string }, fileId: string, reviewerIds: string[], note: string): Promise<string> {
  const db = looseAdmin();
  const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(actor.email)]);
  const file = ix.files.get(fileId);
  if (!file || !atLeast(levelFor(ix, actor.id, 'file', fileId, oversight), 'share')) throw new Error('You can ask for approval of files you can share.');
  const reviewers = [...new Set(reviewerIds)].filter((r) => r !== actor.id).slice(0, 10);
  if (!reviewers.length) throw new Error('Choose at least one person other than yourself.');
  const { data: ok } = await db.from('profiles').select('id').in('id', reviewers).eq('is_admin', true);
  const valid = ((ok ?? []) as { id: string }[]).map((p) => p.id);
  if (valid.length !== reviewers.length) throw new Error('Only team members can be asked to approve.');

  await db.from('mjengo_approvals').update({ status: 'withdrawn', decided_at: new Date().toISOString() }).eq('file_id', fileId).eq('status', 'pending');
  const { data: made, error } = await db.from('mjengo_approvals').insert({ file_id: fileId, requested_by: actor.id, note: note.trim().slice(0, 600) || null }).select('id').single();
  if (error || !made) throw new Error('Could not ask for approval.');
  await db.from('mjengo_approval_reviewers').insert(valid.map((user_id) => ({ approval_id: made.id, user_id })));
  for (const uid of valid) {
    if (!levelFor(ix, uid, 'file', fileId, false)) {
      await db.from('vault_permissions').upsert({ resource_type: 'file', resource_id: fileId, user_id: uid, level: 'view', granted_by: actor.id }, { onConflict: 'resource_type,resource_id,user_id' });
    }
    await sendNotification({ userId: uid, type: 'system_alert', title: 'Your approval is asked for', message: `${file.name}${note.trim() ? `: ${note.trim().slice(0, 120)}` : ''}`, link: fileLink(file.name, fileId), sendEmail: false }).catch(() => undefined);
  }
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'vault.approval_requested', targetType: 'vault_file', targetId: fileId, targetLabel: file.name, details: { reviewers: valid.length } });
  return made.id;
}

/** A reviewer's answer. The requester is told, and the approval takes its overall state. */
export async function decideApproval(actor: { id: string; email: string }, approvalId: string, decision: 'approved' | 'changes_requested', comment: string): Promise<ApprovalStatus> {
  const db = looseAdmin();
  const { data: ap } = await db.from('mjengo_approvals').select('id, file_id, requested_by, status').eq('id', approvalId).maybeSingle();
  if (!ap) throw new Error('That request no longer exists.');
  if (ap.status !== 'pending') throw new Error('That request is no longer open.');
  const { data: me } = await db.from('mjengo_approval_reviewers').select('decision').eq('approval_id', approvalId).eq('user_id', actor.id).maybeSingle();
  if (!me) throw new Error('You were not asked to approve this.');
  if (decision === 'changes_requested' && !comment.trim()) throw new Error('Say what needs to change.');
  await db.from('mjengo_approval_reviewers').update({ decision, comment: comment.trim().slice(0, 800) || null, decided_at: new Date().toISOString() }).eq('approval_id', approvalId).eq('user_id', actor.id);
  const { data: all } = await db.from('mjengo_approval_reviewers').select('decision').eq('approval_id', approvalId);
  const status = statusOf(((all ?? []) as { decision: Decision }[]).map((r) => r.decision));
  if (status !== 'pending') await db.from('mjengo_approvals').update({ status, decided_at: new Date().toISOString() }).eq('id', approvalId);
  const { data: f } = await db.from('vault_files').select('name').eq('id', ap.file_id).maybeSingle();
  const who = (await names([actor.id])).get(actor.id) ?? 'Someone';
  const fname = f?.name ?? 'your file';
  await sendNotification({
    userId: ap.requested_by, type: 'system_alert',
    title: status === 'approved' ? `Approved: ${fname}` : decision === 'approved' ? `${who} approved ${fname}` : `${who} asked for changes to ${fname}`,
    message: comment.trim().slice(0, 160) || (status === 'approved' ? 'Everyone you asked has approved it.' : ''), link: fileLink(fname, ap.file_id), sendEmail: false,
  }).catch(() => undefined);
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: `vault.approval_${decision}`, targetType: 'vault_file', targetId: ap.file_id, targetLabel: fname });
  return status;
}

/** The latest request on a file, with who was asked and what they said. */
export async function approvalFor(fileId: string): Promise<Approval | null> {
  const db = looseAdmin();
  const { data: ap } = await db.from('mjengo_approvals').select('id, file_id, requested_by, note, status, created_at, decided_at').eq('file_id', fileId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!ap) return null;
  const { data: rs } = await db.from('mjengo_approval_reviewers').select('user_id, decision, comment, decided_at').eq('approval_id', ap.id);
  const reviewers = (rs ?? []) as { user_id: string; decision: Decision; comment: string | null; decided_at: string | null }[];
  const n = await names([ap.requested_by, ...reviewers.map((r) => r.user_id)]);
  return {
    id: ap.id, fileId: ap.file_id, note: ap.note, status: ap.status as ApprovalStatus, createdAt: ap.created_at, decidedAt: ap.decided_at,
    requestedBy: { id: ap.requested_by, name: n.get(ap.requested_by) ?? 'Someone' },
    reviewers: reviewers.map((r) => ({ id: r.user_id, name: n.get(r.user_id) ?? 'Someone', decision: r.decision, comment: r.comment, decidedAt: r.decided_at })),
  };
}

/** Files waiting for this person's answer, oldest first. Only those they may open. */
export async function waitingFor(asker: { id: string; email: string }): Promise<{ approvalId: string; fileId: string; name: string; link: string; from: string; note: string | null; at: string }[]> {
  const db = looseAdmin();
  const { data: mine } = await db.from('mjengo_approval_reviewers').select('approval_id').eq('user_id', asker.id).eq('decision', 'pending');
  const ids = ((mine ?? []) as { approval_id: string }[]).map((m) => m.approval_id);
  if (!ids.length) return [];
  const { data: aps } = await db.from('mjengo_approvals').select('id, file_id, requested_by, note, created_at').in('id', ids).eq('status', 'pending').order('created_at');
  const rows = (aps ?? []) as { id: string; file_id: string; requested_by: string; note: string | null; created_at: string }[];
  const [ix, oversight, n] = await Promise.all([loadIndex(), oversightFor(asker.email), names(rows.map((r) => r.requested_by))]);
  return rows.flatMap((r) => {
    const f = ix.files.get(r.file_id);
    if (!f || !atLeast(levelFor(ix, asker.id, 'file', r.file_id, oversight), 'view')) return [];
    return [{ approvalId: r.id, fileId: r.file_id, name: f.name, link: fileLink(f.name, f.id), from: n.get(r.requested_by) ?? 'Someone', note: r.note, at: r.created_at }];
  });
}
