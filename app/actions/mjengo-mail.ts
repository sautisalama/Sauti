'use server';

import MailComposer from 'nodemailer/lib/mail-composer';
import { looseAdmin } from '@/lib/loose-db';
import { encryptField } from '@/lib/security/crypto';
import { logAudit } from '@/lib/access/audit';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
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
import { touchContacts } from '@/lib/mjengo-contacts';
import { atLeast, levelFor, loadIndex, oversightFor, recipientLevels } from '@/lib/vault/access';

/** Which one-click sign-ins this deployment has credentials for. */
async function oauthAvailability_() {
  await requireAdminActor();
  return { google: oauthConfigured('google'), microsoft: oauthConfigured('microsoft'), myEmail: (await requireAdminActor()).email };
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
  const actor = await requireAdminActor();
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
  const actor = await requireAdminActor();
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
  const actor = await requireAdminActor();
  const { data } = await looseAdmin().from('mail_accounts').delete().eq('id', id).eq('owner_id', actor.id).select('email').maybeSingle();
  if (data) await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'mail.account_removed', targetType: 'mailbox', targetId: id, targetLabel: data.email });
}

/** From an email address alone: which provider, and which servers if it is a password mailbox. */
async function detectMailbox_(email: string): Promise<Detected & { oauthReady: boolean }> {
  await requireAdminActor();
  const d = await detect(email);
  return { ...d, oauthReady: d.kind === 'google' || d.kind === 'microsoft' ? oauthConfigured(d.kind) : false };
}

/* --------------------------------------------------------------- Mailboxes */

