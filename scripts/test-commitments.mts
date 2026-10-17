// The commitments engine on a sample call (live AI call, nothing is written).
//   npx tsx --env-file=.env.local scripts/test-commitments.mts
import { extractCommitments } from '../lib/mjengo/commitments';

const at = new Date().toISOString();
const say = (name: string, text: string, i: number) => ({ id: String(i), name, text, at });
const lines = [
	say('Amina', 'Thanks all. The clinic asked for the referral numbers before the donor visit.', 1),
	say('Joseph', 'I will send the referral numbers to the clinic by Friday.', 2),
	say('Amina', 'Great. Someone needs to book the venue for the paralegal training.', 3),
	say('Grace', 'I can book the venue, I will confirm tomorrow.', 4),
	say('Amina', 'We discussed the budget but nothing is decided yet.', 5),
];
const items = await extractCommitments('Donor visit prep', lines);
console.log(JSON.stringify(items, null, 1));
const ok = items.some((i) => i.owner === 'Joseph' && /referral/i.test(i.title)) && items.some((i) => i.owner === 'Grace' && /venue/i.test(i.title)) && !items.some((i) => /budget/i.test(i.title));
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
