import { MailtrapClient } from 'mailtrap';

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
  sender = DEFAULT_SENDER
) {
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
      category: 'Notification',
    });

    return { success: true, messageId: response.message_ids[0] };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error };
  }
}
