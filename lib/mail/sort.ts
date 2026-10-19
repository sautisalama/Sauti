/**
 * What a message is, from its envelope alone (who sent it, the subject, and whether it carries a list header),
 * so the inbox can hold only mail that needs a person: subscriptions, receipts and automated updates are put
 * under their own labels with a count, and a payment that is waiting becomes a pending item.
 * Rules decide the clear cases at once; `sure: false` marks the rest for the decision model to look at.
 */

export type MailKind = 'person' | 'subscription' | 'receipt' | 'payment' | 'update';
export interface Sorted { kind: MailKind; sure: boolean }

const PAYMENT = /\b(overdue|payment (is )?(due|failed|declined|pending|overdue|reminder|unsuccessful|required|could not)|invoice (is )?(due|overdue|past due|reminder)|past due|overdue (invoice|payment|balance)|final (notice|reminder)|(card|payment method) (was )?(declined|expired|failed)|failed to (charge|process)|unable to (charge|process) (your )?payment|(subscription|renewal|plan) (payment )?(failed|expires?|is expiring|will expire|renews? (soon|on|in))|action required.{0,40}(payment|billing|invoice)|billing (problem|issue)|(your )?(account|service) (will be|is|has been) (suspended|cancell?ed)|pay (now|by|before)|amount due|balance due)\b/i;
const RECEIPT = /\b(receipt|your order|order (confirmation|confirmed|#|no\.?)|payment (received|successful|confirmation|confirmed|processed)|thank(s| you) for (your )?(purchase|payment|order)|tax invoice|invoice #?\s?\w*\d|paid invoice|e-?receipt|booking confirm|your (e-?ticket|ticket|itinerary|trip)|statement is ready|transaction (alert|notification|receipt)|you('ve| have) (paid|sent)|mpesa|m-pesa confirmed)\b/i;
const SUBSCRIPTION = /\b(newsletter|weekly digest|daily digest|monthly digest|weekly roundup|this week in|unsubscribe|view in browser|view this email in|\d{1,2}% off|sale ends|limited time|new arrivals|special offer|exclusive offer|promo(tion)?|free shipping|webinar|just launched|don't miss|we miss you|top stories|you may also like|recommended for you)\b/i;
const UPDATE_FROM = /^(no-?reply|do-?not-?reply|notifications?|notify|alerts?|mailer-daemon|postmaster|bounce[sd]?|system|automated|support-?noreply|updates?|security|accounts?-?noreply|donotreply)([._+-]|@)/i;
const UPDATE_SUBJECT = /\b(verification code|verify your (email|account)|one-time (password|code)|your code is|security alert|new sign-?in|new login|password (reset|changed)|reset your password|logged in from|signed in from|new comment|mentioned you|invited you|shared .{0,30} with you|assigned to you|pull request|build (failed|passed|succeeded)|deployment|pipeline|your (daily|weekly) (summary|report)|delivery status|undeliverable|out of office|automatic reply|calendar:?\s|invitation:|accepted:|declined:|updated invitation)/i;
const BULK_FROM = /^(newsletter|news|digest|marketing|promo(tion)?s?|offers?|deals?|mailer|campaign|hello|hi|team|info|contact|community|editor|weekly|daily|updates?|press)@/i;
const RECEIPT_FROM = /^(receipts?|billing|invoices?|orders?|payments?|accounts?-?receivable|sales|finance|store|shop|tickets?|bookings?|reservations?|statements?)@/i;

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'pm.me', 'aol.com', 'gmx.com', 'gmx.net', 'zoho.com', 'mail.com', 'yandex.com', 'fastmail.com', 'tutanota.com', 'tuta.io', 'hey.com',
]);

/** A mailbox on a public provider is personal; one on the organisation's own domain is work. */
export function scopeOf(address: string): 'work' | 'personal' {
  const d = address.toLowerCase().split('@')[1] ?? '';
  return PERSONAL_DOMAINS.has(d) ? 'personal' : 'work';
}

/** What `bulk` means: the message has a List-Unsubscribe header or says it is bulk or a list. */
export function sortMessage(m: { from: { name: string; address: string }; subject: string; bulk?: boolean; flagged?: boolean; labels?: string[]; answered?: boolean }): Sorted {
  // Anything the person has already acted on stays where it is.
  if (m.flagged || m.answered || (m.labels && m.labels.length)) return { kind: 'person', sure: true };
  const addr = m.from.address.toLowerCase();
  const local = addr.split('@')[0] ?? '';
  const subj = m.subject;
  if (PAYMENT.test(subj)) return { kind: 'payment', sure: true };
  if (RECEIPT.test(subj) || RECEIPT_FROM.test(addr)) return { kind: 'receipt', sure: RECEIPT.test(subj) };
  if (m.bulk || SUBSCRIPTION.test(subj) || BULK_FROM.test(addr)) return { kind: 'subscription', sure: !!m.bulk || SUBSCRIPTION.test(subj) };
  if (UPDATE_FROM.test(addr) || UPDATE_SUBJECT.test(subj)) return { kind: 'update', sure: true };
  // A human address: a name that looks like a person's, or a plain first.last local part.
  const personal = /^[a-z]+([._-][a-z]+)?$/.test(local) && !/^(admin|support|help|service|sales|info|office|contact|team|hello|billing|accounts?)$/.test(local);
  return { kind: 'person', sure: personal || m.from.name.trim().split(/\s+/).length >= 2 };
}

export const BUCKET_LABEL: Record<Exclude<MailKind, 'person' | 'payment'>, string> = { subscription: 'Subscriptions', receipt: 'Receipts', update: 'Updates' };
