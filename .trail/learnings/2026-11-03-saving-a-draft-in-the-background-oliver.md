---
title: Saving a draft in the background must not behave like pressing Save
author: Oliver
date: 2026-11-03
branch: main
cost: { minutes: 9, tokens: 49221 }
id: l-9f2c2cf7
scope: repo
status: active
src: agent
touches:
  - "app/dashboard/reports/[id]/page.tsx"
  - components/RichTextEditor.tsx
  - app/actions/publishing.ts
  - components/editor/RichEditor.tsx
  - components/publishing/PublicationEditor.tsx
  - scripts/e2e/uat/43-publication-editing.mjs
  - app/actions/meet-recording.ts
  - app/dashboard/admin/_components/AdminActivitySection.tsx
  - app/dashboard/mjengo/_components/MeetChooser.tsx
  - "app/meet/[code]/recording/RecordingPlayer.tsx"
---

## Decided
A background save of a draft (autosave) changes nothing public, so it must not refresh public pages, add history entries, show a toast, or reload the page it came from. Pressing Save or Publish still does all of those. The editor must not be handed back text it just emitted, or the cursor and formatting (bold, images) glitch while typing.

## Tried and ruled out
A browser test (type, bold, wait through the save, add an image) passed both with and without the change, so the glitch was not reproduced; the fix follows from reading the code, not from a failing test. If it is still seen, ask which route and what exactly happens (flicker, lost selection, lost cursor).

## Watch out
Any new autosave needs the same care: pass an autosave flag to the server action and skip revalidation and history, and keep editor handlers behind refs so the parent re-rendering does not reconfigure the editor.

In the code: PublicationInput.autosave in app/actions/publishing.ts; RichEditor onChangeRef/onUploadRef in components/editor/RichEditor.tsx; handleSaveNotes in app/dashboard/reports/[id]/page.tsx and lastHtmlRef in components/RichTextEditor.tsx; e2e scripts/e2e/uat/43-publication-editing.mjs.
