'use server';

import { NO_DASH_RULE, stripDashes } from '@/lib/plain-text';
import MailComposer from 'nodemailer/lib/mail-composer';
import { looseAdmin } from '@/lib/loose-db';
import { decryptField, encryptField } from '@/lib/security/crypto';
import { logAudit } from '@/lib/access/audit';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { requireModule } from '@/lib/access/permissions';
import {
  PRESETS, classify, explain, fetchSource, loadAccount, normaliseSubject, parseSource, pathOf, testImap, testPop3, transporter, verifySmtp, withImap, withPop3,
  type Address, type MailboxInfo, type ParsedMessage,
} from '@/lib/mail/client';
import { oauthConfigured } from '@/lib/mail/oauth';
import { detectMailbox as detect, type Detected } from '@/lib/mail/autoconfig';
import { uidOf } from '@/lib/mail/pop3';
import { simpleParser } from 'mailparser';
import sanitizeHtml from 'sanitize-html';
import { headers } from 'next/headers';
import { touchContacts, autoAddTeamContacts } from '@/lib/mjengo-contacts';
import { atLeast, levelFor, loadIndex, oversightFor, recipientLevels } from '@/lib/vault/access';
import { sortMessage, scopeOf, type MailKind } from '@/lib/mail/sort';

/** Which one-click sign-ins this deployment has credentials for. */
async function oauthAvailability_() {
  await requireModule('mail');
  return { google: oauthConfigured('google'), microsoft: oauthConfigured('microsoft'), myEmail: (await requireModule('mail')).email };
}

/* ---------------------------------------------------------------- Accounts */

export interface AccountView {
  id: string;
  label: string;
  email: string;
  protocol: 'imap' | 'pop3';
  auth_type: 'password' | 'google' | 'microsoft';
}

async function listAccounts_(): Promise<AccountView[]> {
  const actor = await requireModule('mail');
  const { data } = await looseAdmin().from('mail_accounts').select('id, label, email, protocol, auth_type').eq('owner_id', actor.id).order('created_at');
  return (data ?? []) as AccountView[];
}

export interface AddAccountInput {
  /** 'auto' works the servers out from the email address. */
  preset: keyof typeof PRESETS | 'custom' | 'auto';
  /** How to read the mailbox. Sending always uses SMTP. */
  protocol?: 'imap' | 'pop3';
  email: string;
  password: string;
  label?: string;
  username?: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
}

async function addAccount_(input: AddAccountInput): Promise<AccountView> {
  const actor = await requireModule('mail', 'write');
  const email = (input.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!input.password) throw new Error('Enter the password (or app password).');

  let p: { imap: [string, number, boolean]; smtp: [string, number, boolean]; pop?: [string, number, boolean] } | null = null;
  if (input.preset === 'auto') {
    const d = await detect(email);
    if (!d.imap || !d.smtp) throw new Error("We couldn't find this mailbox's servers from the address. Open Advanced and enter them.");
    p = { imap: d.imap, smtp: d.smtp, pop: d.pop };
  } else if (input.preset !== 'custom') p = PRESETS[input.preset];
  const protocol = input.protocol === 'pop3' ? 'pop3' : 'imap';
  const readHost = protocol === 'pop3' && p?.pop ? p.pop : p?.imap;
  const imapHost = readHost ? readHost[0] : (input.imapHost ?? '').trim();
  const smtpHost = p ? p.smtp[0] : (input.smtpHost ?? '').trim();
  if (!imapHost || !smtpHost) throw new Error('Enter the mail server names.');
  const imapPort = readHost ? readHost[1] : input.imapPort || (protocol === 'pop3' ? 995 : 993);
  const smtpPort = p ? p.smtp[1] : input.smtpPort || 465;
  const row = {
    imap_host: imapHost,
    imap_port: imapPort,
    imap_secure: readHost ? readHost[2] : imapPort === 993 || imapPort === 995,
    smtp_host: smtpHost,
    smtp_port: smtpPort,
    smtp_secure: p ? p.smtp[2] : smtpPort === 465,
    username: (input.username || email).trim(),
  };

  // Prove both directions work before saving anything.
  try {
    if (protocol === 'pop3') await testPop3(row, input.password);
    else await testImap(row, { pass: input.password });
  } catch (e) {
    throw new Error(explain(e));
  }
  try {
    await verifySmtp(row, { pass: input.password });
  } catch (e) {
    throw new Error('Reading mail works, but sending does not: ' + explain(e));
  }

  const enc = encryptField(input.password);
  if (!enc) throw new Error('Could not secure the password.');
  const { data, error } = await looseAdmin()
    .from('mail_accounts')
    .upsert({ owner_id: actor.id, label: (input.label || email).trim().slice(0, 60), email, password_enc: enc, protocol, auth_type: 'password', ...row }, { onConflict: 'owner_id,email' })
    .select('id, label, email, protocol, auth_type')
    .single();
  if (error || !data) throw new Error('Could not save the mailbox.');
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mail.account_connected', targetType: 'mailbox', targetId: data.id, targetLabel: email });
  return data as AccountView;
}

async function removeAccount_(id: string) {
  const actor = await requireModule('mail', 'owner');
  const { data } = await looseAdmin().from('mail_accounts').delete().eq('id', id).eq('owner_id', actor.id).select('email').maybeSingle();
  if (data) await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mail.account_removed', targetType: 'mailbox', targetId: id, targetLabel: data.email });
}

/* ------------------------------------------------------- Settings (Gmail-style) */

export interface MailPrefs {
  undoSeconds: 0 | 5 | 10 | 20 | 30;
  replyDefault: 'reply' | 'reply_all';
  conversationView: boolean;
  density: 'comfortable' | 'compact';
  blocked: string[];
}

const DEFAULT_PREFS: MailPrefs = { undoSeconds: 5, replyDefault: 'reply', conversationView: true, density: 'comfortable', blocked: [] };

async function getPrefs_(): Promise<MailPrefs> {
  const a = await requireModule('mail');
  const { data } = await looseAdmin().from('mail_preferences').select('undo_seconds, reply_default, conversation_view, density, blocked').eq('owner_id', a.id).maybeSingle();
  if (!data) return DEFAULT_PREFS;
  return { undoSeconds: data.undo_seconds, replyDefault: data.reply_default, conversationView: data.conversation_view, density: data.density, blocked: data.blocked ?? [] };
}

async function savePrefs_(v: MailPrefs): Promise<MailPrefs> {
  const a = await requireModule('mail', 'write');
  const blocked = [...new Set(v.blocked.map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$|^@[^\s@]+\.[^\s@]+$/.test(x)))].slice(0, 200);
  const row = {
    owner_id: a.id,
    undo_seconds: [0, 5, 10, 20, 30].includes(v.undoSeconds) ? v.undoSeconds : 5,
    reply_default: v.replyDefault === 'reply_all' ? 'reply_all' : 'reply',
    conversation_view: !!v.conversationView,
    density: v.density === 'compact' ? 'compact' : 'comfortable',
    blocked,
    updated_at: new Date().toISOString(),
  };
  await looseAdmin().from('mail_preferences').upsert(row, { onConflict: 'owner_id' });
  return { undoSeconds: row.undo_seconds as MailPrefs['undoSeconds'], replyDefault: row.reply_default as MailPrefs['replyDefault'], conversationView: row.conversation_view, density: row.density as MailPrefs['density'], blocked };
}

export interface AccountServers {
  id: string;
  email: string;
  label: string;
  protocol: 'imap' | 'pop3';
  auth_type: 'password' | 'google' | 'microsoft';
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  username: string;
}

/** The connection settings of a mailbox, to show and adjust like Gmail's Accounts and Import page. */
async function getServers_(id: string): Promise<AccountServers> {
  const a = await requireModule('mail');
  const { data } = await looseAdmin().from('mail_accounts').select('id, email, label, protocol, auth_type, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, username').eq('id', id).eq('owner_id', a.id).maybeSingle();
  if (!data) throw new Error('That mailbox no longer exists.');
  return data as AccountServers;
}

export interface UpdateServers {
  label?: string;
  username?: string;
  password?: string;
  imapHost?: string; imapPort?: number; imapSecure?: boolean;
  smtpHost?: string; smtpPort?: number; smtpSecure?: boolean;
}

