import { parseSource, cleanHtml, normaliseSubject } from '../lib/mail/client';
const raw = Buffer.from([
 'From: "Ada Funder" <ada@funder.org>','To: team@sautisalama.org','Subject: Re: Re: Grant call 2027','Date: Fri, 9 Oct 2026 10:00:00 +0000',
 'Message-ID: <abc@funder.org>','MIME-Version: 1.0','Content-Type: text/html; charset=utf-8','',
 '<p>Hello <b>team</b></p><script>alert(1)</script><img src="https://track.example/p.gif"><a href="javascript:alert(1)" onclick="x()">bad</a><a href="https://ok.org">ok</a>'
].join('\r\n'));
const blocked = await parseSource(7, raw, false);
const allowed = await parseSource(7, raw, true);
console.log('subject:', blocked.subject, '| key:', normaliseSubject(blocked.subject));
console.log('from:', blocked.from[0]);
console.log('script removed:', !/script/i.test(blocked.html!), '| onclick removed:', !/onclick/i.test(blocked.html!), '| js href removed:', !/javascript:/i.test(blocked.html!));
console.log('remote img blocked:', !/track\.example/.test(blocked.html!), '| allowed when asked:', /track\.example/.test(allowed.html!), '| flagged:', blocked.hasRemoteImages);
console.log('safe link kept:', /href="https:\/\/ok.org"/.test(blocked.html!), /noopener/.test(blocked.html!));
