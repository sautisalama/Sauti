// Playbooks (a status sets up steps once), approvals (ask, decide, overall state, access) and the catch-up digest.
// Seeded rows are removed again; the built-in playbooks stay (they are product defaults).
//   npx tsx --env-file=.env.local scripts/test-playbooks-approvals.mts
import { createClient } from '@supabase/supabase-js';
import { cleanSteps, runPlaybooks, BUILT_IN_PLAYBOOKS } from '../lib/mjengo/playbooks';
import { requestApproval, decideApproval, approvalFor, waitingFor, statusOf } from '../lib/mjengo/approvals';
import { collectDigest, markCaughtUp, sinceFor } from '../lib/mjengo/digest';

let bad = 0;
const ok = (n: string, c: unknown) => { console.log(c ? 'ok  ' : 'FAIL', n); if (!c) bad++; };

ok('playbook steps are made safe', (() => { const s = cleanSteps([{ kind: 'todo', title: '  Call  the funder ', offsetDays: 9999 }, { kind: 'todo', title: '' }, { kind: 'hack' }, { kind: 'folder', name: 'X' }, 'junk']); return s.length === 2 && s[0].offsetDays === 730 && s[0].title === 'Call the funder' && s[1].kind === 'folder'; })());
ok('every built-in playbook has steps and a known status', BUILT_IN_PLAYBOOKS.every((p) => p.steps.length > 0 && p.trigger_status.length > 2));
ok('overall approval state: changes win, all must approve', statusOf(['approved', 'pending']) === 'pending' && statusOf(['approved', 'approved']) === 'approved' && statusOf(['approved', 'changes_requested']) === 'changes_requested' && statusOf([]) === 'pending');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const { data: admins } = await db.from('profiles').select('id, email').eq('is_admin', true).limit(2);
const [a, b] = admins as { id: string; email: string }[];
const tag = `zq${Date.now()}`;
const cleanup: (() => Promise<unknown>)[] = [];
try {
  // ------------------------------------------------------------ playbooks
  const { data: g } = await db.from('mjengo_grants').insert({ title: `Playbook grant ${tag}`, status: 'awarded', created_by: a.id, owner_id: a.id }).select('id').single();
  cleanup.push(async () => { await db.from('mjengo_playbook_runs').delete().eq('entity_id', g!.id); await db.from('mjengo_todos').delete().eq('entity_id', g!.id); await db.from('mjengo_grants').delete().eq('id', g!.id); });
  const r1 = await runPlaybooks('grant', g!.id, 'awarded', a.id);
  const { data: todos } = await db.from('mjengo_todos').select('title, due_date, assignee_ids, entity_type, entity_id, notes').eq('entity_id', g!.id);
  console.log((todos ?? []).map((t: { title: string; due_date: string }) => `${t.due_date} ${t.title}`));
  ok('a grant becoming awarded sets up its steps', r1.made >= 5 && r1.playbooks.includes('Grant awarded: set it up') && (todos ?? []).length >= 5);
  ok('they are given to the person responsible, linked to the grant, with due dates', (todos ?? []).every((t: { assignee_ids: string[]; entity_type: string; due_date: string | null }) => t.assignee_ids.includes(a.id) && t.entity_type === 'grant' && !!t.due_date));
  ok('a folder was made for it in the owner\'s vault', !!(await db.from('vault_folders').select('id').eq('owner_id', a.id).eq('name', `Playbook grant ${tag}`).maybeSingle()).data);
  cleanup.push(async () => { await db.from('vault_folders').delete().eq('owner_id', a.id).eq('name', `Playbook grant ${tag}`); });
  const r2 = await runPlaybooks('grant', g!.id, 'awarded', a.id);
  ok('running it again for the same grant makes nothing more', r2.made === 0 && ((await db.from('mjengo_todos').select('id').eq('entity_id', g!.id)).data ?? []).length === (todos ?? []).length);
  const r3 = await runPlaybooks('grant', g!.id, 'idea', a.id);
  ok('a status with no playbook makes nothing', r3.made === 0);

  // ------------------------------------------------------------ approvals
  const path = `e2e/${tag}-approve.txt`;
  await db.storage.from('mjengo-docs').upload(path, Buffer.from('Draft for approval.'), { contentType: 'text/plain', upsert: true });
  const { data: f } = await db.from('vault_files').insert({ name: `approve-${tag}.txt`, storage_path: path, mime: 'text/plain', size: 19, owner_id: a.id }).select('id').single();
  cleanup.push(async () => { await db.from('vault_files').delete().eq('id', f!.id); await db.storage.from('mjengo-docs').remove([path]); });
  ok('the file is private to its owner before asking', !(await db.from('vault_permissions').select('id').eq('resource_id', f!.id).eq('user_id', b.id).maybeSingle()).data);
  const ap1 = await requestApproval(a, f!.id, [b.id], 'Please check the numbers.');
  ok('asking gives the reviewer view access', !!(await db.from('vault_permissions').select('id').eq('resource_id', f!.id).eq('user_id', b.id).maybeSingle()).data);
  const w = await waitingFor(b);
  ok('it is waiting for the reviewer', w.some((x) => x.approvalId === ap1 && x.name === `approve-${tag}.txt`));
  let refused = false;
  try { await decideApproval(a, ap1, 'approved', ''); } catch { refused = true; }
  ok('someone who was not asked cannot decide', refused);
  let needComment = false;
  try { await decideApproval(b, ap1, 'changes_requested', ''); } catch { needComment = true; }
  ok('asking for changes needs a reason', needComment);
  const st1 = await decideApproval(b, ap1, 'changes_requested', 'The budget total is wrong.');
  const cur = await approvalFor(f!.id);
  ok('asking for changes sets the state and keeps the comment', st1 === 'changes_requested' && cur?.status === 'changes_requested' && cur.reviewers[0].comment === 'The budget total is wrong.');
  let closed = false;
  try { await decideApproval(b, ap1, 'approved', ''); } catch { closed = true; }
  ok('a closed request cannot be decided again', closed);
  const ap2 = await requestApproval(a, f!.id, [b.id], 'Fixed.');
  const st2 = await decideApproval(b, ap2, 'approved', 'Good now.');
  ok('a new request, approved by everyone, is approved', st2 === 'approved' && (await approvalFor(f!.id))?.status === 'approved');
  ok('the earlier request stays in the record as it was', (await db.from('mjengo_approvals').select('status').eq('id', ap1).single()).data?.status === 'changes_requested');
  let notShare = false;
  try { await requestApproval(b, f!.id, [a.id], ''); } catch { notShare = true; }
  ok('only someone who can share a file can ask for its approval', notShare);

  // ------------------------------------------------------------ digest
  const track = (await db.from('mjengo_todo_tracks').insert({ name: `dg ${tag}`, created_by: a.id }).select('id').single()).data!;
  cleanup.push(async () => { await db.from('mjengo_todo_tracks').delete().eq('id', track.id); });
  await db.from('mjengo_todos').insert({ track_id: track.id, title: `Digest task ${tag}`, assignee_ids: [b.id], created_by: a.id });
  const ap3 = await requestApproval(a, f!.id, [b.id], 'Once more.');
  const items = await collectDigest(b, new Date(Date.now() - 3600_000).toISOString());
  console.log(items.map((i) => `${i.kind}: ${i.title}`));
  ok('the digest lists a task given to them and an approval waiting for them', items.some((i) => i.kind === 'task' && i.title.includes(`Digest task ${tag}`)) && items.some((i) => i.kind === 'approval'));
  const mine = await collectDigest(a, new Date(Date.now() - 3600_000).toISOString());
  ok('it does not list what they did themselves', !mine.some((i) => i.title.includes(`Digest task ${tag}`)));
  await markCaughtUp(b.id);
  const since = await sinceFor(b.id);
  ok('catching up moves the start forward (but never past an hour ago)', new Date(since).getTime() <= Date.now() - 3500_000 && new Date(since).getTime() > Date.now() - 2 * 3600_000);
  void ap3;
} finally {
  for (const c of cleanup.reverse()) await c().catch(() => undefined);
  await db.from('mjengo_digest_seen').delete().eq('user_id', b.id);
}
process.exit(bad ? 1 : 0);
