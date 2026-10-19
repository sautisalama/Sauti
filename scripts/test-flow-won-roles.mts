// A won opportunity becomes a grant/project/fellowship, default roles, a drawing saved in the vault and shown on a timeline.
// Everything is seeded and removed again (dev database).
//   npx tsx --env-file=.env.local scripts/test-flow-won-roles.mts
import { createClient } from '@supabase/supabase-js';
import { convertWonOpportunity, wonTypeFor } from '../lib/mjengo/won';
import { addDefaultRoles, DEFAULT_ROLES } from '../lib/mjengo/default-roles';
import { entitiesFor } from '../lib/mjengo/entity-view';
import { saveToVault, linkFileToRecord } from '../lib/mjengo/vault-save';
import { excalidrawText, textFromBytes } from '../lib/mjengo/files-text';
import { fileLink } from '../lib/mjengo/links';
import { timelineFor } from '../lib/mjengo/timeline';

let bad = 0;
const ok = (n: string, c: unknown) => { console.log(c ? 'ok  ' : 'FAIL', n); if (!c) bad++; };
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const { data: ad } = await db.from('profiles').select('id, email').eq('is_admin', true).limit(1);
const a = ad![0] as { id: string; email: string };
const tag = `zq${Date.now()}`;

ok('grant kind becomes a grant', wonTypeFor('grant') === 'grant');
ok('fellowship kind becomes a fellowship', wonTypeFor('fellowship') === 'fellowship');
ok('anything else becomes a project', wonTypeFor('partnership') === 'project' && wonTypeFor(null) === 'project');

