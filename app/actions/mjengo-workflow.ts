'use server';

import { guard } from '@/lib/action-result';
import { looseAdmin } from '@/lib/loose-db';
import { isSuperAdminEmail, requireAdminActor } from '@/lib/access/super-admin';
import { approvalFor, decideApproval, requestApproval, waitingFor, type Approval, type ApprovalStatus } from '@/lib/mjengo/approvals';
import { briefOf, collectDigest, markCaughtUp, sinceFor, type Digest, type DigestItem } from '@/lib/mjengo/digest';
import { cleanSteps, ensureBuiltIns, type Playbook, type PlaybookStep } from '@/lib/mjengo/playbooks';
import type { EntityKind } from '@/lib/mjengo/entity-view';

const me = async () => { const a = await requireAdminActor(); return { id: a.id, email: a.email }; };

/* ------------------------------------------------------------------ catch-up digest */

/** What changed for this person since they last caught up (no AI: it is quick). */
async function getDigest_(): Promise<Omit<Digest, 'brief'>> {
  const a = await me();
  const since = await sinceFor(a.id);
  return { since, items: await collectDigest(a, since) };
}

/** Salama's few lines on those changes. */
async function digestBrief_(): Promise<string> {
  const a = await me();
  const since = await sinceFor(a.id);
  return briefOf(await collectDigest(a, since), since);
}

/** "I'm caught up": the next digest starts from now. */
async function catchUp_(): Promise<void> {
  await markCaughtUp((await me()).id);
}

/* ------------------------------------------------------------------ approvals */

async function askApproval_(fileId: string, reviewerIds: string[], note: string): Promise<Approval | null> {
  await requestApproval(await me(), fileId, reviewerIds, note ?? '');
  return approvalFor(fileId);
}

async function answerApproval_(approvalId: string, decision: 'approved' | 'changes_requested', comment: string): Promise<ApprovalStatus> {
  if (decision !== 'approved' && decision !== 'changes_requested') throw new Error('Choose approve or ask for changes.');
  return decideApproval(await me(), approvalId, decision, comment ?? '');
}

/** The latest approval on a file, and whether this person is being asked for an answer on it. */
async function getApproval_(fileId: string): Promise<{ approval: Approval | null; mine: boolean }> {
  const a = await me();
  const approval = await approvalFor(fileId);
  return { approval, mine: !!approval && approval.status === 'pending' && approval.reviewers.some((r) => r.id === a.id && r.decision === 'pending') };
}

async function myApprovals_() {
  return waitingFor(await me());
}

/* ------------------------------------------------------------------ playbooks */

async function listPlaybooks_(): Promise<{ playbooks: Playbook[]; canEditBuiltIn: boolean }> {
  const a = await me();
  await ensureBuiltIns();
  const { data } = await looseAdmin().from('mjengo_playbooks').select('id, name, entity_type, trigger_status, steps, active, built_in').order('entity_type').order('created_at');
  return {
    playbooks: ((data ?? []) as (Omit<Playbook, 'steps'> & { steps: unknown })[]).map((p) => ({ ...p, steps: cleanSteps(p.steps) })),
    canEditBuiltIn: await isSuperAdminEmail(a.email),
  };
}

const KINDS: EntityKind[] = ['grant', 'opportunity', 'project', 'fellowship'];

/** Make a playbook or change one. Built-in ones can be switched off by anyone but changed only by super admins. */
async function savePlaybook_(id: string | null, v: { name: string; entityType: EntityKind; triggerStatus: string; steps: PlaybookStep[]; active: boolean }): Promise<void> {
  const a = await me();
  const name = String(v.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const status = String(v.triggerStatus ?? '').trim().toLowerCase().replace(/[^a-z_]/g, '').slice(0, 40);
  if (!name) throw new Error('Give the playbook a name.');
  if (!KINDS.includes(v.entityType)) throw new Error('Choose what it is for.');
  if (!status) throw new Error('Choose the status that starts it.');
  const steps = cleanSteps(v.steps);
  if (!steps.length) throw new Error('Add at least one step.');
  const db = looseAdmin();
  if (id) {
    const { data: cur } = await db.from('mjengo_playbooks').select('built_in, created_by').eq('id', id).maybeSingle();
    if (!cur) throw new Error('That playbook no longer exists.');
    const isSuper = await isSuperAdminEmail(a.email);
    if (cur.built_in && !isSuper) {
      // Anyone may switch a built-in playbook on or off, nothing more.
      await db.from('mjengo_playbooks').update({ active: !!v.active }).eq('id', id);
      return;
    }
    if (!cur.built_in && cur.created_by !== a.id && !isSuper) throw new Error('Only the person who made it can change it.');
    const { error } = await db.from('mjengo_playbooks').update({ name, entity_type: v.entityType, trigger_status: status, steps, active: !!v.active }).eq('id', id);
    if (error) throw new Error('Could not save the playbook.');
    return;
  }
  const { error } = await db.from('mjengo_playbooks').insert({ name, entity_type: v.entityType, trigger_status: status, steps, active: !!v.active, created_by: a.id });
  if (error) throw new Error('Could not save the playbook.');
}

async function deletePlaybook_(id: string): Promise<void> {
  const a = await me();
  const db = looseAdmin();
  const { data: cur } = await db.from('mjengo_playbooks').select('built_in, created_by').eq('id', id).maybeSingle();
  if (!cur) return;
  if (cur.built_in) throw new Error('Built-in playbooks cannot be deleted, only switched off.');
  if (cur.created_by !== a.id && !(await isSuperAdminEmail(a.email))) throw new Error('Only the person who made it can delete it.');
  await db.from('mjengo_playbooks').delete().eq('id', id);
}

export const getDigest = guard(getDigest_);
export const digestBrief = guard(digestBrief_);
export const catchUp = guard(catchUp_);
export const askApproval = guard(askApproval_);
export const answerApproval = guard(answerApproval_);
export const getApproval = guard(getApproval_);
export const myApprovals = guard(myApprovals_);
export const listPlaybooks = guard(listPlaybooks_);
export const savePlaybook = guard(savePlaybook_);
export const deletePlaybook = guard(deletePlaybook_);
export type { DigestItem, Approval };
