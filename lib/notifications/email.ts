import { MailtrapClient } from 'mailtrap';
import { appendFileSync } from 'node:fs';
import { createAdminClient } from '@/utils/supabase/admin-client';
import { categoryOfSubject, type NotificationCategoryId } from './catalog';
import { allows, getPrefsByEmails } from './prefs';

/**
 * Test mode: EMAIL_MODE=capture records outbound mail to a local file instead of sending it, so
 * end-to-end tests can assert on subject/recipients without emailing real people.
 * Ignored in production builds.
 */
function captured(entry: Record<string, unknown>): boolean {
  if (process.env.EMAIL_MODE !== 'capture' || process.env.NODE_ENV === 'production') return false;
  try {
    appendFileSync(process.env.EMAIL_OUTBOX || '.e2e-outbox.jsonl', JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
  } catch (e) {
    console.error('Could not write email outbox:', e);
  }
  return true;
}

// Default sender configuration
const DEFAULT_SENDER = {
  email: 'notifications@sautisalama.org',
  name: 'Sauti Salama Notifications',
};

/** Every outbound platform email is recorded here for the admin "Platform emails" view. Best effort. */
async function logEmail(entry: { to: string[]; subject: string; category?: string; status: 'sent' | 'failed' | 'captured' | 'skipped'; error?: string; html?: string }) {
  try {
    await createAdminClient()
      .from('email_log' as never)
      .insert({
        to_addresses: entry.to,
        subject: entry.subject,
        category: entry.category ?? null,
        status: entry.status,
        error: entry.error ?? null,
        html: entry.html ? entry.html.slice(0, 200_000) : null,
      } as never);
  } catch (e) {
    console.error('Could not log email:', e instanceof Error ? e.message : e);
  }
}

/**
 * Sends an email using Mailtrap.
 *
 * - Recipients who turned this kind of email off (Profile > App Settings > Notifications) are skipped.
 *   The kind comes from options.prefCategory, or is inferred from the subject for appointment mail.
 * - EMAIL_AUDIT_BCC (comma-separated) receives a blind copy of everything sent.
 * - Every send is recorded in email_log.
 *
 * @param to Recipient email address or array of addresses
 * @param subject Subject line
 * @param html HTML content of the email
 * @param sender Optional sender override
 */
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  sender = DEFAULT_SENDER,
  options: { urgent?: boolean; category?: string; prefCategory?: NotificationCategoryId } = {}
) {
  let recipientsList = Array.isArray(to) ? to : [to];

  const prefCategory = options.prefCategory ?? categoryOfSubject(subject);
  if (prefCategory) {
    try {
      const prefs = await getPrefsByEmails(recipientsList.map((e) => e.toLowerCase()));
      recipientsList = recipientsList.filter((e) => {
        const p = prefs.get(e.toLowerCase());
        return !p || allows(p, prefCategory, 'email');
      });
    } catch (e) {
      console.error('Could not check email preferences (sending anyway):', e instanceof Error ? e.message : e);
    }
    if (!recipientsList.length) {
      await logEmail({ to: Array.isArray(to) ? to : [to], subject, category: options.category, status: 'skipped', html });
      return { success: true, messageId: 'skipped-by-preference' };
    }
  }

  if (captured({ to: recipientsList, subject, category: options.category ?? 'Notification', urgent: !!options.urgent })) {
    return { success: true, messageId: 'captured' };
  }

  const token = process.env.MAILTRAP_TOKEN;

  if (!token) {
    console.warn('MAILTRAP_TOKEN not set. Email simulation:');
    console.log(`To: ${recipientsList}`);
    console.log(`Subject: ${subject}`);
    return { success: false, error: 'MAILTRAP_TOKEN missing' };
  }

  const client = new MailtrapClient({ token });

  try {
    const recipients = recipientsList.map((email) => ({ email }));
    const lower = new Set(recipientsList.map((e) => e.toLowerCase()));
    const bcc = (process.env.EMAIL_AUDIT_BCC ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e && !lower.has(e.toLowerCase()))
      .map((email) => ({ email }));

    const response = await client.send({
      from: sender,
      to: recipients,
      ...(bcc.length && { bcc }),
      subject,
      html,
      category: options.category ?? 'Notification',
      // High-importance headers so mail clients flag the message as urgent.
      ...(options.urgent && {
        headers: { 'X-Priority': '1 (Highest)', 'X-MSMail-Priority': 'High', Importance: 'High' },
      }),
    });

    await logEmail({ to: recipientsList, subject, category: options.category, status: 'sent', html });
    return { success: true, messageId: response.message_ids[0] };
  } catch (error) {
    console.error('Failed to send email:', error);
    await logEmail({ to: recipientsList, subject, category: options.category, status: 'failed', error: error instanceof Error ? error.message : String(error), html });
    return { success: false, error };
  }
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  type: string;
}

/**
 * Sends an email with file attachments (used for publication copies).
 * Unlike {@link sendEmail}, a missing token is reported as a failure the
 * caller can persist and surface, never silently swallowed.
 */
export async function sendEmailWithAttachments(
  to: string | string[],
  subject: string,
  html: string,
  attachments: EmailAttachment[],
  sender = { email: 'publications@sautisalama.org', name: 'Sauti Salama Publications' }
): Promise<{ success: true; messageId: string } | { success: false; error: string }> {
  if (captured({ to, subject, category: 'Publications', attachments: attachments.map((a) => a.filename) })) {
    return { success: true, messageId: 'captured' };
  }
  const token = process.env.MAILTRAP_TOKEN;
  if (!token) return { success: false, error: 'MAILTRAP_TOKEN is not configured' };

  try {
    const client = new MailtrapClient({ token });
    const recipients = (Array.isArray(to) ? to : [to]).map((email) => ({ email }));
    const response = await client.send({
      from: sender,
      to: recipients,
      subject,
      html,
      category: 'Publications',
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        type: a.type,
        disposition: 'attachment' as const,
      })),
    });
    return { success: true, messageId: response.message_ids[0] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to send email with attachments:', message);
    return { success: false, error: message };
  }
}
