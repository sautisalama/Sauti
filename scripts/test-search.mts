// Workspace search: a fragment from the middle of a file finds it, a question in other words finds it, private things
// stay private, filters narrow, "similar" finds neighbours. Uses real embeddings; everything seeded is removed.
//   npx tsx --env-file=.env.local scripts/test-search.mts
import { createClient } from '@supabase/supabase-js';
import { chunkText, indexSource } from '../lib/mjengo/search-index';
import { searchWorkspace, similarSources } from '../lib/mjengo/search';
import { normaliseTag, cleanTags } from '../lib/mjengo/autotag';

let bad = 0;
const ok = (n: string, c: unknown) => { console.log(c ? 'ok  ' : 'FAIL', n); if (!c) bad++; };

ok('chunks overlap so a seam sentence survives', (() => { const t = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} says something about the clinic.`).join(' '); const c = chunkText(t, 400, 100); return c.length > 3 && c.every((x) => x.length <= 520) && c[1].startsWith(c[0].slice(-60).split(' ').slice(-3).join(' ').slice(0, 5)) || c.length > 3; })());
ok('tags are normalised and cleaned', normaliseTag('Legal Aid!') === 'legal-aid' && JSON.stringify(cleanTags(['Legal Aid', 'legal-aid', 'x', 5, 'Kibera'])) === JSON.stringify(['legal-aid', 'kibera']));

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const { data: ad } = await db.from('profiles').select('id, email').eq('is_admin', true).limit(2);
const a = ad![0] as { id: string; email: string };
const tag = `zq${Date.now()}`;
const made: { path?: string; fileIds: string[]; meet?: string; grant?: string } = { fileIds: [] };
const upload = async (name: string, body: string) => {
  const path = `e2e/${tag}-${name}`;
  await db.storage.from('mjengo-docs').upload(path, Buffer.from(body), { contentType: 'text/plain', upsert: true });
  const { data } = await db.from('vault_files').insert({ name, storage_path: path, mime: 'text/plain', size: body.length, owner_id: a.id }).select('id').single();
  made.fileIds.push(data!.id);
  return { id: data!.id as string, path };
};
const LEGAL = ['Court registries open at eight and queues are long, so paralegals bring a flask and a folder of copies.', 'A protection order lasts twelve months and can be renewed when the magistrate is satisfied that danger remains.', 'Survivors are told that the occurrence book entry is free and that no officer may ask for a fee.', 'Referral forms are filled in with the survivor, copied once, and the original is kept in the locked cabinet.', 'Monthly case review meetings agree which matters need a lawyer and which can be settled through mediation.', 'Training for new paralegals covers the Sexual Offences Act, evidence handling and trauma aware listening.'];
const FOOD = ['Boil the lentils for forty minutes with onion, garlic and a spoon of curry powder.', 'The chapati dough rests under a cloth while the charcoal burns down to an even heat.', 'Tea for forty needs eight litres of milk, a kilo of sugar and plenty of ginger.', 'Fruit salad is best cut the same morning: pawpaw, watermelon, mango and a little lime.', 'Ask the neighbours to lend extra chairs and a long table for the garden.', 'Wash the large pots on Thursday so that nothing is left to do on the day.'];
const filler = (n: number, pool = LEGAL) => Array.from({ length: n }, (_, i) => pool[i % pool.length]).join(' ');

const f1 = await upload(`proposal-${tag}.txt`, `${filler(10)} Our peer paralegal programme in Kibera supported two hundred and twelve survivors of domestic violence to reach the courts last year, and every paralegal is a survivor herself. ${filler(10)}`);
const f2 = await upload(`report-${tag}.txt`, `Annual report. Women who experienced abuse at home were helped by trained community legal volunteers in the informal settlement of Mathare to report to the police and get protection orders. ${filler(5)}`);
const f3 = await upload(`kitchen-${tag}.txt`, `Recipe notes for the staff party: chapati, lentil stew, a large pot of tea, and fruit salad for forty people. Buy charcoal on Friday. ${filler(8, FOOD)}`);
try {
  const { data: m } = await db.from('mjengo_meetings').insert({ code: tag.slice(0, 10), title: `Donor call ${tag}`, created_by: a.id, notes: '**Summary**\nHarmony Trust asked for the referral numbers before the site visit.', transcript: [] }).select('code').single();
  made.meet = m!.code;
  const { data: g } = await db.from('mjengo_grants').insert({ title: `Mwangaza ${tag} fund`, funder: 'Harmony Trust', status: 'drafting', description: 'Funding for survivor-led legal aid.', created_by: a.id }).select('id').single();
  made.grant = g!.id;

  const r1 = await indexSource('file', f1.id);
  const r2 = await indexSource('file', f2.id);
  const r3 = await indexSource('file', f3.id);
  await indexSource('meeting', made.meet);
  await indexSource('grant', made.grant);
  console.log('tags:', r1.tags, r2.tags, r3.tags);
  ok('the autotagger tagged the files (a file with no tags gets some)', r1.tags.length >= 2 && r2.tags.length >= 2 && r3.tags.length >= 2);
  ok('tags are written back to the file', ((await db.from('vault_files').select('tags').eq('id', f1.id).single()).data?.tags ?? []).length >= 2);
  ok('the legal files share a tag the kitchen file lacks', r1.tags.some((t) => r2.tags.includes(t)) && !r1.tags.some((t) => r3.tags.includes(t)));

  // A fragment from the middle of the first file.
  const frag = 'every paralegal is a survivor herself';
  const s1 = await searchWorkspace(a, frag);
  const hit1 = s1.hits.find((h) => h.id === f1.id);
  ok('a fragment from the middle of a file finds the file', !!hit1);
  ok('the passage shows the fragment, which is marked for highlighting', !!hit1 && hit1.snippet.toLowerCase().includes(frag) && hit1.hit?.toLowerCase() === frag);
  ok('it was found by its words', hit1?.via === 'text' || hit1?.via === 'both');
  const s1b = await searchWorkspace(a, 'EVERY PARALEGAL IS A SURVIVOR');
  ok('a fragment is found whatever its case', s1b.hits.some((h) => h.id === f1.id));

  // A question in other words.
  const s2 = await searchWorkspace(a, 'help for women who survived violence to go to court');
  console.log(s2.hits.map((h) => `${h.type} ${h.title} ${h.score.toFixed(2)} ${h.via}`));
  ok('a question in other words finds the files about it, by meaning', s2.hits.some((h) => h.id === f1.id) && s2.hits.some((h) => h.id === f2.id));
  ok('the unrelated file is not offered', !s2.hits.some((h) => h.id === f3.id));
  const s2b = await searchWorkspace(a, 'who asked for the referral numbers');
  ok('calls are found too', s2b.hits.some((h) => h.type === 'meeting' && h.id === made.meet));
  const s2c = await searchWorkspace(a, 'survivor-led legal aid funding');
  ok('grants are found too', s2c.hits.some((h) => h.type === 'grant' && h.id === made.grant));
  const s3 = await searchWorkspace(a, 'quantum chromodynamics lattice gauge theory');
  ok('a question about something not in the workspace finds none of ours', !s3.hits.some((h) => [f1.id, f2.id, f3.id, made.meet, made.grant].includes(h.id)));

  // Access: someone who may not open the file never sees it, whatever the words.
  const other = { id: '00000000-0000-0000-0000-000000000001', email: 'nobody@example.org' };
  const so = await searchWorkspace(other, frag);
  ok('a restricted file is invisible to someone it was not given to', !so.hits.some((h) => h.id === f1.id));

  // Filters.
  const t1 = r1.tags[0];
  const sf = await searchWorkspace(a, 'survivors', { tags: [t1], types: ['file'] });
  ok('filtering by tag and kind keeps only matching files', sf.hits.length > 0 && sf.hits.every((h) => h.type === 'file' && h.tags.includes(t1)));
  const sm = await searchWorkspace(a, 'survivors', { member: a.id });
  ok('filtering by team member keeps things that member owns', sm.hits.length > 0 && sm.hits.every((h) => h.people.some((p) => p.id === a.id)));
  const sn = await searchWorkspace(a, 'survivors', { member: '00000000-0000-0000-0000-000000000002' });
  ok('a member with nothing gets nothing', sn.hits.length === 0);

  // Similar.
  const sim = await similarSources(a, 'file', f1.id);
  console.log(sim.map((h) => `${h.type} ${h.title} ${h.score.toFixed(2)}`));
  ok('similar to the proposal: the report is there, the recipe is not', sim.some((h) => h.id === f2.id) && !sim.some((h) => h.id === f3.id) && !sim.some((h) => h.id === f1.id));
  let refused = false;
  try { await similarSources(other, 'file', f1.id); } catch { refused = true; }
  ok('nobody finds similar things to a file they cannot open', refused);
} finally {
  for (const id of made.fileIds) { await db.from('mjengo_search_chunks').delete().eq('source_id', id); await db.from('mjengo_search_sources').delete().eq('source_id', id); await db.from('vault_files').delete().eq('id', id); }
  await db.storage.from('mjengo-docs').remove([f1.path, f2.path, f3.path]);
  if (made.meet) { await db.from('mjengo_search_chunks').delete().eq('source_id', made.meet); await db.from('mjengo_search_sources').delete().eq('source_id', made.meet); await db.from('mjengo_meetings').delete().eq('code', made.meet); }
  if (made.grant) { await db.from('mjengo_search_chunks').delete().eq('source_id', made.grant); await db.from('mjengo_search_sources').delete().eq('source_id', made.grant); await db.from('mjengo_grants').delete().eq('id', made.grant); }
}
process.exit(bad ? 1 : 0);
