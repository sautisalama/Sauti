'use server';

import MailComposer from 'nodemailer/lib/mail-composer';
import { looseAdmin } from '@/lib/loose-db';
import { encryptField } from '@/lib/security/crypto';
import { logAudit } from '@/lib/access/audit';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import {
  PRESETS, classify, explain, loadAccount, normaliseSubject, parseSource, pathOf, testImap, transporter, verifySmtp, withImap,
  type Address, type MailboxInfo, type ParsedMessage,
} from '@/lib/mail/client';

/* ---------------------------------------------------------------- Accounts */

export interface AccountView {
  id: string;
  label: string;
  email: string;
}

async function listAccounts_(): Promise<AccountView[]> {
  const actor = await requireAdminActor();
  const { data } = await looseAdmin().from('mail_accounts').select('id, label, email').eq('owner_id', actor.id).order('created_at');
  return (data ?? []) as AccountView[];
}

export interface AddAccountInput {
  preset: keyof typeof PRESETS | 'custom';
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
  const actor = await requireAdminActor();
  const email = (input.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!input.password) throw new Error('Enter the password (or app password).');

  const p = input.preset !== 'custom' ? PRESETS[input.preset] : null;
  const imapHost = p ? p.imap[0] : (input.imapHost ?? '').trim();
  const smtpHost = p ? p.smtp[0] : (input.smtpHost ?? '').trim();
  if (!imapHost || !smtpHost) throw new Error('Enter the mail server names.');
  const imapPort = p ? p.imap[1] : input.imapPort || 993;
  const smtpPort = p ? p.smtp[1] : input.smtpPort || 465;
  const row = {
    imap_host: imapHost,
    imap_port: imapPort,
    imap_secure: p ? p.imap[2] : imapPort === 993,
    smtp_host: smtpHost,
    smtp_port: smtpPort,
    smtp_secure: p ? p.smtp[2] : smtpPort === 465,
    username: (input.username || email).trim(),
  };

  // Prove both directions work before saving anything.
  try {
    await testImap(row, input.password);
  } catch (e) {
    throw new Error(explain(e));
  }
  try {
    await verifySmtp(row, input.password);
  } catch (e) {
    throw new Error('Reading mail works, but sending does not: ' + explain(e));
  }

  const enc = encryptField(input.password);
  if (!enc) throw new Error('Could not secure the password.');
  const { data, error } = await looseAdmin()
    .from('mail_accounts')
    .upsert({ owner_id: actor.id, label: (input.label || email).trim().slice(0, 60), email, password_enc: enc, ...row }, { onConflict: 'owner_id,email' })
    .select('id, label, email')
    .single();
  if (error || !data) throw new Error('Could not save the mailbox.');
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mail.account_connected', targetType: 'mailbox', targetId: data.id, targetLabel: email });
  return data as AccountView;
}

async function removeAccount_(id: string) {
  const actor = await requireAdminActor();
  const { data } = await looseAdmin().from('mail_accounts').delete().eq('id', id).eq('owner_id', actor.id).select('email').maybeSingle();
  if (data) await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mail.account_removed', targetType: 'mailbox', targetId: id, targetLabel: data.email });
}

/* --------------------------------------------------------------- Mailboxes */

async function getMailboxes_(accountId: string): Promise<{ boxes: MailboxInfo[]; unread: number }> {
  const actor = await requireAdminActor();
  const acct = await loadAccount(accountId, actor.id);
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
  /** Messages in this list that share the subject. */
  thread: number;
}

export interface ListQuery {
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
  from?: string;
  text?: string;
}

function hasAttachment(node: { disposition?: string; childNodes?: unknown[] } | undefined): boolean {
  if (!node) return false;
  if (node.disposition === 'attachment') return true;
  return (node.childNodes ?? []).some((n) => hasAttachment(n as { disposition?: string; childNodes?: unknown[] }));
}

