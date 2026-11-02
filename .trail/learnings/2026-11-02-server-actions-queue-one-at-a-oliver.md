---
title: "Server actions queue one at a time, so background polling and hidden tabs must not use them"
author: Oliver
date: 2026-11-02
branch: main
cost: { minutes: 44, tokens: 332722 }
id: l-7e9fbb71
scope: repo
status: active
src: agent
touches:
  - scripts/e2e/probe-mjengo-load.mjs
  - app/api/suite/side/route.ts
  - lib/client/side.ts
  - scripts/e2e/audit-hover.mjs
  - supabase/migrations/20261102_documents_can_be_unlinked.sql
  - supabase/migrations/20261102_documents_attach_vault_and_drive.sql
  - lib/google-drive-search.ts
  - app/actions/mjengo-attach.ts
  - app/dashboard/mjengo/_components/FilePreviewDialog.tsx
  - app/dashboard/mjengo/_components/AddDocumentDialog.tsx
---

## Decided
Background polls (nav, counts, unread, balance) go through one batched GET route, and tabs on a full record page load only when first opened. Deleting an opportunity removes only its link to documents, which stay for reuse. Documents can point at a Files item or a Drive file. Tag filters and chips were removed.

## Tried and ruled out
Leaving every tab mounted: it fired about 15 serial actions, so an autosave waited ~28s behind reads.

## Watch out
Browser server actions run serially, so any new background action delays a screen's own data and its saves. After a delete, refresh cached lists (R.documents) or the next page shows the old copy.

In the code: app/api/suite/side/route.ts, lib/client/side.ts, EntityWorkspace.tsx (seen tabs), app/actions/mjengo.ts deleteEntity, app/actions/mjengo-attach.ts.
