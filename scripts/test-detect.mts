import { detectMailbox } from '../lib/mail/autoconfig.ts';
for (const e of ['a@gmail.com', 'a@outlook.com', 'oliver@sautisalama.org', 'x@tusonge.co.ke', 'x@zoho.com', 'x@example.com']) {
  const d = await detectMailbox(e).catch((err) => ({ error: String(err) }));
  console.log(e, JSON.stringify(d));
}
