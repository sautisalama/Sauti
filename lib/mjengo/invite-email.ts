import { sendEmail } from '@/lib/notifications/email';

export type InviteKind = 'meeting' | 'event' | 'document' | 'folder' | 'form' | 'contact' | 'grant' | 'project' | 'opportunity' | 'fellowship' | 'file';

const WORDS: Record<InviteKind, { noun: string; verb: string }> = {
  meeting: { noun: 'meeting', verb: 'invited you to' },
  event: { noun: 'event', verb: 'invited you to an event' },
  document: { noun: 'document', verb: 'shared a document with you:' },
  file: { noun: 'file', verb: 'shared a file with you:' },
  folder: { noun: 'folder', verb: 'shared a folder with you:' },
  form: { noun: 'form', verb: 'gave you access to the form' },
  contact: { noun: 'contacts', verb: 'shared contacts with you:' },
  grant: { noun: 'grant', verb: 'gave you access to the grant' },
  project: { noun: 'project', verb: 'added you to the project' },
  opportunity: { noun: 'opportunity', verb: 'shared an opportunity with you:' },
  fellowship: { noun: 'fellowship', verb: 'added you to the fellowship' },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export function appOrigin(): string {
  const o = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.sautisalama.org').replace(/\/$/, '');
  return o.startsWith('http') ? o : `https://${o}`;
}

export interface InviteOptions {
  kind: InviteKind;
  to: string[];
  /** Who did it. */
  by: string;
  title: string;
  /** Path or absolute URL that opens the thing. */
  url: string;
  /** A short extra line: the level of access, the time of a meeting. */
  detail?: string;
  /** A personal note from the sender. */
  note?: string;
  /** Replace the headline (permission changed, access removed). */
  headline?: string;
}

/**
 * The email every section sends when someone is added to something, the way Google's sharing mail reads:
 * who did it, what it is, a note if there was one, and one button that opens it. Best effort: a mail problem
 * never blocks the action that caused it.
 */
export async function sendAccessEmail(o: InviteOptions): Promise<void> {
  const to = [...new Set(o.to.map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
  if (!to.length) return;
  const w = WORDS[o.kind];
  const href = o.url.startsWith('http') ? o.url : `${appOrigin()}${o.url.startsWith('/') ? '' : '/'}${o.url}`;
  const subject = o.headline ? `${o.title}: ${o.headline}` : o.kind === 'meeting' || o.kind === 'event' ? `Invitation: ${o.title}` : `${o.by} shared "${o.title}" with you`;
  const lead = o.headline ? esc(o.headline) : `<strong>${esc(o.by)}</strong> ${w.verb} ${o.kind === 'meeting' ? 'a meeting' : ''}`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f6f8f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0b2228">
<div style="max-width:560px;margin:28px auto;background:#fff;border:1px solid #e4e7ea;border-radius:16px;overflow:hidden">
  <div style="padding:22px 28px 0;font-size:13px;color:#068297;font-weight:600">Sauti Salama</div>
  <div style="padding:10px 28px 8px;font-size:16px;line-height:1.5">${lead}</div>
  <div style="margin:6px 28px 0;padding:16px 18px;border:1px solid #e4e7ea;border-radius:12px;background:#fafbfb">
    <div style="font-size:17px;font-weight:600">${esc(o.title)}</div>
    ${o.detail ? `<div style="margin-top:4px;font-size:13px;color:#5f6368">${esc(o.detail)}</div>` : ''}
  </div>
  ${o.note ? `<div style="margin:14px 28px 0;font-size:14px;line-height:1.5;white-space:pre-wrap;color:#202124">${esc(o.note)}</div>` : ''}
  <div style="padding:22px 28px 28px"><a href="${esc(href)}" style="display:inline-block;background:#068297;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:999px">Open ${esc(w.noun)}</a></div>
  <div style="padding:14px 28px;border-top:1px solid #eef0f1;font-size:12px;color:#80868b">You received this because ${esc(o.by)} added you in the Sauti Salama suite.</div>
</div></body></html>`;
  try {
    await sendEmail(to, subject, html, { email: 'notifications@sautisalama.org', name: `${o.by} via Sauti Salama` }, { category: 'Access', prefCategory: undefined });
  } catch (e) {
    console.error('[invite-email]', e instanceof Error ? e.message : e);
  }
}
