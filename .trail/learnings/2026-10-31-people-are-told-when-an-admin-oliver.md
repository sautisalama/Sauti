---
title: People are told when an admin changes their role; the landing page already shows new posts
author: Oliver
date: 2026-10-31
branch: main
cost: { minutes: 1, tokens: 904 }
id: l-3731cbd9
scope: repo
status: active
src: agent
touches:
  - app/actions/access.ts
  - lib/content/feed.ts
  - app/page.tsx
  - components/PublicationsSection.tsx
  - app/actions/publishing.ts
---

## Decided
Changing someone's admin status or account type now notifies them in the app and by email, only when the role actually changed, because people were otherwise never told their access had changed. Changing roles stays a super-admin power. The landing page needs no extra work to show newly published posts, because publishing already refreshes it.

## Watch out
A failed notification must never undo the role change, so it runs after the response and swallows errors; otherwise a mail outage would block admin changes. The landing Our Publications section is the newest three published items; if a post seems missing, check its published date and status first, since the feed only lists published rows dated now or earlier.

In the code:
- app/actions/access.ts (setAdminStatus, setAccountType, tellOfRoleChange)
- lib/content/feed.ts (getFeed), app/page.tsx, components/PublicationsSection.tsx
- app/actions/publishing.ts (revalidateAll refreshes "/")
