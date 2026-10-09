import { ImapFlow, type ListResponse } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser, type ParsedMail } from 'mailparser';
import sanitizeHtml from 'sanitize-html';
import { looseAdmin } from '@/lib/loose-db';
import { decryptField } from '@/lib/security/crypto';

export interface MailAccount {
  id: string;
  owner_id: string;
  label: string;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  username: string;
  password_enc: string;
}

export const PRESETS: Record<string, { label: string; imap: [string, number, boolean]; smtp: [string, number, boolean]; hint?: string }> = {
  gmail: { label: 'Gmail / Google Workspace', imap: ['imap.gmail.com', 993, true], smtp: ['smtp.gmail.com', 465, true], hint: 'Use an app password (Google Account > Security > 2-Step Verification > App passwords).' },
  outlook: { label: 'Outlook / Microsoft 365', imap: ['outlook.office365.com', 993, true], smtp: ['smtp.office365.com', 587, false], hint: 'Your organisation must allow IMAP and SMTP AUTH; use an app password if 2-step is on.' },
  zoho: { label: 'Zoho Mail', imap: ['imap.zoho.com', 993, true], smtp: ['smtp.zoho.com', 465, true] },
  yahoo: { label: 'Yahoo Mail', imap: ['imap.mail.yahoo.com', 993, true], smtp: ['smtp.mail.yahoo.com', 465, true], hint: 'Use an app password.' },
};

/** The account row for this owner. Throws if it is not theirs. */
export async function loadAccount(accountId: string, ownerId: string): Promise<MailAccount> {
  const { data } = await looseAdmin().from('mail_accounts').select('*').eq('id', accountId).eq('owner_id', ownerId).maybeSingle();
  if (!data) throw new Error('That mailbox is not connected.');
  return data as MailAccount;
}

function imapFor(a: Pick<MailAccount, 'imap_host' | 'imap_port' | 'imap_secure' | 'username'>, password: string) {
  const client = new ImapFlow({
    host: a.imap_host,
    port: a.imap_port,
    secure: a.imap_secure,
    auth: { user: a.username, pass: password },
    logger: false,
    socketTimeout: 25_000,
    greetingTimeout: 15_000,
    connectionTimeout: 15_000,
  });
  client.on('error', () => undefined); // surfaced by the awaited call instead
  return client;
}

export async function withImap<T>(a: MailAccount, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const password = decryptField(a.password_enc);
  if (!password) throw new Error('The saved password could not be read. Reconnect this mailbox.');
  const client = imapFor(a, password);
  try {
    await client.connect();
  } catch (e) {
    throw new Error(explain(e));
  }
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

/** Plain-language reason for a connection failure. */
export function explain(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { responseText?: string; authenticationFailed?: boolean })?.authenticationFailed;
  if (code || /auth|credential|login|password|invalid/i.test(msg)) return 'The mailbox rejected the sign-in. Check the email and password (many providers need an app password).';
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) return 'We could not find that mail server. Check the server name.';
  if (/ETIMEDOUT|timeout/i.test(msg)) return 'The mail server took too long to answer.';
  return 'Could not reach the mailbox. ' + msg.slice(0, 120);
}

export async function verifySmtp(a: Pick<MailAccount, 'smtp_host' | 'smtp_port' | 'smtp_secure' | 'username'>, password: string) {
  const t = nodemailer.createTransport({ host: a.smtp_host, port: a.smtp_port, secure: a.smtp_secure, auth: { user: a.username, pass: password }, connectionTimeout: 15_000, greetingTimeout: 15_000 });
  await t.verify();
}

export async function testImap(a: Pick<MailAccount, 'imap_host' | 'imap_port' | 'imap_secure' | 'username'>, password: string) {
  const c = imapFor(a, password);
  try {
    await c.connect();
  } finally {
    await c.logout().catch(() => c.close());
  }
}

export function transporter(a: MailAccount) {
  const password = decryptField(a.password_enc);
  if (!password) throw new Error('The saved password could not be read. Reconnect this mailbox.');
  return nodemailer.createTransport({ host: a.smtp_host, port: a.smtp_port, secure: a.smtp_secure, auth: { user: a.username, pass: password }, connectionTimeout: 15_000, greetingTimeout: 15_000 });
}

/* ---------------------------------------------------------------- Mailboxes */

