---
title: "Deleted files go to a 21-day trash, and shared things show who has access as overlapping photos"
author: Oliver
date: 2026-11-04
branch: main
cost: { minutes: 72, tokens: 469828 }
id: l-2d18343d
scope: repo
status: active
src: agent
touches:
  - app/actions/mjengo-contacts.ts
  - app/actions/mjengo-files.ts
  - app/actions/mjengo.ts
  - app/dashboard/mjengo/_components/EntityWorkspace.tsx
  - app/dashboard/mjengo/_components/shared.tsx
  - app/dashboard/mjengo/contacts/page.tsx
  - app/dashboard/mjengo/vault/page.tsx
  - scripts/e2e/uat/47-access-stacks.mjs
  - app/actions/vault.ts
  - app/api/cron/escalate-stale-cases/route.ts
---

## Decided
Deleting in Files moves a file or folder to the trash instead of erasing it. It can be restored for 21 days, deleted for good from the trash, or the trash can be emptied. After 21 days it is removed for good by the daily job that already runs (and when the trash is opened). Folders are trashed with everything inside; restoring brings back what went with it, to the top level if the folder it was in is gone. Recent files has the same actions menu as All files.
Anywhere something is shared in the admin suite shows the people with access as overlapping photos: the whole team when it is open to everyone, otherwise the owner and those it was shared with. This covers files, contacts, grants, opportunities, projects and fellowships.
In the background picker a picture is shown as Fill or a 3 by 3 Grid only, and choosing the picture opens the picture's settings, never the blur or colour panel that was open.

## Tried and ruled out
A separate purge job: the project's scheduled jobs are limited, so removal rides on the existing daily job.
Showing only the creator and owner on grant and opportunity cards: it said nothing about who could actually open them.
Judging the Meet suite by one failing run: its timeouts came from a slow download of the background model and a dev server that had run for a day, not from the code. A focused test of the picker is the reliable check.

## Watch out
Anything that reads files directly must leave out trashed ones (the file index does so by default; public links, previews and search were updated). New code that lists files should use the index, not query the table.
The suite's first-visit set-up prompt covers other screens in tests, so the shared test helper snoozes it; only its own test clears that.

In the code: lib/vault/trash.ts, lib/vault/access.ts (loadIndex withTrashed), app/actions/vault.ts (deleteItem, listTrash, restoreItem, deleteForever, emptyTrash), app/dashboard/mjengo/vault/TrashDialog.tsx; accessIds in app/dashboard/mjengo/_components/shared.tsx; components/meet/BackgroundPicker.tsx; e2e 45, 46, 47.
