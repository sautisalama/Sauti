
import { createAdminClient } from '@/utils/supabase/admin-client';
import { sendEmail } from './email';
import { sendInAppNotification } from './in-app';
import { NotificationPayload, NotificationType } from './types';
import { baseTemplate } from './templates';
import { sendPushToUser } from './push';

const CRITICAL_TYPES: NotificationType[] = [
  'verification_verified',
  'verification_rejected',
  'account_banned',
  'match_found',
  'new_referral',
  'case_forwarded',
  'blog_approved',
  'blog_rejected',
  'new_blog_submission',
  'new_professional_signup',
  'new_service_submission',
  'system_alert',
  'welcome'
];

/**
 * Unified notification sender.
 * Handles both In-App and Email notifications based on type and priority.
 */
export async function sendNotification(payload: NotificationPayload) {
  // Notifications are written for, and addressed to, OTHER users, so this runs with the
  // service role. (As the sender it was blocked by RLS: in-app rows were not created and
  // the recipient's email address could not be read.)
  const supabase = createAdminClient();
  
  // 1. Send In-App Notification (Always)
  const inAppResult = await sendInAppNotification(
    payload.userId,
    payload.type,
    payload.title,
    payload.message,
    payload.link,
    payload.metadata,
    supabase
  );

  if (!inAppResult.success) {
    console.error('In-App notification failed:', inAppResult.error);
  }

  // 1b. Push to the user's devices (notification drawer + app-icon badge). Best-effort.
  if (inAppResult.success) {
    await sendPushToUser(payload.userId, {
      title: payload.title,
      body: payload.message,
      url: payload.link,
      tag: payload.type,
    });
  }

  // 2. Check if Email is needed
  // Send email if explicitly requested OR if it's a critical type (unless explicitly disabled)
  const shouldSendEmail = payload.sendEmail ?? CRITICAL_TYPES.includes(payload.type);

  if (shouldSendEmail) {
    try {
      // Fetch user email if payload.userId is present
      const { data: user, error } = await supabase
        .from('profiles')
        .select('email, first_name')
        .eq('id', payload.userId)
        .single();

      // Anonymous survivors have a placeholder address with no inbox — never email it.
      if (user?.email?.endsWith('@anon.sautisalama.org')) {
        return { inApp: inAppResult, email: { success: false, error: 'anonymous account (no inbox)' } };
      }

      if (error || !user?.email) {
        console.warn(`Could not fetch email for user ${payload.userId}. Email skipped.`);
        return { inApp: inAppResult, email: { success: false, error: 'User email not found' } };
      }

      // Use provided HTML or fallback to base template
      const htmlContent = payload.emailHtml || baseTemplate(
        `<p>${payload.message}</p>
         ${payload.link ? `<div style="text-align: center; margin: 32px 0;"><a href="${process.env.NEXT_PUBLIC_APP_URL}${payload.link}" style="background-color: #14b8a6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View Details</a></div>` : ''}`,
        payload.title
      );

      const emailResult = await sendEmail(user.email, payload.title, htmlContent);
      return { inApp: inAppResult, email: emailResult };

    } catch (err) {
      console.error('Error in sendNotification email flow:', err);
      return { inApp: inAppResult, email: { success: false, error: err } };
    }
  }

  return { inApp: inAppResult, email: null };
}

/**
 * Broadcasts a notification to ALL users.
 * Currently supports In-App notifications only to avoid mass email spam.
 */
export async function broadcastNotification(payload: Omit<NotificationPayload, 'userId' | 'sendEmail' | 'emailHtml'>) {
    // Trusted server code: reads every user and writes a row per user (service role).
    const supabase = createAdminClient();
    
    // 1. Fetch all users (batching might be needed for large datasets)
    const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id');
    
    if (userError || !users) {
        console.error('Broadcast failed: Could not fetch users', userError);
        return { success: false, error: userError };
    }

    // 2. Prepare bulk insert payload
    const notifications = users.map(user => ({
        user_id: user.id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link,
        metadata: payload.metadata,
        read: false,
        created_at: new Date().toISOString()
    }));

    // 3. Batch insert (Supabase handles large batches reasonably well, but chunking is safer for >1000)
    const chunkSize = 1000;
    const results = [];
    
    for (let i = 0; i < notifications.length; i += chunkSize) {
        const chunk = notifications.slice(i, i + chunkSize);
        const { error } = await supabase.from('notifications').insert(chunk);
        if (error) {
            console.error(`Broadcast chunk ${i} failed:`, error);
            results.push({ chunk: i, success: false, error });
        } else {
            results.push({ chunk: i, success: true });
        }
    }

    return { success: true, detailedResults: results };
}
