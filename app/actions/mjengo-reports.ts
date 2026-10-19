'use server';

import { after } from 'next/server';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor } from '@/lib/access/super-admin';
import { requireModule, type ModuleKey } from '@/lib/access/permissions';
import { explainFileAccess, type AccessExplanation } from '@/lib/mjengo/access-explain';
import { ENTITY_KINDS, type EntityKind } from '@/lib/mjengo/entity-view';
import { fileLink } from '@/lib/mjengo/links';
import { draftProgressReport } from '@/lib/mjengo/progress-report';
import { indexSource } from '@/lib/mjengo/search-index';
import { linkFileToRecord, saveToVault } from '@/lib/mjengo/vault-save';

const MODULE_OF: Record<EntityKind, ModuleKey> = { grant: 'grants', opportunity: 'opportunities', project: 'projects', fellowship: 'fellowships' };

/** Who can open a file, and why each of them can. People who may share it see everyone; others see only themselves. */
async function whoCanSeeFile_(fileId: string): Promise<AccessExplanation> {
  const a = await requireAdminActor();
  return explainFileAccess({ id: a.id, email: a.email }, fileId);
}

/**
 * Draft a progress report for a grant, opportunity, project or fellowship from its own record, save it as a Word file in
 * the person's vault (Reports folder), put it on the record's timeline, and let the autotagger tag it.
 */
async function progressReport_(kind: EntityKind, id: string, months = 6): Promise<{ id: string; name: string; link: string; words: number; tags: string[] }> {
  if (!ENTITY_KINDS.includes(kind)) throw new Error('That kind of record has no reports.');
  const a = await requireModule(MODULE_OF[kind], 'write');
  const actor = { id: a.id, email: a.email };
  const m = Math.max(1, Math.min(24, Math.round(Number(months) || 6)));
  const r = await draftProgressReport(actor, kind, id, m);
  const stamp = new Date().toISOString().slice(0, 7);
  const saved = await saveToVault(actor, { name: `${r.title} ${stamp}.docx`, bytes: r.docx, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', folder: 'Reports' });
  await linkFileToRecord(kind, id, saved.id, actor.id, false);
  after(() => indexSource('file', saved.id).then(() => undefined).catch(() => undefined));
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.report_drafted', targetType: kind, targetId: id, targetLabel: r.title });
  return { id: saved.id, name: saved.name, link: fileLink(saved.name, saved.id), words: r.words, tags: [] };
}

export const whoCanSeeFile = guard(whoCanSeeFile_);
export const progressReport = guard(progressReport_);