export type Special = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'starred' | 'other';

export interface MailboxInfo {
  path: string;
  name: string;
  special: Special;
}

const USE: Record<string, Special> = { '\\Sent': 'sent', '\\Drafts': 'drafts', '\\Trash': 'trash', '\\Junk': 'spam', '\\Archive': 'archive', '\\All': 'archive', '\\Flagged': 'starred' };

export function classify(list: ListResponse[]): MailboxInfo[] {
  return list
    .filter((m) => !m.flags?.has('\\Noselect'))
    .map((m) => {
      let special: Special = m.path.toUpperCase() === 'INBOX' ? 'inbox' : 'other';
      if (m.specialUse && USE[m.specialUse]) special = USE[m.specialUse];
      else if (special === 'other') {
        const n = m.name.toLowerCase();
        if (/^sent/.test(n)) special = 'sent';
        else if (/^draft/.test(n)) special = 'drafts';
        else if (/^(trash|deleted)/.test(n)) special = 'trash';
        else if (/^(spam|junk)/.test(n)) special = 'spam';
        else if (/^archive/.test(n)) special = 'archive';
      }
      return { path: m.path, name: m.name, special };
    });
}

export const pathOf = (boxes: MailboxInfo[], s: Special) => boxes.find((b) => b.special === s)?.path;

/* ------------------------------------------------------------------ Parsing */

export interface Address {
  name: string;
  address: string;
}

const toAddresses = (v: ParsedMail['from'] | ParsedMail['to'] | undefined): Address[] => {
  const list = Array.isArray(v) ? v.flatMap((x) => x.value) : v ? v.value : [];
  return list.map((a) => ({ name: a.name || '', address: a.address || '' }));
};

/** Email HTML is untrusted: keep formatting, drop scripts/forms/handlers, optionally block remote images. */
export function cleanHtml(html: string, allowImages: boolean): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'span', 'font', 'center', 'style', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3']).filter((t) => t !== 'style'),
    allowedAttributes: { '*': ['style', 'align', 'width', 'height', 'bgcolor', 'color', 'class'], a: ['href', 'name', 'target', 'rel'], img: ['src', 'alt', 'width', 'height'], td: ['colspan', 'rowspan', 'align', 'valign'], th: ['colspan', 'rowspan'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'cid', 'data'],
    allowedSchemesByTag: { img: allowImages ? ['http', 'https', 'cid', 'data'] : ['cid', 'data'] },
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }) },
    allowProtocolRelative: false,
  });
}

export interface ParsedMessage {
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  from: Address[];
  to: Address[];
  cc: Address[];
  date: string | null;
  html: string | null;
  text: string;
  hasRemoteImages: boolean;
  attachments: { index: number; filename: string; size: number; contentType: string; inline: boolean }[];
}

export async function parseSource(uid: number, source: Buffer, allowImages: boolean): Promise<ParsedMessage> {
  const m = await simpleParser(source);
  let html = typeof m.html === 'string' ? m.html : null;
  const hasRemoteImages = !!html && /<img[^>]+src=["']https?:/i.test(html);
  if (html) {
    // Show embedded (cid:) images inline.
    for (const att of m.attachments ?? []) {
      if (att.cid && att.content) html = html.split(`cid:${att.cid}`).join(`data:${att.contentType};base64,${att.content.toString('base64')}`);
    }
    html = cleanHtml(html, allowImages);
  }
  return {
    uid,
    messageId: m.messageId ?? null,
    inReplyTo: m.inReplyTo ?? null,
    references: Array.isArray(m.references) ? m.references : m.references ? [m.references] : [],
    subject: m.subject ?? '(no subject)',
    from: toAddresses(m.from),
    to: toAddresses(m.to),
    cc: toAddresses(m.cc),
    date: m.date ? m.date.toISOString() : null,
    html,
    text: m.text ?? '',
    hasRemoteImages,
    attachments: (m.attachments ?? []).map((a, i) => ({ index: i, filename: a.filename ?? `attachment-${i + 1}`, size: a.size ?? 0, contentType: a.contentType, inline: !!a.cid && a.contentDisposition !== 'attachment' })),
  };
}

export const normaliseSubject = (s: string) => s.replace(/^\s*((re|fwd?|aw|sv)\s*:\s*)+/i, '').trim().toLowerCase();
