# Professional Portal Redesign - Feature Documentation

## Overview

This document outlines all new features added to the Sauti Salama platform as part of the Professional Portal Redesign. It covers feature descriptions, user permissions, and how components interconnect.

---

## 1. Community Chat System

### Description

Enables professionals to create support communities where survivors and other professionals can connect, share resources, and communicate in group settings.

### Components

| Component                  | Location                          |
| -------------------------- | --------------------------------- |
| `CommunityChat.tsx`        | `app/dashboard/chat/_components/` |
| `CommunityCreateModal.tsx` | `components/chat/`                |
| `ChatSidebar.tsx`          | `components/chat/` (updated)      |

### Permissions

| Action                   | Survivor | Professional | NGO          |
| ------------------------ | -------- | ------------ | ------------ |
| View public communities  | ✅       | ✅           | ✅           |
| Join communities         | ✅       | ✅           | ✅           |
| Create communities       | ❌       | ✅           | ✅           |
| Manage community (admin) | ❌       | Creator only | Creator only |

### Interconnections

- **ChatSidebar** → Displays "Communities" tab alongside "Messages"
- **CommunityCreateModal** → Opens from ChatSidebar for professionals
- **CommunityChat** → Renders when selecting a community from sidebar
- **Database** → `communities`, `community_members`, `community_invitations` tables

---

## 2. Case Management Enhancements

### Description

Provides in-context tools for professionals to manage survivor cases including inline messaging, recommendations, and case forwarding.

### Components

| Component                 | Purpose                           |
| ------------------------- | --------------------------------- |
| `CaseInlineChat.tsx`      | Quick messaging within case view  |
| `CaseRecommendations.tsx` | Add/share service recommendations |
| `CaseForwardModal.tsx`    | Forward cases to other providers  |

### Permissions

| Action                | Survivor  | Professional  | NGO           |
| --------------------- | --------- | ------------- | ------------- |
| View case details     | Own cases | Matched cases | Matched cases |
| Send inline messages  | ✅        | ✅            | ✅            |
| Add recommendations   | ❌        | ✅            | ✅            |
| Share recommendations | ❌        | ✅            | ✅            |
| Forward cases         | ❌        | ✅            | ✅            |

### Interconnections

- **CaseInlineChat** → Syncs with main `ChatWindow` via Supabase realtime
- **CaseRecommendations** → Stored in `case_recommendations` table, visible in survivor report view
- **CaseForwardModal** → Creates `case_shares` record, updates `matched_services.shared_from_match_id`

---

## 3. Blog System

### Description

Professionals can write educational blog posts. NGOs review and approve posts before publication.

### Components

| Component         | Purpose                       |
| ----------------- | ----------------------------- |
| `BlogEditor.tsx`  | TipTap-based rich text editor |
| `BlogCard.tsx`    | Display card (3 variants)     |
| `BlogPage.tsx`    | Full reading view             |
| `BlogVetting.tsx` | NGO approval queue            |
| `blogs/page.tsx`  | Dashboard route               |

### Permissions

| Action               | Survivor | Professional | NGO |
| -------------------- | -------- | ------------ | --- |
| Read published blogs | ✅       | ✅           | ✅  |
| Create blog posts    | ❌       | ✅           | ✅  |
| Submit for review    | ❌       | ✅           | ✅  |
| Approve/reject posts | ❌       | ❌           | ✅  |

### Workflow

```
Draft → Submit for Review → Pending → [NGO Reviews] → Published/Rejected
```

### Interconnections

- **BlogEditor** → Creates/updates `blogs` table records
- **BlogVetting** → NGO-only view, updates `status`, `reviewed_by`, `reviewed_at`
- **EnhancedSidebar** → "Blog Posts" link for professionals/NGOs

---

## 4. Service Limits

### Description

Professionals are limited to 2 support services to encourage specialization. NGOs have unlimited services.

### Implementation

| File                     | Change                                |
| ------------------------ | ------------------------------------- |
| `SupportServicesTab.tsx` | Added `userType` prop and limit logic |

### Permissions

| User Type    | Service Limit |
| ------------ | ------------- |
| Survivor     | N/A           |
| Professional | 2             |
| NGO          | Unlimited     |

### UI Behavior

- Shows "X/2 services" counter for professionals
- "Add Service" button disabled at limit
- "Limit reached" badge when at capacity

---

## 5. Survivor Options

### Description

Survivors can view assigned providers, request provider changes, and share cases with additional providers.

### Component

| Component                | Location                             |
| ------------------------ | ------------------------------------ |
| `SurvivorOptionsTab.tsx` | `app/dashboard/profile/_components/` |

### Permissions

| Action                              | Survivor | Professional | NGO |
| ----------------------------------- | -------- | ------------ | --- |
| View assigned providers             | ✅       | ❌           | ❌  |
| Request provider change             | ✅       | ❌           | ❌  |
| Share case with additional provider | ✅       | ❌           | ❌  |

### Interconnections

- Creates `support_requests` record for provider changes
- Links to `matched_services` to display provider info

---

## 6. Record Only Reports

### Description

Survivors can submit reports for documentation purposes without seeking immediate help.

### Implementation

| File                               | Change                      |
| ---------------------------------- | --------------------------- |
| `AuthenticatedReportAbuseForm.tsx` | Added `recordOnly` checkbox |

### Behavior

- When checked: Report saved with `record_only = true`
- No automatic service matching triggered
- Survivor can request help later from dashboard

---

## 7. Professional Calendar

### Description

ADPList-inspired calendar for professionals to manage appointments.

### Component

| Component                  | Location                |
| -------------------------- | ----------------------- |
| `ProfessionalCalendar.tsx` | `components/dashboard/` |

### Features

- Month view with appointment dots
- Day view with week strip navigation
- Color-coded status (confirmed/pending/cancelled)
- Appointment detail cards

---

## Database Schema Changes

### New Tables

| Table                   | Purpose                          |
| ----------------------- | -------------------------------- |
| `communities`           | Community metadata               |
| `community_members`     | Membership with roles            |
| `community_invitations` | Invite tracking                  |
| `blogs`                 | Blog posts with vetting workflow |
| `case_recommendations`  | Professional recommendations     |
| `case_shares`           | Case forwarding audit trail      |

### Modified Tables

| Table              | Change                                                |
| ------------------ | ----------------------------------------------------- |
| `reports`          | Added `record_only` boolean                           |
| `matched_services` | Added `recommendations` JSONB, `shared_from_match_id` |

### New Enums

- `blog_status_type`: `draft`, `pending`, `published`, `rejected`
- `community_role_type`: `admin`, `moderator`, `member`

---

## Navigation Updates

### EnhancedSidebar

Professional navigation now includes:

- Overview
- Case Management
- My Reports
- Messages
- Resources
- **Blog Posts** ← NEW
- My Services
- Settings

---

## Security Considerations

1. **RLS Policies** - All new tables require Row Level Security
2. **Community visibility** - Public vs private controlled by `is_public` flag
3. **Blog vetting** - Content reviewed before publication
4. **Case sharing** - Audit trail via `case_shares` table
5. **Provider changes** - Logged for abuse prevention
