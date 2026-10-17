// The timeline of a grant: its own history, requirements, to-dos, and a call that names it, linked by the system.
// Everything is seeded and removed again.
//   npx tsx --env-file=.env.local scripts/test-timeline.mts
import { createClient } from '@supabase/supabase-js';
import { timelineFor, recordsMentioned } from '../lib/mjengo/timeline';
import { autoLinkMeeting } from '../lib/mjengo/auto-link';

let bad = 0;
const ok = (n: string, c: unknown) => { console.log(c ? 'ok  ' : 'FAIL', n); if (!c) bad++; };

ok('a record is found by its title as a whole phrase', recordsMentioned('We met about the Mwangaza Fund today', [{ kind: 'grant', id: '1', title: 'Mwangaza Fund' }]).length === 1);
ok('part of a word is not a mention', recordsMentioned('the mwangazafunds list', [{ kind: 'grant', id: '1', title: 'Mwangaza Fund' }]).length === 0);
ok('a very short title is never matched', recordsMentioned('see the AI report', [{ kind: 'grant', id: '1', title: 'AI' }]).length === 0);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const { data: ad } = await db.from('profiles').select('id, email').eq('is_admin', true).limit(1);
const a = ad![0] as { id: string; email: string };
const tag = `zq${Date.now()}`;
const title = `Kivuli ${tag} resilience grant`;
const soon = new Date(Date.now() + 20 * 86400_000).toISOString().slice(0, 10);
const { data: g } = await db.from('mjengo_grants').insert({ title, funder: 'Harmony Trust', status: 'drafting', deadline: soon, created_by: a.id }).select('id').single();
const code = tag.slice(0, 10);
const { data: m } = await db.from('mjengo_meetings').insert({ code, title: `Call about ${title}`, created_by: a.id, notes: '**Summary**\nWe agreed the budget needs a second pass.\n\n**Decisions**\n- None', transcript: [] }).select('id').single();
const { data: t } = await db.from('mjengo_todos').insert({ track_id: (await db.from('mjengo_todo_tracks').insert({ name: `tl ${tag}` }).select('id').single()).data!.id, title: `Send the budget ${tag}`, entity_type: 'grant', entity_id: g!.id, due_date: soon, created_by: a.id }).select('id, track_id').single();
const { data: d } = await db.from('mjengo_documents').insert({ entity_type: 'grant', entity_id: g!.id, name: `Audited accounts ${tag}`, required: true }).select('id').single();
await db.from('audit_logs').insert({ actor_id: a.id, action: 'mjengo.grant.status_changed', target_type: 'grant', target_id: g!.id, target_label: title, details: { from: 'researching', to: 'drafting' } });
try {
  const linked = await autoLinkMeeting({ code, title: `Call about ${title}`, notes: null }, []);
  ok('the call that names the grant is linked by the system', linked.some((l) => l.id === g!.id));
  const tl = await timelineFor(a, 'grant', g!.id);
  const kinds = tl.items.map((i) => i.kind);
  console.log(tl.items.map((i) => `${i.upcoming ? 'UP ' : '   '}${i.at.slice(0, 10)} ${i.kind}: ${i.title}`).join('\n'));
  ok('it starts with what is coming (the deadline and the to-do)', tl.items[0].upcoming && tl.items.filter((i) => i.upcoming).length >= 2);
  ok('the status change is there with who and from to', tl.items.some((i) => i.kind === 'status' && /researching/.test(i.title) && /drafting/.test(i.title)));
  ok('the call is there with its summary, marked as found by the system', tl.items.some((i) => i.kind === 'call' && /budget needs a second pass/.test(i.detail ?? '') && i.auto && i.ref?.id === code));
  ok('the missing document is listed as still needed', tl.items.some((i) => i.kind === 'requirement' && /Audited accounts/.test(i.title)));
  ok('the grant being added is the oldest thing', kinds[kinds.length - 1] === 'added');
  const other = { id: '00000000-0000-0000-0000-000000000001', email: 'nobody@example.org' };
  await db.from('mjengo_grants').update({ visibility: 'restricted' }).eq('id', g!.id);
  let refused = false;
  try { await timelineFor(other, 'grant', g!.id); } catch { refused = true; }
  ok('a private record has no timeline for someone it was not given to', refused);
} finally {
  await db.from('mjengo_links').delete().eq('entity_id', g!.id);
  await db.from('audit_logs').delete().eq('target_id', g!.id);
  if (d) await db.from('mjengo_documents').delete().eq('id', d.id);
  if (t) { await db.from('mjengo_todos').delete().eq('id', t.id); await db.from('mjengo_todo_tracks').delete().eq('id', t.track_id); }
  if (m) await db.from('mjengo_meetings').delete().eq('id', m.id);
  if (g) await db.from('mjengo_grants').delete().eq('id', g.id);
}
process.exit(bad ? 1 : 0);