async function getMailboxes_(accountId: string): Promise<{ boxes: MailboxInfo[]; unread: number }> {
  const actor = await requireAdminActor();
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
  const actor = await requireAdminActor();
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
  const actor = await requireAdminActor();
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
          messageId: m.envelope?.messageId ?? null,
          labels: [],
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

async function getMessageDetail_(accountId: string, mailbox: string, uid: number, allowImages = true): Promise<ParsedMessage & { seen: boolean; flagged: boolean }> {
  const actor = await requireAdminActor();
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
  const actor = await requireAdminActor();
  const acct = await loadAccount(accountId, actor.id);
  const key = normaliseSubject(subject);
  if (!key || acct.protocol === 'pop3') return [];
  return withImap(acct, async (c) => {
    const lock = await c.getMailboxLock(mailbox);
    try {
      const uids = ((await c.search({ subject: key }, { uid: true })) || []).sort((a, b) => b - a).slice(0, 15);
      if (!uids.length) return [];
      const out: MessageRow[] = [];
      for await (const m of c.fetch(uids.join(','), { uid: true, envelope: true, flags: true, internalDate: true }, { uid: true })) {
        const f = m.envelope?.from?.[0];
        out.push({ uid: m.uid, mailbox, from: { name: f?.name || '', address: f?.address || '' }, subject: m.envelope?.subject || '', date: m.envelope?.date ? new Date(m.envelope.date).toISOString() : null, seen: m.flags?.has('\\Seen') ?? false, flagged: m.flags?.has('\\Flagged') ?? false, hasAttachments: false, messageId: m.envelope?.messageId ?? null, labels: [], thread: 1 });
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
  const actor = await requireAdminActor();
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

/* ------------------------------------------------------------------ Labels */

export interface LabelRow {
  id: string;
  name: string;
  color: string;
  instruction: string | null;
}

async function listLabels_(): Promise<LabelRow[]> {
  const actor = await requireAdminActor();
  const { data } = await looseAdmin().from('mail_labels').select('id, name, color, instruction').eq('owner_id', actor.id).order('created_at');
  return (data ?? []) as LabelRow[];
}

async function saveLabel_(id: string | null, v: { name: string; color?: string; instruction?: string | null }): Promise<LabelRow> {
  const actor = await requireAdminActor();
  const name = v.name.trim().slice(0, 40);
  if (!name) throw new Error('Name the label.');
  const row = { name, color: v.color || 'purple', instruction: v.instruction?.trim().slice(0, 600) || null };
  const db = looseAdmin();
  const q = id ? db.from('mail_labels').update(row).eq('id', id).eq('owner_id', actor.id) : db.from('mail_labels').insert({ ...row, owner_id: actor.id });
  const { data, error } = await q.select('id, name, color, instruction').single();
  if (error || !data) throw new Error('Could not save the label.');
  return data as LabelRow;
}

async function deleteLabel_(id: string) {
  const actor = await requireAdminActor();
  await looseAdmin().from('mail_labels').delete().eq('id', id).eq('owner_id', actor.id);
}

async function setMessageLabel_(accountId: string, messageId: string, labelId: string, on: boolean) {
  const actor = await requireAdminActor();
  await loadAccount(accountId, actor.id);
  const db = looseAdmin();
  const { data: label } = await db.from('mail_labels').select('id').eq('id', labelId).eq('owner_id', actor.id).maybeSingle();
  if (!label) throw new Error('That label no longer exists.');
  if (on) await db.from('mail_message_labels').upsert({ owner_id: actor.id, account_id: accountId, message_id: messageId, label_id: labelId });
  else await db.from('mail_message_labels').delete().eq('account_id', accountId).eq('message_id', messageId).eq('label_id', labelId).eq('owner_id', actor.id);
}

export interface AutoLabelMatch { messageId: string; from: string; subject: string }

/** Which recent messages match a label's rule. Nothing is changed; sender and subject are sent to the AI service. */
async function previewAutoLabel_(accountId: string, mailbox: string, labelId: string): Promise<{ matches: AutoLabelMatch[]; scanned: number }> {
  const actor = await requireAdminActor();
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
  const actor = await requireAdminActor();
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
  const actor = await requireAdminActor();
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
async function rewriteText_(text: string, mode: 'improve' | 'shorter' | 'friendlier' | 'fix'): Promise<string> {
  await requireAdminActor();
  const t = text.trim().slice(0, 4000);
  if (!t) throw new Error('Select some text first.');
  const how: Record<typeof mode, string> = {
    improve: 'Improve the clarity and tone while keeping the meaning and the language.',
    shorter: 'Make it shorter and clearer without losing the key points.',
    friendlier: 'Make it warmer and friendlier while staying professional.',
    fix: 'Fix spelling and grammar only. Change nothing else.',
  };
  const out = await ai(`You edit email text. ${how[mode]} Reply with only the rewritten text, no quotes or commentary.`, t, 600);
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
  const actor = await requireAdminActor();
  const { data } = await looseAdmin().from('mail_signatures').select('html, prompt_dismissed').eq('owner_id', actor.id).maybeSingle();
  return { html: data?.html ?? '', configured: !!data && (data.html ?? '').length > 0, dismissed: !!data?.prompt_dismissed };
}

async function saveSignature_(html: string): Promise<SignatureState> {
  const actor = await requireAdminActor();
  const clean = sanitizeHtml(html.slice(0, 8000), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'span'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
  }).trim();
  const isEmpty = !clean.replace(/<[^>]+>/g, '').trim();
  const { error } = await looseAdmin().from('mail_signatures').upsert({ owner_id: actor.id, html: isEmpty ? '' : clean, prompt_dismissed: true, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
  if (error) throw new Error('Could not save your signature.');
  return { html: isEmpty ? '' : clean, configured: !isEmpty, dismissed: true };
}

async function dismissSignaturePrompt_() {
  const actor = await requireAdminActor();
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
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash-lite', temperature: 0.4, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
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
export const oauthAvailability = guard(oauthAvailability_);
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
export const listLabels = guard(listLabels_);
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

/** Everything the mail screen needs to start, in one round trip (server actions run one at a time). */
async function mailBootstrap_() {
  await requireAdminActor();
  const [accounts, views, snippets, labels, signature] = await Promise.all([listAccounts_(), listViews_(), listSnippets_(), listLabels_(), getSignature_().catch(() => null)]);
  return { accounts, views, snippets, labels, signature };
}
export const mailBootstrap = guard(mailBootstrap_);