/** Change a password mailbox's servers, port, security or password; the new settings are tested before they are kept. */
async function updateServers_(id: string, v: UpdateServers): Promise<AccountServers> {
  const a = await requireModule('mail', 'write');
  const db = looseAdmin();
  const { data: cur } = await db.from('mail_accounts').select('*').eq('id', id).eq('owner_id', a.id).maybeSingle();
  if (!cur) throw new Error('That mailbox no longer exists.');
  const label = (v.label ?? cur.label).trim().slice(0, 60) || cur.email;
  if (cur.auth_type !== 'password') {
    await db.from('mail_accounts').update({ label }).eq('id', id);
    return getServers_(id);
  }
  const row = {
    imap_host: (v.imapHost ?? cur.imap_host).trim(),
    imap_port: Number(v.imapPort ?? cur.imap_port),
    imap_secure: v.imapSecure ?? cur.imap_secure,
    smtp_host: (v.smtpHost ?? cur.smtp_host).trim(),
    smtp_port: Number(v.smtpPort ?? cur.smtp_port),
    smtp_secure: v.smtpSecure ?? cur.smtp_secure,
    username: (v.username ?? cur.username).trim(),
  };
  if (!row.imap_host || !row.smtp_host || !row.username) throw new Error('Server names and the username cannot be empty.');
  if (![row.imap_port, row.smtp_port].every((n) => Number.isInteger(n) && n > 0 && n < 65536)) throw new Error('Ports must be numbers between 1 and 65535.');
  const pass = v.password || decryptField(cur.password_enc) || '';
  try {
    if (cur.protocol === 'pop3') await testPop3(row, pass);
    else await testImap(row, { pass });
  } catch (e) {
    throw new Error('Reading mail with those settings failed: ' + explain(e));
  }
  try {
    await verifySmtp(row, { pass });
  } catch (e) {
    throw new Error('Sending with those settings failed: ' + explain(e));
  }
  const patch: Record<string, unknown> = { ...row, label };
  if (v.password) patch.password_enc = encryptField(v.password);
  await db.from('mail_accounts').update(patch).eq('id', id);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'mail.account_settings_changed', targetType: 'mailbox', targetId: id, targetLabel: cur.email });
  return getServers_(id);
}

/** From an email address alone: which provider, and which servers if it is a password mailbox. */
async function detectMailbox_(email: string): Promise<Detected & { oauthReady: boolean }> {
  await requireModule('mail');
  const d = await detect(email);
  return { ...d, oauthReady: d.kind === 'google' || d.kind === 'microsoft' ? oauthConfigured(d.kind) : false };
}

/* --------------------------------------------------------------- Mailboxes */

async function getMailboxes_(accountId: string): Promise<{ boxes: MailboxInfo[]; unread: number }> {
  const actor = await requireModule('mail');
  const acct = await loadAccount(accountId, actor.id);
  if (acct.protocol === 'pop3') return { boxes: [{ path: 'INBOX', name: 'Inbox', special: 'inbox' as const }], unread: 0 };
  return withImap(acct, async (c) => {
    const boxes = classify(await c.list());
    const inbox = pathOf(boxes, 'inbox') ?? 'INBOX';
    const st = await c.status(inbox, { unseen: true }).catch(() => null);
    return { boxes, unread: st && typeof st === 'object' ? st.unseen ?? 0 : 0 };
  });
}

/* ---------------------------------------------------------------- Messages */

export interface MessageRow {
  uid: number;
  mailbox: string;
  from: Address;
  subject: string;
  date: string | null;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  /** Message-ID header: what labels are attached to. */
  messageId: string | null;
  /** Label ids on this message. */
  labels: string[];
  /** Messages in this list that share the subject. */
  thread: number;
  /** Set on the combined inbox, where rows of different mailboxes are mixed. */
  account?: string;
  accountEmail?: string;
  accountScope?: 'work' | 'personal';
  /** Sent by a list (carries a List-Unsubscribe header). */
  bulk?: boolean;
  answered?: boolean;
  kind?: MailKind;
  /** False when the kind was only guessed from the address and subject. */
  sure?: boolean;
}

export interface ListQuery {
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
  from?: string;
  text?: string;
  labelId?: string;
}

async function listPop3(acct: Awaited<ReturnType<typeof loadAccount>>, query: ListQuery, offset: number, limit: number): Promise<{ items: MessageRow[]; total: number }> {
  return withPop3(acct, async (p) => {
    const all = (await p.uidl()).reverse(); // newest first
    const term = (query.text ?? query.from ?? '').trim().toLowerCase();
    // POP3 has no search: when filtering, look through the newest 200 headers.
    const window = term ? all.slice(0, 200) : all.slice(offset, offset + limit);
    const items: MessageRow[] = [];
    for (const [n, id] of window) {
      const h = await simpleParser(await p.top(n));
      const from = h.from?.value?.[0];
      const row: MessageRow = {
        uid: uidOf(id),
        mailbox: 'INBOX',
        from: { name: from?.name || '', address: from?.address || '' },
        subject: h.subject || '(no subject)',
        date: h.date ? h.date.toISOString() : null,
        seen: true,
        flagged: false,
        hasAttachments: false,
        messageId: h.messageId ?? null,
        labels: [],
        thread: 1,
      };
      if (term && ![row.subject, row.from.name, row.from.address].some((v) => v.toLowerCase().includes(term))) continue;
      items.push(row);
    }
    return { items: term ? items.slice(offset, offset + limit) : items, total: term ? items.length : all.length };
  });
}

function hasAttachment(node: { disposition?: string; childNodes?: unknown[] } | undefined): boolean {
  if (!node) return false;
  if (node.disposition === 'attachment') return true;
  return (node.childNodes ?? []).some((n) => hasAttachment(n as { disposition?: string; childNodes?: unknown[] }));
}

/** Messages of a folder with their labels; a label filter looks through the newest 300 messages. */
async function listMessages_(accountId: string, mailbox: string, query: ListQuery = {}, offset = 0, limit = 40): Promise<{ items: MessageRow[]; total: number }> {
  const actor = await requireModule('mail');
  const db = looseAdmin();
  let set: Set<string> | null = null;
  if (query.labelId) {
    const { data } = await db.from('mail_message_labels').select('message_id').eq('owner_id', actor.id).eq('account_id', accountId).eq('label_id', query.labelId);
    set = new Set((data ?? []).map((r: { message_id: string }) => r.message_id));
    offset = 0;
    limit = 300;
  }
  const res = await listCore_(accountId, mailbox, query, offset, limit);
  const ids = res.items.map((i) => i.messageId).filter(Boolean) as string[];
  if (ids.length) {
    const { data } = await db.from('mail_message_labels').select('message_id, label_id').eq('owner_id', actor.id).eq('account_id', accountId).in('message_id', ids);
    const by = new Map<string, string[]>();
    for (const r of (data ?? []) as { message_id: string; label_id: string }[]) by.set(r.message_id, [...(by.get(r.message_id) ?? []), r.label_id]);
    res.items.forEach((i) => { i.labels = (i.messageId && by.get(i.messageId)) || []; });
  }
  if (set) {
    const items = res.items.filter((i) => i.messageId && set!.has(i.messageId));
    return { items, total: items.length };
  }
  return res;
}

async function listCore_(accountId: string, mailbox: string, query: ListQuery = {}, offset = 0, limit = 40): Promise<{ items: MessageRow[]; total: number }> {
  const actor = await requireModule('mail');
  const acct = await loadAccount(accountId, actor.id);
  if (acct.protocol === 'pop3') return listPop3(acct, query, offset, limit);
  return withImap(acct, async (c) => {
    const lock = await c.getMailboxLock(mailbox);
    try {
      const filtered = query.unread || query.starred || query.from?.trim() || query.text?.trim();
      let range: string;
      let useUid = false;
      let total: number;
      if (filtered) {
        const q: Record<string, unknown> = {};
        if (query.unread) q.seen = false;
        if (query.starred) q.flagged = true;
        if (query.from?.trim()) q.from = query.from.trim();
        if (query.text?.trim()) q.or = [{ subject: query.text.trim() }, { from: query.text.trim() }, { body: query.text.trim() }];
        const uids = ((await c.search(q, { uid: true })) || []).sort((a, b) => b - a);
        total = uids.length;
        const page = uids.slice(offset, offset + limit);
        if (!page.length) return { items: [], total };
        range = page.join(',');
        useUid = true;
      } else {
        const exists = (c.mailbox && typeof c.mailbox === 'object' ? c.mailbox.exists : 0) || 0;
        total = exists;
        const end = exists - offset;
        if (end < 1) return { items: [], total };
        range = `${Math.max(1, end - limit + 1)}:${end}`;
      }

      const items: MessageRow[] = [];
      for await (const m of c.fetch(range, { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true, headers: ['list-unsubscribe', 'precedence'] }, { uid: useUid })) {
        const f = m.envelope?.from?.[0];
        const date = m.envelope?.date ?? (m.internalDate ? new Date(m.internalDate) : null);
        items.push({
          uid: m.uid,
          mailbox,
          from: { name: f?.name || '', address: f?.address || '' },
          subject: m.envelope?.subject || '(no subject)',
          date: date ? new Date(date).toISOString() : null,
          seen: m.flags?.has('\\Seen') ?? false,
          flagged: m.flags?.has('\\Flagged') ?? false,
          hasAttachments: hasAttachment(m.bodyStructure as never),
          messageId: m.envelope?.messageId ?? null,
          labels: [],
          thread: 1,
          bulk: /list-unsubscribe|precedence:\s*(bulk|list|junk)/i.test(m.headers ? m.headers.toString() : ''),
          answered: m.flags?.has('\\Answered') ?? false,
        });
      }
      items.sort((a, b) => b.uid - a.uid);
      if (query.hasAttachment) {
        const kept = items.filter((i) => i.hasAttachments);
        return { items: kept, total };
      }
      const counts = new Map<string, number>();
      for (const i of items) counts.set(normaliseSubject(i.subject), (counts.get(normaliseSubject(i.subject)) ?? 0) + 1);
      for (const i of items) i.thread = counts.get(normaliseSubject(i.subject)) ?? 1;
      return { items, total };
    } finally {
      lock.release();
    }
  });
}

