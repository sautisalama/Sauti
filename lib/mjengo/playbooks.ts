import { looseAdmin } from '@/lib/loose-db';
import { sendNotification } from '@/lib/notifications';
import { ensureFolder } from '@/lib/mjengo/vault-save';
import { ENTITY_LABEL_FIELD, ENTITY_TABLE, type EntityKind } from '@/lib/mjengo/entity-view';

export interface PlaybookStep { kind: 'todo' | 'folder'; /** to-do title */ title?: string; /** folder name (default: the record's name) */ name?: string; /** days after the record reached the status */ offsetDays?: number; notes?: string }
export interface Playbook { id: string; name: string; entity_type: EntityKind; trigger_status: string; steps: PlaybookStep[]; active: boolean; built_in: boolean }

/** What a playbook may contain, made safe: known kinds only, capped lengths and counts. */
export function cleanSteps(raw: unknown): PlaybookStep[] {
  if (!Array.isArray(raw)) return [];
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  return raw.slice(0, 25).flatMap((s): PlaybookStep[] => {
    const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    if (o.kind === 'folder') return [{ kind: 'folder', name: str(o.name, 80) || undefined }];
    const title = str(o.title, 160);
    if (o.kind !== 'todo' || !title) return [];
    const off = Number(o.offsetDays);
    return [{ kind: 'todo', title, offsetDays: Number.isFinite(off) ? Math.max(0, Math.min(730, Math.round(off))) : 0, notes: str(o.notes, 400) || undefined }];
  });
}

const t = (title: string, offsetDays: number, notes?: string): PlaybookStep => ({ kind: 'todo', title, offsetDays, notes });

/** The playbooks that come with the suite. People can switch them off or change them; they are made once. */
export const BUILT_IN_PLAYBOOKS: Omit<Playbook, 'id' | 'active' | 'built_in'>[] = [
  { name: 'Grant awarded: set it up', entity_type: 'grant', trigger_status: 'awarded', steps: [
    { kind: 'folder' },
    t('Send the thank-you and acceptance letter to the funder', 2),
    t('Hold the kick-off meeting with the team', 7),
    t('Agree the reporting calendar with the funder', 14),
    t('Set up budget tracking for this grant', 14),
    t('First check of progress against the plan', 30),
  ] },
  { name: 'Grant submitted: follow up', entity_type: 'grant', trigger_status: 'submitted', steps: [
    t('Put the funder\'s decision date in the calendar', 1),
    t('Check in with the funder if there is no news', 30),
  ] },
  { name: 'Grant declined: learn from it', entity_type: 'grant', trigger_status: 'declined', steps: [
    t('Ask the funder for feedback on the application', 3),
    t('Record the funder\'s feedback on the grant, so later drafts use it', 7),
    t('Decide whether to apply again next round', 14),
  ] },
  { name: 'Opportunity pursued: get going', entity_type: 'opportunity', trigger_status: 'pursuing', steps: [
    t('Read the call in full and note the deadline', 1),
    t('Decide who leads the application', 2),
    t('Gather the documents the funder asks for', 7),
  ] },
  { name: 'Project active: start well', entity_type: 'project', trigger_status: 'active', steps: [
    { kind: 'folder' },
    t('Hold the project kick-off', 3),
    t('Share the plan and the budget with the team', 7),
    t('First monthly progress update', 30),
  ] },
  { name: 'Project completed: close it out', entity_type: 'project', trigger_status: 'completed', steps: [
    t('Write the closing report', 7),
    t('Collect the lessons learned with the team', 14),
    t('Archive the project folder', 30),
  ] },
  { name: 'Fellowship accepted: prepare', entity_type: 'fellowship', trigger_status: 'accepted', steps: [
    t('Confirm the dates, travel and visa needs', 3),
    t('Reply to the host to accept formally', 3),
    t('Brief the team on cover while you are away', 14),
  ] },
];

/** Make the built-in playbooks exist (once each, matched by name). Cheap to call. */
export async function ensureBuiltIns(): Promise<void> {
  const db = looseAdmin();
  const { data } = await db.from('mjengo_playbooks').select('name').eq('built_in', true);
  const have = new Set(((data ?? []) as { name: string }[]).map((p) => p.name));
  const missing = BUILT_IN_PLAYBOOKS.filter((p) => !have.has(p.name));
  if (missing.length) await db.from('mjengo_playbooks').insert(missing.map((p) => ({ ...p, built_in: true, active: true })));
}

const TRACK = 'Playbooks';
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);

/**
 * A record has reached `status`: run the active playbooks for that status, once per record each. To-dos go on the
 * "Playbooks" track, linked to the record and given to whoever is responsible for it (or whoever added it); a folder
 * step makes a folder for the record in that person's vault. They are told what was set up.
 */
export async function runPlaybooks(kind: EntityKind, id: string, status: string, actorId: string): Promise<{ made: number; playbooks: string[] }> {
  const db = looseAdmin();
  await ensureBuiltIns().catch(() => undefined);
  const { data: pbs } = await db.from('mjengo_playbooks').select('id, name, steps').eq('entity_type', kind).eq('trigger_status', status).eq('active', true);
  if (!pbs?.length) return { made: 0, playbooks: [] };
  const { data: rec } = await db.from(ENTITY_TABLE[kind]).select('*').eq('id', id).maybeSingle();
  if (!rec) return { made: 0, playbooks: [] };
  const r = rec as Record<string, unknown>;
  const title = String(r[ENTITY_LABEL_FIELD[kind]] ?? 'Untitled');
  const owner = (kind === 'project' ? r.lead_id : r.owner_id) as string | null;
  const responsible = owner ?? (r.created_by as string | null) ?? actorId;

  let { data: track } = await db.from('mjengo_todo_tracks').select('id').eq('name', TRACK).maybeSingle();
  if (!track) ({ data: track } = await db.from('mjengo_todo_tracks').insert({ name: TRACK, color: 'green', created_by: actorId }).select('id').single());
  let made = 0;
  const ran: string[] = [];
  for (const pb of pbs as { id: string; name: string; steps: unknown }[]) {
    // Once per record and playbook: the claim is made first so two saves in a row cannot both run it.
    const { error: claim } = await db.from('mjengo_playbook_runs').insert({ playbook_id: pb.id, entity_type: kind, entity_id: id, made: 0 });
    if (claim) continue;
    let n = 0;
    for (const s of cleanSteps(pb.steps)) {
      try {
        if (s.kind === 'folder') { await ensureFolder(responsible, s.name || title); n += 1; continue; }
        if (!track) continue;
        const { error } = await db.from('mjengo_todos').insert({
          track_id: track.id, title: s.title, notes: `From the playbook "${pb.name}" for ${title}.${s.notes ? ` ${s.notes}` : ''}`, status: 'todo',
          due_date: addDays(today(), s.offsetDays ?? 0), assignee_ids: [responsible], entity_type: kind, entity_id: id, created_by: actorId,
        });
        if (!error) n += 1;
      } catch { /* the other steps still run */ }
    }
    made += n;
    ran.push(pb.name);
    await db.from('mjengo_playbook_runs').update({ made: n }).eq('playbook_id', pb.id).eq('entity_type', kind).eq('entity_id', id);
  }
  if (made > 0 && responsible) {
    await sendNotification({ userId: responsible, type: 'system_alert', title: `Playbook: ${ran.join(', ')}`, message: `${made} ${made === 1 ? 'step was' : 'steps were'} set up for ${title}. They are in your to-dos.`, link: '/dashboard/mjengo/todos', sendEmail: false }).catch(() => undefined);
  }
  return { made, playbooks: ran };
}
