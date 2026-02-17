# Sauti Salama: Notifications & Email System Architecture

This document maps out all required notification and email touchpoints within the Sauti Salama platform. It details existing implementations, identifies critical gaps, and proposes a centralized architecture for managing communication between Admins, Professionals, and Survivors.

## 1. System Overview

Currently, the system uses a fragmented approach:

- **In-App Notifications**: Managed via the `notifications` Supabase table.
- **Emails**: Sent via direct API calls to Mailtrap (e.g., Daily Reminder, Abuse Reports).
- **Automatic Matching (Booking)**: Triggered automatically upon Report submission.
- **Missing Infrastructure**: No centralized `EmailService` or `NotificationService` abstraction exists, leading to hardcoded API calls and potential inconsistencies.

---

## 2. Notification & Email Map by User Role

### A. Survivor (User) Actions

| Event                     | Notification Type      | Recipient | Status           | Priority | Details                                                                               |
| :------------------------ | :--------------------- | :-------- | :--------------- | :------- | :------------------------------------------------------------------------------------ |
| **Sign Up**               | Email (Verification)   | User      | ✅ Supabase Auth | Critical | Native Supabase Auth handles this.                                                    |
| **Welcome**               | Email                  | User      | ❌ Missing       | High     | "Welcome to Sauti Salama" guide/resources.                                            |
| **Report Submitted**      | Email                  | User      | ❌ Missing       | Medium   | "We received your report. Case ID: #123." (Careful with privacy).                     |
| **Match Found (Booking)** | Email + In-App         | User      | ❌ Missing       | Critical | **Automated Step**: "You have been matched with [Professional]." Triggered by Report. |
| **New Message**           | Push/Email (Throttled) | User      | ❌ Missing       | High     | "You have a new secure message from [Professional]."                                  |
| **New Blog/Event**        | In-App                 | All Users | ❌ Missing       | Low      | **Global Alert**: "New resource/event '[Title]' is now available."                    |

### B. Professional Actions

| Event                     | Notification Type    | Recipient    | Status           | Priority | Details                                                                            |
| :------------------------ | :------------------- | :----------- | :--------------- | :------- | :--------------------------------------------------------------------------------- |
| **Account Created**       | Email (Verification) | Professional | ✅ Supabase Auth | Critical | Native Supabase Auth.                                                              |
| **Profile Approved**      | Email + In-App       | Professional | ⚠️ Partial       | Critical | In-App exists (`admin/professionals/[id]`). Email missing.                         |
| **Profile Rejected**      | Email + In-App       | Professional | ⚠️ Partial       | Critical | In-App exists. Email missing. Needs clear "Reasons".                               |
| **Service Approved**      | Email + In-App       | Professional | ⚠️ Partial       | High     | In-App exists (`admin/services/[id]`). Email missing.                              |
| **New Match (Referral)**  | Email + In-App       | Professional | ❌ Missing       | Critical | **Automated Step**: "New case matched to your service [Name]." Triggered by Report |
| **Case Forward Received** | Email + In-App       | Professional | ❌ Missing       | High     | "Professional X wants to forward a case to you."                                   |
| **New Message**           | Email (Throttled)    | Professional | ❌ Missing       | High     | "New message from client [Name/Alias]."                                            |
| **Review Received**       | Email + In-App       | Professional | ❌ Missing       | Medium   | "You received a new 5-star review."                                                |
| **Blog/Event Approved**   | Email + In-App       | Professional | ❌ Missing       | Medium   | "Your post '[Title]' is now live on the platform."                                 |
| **Blog/Event Rejected**   | Email + In-App       | Professional | ❌ Missing       | Medium   | "Your post '[Title]' was not approved. See notes for required changes."            |

### C. Admin Actions

| Event                       | Notification Type | Recipient      | Status      | Priority | Details                                                                    |
| :-------------------------- | :---------------- | :------------- | :---------- | :------- | :------------------------------------------------------------------------- |
| **New Professional Signup** | Email + In-App    | Admin          | ❌ Missing  | Medium   | "New professional waiting for verification."                               |
| **New Service Added**       | Email + In-App    | Admin          | ❌ Missing  | Medium   | "New service [Name] awaiting approval."                                    |
| **Abuse Report Filed**      | Email             | Admin/NGO Team | ✅ Existing | Critical | Handled in `api/reports/route.ts` via Mailtrap.                            |
| **New Blog/Event Added**    | Email + In-App    | Admin          | ❌ Missing  | Medium   | "New entry awaiting review." **Email must include a snapshot of content.** |
| **System Alerts**           | Email             | Admin          | ✅ Existing | Low      | Daily Cron Job (`api/cron/daily-reminder`) exists.                         |

---

## 3. Detailed Implementation Status & Gaps

### 3.1. Authentication & Onboarding

- **Status**: Supabase Auth handles basic verification emails.
- **Gap**: No custom "Welcome" email sequence or onboarding guide for Professionals.

### 3.2. Automatic Matching / Booking (`app/actions/match-services.ts`)