async function getMessageDetail_(accountId: string, mailbox: string, uid: number, allowImages = true): Promise<ParsedMessage & { seen: boolean; flagged: boolean }> {
  const actor = await requireModule('mail');
  const acct = await loadAccount(accountId, actor.id);
  if (acct.protocol === 'pop3') {
    const parsed = await parseSource(uid, await fetchSource(acct, mailbox, uid), allowImages);
    return { ...parsed, seen: true, flagged: false };
  }
  return withImap(acct, async (c) => {
    const lock = await c.getMailboxLock(mailbox);
    try {
      const msg = await c.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
      if (!msg || !msg.source) throw new Error('That message is no longer there.');
      const parsed = await parseSource(uid, msg.source, allowImages);
      const wasSeen = msg.flags?.has('\\Seen') ?? false;
      if (!wasSeen) await c.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
      return { ...parsed, seen: true, flagged: msg.flags?.has('\\Flagged') ?? false };
    } finally {
      lock.release();
    }
  });
}

/** Other messages in this mailbox with the same subject, newest first. */
async function getConversation_(accountId: string, mailbox: string, subject: string): Promise<MessageRow[]> {
  const actor = await requireModule('mail');
  const acct = await loadAccount(accountId, actor.id);
  const key = normaliseSubject(subject);
  if (!key || acct.protocol === 'pop3') return [];
  return withImap(acct, async (c) => {
    // The folder it is in, and the Sent folder, so your own replies belong to the conversation too.
    const paths = [mailbox];
    try {
      const sent = (await c.list()).find((b) => b.specialUse === '\\Sent');
      if (sent && sent.path !== mailbox) paths.push(sent.path);
    } catch { /* no list: the open folder only */ }
    const out: MessageRow[] = [];
    for (const path of paths) {
      const lock = await c.getMailboxLock(path);
      try {
        const uids = ((await c.search({ subject: key }, { uid: true })) || []).sort((x, y) => y - x).slice(0, 15);
        if (!uids.length) continue;
        for await (const m of c.fetch(uids.join(','), { uid: true, envelope: true, flags: true, internalDate: true }, { uid: true })) {
          const f = m.envelope?.from?.[0];
          out.push({ uid: m.uid, mailbox: path, from: { name: f?.name || '', address: f?.address || '' }, subject: m.envelope?.subject || '', date: m.envelope?.date ? new Date(m.envelope.date).toISOString() : null, seen: m.flags?.has('\\Seen') ?? false, flagged: m.flags?.has('\\Flagged') ?? false, hasAttachments: false, messageId: m.envelope?.messageId ?? null, labels: [], thread: 1 });
        }
      } finally {
        lock.release();
      }
    }
    return out.filter((m) => normaliseSubject(m.subject) === key).sort((x, y) => (y.date ?? '').localeCompare(x.date ?? ''));
  });
}

export interface ThreadDetail extends ParsedMessage { mailbox: string; seen: boolean; flagged: boolean }

/**
 * A whole conversation in one round trip: the headers of every message, and the bodies of the most recent
 * ones, fetched over a single connection. Mail apps are quick at threads for the same reason: they do not ask
 * for each message one at a time, they pull the thread down together and show it from what they hold.
 */
async function getThread_(accountId: string, mailbox: string, subject: string, limit = 10): Promise<{ rows: MessageRow[]; details: ThreadDetail[] }> {
  const actor = await requireModule('mail');
  const acct = await loadAccount(accountId, actor.id);
  const key = normaliseSubject(subject);
  if (!key || acct.protocol === 'pop3') return { rows: [], details: [] };
  return withImap(acct, async (c) => {
    const paths = [mailbox];
    try {
      const sent = (await c.list()).find((b) => b.specialUse === '\\Sent');
      if (sent && sent.path !== mailbox) paths.push(sent.path);
    } catch { /* the open folder only */ }

    const rows: MessageRow[] = [];
    const details: ThreadDetail[] = [];
    for (const path of paths) {
      const lock = await c.getMailboxLock(path);
      try {
        const uids = ((await c.search({ subject: key }, { uid: true })) || []).sort((x, y) => y - x).slice(0, 15);
        if (!uids.length) continue;
        const wantBodies = new Set(uids.slice(0, limit));
        for await (const m of c.fetch(uids.join(','), { uid: true, envelope: true, flags: true, internalDate: true, source: wantBodies.size > 0 }, { uid: true })) {
          const f = m.envelope?.from?.[0];
          const subj = m.envelope?.subject || '';
          if (normaliseSubject(subj) !== key) continue;
          rows.push({ uid: m.uid, mailbox: path, from: { name: f?.name || '', address: f?.address || '' }, subject: subj, date: m.envelope?.date ? new Date(m.envelope.date).toISOString() : null, seen: m.flags?.has('\\Seen') ?? false, flagged: m.flags?.has('\\Flagged') ?? false, hasAttachments: false, messageId: m.envelope?.messageId ?? null, labels: [], thread: 1 });
          if (m.source && wantBodies.has(m.uid)) {
            try {
              const parsed = await parseSource(m.uid, m.source, true);
              details.push({ ...parsed, mailbox: path, seen: m.flags?.has('\\Seen') ?? false, flagged: m.flags?.has('\\Flagged') ?? false });
            } catch { /* one message that will not parse */ }
          }
        }
      } finally {
        lock.release();
      }
    }
    rows.sort((x, y) => (y.date ?? '').localeCompare(x.date ?? ''));
    return { rows, details };
  });
}

export type MailAction = 'archive' | 'trash' | 'spam' | 'read' | 'unread' | 'star' | 'unstar' | 'delete';

async function actOnMessages_(accountId: string, mailbox: string, uids: number[], action: MailAction) {
  const actor = await requireModule('mail', 'write');
  const acct = await loadAccount(accountId, actor.id);
  if (!uids.length) return;
  const set = uids.slice(0, 200).join(',');
  if (acct.protocol === 'pop3') {
    // POP3 can only delete; reading state and stars have no meaning there.
    if (!['archive', 'trash', 'spam', 'delete'].includes(action)) return;
    await withPop3(acct, async (p) => {
      const map = new Map((await p.uidl()).map(([n, id]) => [uidOf(id), n]));
      for (const u of uids.slice(0, 200)) {
        const n = map.get(u);
        if (n) await p.dele(n);
      }
    });
    return;
  }
  await withImap(acct, async (c) => {
    const boxes = classify(await c.list());
    const lock = await c.getMailboxLock(mailbox);
    try {
      switch (action) {
        case 'read': await c.messageFlagsAdd(set, ['\\Seen'], { uid: true }); break;
        case 'unread': await c.messageFlagsRemove(set, ['\\Seen'], { uid: true }); break;
        case 'star': await c.messageFlagsAdd(set, ['\\Flagged'], { uid: true }); break;
        case 'unstar': await c.messageFlagsRemove(set, ['\\Flagged'], { uid: true }); break;
        case 'delete': await c.messageDelete(set, { uid: true }); break;
        default: {
          const target = action === 'archive' ? pathOf(boxes, 'archive') : action === 'trash' ? pathOf(boxes, 'trash') : pathOf(boxes, 'spam');
          if (target && target !== mailbox) await c.messageMove(set, target, { uid: true });
          else if (action === 'trash') await c.messageDelete(set, { uid: true }); // no Trash folder: remove it
          else if (!target) throw new Error(action === 'archive' ? 'This mailbox has no Archive folder.' : 'This mailbox has no Spam folder.');
        }
      }
    } finally {
      lock.release();
    }
  });
}

/* ------------------------------------------------------------------- Send */

export interface SendInput {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  inReplyTo?: string | null;
  references?: string[];
  attachments?: { filename: string; contentBase64: string; contentType: string }[];
  /** Vault files sent as links; recipients open them under their own vault rights. */
  vaultLinks?: string[];
  /** Vault files attached as copies. Needs share rights on each file. */
  vaultAttach?: string[];
  /** The sender has been told some recipients cannot open the linked files and sends anyway. */
  acknowledgeNoAccess?: boolean;
}