const made: { table: string; id: string }[] = [];
const opps: string[] = [];
let fileId: string | null = null;
let storagePath: string | null = null;
const rolesBefore = new Set(((await db.from('mjengo_roles').select('name')).data ?? []).map((r: { name: string }) => r.name.toLowerCase()));
try {
  for (const [kind, table, typ] of [['grant', 'mjengo_grants', 'grant'], ['fellowship', 'mjengo_fellowships', 'fellowship'], ['partnership', 'mjengo_projects', 'project']] as const) {
    const title = `Won ${kind} ${tag}`;
    const { data: o, error } = await db.from('mjengo_opportunities').insert({ title, kind, status: 'won', organisation: 'Harmony Trust', source_url: 'https://example.org/apply', shared_url: 'https://www.instagram.com/p/abc/', tags: ['youth'], created_by: a.id, owner_id: a.id }).select('id').single();
    if (error || !o) { ok(`seed ${kind} opportunity (${error?.message})`, false); continue; }
    opps.push(o.id);
    const r = await convertWonOpportunity(o.id, a.id);
    ok(`${kind}: converted to a ${typ}`, r?.type === typ && !!r.id);
    if (r) {
      made.push({ table, id: r.id });
      const { data: rec } = await db.from(table).select('*').eq('id', r.id).single();
      ok(`${kind}: tagged with its type and won, kept its own tag`, ['youth', typ, 'won'].every((t) => (rec as { tags: string[] }).tags.includes(t)));
      ok(`${kind}: link and shared link carried over`, JSON.stringify(rec).includes('example.org') || JSON.stringify(rec).includes('instagram.com'));
      const { data: back } = await db.from('mjengo_opportunities').select('converted_to_type, converted_to_id').eq('id', o.id).single();
      ok(`${kind}: opportunity points at it`, back?.converted_to_type === typ && back?.converted_to_id === r.id);
      ok(`${kind}: running twice does nothing`, (await convertWonOpportunity(o.id, a.id)) === null);
      const mine = await entitiesFor(a, [typ]);
      ok(`${kind}: the owner now has one (so the menu item shows)`, mine.some((e) => e.id === r.id));
    }
  }
  const { data: notWon } = await db.from('mjengo_opportunities').insert({ title: `Open ${tag}`, kind: 'grant', status: 'applied', created_by: a.id }).select('id').single();
  if (notWon) { opps.push(notWon.id); ok('an opportunity not won is not converted', (await convertWonOpportunity(notWon.id, a.id)) === null); }

  const added = await addDefaultRoles(a);
  ok('default roles added only where missing', added === DEFAULT_ROLES.filter((r) => !rolesBefore.has(r.name.toLowerCase())).length);
  ok('adding again adds none', (await addDefaultRoles(a)) === 0);
  const { data: roles } = await db.from('mjengo_roles').select('name, permissions').in('name', DEFAULT_ROLES.map((r) => r.name));
  ok('every default role exists', (roles?.length ?? 0) === DEFAULT_ROLES.length);
  ok('none of them reach people, access or logs', !(roles ?? []).some((r: { permissions: string[] }) => r.permissions.some((p) => /^(people|logs|admin|roles)/.test(p))));

  const scene = JSON.stringify({ type: 'excalidraw', version: 2, elements: [
    { type: 'rectangle', id: '1' }, { type: 'text', id: '2', text: `Intake ${tag} referral` }, { type: 'text', id: '3', text: 'Deleted note', isDeleted: true }, { type: 'frame', id: '4', name: 'Case triage' },
  ], appState: {}, files: {} });
  ok('the words of a drawing are read, deleted ones skipped', excalidrawText(scene).includes(`Intake ${tag} referral`) && excalidrawText(scene).includes('Case triage') && !excalidrawText(scene).includes('Deleted'));
  ok('broken JSON gives no words', excalidrawText('{nope') === '');
  ok('a drawing opens on the drawing board', fileLink('x.excalidraw', 'ID') === '/dashboard/mjengo/files/draw?file=ID');
  const bytes = new TextEncoder().encode(scene);
  ok('the file reader handles .excalidraw', String(await textFromBytes(bytes, 'flow.excalidraw', 'application/vnd.excalidraw+json')).includes('Case triage'));
  const saved = await saveToVault(a, { name: `flow ${tag}.excalidraw`, bytes, mime: 'application/vnd.excalidraw+json', folder: 'Flows', tags: ['flow'] });
  fileId = saved.id;
  const { data: vf } = await db.from('vault_files').select('storage_path, tags').eq('id', saved.id).single();
  storagePath = vf?.storage_path ?? null;
  ok('saved in the vault with its flow tag', !!vf && vf.tags.includes('flow'));
  const dl = await db.storage.from('mjengo-docs').download(storagePath!);
  ok('the saved file comes back identical', dl.data ? (await dl.data.text()) === scene : false);
  const again = await saveToVault(a, { name: `flow ${tag}.excalidraw`, bytes, mime: 'application/vnd.excalidraw+json', folder: 'Flows' });
  ok('saving the same drawing again keeps one file', again.id === saved.id && again.replaced);
  const grantId = made.find((m) => m.table === 'mjengo_grants')?.id;
  if (grantId) {
    await linkFileToRecord('grant', grantId, saved.id, a.id, false);
    const tl = await timelineFor(a, 'grant', grantId);
    const item = tl.items.find((i) => i.kind === 'file' && i.title.includes(`flow ${tag}`));
    ok('the flow shows on the grant timeline', !!item);
    ok('and opens on the drawing board', item?.link === `/dashboard/mjengo/files/draw?file=${saved.id}`);
  }
} finally {
  if (fileId) { await db.from('mjengo_links').delete().eq('item_id', fileId); await db.from('vault_files').delete().eq('id', fileId); }
  if (storagePath) await db.storage.from('mjengo-docs').remove([storagePath]);
  for (const m of made) { await db.from('mjengo_links').delete().eq('entity_id', m.id); await db.from('audit_logs').delete().eq('target_id', m.id); await db.from(m.table).delete().eq('id', m.id); }
  for (const id of opps) await db.from('mjengo_opportunities').delete().eq('id', id);
  const newRoles = DEFAULT_ROLES.filter((r) => !rolesBefore.has(r.name.toLowerCase())).map((r) => r.name);
  if (newRoles.length) { await db.from('mjengo_roles').delete().in('name', newRoles); await db.from('audit_logs').delete().eq('action', 'roles.defaults_added').eq('actor_id', a.id); }
}
console.log(bad ? `${bad} FAILED` : 'all passed');
process.exit(bad ? 1 : 0);
