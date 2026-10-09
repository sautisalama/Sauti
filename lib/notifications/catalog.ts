/**
 * Every kind of notification Sauti Salama sends to a person, in the words shown on the
 * Notifications settings card. The ids are what is stored in `profiles.settings`.
 *
 * Channels: "email" and "push" can be switched off per kind (or for everything at once).
 * The in-app bell always records them. `locked` kinds are account/safety notices that are
 * always sent by email because the person has to be able to act on them.
 */
export type NotificationCategoryId =
  | 'messages'
  | 'cases'
  | 'appointments'
  | 'verification'
  | 'community'
  | 'publications'
  | 'reminders'
  | 'admin_alerts'
  | 'account';

export interface NotificationCategory {
  id: NotificationCategoryId;
  label: string;
  description: string;
  channels: ('email' | 'push')[];
  /** Who receives it. Hidden from people it never applies to. */
  audience: 'everyone' | 'providers' | 'admins';
  locked?: boolean;
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  { id: 'messages', label: 'New messages', description: 'When someone sends you a chat message. Only the sender is shown, never the message text.', channels: ['push'], audience: 'everyone' },
  { id: 'cases', label: 'Cases and matches', description: 'A new match, a case referred or forwarded to you, and updates on a case you are part of.', channels: ['email', 'push'], audience: 'everyone' },
  { id: 'appointments', label: 'Appointments', description: 'Sessions scheduled, proposed times, confirmations and reschedules.', channels: ['email', 'push'], audience: 'everyone' },
  { id: 'verification', label: 'Verification', description: 'Your profile or service being verified or needing changes, and requests to upload documents.', channels: ['email', 'push'], audience: 'providers' },
  { id: 'community', label: 'Groups', description: 'When you are added to a group.', channels: ['push'], audience: 'everyone' },
  { id: 'publications', label: 'Publications and learning', description: 'New publications, courses, and the review of articles you submitted.', channels: ['email', 'push'], audience: 'everyone' },
  { id: 'reminders', label: 'Reminders', description: 'Helpful nudges and the daily reminder.', channels: ['email', 'push'], audience: 'everyone' },
  { id: 'admin_alerts', label: 'Admin alerts', description: 'New provider sign-ups, service and document submissions awaiting review, and blog submissions.', channels: ['email', 'push'], audience: 'admins' },
  { id: 'account', label: 'Account and safety', description: 'Welcome, security and account status notices. These are always emailed.', channels: ['email'], audience: 'everyone', locked: true },
];

/** Which settings category a stored notification `type` belongs to. */
export function categoryOfType(type: string, metadata?: Record<string, unknown> | null): NotificationCategoryId {
  switch (type) {
    case 'new_message':
      return 'messages';
    case 'match_found':
    case 'new_referral':
    case 'case_forwarded':
    case 'review_received':
      return 'cases';
    case 'appointment':
      return 'appointments';
    case 'verification_verified':
    case 'verification_rejected':
      return 'verification';
    case 'blog_approved':
    case 'blog_rejected':
    case 'new_content':
      return 'publications';
    case 'new_professional_signup':
    case 'new_service_submission':
    case 'new_blog_submission':
      return 'admin_alerts';
    case 'account_banned':
    case 'welcome':
      return 'account';
    case 'system_alert':
      return metadata?.reminder ? 'verification' : 'community';
    default:
      return 'reminders';
  }
}

/** Email subjects sent outside the notification pipeline, mapped to a category. */
export function categoryOfSubject(subject: string): NotificationCategoryId | null {
  if (/session|times proposed|case confirmed|appointment/i.test(subject)) return 'appointments';
  return null;
}
