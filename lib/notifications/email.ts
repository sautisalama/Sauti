import { MailtrapClient } from 'mailtrap';
import { appendFileSync } from 'node:fs';

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

/**
 * Sends an email using Mailtrap
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
  options: { urgent?: boolean; category?: string } = {}
) {
  if (captured({ to, subject, category: options.category ?? 'Notification', urgent: !!options.urgent })) {
    return { success: true, messageId: 'captured' };
  }

  const token = process.env.MAILTRAP_TOKEN;

  if (!token) {
    console.warn('MAILTRAP_TOKEN not set. Email simulation:');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    return { success: false, error: 'MAILTRAP_TOKEN missing' };
  }

  const client = new MailtrapClient({ token });

  try {
    const recipients = Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }];

    const response = await client.send({
      from: sender,
      to: recipients,
      subject,
      html,
      category: options.category ?? 'Notification',
      // High-importance headers so mail clients flag the message as urgent.
      ...(options.urgent && {
        headers: { 'X-Priority': '1 (Highest)', 'X-MSMail-Priority': 'High', Importance: 'High' },
      }),
    });

    return { success: true, messageId: response.message_ids[0] };
  } catch (error) {
    console.error('Failed to send email:', error);
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
