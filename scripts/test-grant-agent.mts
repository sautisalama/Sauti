// The grant agent: reading a funder's call, drafting a section within its limit from the organisation's own record,
// and reviewing the draft. Live AI calls; everything seeded is removed again.
//   npx tsx --env-file=.env.local scripts/test-grant-agent.mts
import { createClient } from '@supabase/supabase-js';
import { cleanRequirements, extractRequirements, draftSection, reviewApplication, trimToWords, wordCount, applicationHtml } from '../lib/mjengo/grant-agent';

let bad = 0;
const ok = (n: string, c: unknown) => { console.log(c ? 'ok  ' : 'FAIL', n); if (!c) bad++; };

const clean = cleanRequirements({ sections: [{ title: 'Need <script>', wordLimit: '500', guidance: 'x'.repeat(2000) }, { title: '' }, 'junk'], criteria: [{ name: 'Impact', weight: 40 }], eligibility: ['Registered in Kenya', 5], extra: 'ignored' });
ok('requirements are made safe: untitled sections dropped, ids made here, text capped', clean.sections.length === 1 && /^need-script-1$/.test(clean.sections[0].id) && clean.sections[0].wordLimit === 500 && clean.sections[0].guidance.length <= 600);
ok('a text is cut at a sentence within the limit', wordCount(trimToWords('One two three. Four five six seven. Eight nine ten eleven twelve.', 8)) <= 8 && trimToWords('One two three. Four five six seven. Eight nine ten.', 8).endsWith('.'));
ok('the application opens as HTML with only the written sections', applicationHtml('A & B', 'Harmony', { ...clean, sections: [clean.sections[0], { id: 'x', title: 'Empty', guidance: '', wordLimit: null }] }, { [clean.sections[0].id]: { text: 'Para one.\n\nPara two.', updatedAt: '' } }).includes('<h2>Need &lt;script&gt;</h2>') );

const call = `Harmony Trust: Survivor Safety Fund 2027. We fund organisations led by survivors of gender-based violence in East Africa.
Who can apply: organisations registered in Kenya, Uganda or Tanzania with an annual income under USD 500,000 and at least two years of operation.
How to apply: submit an online form with these sections. Section 1, The need (maximum 400 words): describe the problem you address and who is affected. Section 2, Your approach (maximum 600 words): what you will do and why it will work. Section 3, Expected results (maximum 300 words): what will change, with measurable indicators. Section 4, Budget summary (no limit): a one page budget.
You must attach: your registration certificate, your latest audited accounts, and a safeguarding policy.
How we score: Survivor leadership 30%, Likely impact 40%, Value for money 20%, Safeguarding 10%. Applications close on 30 November 2026. Written in English.`;
const req = await extractRequirements({ title: 'Survivor Safety Fund', funder: 'Harmony Trust', pageText: call, docs: [] });
console.log(JSON.stringify(req, null, 1).slice(0, 1800));
const need = req.sections.find((s) => /need/i.test(s.title));
ok('the sections are found in the funder\'s order with their limits', req.sections.length >= 4 && need?.wordLimit === 400 && req.sections.find((s) => /approach/i.test(s.title))?.wordLimit === 600);
ok('the scoring criteria carry their weights', req.criteria.length === 4 && req.criteria.find((c) => /impact/i.test(c.name))?.weight === 40);
ok('eligibility and attachments are listed', req.eligibility.length >= 1 && req.attachments.length === 3);
ok('nothing is invented for the section with no limit', req.sections.find((s) => /budget/i.test(s.title))?.wordLimit === null);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const { data: ad } = await db.from('profiles').select('id, email').eq('is_admin', true).limit(1);
const a = ad![0] as { id: string; email: string };
const tag = `zq${Date.now()}`;
const { data: m } = await db.from('mjengo_meetings').insert({ code: tag.slice(0, 10), title: `Survivor Safety Fund prep ${tag}`, created_by: a.id, notes: `**Summary**\nOur peer paralegal programme in Kibera supported 212 survivors last year. All eleven paralegals are survivors themselves. ${tag}`, transcript: [] }).select('id').single();
try {
  const d = await draftSection(a, { title: `Survivor Safety Fund ${tag}`, funder: 'Harmony Trust', description: 'A fund for survivor-led organisations.', req, section: need!, others: [], feedback: 'Last time the funder said our answers were too general.' });
  console.log('\nDRAFT:\n' + d.text + '\nsources: ' + d.sources.join('; '));
  ok('the section is within its limit', wordCount(d.text) <= need!.wordLimit! * 1.0);
  ok('it uses the facts on record', /212|eleven|paralegal/i.test(d.text));
  ok('it does not invent figures the record lacks (a budget figure becomes a placeholder or is absent)', !/USD\s?\d/.test(d.text) || /\[to confirm/i.test(d.text));

  const r1 = await reviewApplication({ title: 'x', funder: 'Harmony Trust', req, drafts: { [need!.id]: { text: d.text, updatedAt: '' } }, attached: ['Registration certificate.pdf'] });
  console.log(JSON.stringify(r1, null, 1).slice(0, 1500));
  ok('review: sections not written are flagged', r1.checks.some((c) => !c.ok && /has not been written/.test(c.text)));
  ok('review: an attached certificate is recognised, the audited accounts are missing', r1.checks.some((c) => c.ok && /registration/i.test(c.text)) && r1.checks.some((c) => !c.ok && /audited accounts/i.test(c.text)));
  ok('review: the criteria are scored with feedback', r1.criteria.length === 4 && r1.criteria.every((c) => c.score >= 0 && c.score <= 5 && c.feedback.length > 5) && r1.overall !== null);
} finally {
  if (m) await db.from('mjengo_meetings').delete().eq('id', m.id);
}
process.exit(bad ? 1 : 0);
