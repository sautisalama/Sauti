export type NotificationType =
  | 'verification_verified'
  | 'verification_rejected'
  | 'account_banned'
  | 'match_found'
  | 'new_referral'
  | 'case_forwarded'
  | 'new_message'
  | 'review_received'
  | 'blog_approved'
  | 'blog_rejected'
  | 'new_blog_submission'
  | 'new_professional_signup'
  | 'new_service_submission'
  | 'system_alert'
  | 'new_content'
  | 'welcome';

export interface RecipientProfile {
  id: string; // Supabase user ID
  email: string;
  firstName: string | null;
  role: 'admin' | 'professional' | 'user';
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  priority?: 'high' | 'medium' | 'low';
  sendEmail?: boolean; // Override default behavior
  emailHtml?: string; // HTML content for email (if sendEmail is true)
}
