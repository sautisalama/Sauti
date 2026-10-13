// Round trip against the recordings host: signed upload in two pieces, signed download, bad signature refused.
import { createHmac, randomBytes } from 'node:crypto';

const base = process.env.RECORDINGS_BASE_URL;
const secret = process.env.RECORDINGS_SECRET;
if (!base || !secret) { console.log('RECORDINGS_BASE_URL / RECORDINGS_SECRET missing'); process.exit(1); }

const url = (action, name, extra = {}, sigOverride) => {
  const exp = Math.floor(Date.now() / 1000) + 600;
  const sig = sigOverride ?? createHmac('sha256', secret).update(`${action}|${name}|${exp}`).digest('hex');
  return `${base}?${new URLSearchParams({ a: action, f: name, exp: String(exp), sig, ...extra })}`;
};
let pass = 0, fail = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); ok ? pass++ : fail++; };

const name = `e2e-test-${Date.now()}.webm`;
const a = randomBytes(1500), b = randomBytes(900);
const r1 = await fetch(url('put', name, { offset: '0' }), { method: 'POST', body: a, headers: { 'Content-Type': 'application/octet-stream' } });
check(r1.ok, `first piece accepted (${r1.status})`);
const r2 = await fetch(url('put', name, { offset: String(a.length) }), { method: 'POST', body: b, headers: { 'Content-Type': 'application/octet-stream' } });
check(r2.ok, `second piece accepted (${r2.status})`);
const bad = await fetch(url('put', name, { offset: '0' }, 'f'.repeat(64)), { method: 'POST', body: a });
check(bad.status === 403, `bad signature refused (${bad.status})`);
const skip = await fetch(url('put', name, { offset: '5' }), { method: 'POST', body: a });
check(skip.status === 409, `wrong offset refused (${skip.status})`);
const got = await fetch(url('get', name));
const buf = Buffer.from(await got.arrayBuffer());
check(got.ok && buf.equals(Buffer.concat([a, b])), `downloaded bytes match (${buf.length})`);
const direct = await fetch(base.replace('index.php', `files/${name}`));
check(direct.status === 403 || direct.status === 404, `direct file access blocked (${direct.status})`);
console.log(`${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