async function listMessages_(accountId: string, mailbox: string, query: ListQuery = {}, offset = 0, limit = 40): Promise<{ items: MessageRow[]; total: number }> {
  const actor = await requireAdminActor();
  const acct = await loadAccount(accountId, actor.id);
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
      for await (const m of c.fetch(range, { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true }, { uid: useUid })) {
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
          thread: 1,
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

async function getMessageDetail_(accountId: string, mailbox: string, uid: number, allowImages = false): Promise<ParsedMessage & { seen: boolean; flagged: boolean }> {
  const actor = await requireAdminActor();
  const acct = await loadAccount(accountId, actor.id);
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
  const actor = await requireAdminActor();
  const acct = await loadAccount(accountId, actor.id);
  const key = normaliseSubject(subject);
  if (!key) return [];
  return withImap(acct, async (c) => {
    const lock = await c.getMailboxLock(mailbox);
    try {
      const uids = ((await c.search({ subject: key }, { uid: true })) || []).sort((a, b) => b - a).slice(0, 15);
      if (!uids.length) return [];
      const out: MessageRow[] = [];
      for await (const m of c.fetch(uids.join(','), { uid: true, envelope: true, flags: true, internalDate: true }, { uid: true })) {
        const f = m.envelope?.from?.[0];
        out.push({ uid: m.uid, mailbox, from: { name: f?.name || '', address: f?.address || '' }, subject: m.envelope?.subject || '', date: m.envelope?.date ? new Date(m.envelope.date).toISOString() : null, seen: m.flags?.has('\\Seen') ?? false, flagged: m.flags?.has('\\Flagged') ?? false, hasAttachments: false, thread: 1 });
      }
      return out.filter((m) => normaliseSubject(m.subject) === key).sort((a, b) => b.uid - a.uid);
    } finally {
      lock.release();
    }
  });
}

export type MailAction = 'archive' | 'trash' | 'spam' | 'read' | 'unread' | 'star' | 'unstar' | 'delete';

async function actOnMessages_(accountId: string, mailbox: string, uids: number[], action: MailAction) {
  const actor = await requireAdminActor();
  const acct = await loadAccount(accountId, actor.id);
  if (!uids.length) return;
  const set = uids.slice(0, 200).join(',');
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
}

const emailOk = (e: string) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e);

const htmlToText = (html: string) =>
  html.replace(/<(br|\/p|\/div|\/h[1-6]|\/li)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();

async function sendMail_(input: SendInput) {
  const actor = await requireAdminActor();
  const acct = await loadAccount(input.accountId, actor.id);
  const to = input.to.map((e) => e.trim()).filter(Boolean);
  const cc = (input.cc ?? []).map((e) => e.trim()).filter(Boolean);
  const bcc = (input.bcc ?? []).map((e) => e.trim()).filter(Boolean);
  if (!to.length) throw new Error('Add at least one recipient.');
  const bad = [...to, ...cc, ...bcc].find((e) => !emailOk(e));
  if (bad) throw new Error(`"${bad}" is not a valid email address.`);
  const attachments = (input.attachments ?? []).slice(0, 10).map((a) => ({ filename: a.filename.slice(0, 200), content: Buffer.from(a.contentBase64, 'base64'), contentType: a.contentType }));
  if (attachments.reduce((n, a) => n + a.content.length, 0) > 18 * 1024 * 1024) throw new Error('Attachments are too large (18 MB total).');

  const mail = {
    from: acct.email,
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject: input.subject.trim() || '(no subject)',
    html: input.html,
    text: htmlToText(input.html),
    inReplyTo: input.inReplyTo || undefined,
    references: input.references?.length ? input.references : undefined,
    attachments,
  };
  const raw = await new MailComposer(mail).compile().build();
  try {
    await transporter(acct).sendMail({ envelope: { from: acct.email, to: [...to, ...cc, ...bcc] }, raw });
  } catch (e) {
    throw new Error('The message was not sent. ' + explain(e));
  }

  // Gmail and Microsoft keep a copy in Sent by themselves; others need us to file it.
  if (!/gmail|googlemail|office365|outlook/i.test(acct.smtp_host)) {
    await withImap(acct, async (c) => {
      const sent = pathOf(classify(await c.list()), 'sent');
      if (sent) await c.append(sent, raw, ['\\Seen']);
    }).catch(() => undefined);
  }
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mail.sent', targetType: 'mailbox', targetId: acct.id, targetLabel: acct.email, details: { to, subject: mail.subject.slice(0, 120), attachments: attachments.length } });
  return { success: true };
}

/* ----------------------------------------------------------- Views, snippets */

export interface ViewConfig {
  mailbox: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive';
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
  from?: string;
  group?: 'date' | 'sender' | 'none';
  hoverActions?: ('archive' | 'trash' | 'unread' | 'star' | 'reply')[];
}

export interface ViewRow {
  id: string;
  name: string;
  icon: string;
  config: ViewConfig;
}

async function listViews_(): Promise<ViewRow[]> {
  const actor = await requireAdminActor();
  const { data } = await looseAdmin().from('mail_views').select('id, name, icon, config').eq('owner_id', actor.id).order('position').order('created_at');
  return (data ?? []) as ViewRow[];
}

async function saveView_(id: string | null, v: { name: string; icon?: string; config: ViewConfig }): Promise<ViewRow> {
  const actor = await requireAdminActor();
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
  const actor = await requireAdminActor();
  await looseAdmin().from('mail_views').delete().eq('id', id).eq('owner_id', actor.id);
}

export interface SnippetRow {
  id: string;
  name: string;
  body_html: string;
}

async function listSnippets_(): Promise<SnippetRow[]> {
  const actor = await requireAdminActor();
  const { data } = await looseAdmin().from('mail_snippets').select('id, name, body_html').eq('owner_id', actor.id).order('name');
  return (data ?? []) as SnippetRow[];
}

async function saveSnippet_(id: string | null, name: string, bodyHtml: string): Promise<SnippetRow> {
  const actor = await requireAdminActor();
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
  const actor = await requireAdminActor();
  await looseAdmin().from('mail_snippets').delete().eq('id', id).eq('owner_id', actor.id);
}

/* ---------------------------------------------------------------------- AI */

async function ai(system: string, user: string, maxTokens: number): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('AI is not configured.');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(40_000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Sauti Salama Mail' },
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash-lite', temperature: 0.4, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error('The AI service is unavailable right now.');
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content?.trim() ?? '';
}

async function bodyText(accountId: string, mailbox: string, uid: number, ownerId: string) {
  const acct = await loadAccount(accountId, ownerId);
  return withImap(acct, async (c) => {
    const lock = await c.getMailboxLock(mailbox);
    try {
      const m = await c.fetchOne(String(uid), { source: true }, { uid: true });
      if (!m || !m.source) throw new Error('That message is no longer there.');
      const p = await parseSource(uid, m.source, false);
      return { text: (p.text || htmlToText(p.html ?? '')).slice(0, 8000), subject: p.subject, from: p.from[0] };
    } finally {
      lock.release();
    }
  });
}

/** Two or three sentences at the top of a long thread. Sent to the AI service only when asked. */
async function summariseMessage_(accountId: string, mailbox: string, uid: number): Promise<string> {
  const actor = await requireAdminActor();
  const { text, subject } = await bodyText(accountId, mailbox, uid, actor.id);
  return ai('Summarise the email in at most three short sentences. Plain text. Say what is being asked and any deadline. Do not invent details.', `Subject: ${subject}\n\n${text}`, 160);
}

async function draftReply_(accountId: string, mailbox: string, uid: number, instruction: string): Promise<string> {
  const actor = await requireAdminActor();
  const { text, subject, from } = await bodyText(accountId, mailbox, uid, actor.id);
  const out = await ai(
    'You write email replies for the team at Sauti Salama, a survivor-led GBV support organisation in Kenya. Write only the body of the reply: warm, clear and brief, in the language of the email. No subject line, no placeholders, no sign-off name. Do not invent facts.',
    `Reply to ${from?.name || from?.address || 'the sender'} about "${subject}".\nInstruction: ${instruction || 'Reply helpfully and briefly.'}\n\nTheir email:\n${text}`,
    500
  );
  return out
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/* Exported actions return { ok, data | error } so the message survives production builds. */
export const listAccounts = guard(listAccounts_);
export const addAccount = guard(addAccount_);
export const removeAccount = guard(removeAccount_);
export const getMailboxes = guard(getMailboxes_);
export const listMessages = guard(listMessages_);
export const getMessageDetail = guard(getMessageDetail_);
export const getConversation = guard(getConversation_);
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