- **Workflow**:
  1. User submits Report (`api/reports`).
  2. System calls `matchReportWithServices`.
  3. System creates records in `matched_services` table.
- **Critical Failure**: The `matchReportWithServices` function creates the match but sends **ZERO notifications**.
  - Professionals are not notified they have a new case.
  - Survivors are not notified they have been matched.
- **Action Required**: Update `matchReportWithServices` to broadcast events/notifications upon successful match insert.

### 3.3. Admin Verification (`app/dashboard/admin/...`)

- **Current State**:
  - Successfully inserts into `admin_actions` table.
  - Successfully inserts into `notifications` table (In-App).
- **Gap**: Does not trigger an email. Professionals relying on email will miss critical status updates (e.g. "Your account is now live").

### 3.4. Case Forwarding (`app/dashboard/cases/...`)

- **Current State**: UI exists (`CaseForwardModal`), database insert works.
- **Gap**: The notification logic is literally commented out:
  ```typescript
  // TODO: Send notification to receiving professional
  ```

### 3.5. Reporting (`app/api/reports/route.ts`)

- **Current State**: Sends email via Mailtrap to hardcoded `REPORT_EMAIL_RECIPIENTS` in `lib/constants`.
- **Note**: This is the most "complete" notification flow but uses a one-off implementation.

### 3.6. Blogs & Events Verification

- **Status**: Database schema exists (`blogs` table with `is_event` flag). Frontend is currently a "Coming Soon" placeholder.
- **Workflow Requirement**:
  1. Professional submits a blog or event.
  2. **Admin Notification**: In-app alert + Email. The email should contain a **content snapshot** (Title, Category, Snippet) so admins can review without immediate login.
  3. **Admin Action**: Approves or Rejects with notes.
  4. **Professional Notification**: Email + In-app. Must clearly state if it's live or if changes are needed (including Admin notes).
  5. **Global Broadcast**: Upon Approval/Publication, trigger an **in-app notification for ALL users** (Survivors and Professionals) to drive engagement with the new content.

---

## 4. Proposed Architecture & Best Practices

To resolve fragmentation, we should implement a centralized **Notification Service**.

### Recommended Directory Structure

```
/lib
  /notifications
    index.ts          # Main entry point (sendNotification)
    email.ts          # Email provider wrapper (Mailtrap/Resend)
    in-app.ts         # Supabase 'notifications' table wrapper
    templates/        # Email HTML templates (Welcome, Booking, etc.)
    types.ts          # NotificationPayload interfaces
```

### Best Practices

1. **Transactional vs. Marketing**:
   - Keep them separate. Sauti Salama's emails are 99% transactional (critical alerts, status updates).
   - Ensure high deliverability by verifying the domain (DKIM/SPF).

2. **In-App + Email Hybrid**:
   - **Critical** (Match Found, Account Ban): Send **BOTH**.
   - **Informational** (New Feature): In-App only.
   - **Chat**: In-App always. Email only if "Unread for > 15 mins" (Smart Notification).

3. **Privacy & Safety (Crucial for Sauti Salama)**:
   - **Survivor Emails**: NEVER include sensitive case details in the email body.
     - ❌ _Bad_: "Your abuse report regarding the incident on Monday..."
     - ✅ _Good_: "You have a new secure message in your portal. Click here to login."
   - **Generic Subjects**: Use discreet subject lines for Survivors.

4. **Idempotency**:
   - Ensure the same event doesn't trigger double emails (e.g., if a webhook retries). Use `event_id` or check `notifications` table before sending.

5. **Queueing (Future Proofing)**:
   - Sending emails during an API request (like in `api/reports`) slows down the response.
   - **Solution**: Use Supabase Edge Functions or a message queue (e.g., QStash) to send emails asynchronously.

---

## 5. Immediate Action Plan

1. **Notification Utility**:
   - Create `lib/notifications/email.ts` to wrap Mailtrap logic.
   - Create `lib/notifications/index.ts` to unify In-App and Email sending.

2. **Fix Match Notifications**:
   - Update `app/actions/match-services.ts` to call the notification utility when a match is created.
   - Notify the Professional ("New Match Intent") and Survivor ("Match Found").

3. **Implement Case Forwarding Notification**:
   - In `CaseForwardModal.tsx`, call a Server Action that triggers the notification workflow.

4. **Enhance Admin Actions**:
   - Update `ProfessionalDetailPage` and `ServiceDetailPage` to call `sendEmail` alongside existing `notifications` insert.

5. **Centralize**:
   - Move the `api/reports` email logic into the reusable utility to ensure consistency.

## 6. Schema Reference

### `notifications` Table

Used for In-App notifications.

```sql
id          uuid PK
user_id     uuid FK (profiles)
type        varchar (verification_verified, match_new, etc.)
title       text
message     text
link        text (internal url)
read        boolean
metadata    jsonb (target_id, target_type, etc.)
created_at  timestamptz
```

### `emails_log` Table (Recommended)

Track sent emails for audit and debugging.

```sql
id          uuid PK
recipient   text
template    varchar
status      varchar (sent, failed)
provider_id text (Mailtrap ID)
created_at  timestamptz
```