const emailOk = (e: string) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e);

const htmlToText = (html: string) =>
  html.replace(/<(br|\/p|\/div|\/h[1-6]|\/li)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();

async function sendMail_(input: SendInput) {
  const actor = await requireModule('mail', 'write');
  const acct = await loadAccount(input.accountId, actor.id);
  const to = input.to.map((e) => e.trim()).filter(Boolean);
  const cc = (input.cc ?? []).map((e) => e.trim()).filter(Boolean);
  const bcc = (input.bcc ?? []).map((e) => e.trim()).filter(Boolean);
  if (!to.length) throw new Error('Add at least one recipient.');
  const bad = [...to, ...cc, ...bcc].find((e) => !emailOk(e));
  if (bad) throw new Error(`"${bad}" is not a valid email address.`);
  const attachments = (input.attachments ?? []).slice(0, 10).map((a) => ({ filename: a.filename.slice(0, 200), content: Buffer.from(a.contentBase64, 'base64'), contentType: a.contentType }));
  let html = input.html;

  // Vault documents: checked again here, whatever the browser said.
  const linkIds = [...new Set(input.vaultLinks ?? [])].slice(0, 20);
  const attachIds = [...new Set(input.vaultAttach ?? [])].slice(0, 10);
  if (linkIds.length || attachIds.length) {
    const ix = await loadIndex();
    const oversight = await oversightFor(actor.email);
    const allAddr = [...to, ...cc, ...bcc];
    const links: { name: string; id: string }[] = [];
    const blocked: string[] = [];
    for (const id of linkIds) {
      const f = ix.files.get(id);
      if (!f || !levelFor(ix, actor.id, 'file', id, oversight)) throw new Error('You do not have access to one of the vault files you linked.');
      const missing = (await recipientLevels(ix, id, allAddr)).filter((r) => !r.level);
      if (missing.length) blocked.push(`"${f.name}" cannot be opened by ${missing.map((m) => m.email).join(', ')}`);
      links.push({ name: f.name, id });
    }
    if (blocked.length && !input.acknowledgeNoAccess) throw new Error('Some recipients do not have access to vault files in this message. ' + blocked.join('; ') + '.');
    for (const id of attachIds) {
      const f = ix.files.get(id);
      if (!f || !atLeast(levelFor(ix, actor.id, 'file', id, oversight), 'share')) throw new Error('You need share rights to send a vault file as an attachment.');
      const { data, error } = await looseAdmin().storage.from('mjengo-docs').download(f.storage_path);
      if (error || !data) throw new Error(`Could not read "${f.name}" from the vault.`);
      attachments.push({ filename: f.name.slice(0, 200), content: Buffer.from(await data.arrayBuffer()), contentType: f.mime || 'application/octet-stream' });
    }
    // A file already linked inline in the body (typed with @) does not need repeating below.
    const extra = links.filter((l) => !html.includes(`open=${l.id}`));
    if (extra.length) {
      const h = await headers();
      const host = h.get('x-forwarded-host') || h.get('host') || 'app.sautisalama.org';
      const origin = `${h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
      const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
      html += `<p style="margin-top:16px;color:#6b7280">Shared from the Sauti Salama vault. You need access to open these.</p><ul>${extra
        .map((l) => `<li><a href="${origin}/dashboard/mjengo/vault?open=${l.id}">${esc(l.name)}</a></li>`)
        .join('')}</ul>`;
    }
  }
  if (attachments.reduce((n, a) => n + a.content.length, 0) > 18 * 1024 * 1024) throw new Error('Attachments are too large (18 MB total).');

  const mail = {
    from: acct.email,
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject: input.subject.trim() || '(no subject)',
    html,
    text: htmlToText(html),
    inReplyTo: input.inReplyTo || undefined,
    references: input.references?.length ? input.references : undefined,
    attachments,
  };
  const raw = await new MailComposer(mail).compile().build();
  try {
    await (await transporter(acct)).sendMail({ envelope: { from: acct.email, to: [...to, ...cc, ...bcc] }, raw });
  } catch (e) {
    throw new Error('The message was not sent. ' + explain(e));
  }

  // Gmail and Microsoft keep a copy in Sent by themselves; others need us to file it.
  if (acct.protocol === 'imap' && !/gmail|googlemail|office365|outlook/i.test(acct.smtp_host)) {
    await withImap(acct, async (c) => {
      const sent = pathOf(classify(await c.list()), 'sent');
      if (sent) await c.append(sent, raw, ['\\Seen']);
    }).catch(() => undefined);
  }
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mail.sent', targetType: 'mailbox', targetId: acct.id, targetLabel: acct.email, details: { to, subject: mail.subject.slice(0, 120), attachments: attachments.length, vault_links: linkIds, vault_attached: attachIds } });
  await touchContacts([...to, ...cc, ...bcc]);
  await autoAddTeamContacts(actor.id, acct.email, [...to, ...cc]);
  return { success: true };
}

/* ----------------------------------------------------------- Views, snippets */

export interface ViewConfig {
  mailbox: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive';
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
  from?: string;
  /** Only messages carrying this label. */
  labelId?: string;
  group?: 'date' | 'sender' | 'status' | 'none';
  hoverActions?: ('archive' | 'trash' | 'unread' | 'star' | 'reply')[];
}

export interface ViewRow {
  id: string;
  name: string;
  icon: string;
  config: ViewConfig;
}

async function listViews_(): Promise<ViewRow[]> {
  const actor = await requireModule('mail');
  const { data } = await looseAdmin().from('mail_views').select('id, name, icon, config').eq('owner_id', actor.id).order('position').order('created_at');
  return (data ?? []) as ViewRow[];
}

async function saveView_(id: string | null, v: { name: string; icon?: string; config: ViewConfig }): Promise<ViewRow> {
  const actor = await requireModule('mail', 'write');
  const name = v.name.trim().slice(0, 40);
  if (!name) throw new Error('Name the view.');
  const db = looseAdmin();
  const row = { name, icon: v.icon || 'inbox', config: v.config };
  const q = id ? db.from('mail_views').update(row).eq('id', id).eq('owner_id', actor.id) : db.from('mail_views').insert({ ...row, owner_id: actor.id });
  const { data, error } = await q.select('id, name, icon, config').single();
  if (error || !data) throw new Error('Could not save the view.');
  return data as ViewRow;
}

async function deleteView_(id: string) {
  const actor = await requireModule('mail', 'owner');
  await looseAdmin().from('mail_views').delete().eq('id', id).eq('owner_id', actor.id);
}

export interface SnippetRow {
  id: string;
  name: string;
  body_html: string;
}

async function listSnippets_(): Promise<SnippetRow[]> {
  const actor = await requireModule('mail');
  const { data } = await looseAdmin().from('mail_snippets').select('id, name, body_html').eq('owner_id', actor.id).order('name');
  return (data ?? []) as SnippetRow[];
}

async function saveSnippet_(id: string | null, name: string, bodyHtml: string): Promise<SnippetRow> {
  const actor = await requireModule('mail', 'write');
  const n = name.trim().slice(0, 40);
  if (!n || !bodyHtml.trim()) throw new Error('A snippet needs a name and some content.');
  const db = looseAdmin();
  const row = { name: n, body_html: bodyHtml.slice(0, 20000) };
  const q = id ? db.from('mail_snippets').update(row).eq('id', id).eq('owner_id', actor.id) : db.from('mail_snippets').insert({ ...row, owner_id: actor.id });
  const { data, error } = await q.select('id, name, body_html').single();
  if (error || !data) throw new Error('Could not save the snippet.');
  return data as SnippetRow;
}

async function deleteSnippet_(id: string) {
  const actor = await requireModule('mail', 'owner');
  await looseAdmin().from('mail_snippets').delete().eq('id', id).eq('owner_id', actor.id);
}

/* ------------------------------------------------------------------ Labels */

export interface LabelRow {
  id: string;
  name: string;
  color: string;
  instruction: string | null;
  /** Set when this label stands for a project: emails tagged with it are that project's mail. */
  project_id?: string | null;
}

async function listLabels_(): Promise<LabelRow[]> {
  const actor = await requireModule('mail');
  const db = looseAdmin();
  const read = () => db.from('mail_labels').select('id, name, color, instruction, project_id').eq('owner_id', actor.id).order('created_at');
  let { data } = await read();
  // Financial and Budgeting are there for everyone: tagging an email with them is how money mail is found.
  const have = new Set(((data ?? []) as { name: string }[]).map((l) => l.name.toLowerCase()));
  const missing = [['Financial', 'green', 'Invoices, receipts, payments, statements and anything about money.'], ['Budgeting', 'amber', 'Budgets, forecasts, cost plans and budget approvals.']].filter(([n]) => !have.has(n.toLowerCase()));
  if (missing.length) {
    await db.from('mail_labels').insert(missing.map(([name, color, instruction]) => ({ owner_id: actor.id, name, color, instruction })));
    ({ data } = await read());
  }
  return (data ?? []) as LabelRow[];
}

async function saveLabel_(id: string | null, v: { name: string; color?: string; instruction?: string | null }): Promise<LabelRow> {
  const actor = await requireModule('mail', 'write');
  const name = v.name.trim().slice(0, 40);
  if (!name) throw new Error('Name the label.');
  const row = { name, color: v.color || 'purple', instruction: v.instruction?.trim().slice(0, 600) || null };
  const db = looseAdmin();
  const q = id ? db.from('mail_labels').update(row).eq('id', id).eq('owner_id', actor.id) : db.from('mail_labels').insert({ ...row, owner_id: actor.id });
  const { data, error } = await q.select('id, name, color, instruction, project_id').single();
  if (error || !data) throw new Error('Could not save the label.');
  return data as LabelRow;
}

async function deleteLabel_(id: string) {
  const actor = await requireModule('mail', 'owner');
  await looseAdmin().from('mail_labels').delete().eq('id', id).eq('owner_id', actor.id);
}

async function setMessageLabel_(accountId: string, messageId: string, labelId: string, on: boolean) {
  const actor = await requireModule('mail', 'write');
  await loadAccount(accountId, actor.id);
  const db = looseAdmin();
  const { data: label } = await db.from('mail_labels').select('id').eq('id', labelId).eq('owner_id', actor.id).maybeSingle();
  if (!label) throw new Error('That label no longer exists.');
  if (on) await db.from('mail_message_labels').upsert({ owner_id: actor.id, account_id: accountId, message_id: messageId, label_id: labelId });
  else await db.from('mail_message_labels').delete().eq('account_id', accountId).eq('message_id', messageId).eq('label_id', labelId).eq('owner_id', actor.id);
}

export interface MailTriage { kind: 'personal' | 'automated' | 'opportunity'; confidence: number; by: 'jev' | 'rules' }

const OPP_WORDS = /\b(call for (proposals|applications|expressions)|request for proposals?|rfp|funding opportunit|grant (opportunity|call|application)|fellowship|tender|expression of interest|eoi|application deadline|apply by|closing date)\b/i;
const AUTO_WORDS = /unsubscribe|manage (your )?(email )?preferences|view (this email )?in (your )?browser|no[-_.]?reply|do[-_.]?not[-_.]?reply|receipt|invoice #|your order/i;

/**
 * What kind of mail this is, so the suite knows whether it needs reading, can be left alone, or should be
 * offered to Opportunities. Jev (a typed decision model, through OpenRouter) answers; if it cannot, word
 * rules do. No language model is called either way.
 */
async function triage_(subject: string, from: string, text: string): Promise<MailTriage> {
  await requireModule('mail');
  const body = `From: ${from.slice(0, 120)}\nSubject: ${subject.slice(0, 200)}\n\n${text.slice(0, 3500)}`;
  const { decideChoice } = await import('@/lib/mjengo/decide');
  const r = await decideChoice(body, 'What kind of email is this?', {
    personal: 'A person wrote this to the reader and expects a reply or attention.',
    automated: 'A newsletter, receipt, notification, system message or marketing mail.',
    opportunity: 'It announces a funding call, grant, fellowship, tender or partnership opportunity with a deadline.',
  });
  if (r) return { kind: r.choice, confidence: r.probability, by: 'jev' };
  const hay = `${subject}\n${text.slice(0, 3000)}`;
  if (OPP_WORDS.test(hay)) return { kind: 'opportunity', confidence: 0.6, by: 'rules' };
  if (AUTO_WORDS.test(`${from}\n${text.slice(-1500)}`)) return { kind: 'automated', confidence: 0.7, by: 'rules' };
  return { kind: 'personal', confidence: 0.5, by: 'rules' };
}

export interface ProjectLite { id: string; name: string; status: string }

async function listProjects_(): Promise<ProjectLite[]> {
  await requireModule('mail');
  const { data } = await looseAdmin().from('mjengo_projects').select('id, name, status').order('created_at', { ascending: false }).limit(200);
  return (data ?? []) as ProjectLite[];
}

/** The label that stands for a project, made the first time a message is tagged with it. */
async function projectLabel_(projectId: string): Promise<LabelRow> {
  const actor = await requireModule('mail');
  const db = looseAdmin();
  const { data: have } = await db.from('mail_labels').select('id, name, color, instruction, project_id').eq('owner_id', actor.id).eq('project_id', projectId).maybeSingle();
  if (have) return have as LabelRow;
  const { data: proj } = await db.from('mjengo_projects').select('name').eq('id', projectId).maybeSingle();
  if (!proj) throw new Error('That project no longer exists.');
  const { data, error } = await db.from('mail_labels').insert({ owner_id: actor.id, name: String(proj.name).slice(0, 40), color: 'blue', instruction: null, project_id: projectId }).select('id, name, color, instruction, project_id').single();
  if (error || !data) throw new Error('Could not tag the message with that project.');
  return data as LabelRow;
}

export interface GrantLite { id: string; title: string; funder: string | null; link: string | null }

async function listGrantsLite_(): Promise<GrantLite[]> {
  await requireModule('mail');
  const { data } = await looseAdmin().from('mjengo_grants').select('id, title, funder, link').order('created_at', { ascending: false }).limit(200);
  return (data ?? []) as GrantLite[];
}

/**
 * A link found in a tagged email, put where it belongs: as a new opportunity (its details are read from the
 * page), as a new grant, or as the link of a grant that already exists and has none.
 */
async function linkToWork_(target: { kind: 'opportunity' | 'grant'; grantId?: string | null }, url: string, subject: string): Promise<{ kind: 'opportunity' | 'grant'; id: string; title: string }> {
  const actor = await requireModule('mail', 'write');
  let clean: string;
  try { clean = new URL(url).toString(); } catch { throw new Error('That is not a valid web address.'); }
  if (!/^https?:/i.test(clean)) throw new Error('Only web links can be added.');
  const title = subject.replace(/^(re|fwd?):\s*/i, '').trim().slice(0, 140) || 'From an email';
  const db = looseAdmin();
  if (target.kind === 'opportunity') {
    const { data, error } = await db.from('mjengo_opportunities').insert({ title, kind: 'grant', status: 'new', source_url: clean, created_by: actor.id, owner_id: actor.id }).select('id, title').single();
    if (error || !data) throw new Error('Could not add the opportunity.');
    // Fill its empty fields from the page, as when a link is pasted into a new opportunity. Best effort.
    try {
      const { verifyOpportunityRow } = await import('@/lib/mjengo/opportunity-run');
      await verifyOpportunityRow(data.id as string, { url: clean });
    } catch { /* the opportunity still exists with its link */ }
    await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.opportunity.from_mail', targetType: 'opportunity', targetId: data.id, targetLabel: data.title });
    return { kind: 'opportunity', id: data.id as string, title: data.title as string };
  }
  if (target.grantId) {
    const { data: g } = await db.from('mjengo_grants').select('id, title, link').eq('id', target.grantId).maybeSingle();
    if (!g) throw new Error('That grant no longer exists.');
    await db.from('mjengo_grants').update({ link: clean }).eq('id', g.id);
    await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.grant.link_from_mail', targetType: 'grant', targetId: g.id, targetLabel: g.title });
    return { kind: 'grant', id: g.id as string, title: g.title as string };
  }
  const { data, error } = await db.from('mjengo_grants').insert({ title, status: 'idea', link: clean, created_by: actor.id, owner_id: actor.id }).select('id, title').single();
  if (error || !data) throw new Error('Could not add the grant.');
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mjengo.grant.from_mail', targetType: 'grant', targetId: data.id, targetLabel: data.title });
  return { kind: 'grant', id: data.id as string, title: data.title as string };
}

export interface AutoLabelMatch { messageId: string; from: string; subject: string }

/** Which recent messages match a label's rule. Nothing is changed; sender and subject are sent to the AI service. */
async function previewAutoLabel_(accountId: string, mailbox: string, labelId: string): Promise<{ matches: AutoLabelMatch[]; scanned: number }> {
  const actor = await requireModule('mail');
  const { data: label } = await looseAdmin().from('mail_labels').select('id, name, instruction').eq('id', labelId).eq('owner_id', actor.id).maybeSingle();
  if (!label) throw new Error('That label no longer exists.');
  if (!label.instruction) throw new Error('Describe which emails this label is for first.');
  const { items } = await listCore_(accountId, mailbox, {}, 0, 80);
  if (!items.length) return { matches: [], scanned: 0 };
  const lines = items.map((m, i) => `${i}. From: ${m.from.name || ''} <${m.from.address}> | Subject: ${m.subject}`).join('\n');
  const out = await ai(
    'You sort emails. Given a rule and a numbered list of emails, reply with ONLY a JSON array of the numbers of the emails that clearly match the rule. If none match, reply [].',
    `Rule: ${label.instruction}\n\nEmails:\n${lines}`,
    300
  );
  let picked: number[] = [];
  try {
    picked = (JSON.parse(out.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as unknown[]).filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < items.length);
  } catch {
    picked = [];
  }
  const matches = picked.map((i) => items[i]).filter((m) => m.messageId).map((m) => ({ messageId: m.messageId!, from: m.from.name || m.from.address, subject: m.subject }));
  return { matches, scanned: items.length };
}

/**
 * Save the person's review of a preview: accepted messages get the label; rejected ones are written into the
 * label's rule as "not this" examples so future matching improves.
 */
async function confirmAutoLabel_(accountId: string, labelId: string, accept: string[], reject: { from: string; subject: string }[]): Promise<{ applied: number }> {
  const actor = await requireModule('mail', 'write');
  await loadAccount(accountId, actor.id);
  const db = looseAdmin();
  const { data: label } = await db.from('mail_labels').select('id, instruction').eq('id', labelId).eq('owner_id', actor.id).maybeSingle();
  if (!label) throw new Error('That label no longer exists.');
  const rows = accept.slice(0, 200).map((m) => ({ owner_id: actor.id, account_id: accountId, message_id: m, label_id: labelId }));
  if (rows.length) await db.from('mail_message_labels').upsert(rows);
  if (reject.length) {
    const notes = reject.slice(0, 5).map((r) => `Not: "${r.subject.slice(0, 60)}" from ${r.from.slice(0, 40)}`).join('. ');
    const next = `${label.instruction ?? ''}\n${notes}`.trim().slice(-600);
    await db.from('mail_labels').update({ instruction: next }).eq('id', labelId).eq('owner_id', actor.id);
  }
  return { applied: rows.length };
}

/** Apply a label to the recent messages that match its plain-language rule. Sender and subject are sent to the AI service. */
async function autoLabel_(accountId: string, mailbox: string, labelId: string): Promise<{ matched: number; scanned: number }> {
  const actor = await requireModule('mail', 'write');
  const db = looseAdmin();
  const { data: label } = await db.from('mail_labels').select('id, name, instruction').eq('id', labelId).eq('owner_id', actor.id).maybeSingle();
  if (!label) throw new Error('That label no longer exists.');
  if (!label.instruction) throw new Error('Describe which emails this label is for first.');

  const { items } = await listCore_(accountId, mailbox, {}, 0, 80);
  if (!items.length) return { matched: 0, scanned: 0 };
  const lines = items.map((m, i) => `${i}. From: ${m.from.name || ''} <${m.from.address}> | Subject: ${m.subject}`).join('\n');
  const out = await ai(
    'You sort emails. Given a rule and a numbered list of emails, reply with ONLY a JSON array of the numbers of the emails that clearly match the rule. If none match, reply [].',
    `Rule: ${label.instruction}\n\nEmails:\n${lines}`,
    300
  );
  let picked: number[] = [];
  try {
    picked = (JSON.parse(out.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as unknown[]).filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < items.length);
  } catch {
    picked = [];
  }
  const rows = picked.map((i) => items[i]).filter((m) => m.messageId).map((m) => ({ owner_id: actor.id, account_id: accountId, message_id: m.messageId!, label_id: labelId }));
  if (rows.length) await db.from('mail_message_labels').upsert(rows);
  return { matched: rows.length, scanned: items.length };
}

/** Highlight-to-improve in the composer. Only the selected text is sent. */
export type RewriteMode = 'improve' | 'shorter' | 'friendlier' | 'fix' | 'formal' | 'official' | 'warm' | 'persuasive' | 'simpler' | 'longer' | 'revamp';

async function rewriteText_(text: string, mode: RewriteMode): Promise<string> {
  await requireModule('mail');
  const t = text.trim().slice(0, 4000);
  if (!t) throw new Error('Select some text first.');
  const how: Record<typeof mode, string> = {
    improve: 'Improve the clarity and tone while keeping the meaning and the language.',
    shorter: 'Make it shorter and clearer without losing the key points.',
    friendlier: 'Make it warmer and friendlier while staying professional.',
    fix: 'Fix spelling and grammar only. Change nothing else.',
    formal: 'Rewrite in a formal, polite register suitable for a senior contact or a funder. Keep the meaning and the language.',
    official: 'Rewrite as an official letter style message: precise, neutral and structured, with no slang or contractions. Keep the meaning and the language.',
    warm: 'Rewrite with a warm, human, caring tone suitable for a survivor-centred organisation, still clear and professional. Keep the meaning and the language.',
    persuasive: 'Rewrite to be more persuasive and confident, leading with the benefit to the reader, without exaggerating or inventing facts.',
    simpler: 'Rewrite in plain, simple words and short sentences that anyone can follow. Keep the meaning and the language.',
    longer: 'Expand it a little with helpful detail and a clear structure, without inventing facts. Keep the language.',
    revamp: 'Completely revamp it: restructure for clarity, open with the main point, tighten the wording and end with a clear next step. Keep the meaning and the language.',
  };
  const out = await ai(`You edit email text. ${how[mode]} Use blank lines between paragraphs. Reply with only the rewritten text, no quotes or commentary.`, t, 900);
  return out || t;
}

/* ------------------------------------------------------------------ Signature */

export interface SignatureState {
  html: string;
  /** They have saved one (possibly empty on purpose). */
  configured: boolean;
  /** They chose "Not now" on the first-time prompt. */
  dismissed: boolean;
}

async function getSignature_(): Promise<SignatureState> {
  const actor = await requireModule('mail');
  const { data } = await looseAdmin().from('mail_signatures').select('html, prompt_dismissed').eq('owner_id', actor.id).maybeSingle();
  return { html: data?.html ?? '', configured: !!data && (data.html ?? '').length > 0, dismissed: !!data?.prompt_dismissed };
}

async function saveSignature_(html: string): Promise<SignatureState> {
  const actor = await requireModule('mail', 'write');
  const clean = sanitizeHtml(html.slice(0, 30000), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'span', 'h1', 'h2', 'h3', 'div', 'img'],
    allowedAttributes: { a: ['href'], img: ['src', 'alt', 'width', 'height'], span: ['style'], p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'], div: ['style'] },
    allowedStyles: { '*': { color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/], 'text-align': [/^(left|right|center|justify)$/] } },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https'] },
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
  }).trim();
  const isEmpty = !clean.replace(/<(?!img)[^>]+>/g, '').trim();
  const { error } = await looseAdmin().from('mail_signatures').upsert({ owner_id: actor.id, html: isEmpty ? '' : clean, prompt_dismissed: true, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
  if (error) throw new Error('Could not save your signature.');
  return { html: isEmpty ? '' : clean, configured: !isEmpty, dismissed: true };
}

async function dismissSignaturePrompt_() {
  const actor = await requireModule('mail', 'write');
  await looseAdmin().from('mail_signatures').upsert({ owner_id: actor.id, prompt_dismissed: true }, { onConflict: 'owner_id' });
}

/* ---------------------------------------------------------------------- AI */

async function ai(system: string, user: string, maxTokens: number): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('AI is not configured.');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(40_000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Sauti Salama Mail' },
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL ?? 'qwen/qwen3.7-flash', reasoning: { enabled: false }, temperature: 0.4, max_tokens: maxTokens, messages: [{ role: 'system', content: `${system}
${NO_DASH_RULE}` }, { role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error('The AI service is unavailable right now.');
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content?.trim() ?? '';
}

async function bodyText(accountId: string, mailbox: string, uid: number, ownerId: string) {
  const acct = await loadAccount(accountId, ownerId);
  const p = await parseSource(uid, await fetchSource(acct, mailbox, uid), false);
  return { text: (p.text || htmlToText(p.html ?? '')).slice(0, 8000), subject: p.subject, from: p.from[0] };
}

/**
 * The conversation so far as the AI should see it: who wrote each message and in what order, plus how this
 * person themselves has been writing in the thread (greeting, sign-off, paragraph breaks) so a drafted reply
 * is in their voice and shape. Never fails: a thread that cannot be read gives an empty context.
 */
async function threadContext(accountId: string, mailbox: string, uid: number, subject: string, ownerId: string): Promise<{ history: string; voice: string; me: string }> {
  try {
    const acct = await loadAccount(accountId, ownerId);
    const me = acct.email.toLowerCase();
    const t = await getThread_(accountId, mailbox, subject, 8);
    const msgs = t.details
      .filter((d) => d.uid !== uid || d.mailbox !== mailbox)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      .slice(-6);
    const clip = (x: string) => x.replace(/\n>.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 700);
    const history = msgs.map((m) => {
      const a = m.from[0];
      const mine = a?.address?.toLowerCase() === me;
      return `--- ${mine ? 'ME' : a?.name || a?.address || 'Them'}${m.date ? ` (${m.date.slice(0, 10)})` : ''}\n${clip(m.text || htmlToText(m.html ?? ''))}`;
    }).join('\n\n');
    const mineOnly = msgs.filter((m) => m.from[0]?.address?.toLowerCase() === me).slice(-2).map((m) => clip(m.text || htmlToText(m.html ?? ''))).join('\n\n=====\n\n');
    return { history, voice: mineOnly, me: acct.email };
  } catch {
    return { history: '', voice: '', me: '' };
  }
}

/** Two or three sentences at the top of a long thread. Sent to the AI service only when asked. */
async function summariseMessage_(accountId: string, mailbox: string, uid: number): Promise<string> {
  const actor = await requireModule('mail');
  const { text, subject } = await bodyText(accountId, mailbox, uid, actor.id);
  return ai('Summarise the email in at most three short sentences. Plain text. Say what is being asked and any deadline. Do not invent details.', `Subject: ${subject}\n\n${text}`, 160);
}

async function draftReply_(accountId: string, mailbox: string, uid: number, instruction: string): Promise<string> {
  const actor = await requireModule('mail', 'write');
  const { text, subject, from } = await bodyText(accountId, mailbox, uid, actor.id);
  const ctx = await threadContext(accountId, mailbox, uid, subject, actor.id);
  const out = await ai(
    'You write email replies for the team at Sauti Salama, a survivor-led GBV support organisation in Kenya. You write as ME, the person replying, to the person who sent the latest email. Use the earlier messages to know who is who, what has already been said and what is still open: do not repeat answered points and do not greet someone who is only copied. If ME wrote earlier in the thread, copy ME\'s way of writing: the same kind of greeting, the same level of formality, the same paragraph length and blank lines between paragraphs, the same closing line. Write only the body of the reply in the language of the latest email. No subject line, no placeholders, no sign-off name. Do not invent facts.',
    `Reply to ${from?.name || from?.address || 'the sender'} about "${subject}".\nInstruction: ${instruction || 'Reply helpfully and briefly.'}\n${ctx.voice ? `\nHow ME has written in this thread (copy the shape, not the content):\n${ctx.voice}\n` : ''}${ctx.history ? `\nEarlier in the conversation:\n${ctx.history}\n` : ''}\nLatest email to answer:\n${text}`,
    600
  );
  return out
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export interface ReplySuggestion {
  label: string;
  /** Markdown-lite (bold, bullets) where the content calls for it; the composer turns it into formatting. */
  body: string;
  /** Who the reply goes to and which of the person's accounts it goes from, so nothing is left to fill in. */
  to: string[];
  cc: string[];
  fromAccountId: string;
}

/** Three replies that fit the email: the sender's language and tone, the writer's own voice, formatted where it helps. */
async function suggestReplies_(accountId: string, mailbox: string, uid: number): Promise<ReplySuggestion[]> {
  const actor = await requireModule('mail', 'write');
  const acct = await loadAccount(accountId, actor.id);
  const { text, subject, from } = await bodyText(accountId, mailbox, uid, actor.id);
  const ctx = await threadContext(accountId, mailbox, uid, subject, actor.id);
  // Where the reply goes, and from which account: the one the email was sent to, when that is one of theirs.
  const detail = await getMessageDetail_(accountId, mailbox, uid, false).catch(() => null);
  const mine = (await looseAdmin().from('mail_accounts').select('id, email').eq('owner_id', actor.id)).data as { id: string; email: string }[] | null;
  const own = new Set((mine ?? []).map((a) => a.email.toLowerCase()));
  const sentTo = [...(detail?.to ?? []), ...(detail?.cc ?? [])].map((a) => a.address.toLowerCase());
  const fromAccountId = (mine ?? []).find((a) => sentTo.includes(a.email.toLowerCase()))?.id ?? accountId;
  const sender = from?.address && !own.has(from.address.toLowerCase()) ? from.address : detail?.to?.find((a) => !own.has(a.address.toLowerCase()))?.address ?? from?.address ?? '';
  const to = sender ? [sender] : [];
  const cc: string[] = [];
  const raw = await ai(
    'You suggest replies for the team at Sauti Salama, a survivor-led GBV support organisation in Kenya. Each reply is written as ME to the person who sent the latest email. The earlier messages (when given) show what has been settled, so suggest only what moves things on. Write it as ME would: copy the greeting of ME, level of formality, paragraph length and closing line when ME wrote earlier in the thread; otherwise greet the sender by first name and match their tone and language. Reply with one JSON object {"replies":[{"label": string, "body": string}]} with exactly three different replies. "label" is two to four words naming the intent (for example Confirm, Ask for details, Decline politely). "body" is the whole email text from greeting to closing line, without a subject, without the name of ME after the closing and without placeholders. Keep it as short as the email deserves: two or three sentences for a simple one, more only when there is more to answer. Where the email asks several things, lists dates, documents or steps, use Markdown: **bold** for the key dates, names or asks and "- " bullets for lists, with a blank line between paragraphs. Plain prose otherwise. Never invent facts, dates or commitments.',
    [ctx.voice ? `How ME has written in this thread (copy the shape, not the content):\n${ctx.voice}` : '', ctx.history ? `Earlier in the conversation:\n${ctx.history}` : '', `From ${from?.name || from?.address || 'the sender'}, subject "${subject}":\n${text.slice(0, 5000)}`].filter(Boolean).join('\n\n'),
    1100
  );
  void acct;
  try {
    const j = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { replies?: { label?: string; body?: string }[] };
    return (j.replies ?? []).filter((r) => r.body).slice(0, 3).map((r) => ({ label: String(r.label ?? 'Reply').slice(0, 40), body: String(r.body).slice(0, 2000), to, cc, fromAccountId }));
  } catch {
    return [];
  }
}

/* Exported actions return { ok, data | error } so the message survives production builds. */
export const listAccounts = guard(listAccounts_);
export const oauthAvailability = guard(oauthAvailability_);
export const addAccount = guard(addAccount_);
export const removeAccount = guard(removeAccount_);
export const getMailboxes = guard(getMailboxes_);
export const listMessages = guard(listMessages_);
/**
 * Several messages in one connection, without marking them read: used to have the next messages ready
 * so that switching between emails is instant.
 */
async function getMessageDetails_(accountId: string, mailbox: string, uids: number[]): Promise<(ParsedMessage & { seen: boolean; flagged: boolean })[]> {
  const actor = await requireModule('mail');
  const acct = await loadAccount(accountId, actor.id);
  const list = uids.slice(0, 12);
  if (!list.length || acct.protocol === 'pop3') return [];
  return withImap(acct, async (c) => {
    const lock = await c.getMailboxLock(mailbox);
    try {
      const out: (ParsedMessage & { seen: boolean; flagged: boolean })[] = [];
      for await (const msg of c.fetch(list.join(','), { uid: true, source: true, flags: true }, { uid: true })) {
        if (!msg.source) continue;
        try {
          const parsed = await parseSource(msg.uid, msg.source, true);
          out.push({ ...parsed, seen: msg.flags?.has('\Seen') ?? false, flagged: msg.flags?.has('\Flagged') ?? false });
        } catch { /* skip one that will not parse */ }
      }
      return out;
    } finally {
      lock.release();
    }
  });
}

export const getMessageDetail = guard(getMessageDetail_);
export const getMessageDetails = guard(getMessageDetails_);
export const getConversation = guard(getConversation_);
export const getThread = guard(getThread_);
export const actOnMessages = guard(actOnMessages_);
export const sendMail = guard(sendMail_);
export const listViews = guard(listViews_);
export const saveView = guard(saveView_);
export const deleteView = guard(deleteView_);
export const listSnippets = guard(listSnippets_);
export const saveSnippet = guard(saveSnippet_);
export const deleteSnippet = guard(deleteSnippet_);
export const summariseMessage = guard(summariseMessage_);
export const draftReply = guard(draftReply_);
export const suggestReplies = guard(suggestReplies_);
export const listLabels = guard(listLabels_);
export const mailTriage = guard(triage_);
export const listMailProjects = guard(listProjects_);
export const projectLabel = guard(projectLabel_);
export const listGrantsLite = guard(listGrantsLite_);
export const linkToWork = guard(linkToWork_);
export const saveLabel = guard(saveLabel_);
export const deleteLabel = guard(deleteLabel_);
export const setMessageLabel = guard(setMessageLabel_);
export const autoLabel = guard(autoLabel_);
export const previewAutoLabel = guard(previewAutoLabel_);
export const confirmAutoLabel = guard(confirmAutoLabel_);
export const rewriteText = guard(rewriteText_);
export const getSignature = guard(getSignature_);
export const saveSignature = guard(saveSignature_);
export const dismissSignaturePrompt = guard(dismissSignaturePrompt_);
export const detectMailbox = guard(detectMailbox_);
export const getMailPrefs = guard(getPrefs_);
export const saveMailPrefs = guard(savePrefs_);
export const getAccountServers = guard(getServers_);
export const updateAccountServers = guard(updateServers_);

/** Everything the mail screen needs to start, in one round trip (server actions run one at a time). */
async function mailBootstrap_() {
  await requireModule('mail');
  const [accounts, views, snippets, labels, signature, projects] = await Promise.all([listAccounts_(), listViews_(), listSnippets_(), listLabels_(), getSignature_().catch(() => null), listProjects_().catch(() => [] as ProjectLite[])]);
  return { accounts, views, snippets, labels, signature, projects };
}
export const mailBootstrap = guard(mailBootstrap_);

/* ------------------------------------------------------- The sorted inbox */

export type MailBucket = 'inbox' | 'subscription' | 'receipt' | 'update';
export interface PendingItem { key: string; account: string; accountEmail: string; mailbox: string; uid: number; from: string; subject: string; date: string | null }
export interface SortedList {
  items: MessageRow[];
  total: number;
  /** Unread messages waiting under each label. */
  counts: Record<'subscription' | 'receipt' | 'update', number>;
  /** Payments waiting to be made or fixed, not dismissed. */
  pending: PendingItem[];
  /** Mailboxes that could not be reached just now. */
  failed: string[];
}

const kindCache = new Map<string, MailKind>();

/** Senders the rules could not place are asked to Jev once each (then remembered); the rules stand if it is unsure. */
async function refineKinds(items: MessageRow[]): Promise<void> {
  const unsure = items.filter((i) => i.sure === false && i.kind === 'person');
  for (const i of unsure) { const k = kindCache.get(i.from.address.toLowerCase()); if (k) { i.kind = k; i.sure = true; } }
  const todo = [...new Map(unsure.filter((i) => i.sure === false).map((i) => [i.from.address.toLowerCase(), i])).values()].slice(0, 8);
  if (!todo.length) return;
  const { decideChoice, decideConfigured } = await import('@/lib/mjengo/decide');
  if (!decideConfigured()) return;
  const options = {
    person: 'A real person wrote this to the reader and expects a reply or action.',
    subscription: 'A newsletter, promotion, marketing or mailing-list message sent to many people.',
    receipt: 'A receipt, invoice, order, booking or payment confirmation.',
    update: 'An automated notification, alert, verification code or system message.',
  } as const;
  await Promise.race([
    Promise.all(todo.map(async (i) => {
      const r = await decideChoice(`From: ${i.from.name} <${i.from.address}>\nSubject: ${i.subject}`, 'What kind of email is this?', options);
      if (r && r.probability >= 0.75) kindCache.set(i.from.address.toLowerCase(), r.choice);
    })),
    new Promise((res) => setTimeout(res, 2500)),
  ]);
  for (const i of unsure) { const k = kindCache.get(i.from.address.toLowerCase()); if (k) { i.kind = k; i.sure = true; } }
}

/**
 * The inbox of one mailbox, or of all of them mixed (accountId 'all'), with only the mail that needs a person in it.
 * Subscriptions, receipts and automated updates are left out and counted instead, and payments that are waiting are
 * listed as pending items. Anything starred, replied to or labelled stays, since it has been acted on.
 */
async function listSorted_(accountId: string | 'all', bucket: MailBucket, query: ListQuery = {}, offset = 0, limit = 40): Promise<SortedList> {
  const actor = await requireModule('mail');
  const db = looseAdmin();
  const { data: accts } = await db.from('mail_accounts').select('id, label, email').eq('owner_id', actor.id).order('created_at');
  const accounts = ((accts ?? []) as { id: string; label: string; email: string }[]).filter((a) => accountId === 'all' || a.id === accountId);
  const window = Math.min(400, (offset + limit) * 3);
  const failed: string[] = [];
  const all: MessageRow[] = [];
  await Promise.all(accounts.map(async (a) => {
    // One slow or broken mailbox must not hold up the others; a dropped connection is tried once more.
    let why = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await Promise.race([
          listMessages_(a.id, 'INBOX', { unread: query.unread, starred: query.starred, hasAttachment: query.hasAttachment }, 0, window),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('The mail server took too long to answer.')), 20_000)),
        ]);
        for (const r of res.items) {
          const s = sortMessage(r);
          all.push({ ...r, account: a.id, accountEmail: a.email, accountScope: scopeOf(a.email), kind: s.kind, sure: s.sure });
        }
        why = '';
        break;
      } catch (e) {
        why = e instanceof Error ? e.message : 'unknown error';
        if (/renewed|rejected the sign-in|Reconnect/i.test(why)) break; // retrying will not help
      }
    }
    if (why) { console.error('[mail] could not list', a.email, why); failed.push(`${a.email} (${why.replace(/\.$/, '').slice(0, 140)})`); }
  }));
  all.sort((x, y) => (y.date ? Date.parse(y.date) : 0) - (x.date ? Date.parse(x.date) : 0));
  const page = all.filter((r) => (bucket === 'inbox' ? r.kind === 'person' || r.kind === 'payment' && (r.flagged || r.labels.length) : r.kind === bucket));
  const head = page.slice(offset, offset + limit);
  await refineKinds(head);
  const keep = bucket === 'inbox' ? head.filter((r) => r.kind === 'person' || r.kind === 'payment') : head.filter((r) => r.kind === bucket);
  const counts = { subscription: 0, receipt: 0, update: 0 };
  for (const r of all) if (!r.seen && (r.kind === 'subscription' || r.kind === 'receipt' || r.kind === 'update')) counts[r.kind]++;

  const { data: gone } = await db.from('mail_dismissed').select('item_key').eq('owner_id', actor.id);
  const dismissed = new Set((gone ?? []).map((g: { item_key: string }) => g.item_key));
  const month = Date.now() - 45 * 86400000;
  const pending: PendingItem[] = [];
  for (const r of all) {
    if (r.kind !== 'payment' || r.answered || r.flagged || r.labels.length || !r.date || Date.parse(r.date) < month) continue;
    const key = `${r.account}:${r.messageId ?? r.uid}`;
    if (dismissed.has(key)) continue;
    pending.push({ key, account: r.account!, accountEmail: r.accountEmail!, mailbox: r.mailbox, uid: r.uid, from: r.from.name || r.from.address, subject: r.subject, date: r.date });
    if (pending.length >= 8) break;
  }
  return { items: keep, total: page.length, counts, pending: bucket === 'inbox' ? pending : [], failed };
}

async function dismissPending_(key: string): Promise<void> {
  const actor = await requireModule('mail', 'write');
  await looseAdmin().from('mail_dismissed').upsert({ owner_id: actor.id, item_key: key.slice(0, 300) }, { onConflict: 'owner_id,item_key' });
}

export const listSorted = guard(listSorted_);
export const dismissPending = guard(dismissPending_);

/* ------------------------------------------------------------- New-mail alerts */

export interface NotifyState { all: boolean; accounts: { id: string; notify: boolean }[] }

async function getNotify_(): Promise<NotifyState> {
  const actor = await requireModule('mail');
  const db = looseAdmin();
  const [{ data: pref }, { data: accts }] = await Promise.all([
    db.from('mail_preferences').select('notify_all').eq('owner_id', actor.id).maybeSingle(),
    db.from('mail_accounts').select('id, notify').eq('owner_id', actor.id).order('created_at'),
  ]);
  return { all: pref?.notify_all !== false, accounts: ((accts ?? []) as { id: string; notify: boolean }[]).map((a) => ({ id: a.id, notify: a.notify !== false })) };
}

/** Turn alerts on or off for every mailbox (accountId omitted) or for one. */
async function setNotify_(accountId: string | null, on: boolean): Promise<NotifyState> {
  const actor = await requireModule('mail', 'write');
  const db = looseAdmin();
  if (accountId) await db.from('mail_accounts').update({ notify: on, ...(on ? { notify_uid: null } : {}) }).eq('id', accountId).eq('owner_id', actor.id);
  else await db.from('mail_preferences').upsert({ owner_id: actor.id, notify_all: on }, { onConflict: 'owner_id' });
  return getNotify_();
}

/** Called by the open mail page every minute: mail that has arrived since the last look, to show as a toast. */
async function checkNewMail_(): Promise<import('@/lib/mail/watch').NewMail[]> {
  const actor = await requireModule('mail');
  await looseAdmin().from('mail_preferences').upsert({ owner_id: actor.id, app_seen_at: new Date().toISOString() }, { onConflict: 'owner_id' });
  const { newMailFor } = await import('@/lib/mail/watch');
  return newMailFor(actor.id);
}

export const getNotify = guard(getNotify_);
export const setNotify = guard(setNotify_);
export const checkNewMail = guard(checkNewMail_);
