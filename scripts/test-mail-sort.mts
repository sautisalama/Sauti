import { sortMessage, scopeOf } from '../lib/mail/sort';

let bad = 0;
const t = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };
const kind = (addr: string, subject: string, extra: object = {}, name = '') => sortMessage({ from: { name, address: addr }, subject, ...extra }).kind;

t('a colleague writing', kind('jane.mwangi@sautisalama.org', 'Can we move Thursday?', {}, 'Jane Mwangi'), 'person');
t('a friend on gmail', kind('peter@gmail.com', 'lunch?'), 'person');
t('newsletter by header', kind('hello@substack.com', 'This week in policy', { bulk: true }), 'subscription');
t('newsletter by sender', kind('newsletter@fundsforngos.org', 'New calls this week'), 'subscription');
t('promotion by subject', kind('deals@shop.co.ke', '50% off everything'), 'subscription');
t('receipt', kind('billing@stripe.com', 'Your receipt from Vercel #1234'), 'receipt');
t('order confirmation', kind('orders@jumia.co.ke', 'Order confirmation #A-99'), 'receipt');
t('payment due is pending', kind('billing@hosting.com', 'Payment failed: update your card'), 'payment');
t('invoice overdue is pending', kind('accounts@supplier.co.ke', 'Invoice 2041 is overdue'), 'payment');
t('renewal soon is pending', kind('noreply@domains.com', 'Your domain renews soon'), 'update');
t('subscription failed is pending', kind('noreply@service.com', 'Subscription payment failed'), 'payment');
t('security alert is an update', kind('no-reply@accounts.google.com', 'Security alert'), 'update');
t('verification code is an update', kind('noreply@github.com', 'Your verification code is 123456'), 'update');
t('calendar invite is an update', kind('calendar-notification@google.com', 'Invitation: Weekly sync'), 'update');
t('starred stays in the inbox', kind('newsletter@x.com', 'This week in policy', { flagged: true }), 'person');
t('replied-to stays in the inbox', kind('billing@x.com', 'Your receipt', { answered: true }), 'person');
t('labelled stays in the inbox', kind('noreply@x.com', 'Security alert', { labels: ['l1'] }), 'person');
t('a person writing about a receipt word is not mistaken', kind('mary@sautisalama.org', 'Re: lunch tomorrow', {}, 'Mary Wanjiku'), 'person');
t('work domain is work', scopeOf('me@sautisalama.org'), 'work');
t('gmail is personal', scopeOf('me@gmail.com'), 'personal');
t('outlook is personal', scopeOf('me@outlook.com'), 'personal');
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
