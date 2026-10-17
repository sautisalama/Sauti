// Salama's reading: how a line is recognised as speaking to her, and (live) an answer from the workspace.
//   npx tsx --env-file=.env.local scripts/test-salama.mts
import { addressedToSalama } from '../lib/mjengo/salama-shared';
import { termsOf, passage } from '../lib/mjengo/salama';

let bad = 0;
const ok = (n: string, c: unknown) => { console.log(c ? 'ok  ' : 'FAIL', n); if (!c) bad++; };
ok('hey Salama, question', addressedToSalama('Hey Salama, what did we decide about the venue?') === 'what did we decide about the venue?');
ok('@Salama question', addressedToSalama('@Salama catch me up') === 'catch me up');
ok('Salama alone is not a question', addressedToSalama('Salama') === null);
ok('a name inside a sentence is not addressed to her', addressedToSalama('I asked Salama yesterday about it') === null);
ok('terms drop filler words', JSON.stringify(termsOf('What did we promise the clinic about referrals?')) === JSON.stringify(['promise', 'clinic', 'referrals']));
ok('the passage holds the matching line', passage('Intro line.\nThe clinic wants referral numbers by Friday.\nUnrelated closing.', ['clinic']).includes('referral numbers'));

// Live: seed a few rows, ask Salama, and check she finds them, cites them and invents nothing. Everything is removed after.
if (process.argv.includes('--live')) {
	const { createClient } = await import('@supabase/supabase-js');
	const { answerAsSalama } = await import('../lib/mjengo/salama');
	const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
	const { data: ad } = await db.from('profiles').select('id, email').eq('is_admin', true).limit(1);
	const a = ad![0] as { id: string; email: string };
	const tag = `zq${Date.now()}`;
	const { data: g } = await db.from('mjengo_grants').insert({ title: `Mwangaza ${tag} survivor fund`, funder: 'Harmony Trust', status: 'drafting', amount: 45000, currency: 'USD', deadline: '2026-12-01', owner_id: a.id }).select('id').single();
	const { data: m } = await db.from('mjengo_meetings').insert({ code: tag.slice(0, 10), title: `Clinic sync ${tag}`, created_by: a.id, notes: `**Decisions**\n- Joseph sends the referral numbers to the Kibera clinic by Friday ${tag}.`, transcript: [] }).select('id').single();
	try {
		const r1 = await answerAsSalama(a, `What is the status of the Mwangaza ${tag} fund?`);
		console.log(r1.text, r1.sources.map((s) => s.title));
		ok('finds the grant and cites it', /drafting/i.test(r1.text) && r1.sources.some((s) => s.kind === 'grant'));
		const r2 = await answerAsSalama(a, `What did we agree with the Kibera clinic ${tag}?`);
		console.log(r2.text, r2.sources.map((s) => s.title));
		ok('finds the call decision and cites it', /referral/i.test(r2.text) && r2.sources.some((s) => s.kind === 'call'));
		const r3 = await answerAsSalama(a, `What is our policy on staff holidays in ${tag}x?`);
		console.log(r3.text);
		ok('says so when it has nothing', r3.sources.length === 0);
	} finally {
		if (g) await db.from('mjengo_grants').delete().eq('id', g.id);
		if (m) await db.from('mjengo_meetings').delete().eq('id', m.id);
	}
}
process.exit(bad ? 1 : 0);
