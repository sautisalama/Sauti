# Sauti Salama: Verification & Document Flow Outline

This document outlines the high-level architecture and workflow for user profile and support service verification within the Sauti Salama platform.

## 1. Overview

The verification system ensures that Professionals and NGOs on the platform are vetted before they can interact with Survivors or appear in search results (where applicable). Verification happens at two levels:

1. **Profile Level**: Identity and basic professional standing.
2. **Service Level**: Specific accreditations for individual services offered.

---

## 2. Verification Statuses

The system uses a standardized set of statuses (defined in `db-schema.ts` and `verification-utils.ts`):

| Status         | Description                                                             |
| :------------- | :---------------------------------------------------------------------- |
| `pending`      | Initial state; missing required documents.                              |
| `under_review` | All required documents uploaded; awaiting Admin action.                 |
| `verified`     | Admin has approved the profile/service.                                 |
| `rejected`     | Admin rejected the submission (usually due to invalid documents).       |
| `suspended`    | Account or service manually disabled by an Admin for policy violations. |

---

## 3. The Submission Flow (User Side)

Located in `/dashboard/profile` and managed via `VerificationSection` and `SupportServicesManager`.

1. **Document Upload**:
   - User uploads a file (PDF, Image) via the UI.
   - File is stored in the Supabase `accreditation-documents` storage bucket.
2. **Metadata Creation**:
   - A metadata object is created containing the file URL, original name, upload timestamp, and a default status of `pending`.
   - This object is appended to the `accreditation_files_metadata` JSONB column in the `profiles` (for identity) or `support_services` table.
3. **Automated Status Calculation**:
   - The system calls `calculateNewStatus()` from `lib/verification-utils.ts`.
   - **Logic**:
     - If any doc is `rejected` → Status becomes `rejected`.
     - If required docs (e.g., National ID) are missing → Status becomes `pending`.
     - If all required docs are present and `pending` review → Status becomes `under_review`.
4. **Data Sync**:
   - `profiles` or `support_services` table is updated with the new status and `verification_updated_at` timestamp.

---

## 4. The Review Flow (Admin Side)

Located in `/dashboard/admin/review/[id]`.

1. **Discovery**:
   - Admins see users with `under_review` or `pending` status in the Admin Dashboard tables.
2. **Detailed Review**:
   - Admin opens the user's review page to inspect uploaded documents.
   - **Document Actions**: Admin can mark individual documents as "Verified" or "Rejected" (with notes).
3. **Final Action**:
   - **Approve**: Sets status to `verified`, checks `isVerified` flag, and records `admin_verified_by`.
   - **Reject**: Sets status to `rejected`, requires a reason, and notifies the user.
   - **Ban/Suspend**: Sets status to `suspended` and prevents the user from using core features.
4. **Notifications**:
   - The Admin action triggers a database insert into the `notifications` table.
   - The user receives a real-time notification (via Supabase Realtime) and an email alert.

---

## 5. Technical Implementation Details

### Key Files

- `lib/verification-utils.ts`: Central logic for status transitions.
- `app/dashboard/admin/review/[id]/page.tsx`: The primary Admin interface for verification.
- `components/navigation/NotificationDropdown.tsx`: Real-time alerts for users when status changes.

### Database Schema (Supabase)

- **Tables**: `profiles`, `support_services`, `admin_actions`, `notifications`.
- **JSONB Columns**: Used for `accreditation_files_metadata` to allow flexible document history without complex joins.
- **Audit Log**: Every approval/rejection is logged in `admin_actions` with the Admin's ID and timestamp.

---

## 6. Real-time Synchronization

To ensure a seamless experience without page reloads:

- **Client-side**: Components use `onUpdate` callbacks to trigger data re-fetching.
- **Server-side**: Supabase Realtime listens for `UPDATE` events on the `profiles` table to update the "Verification Status" banner globally across the dashboard.
