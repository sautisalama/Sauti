---
title: Anyone with a professional or NGO account can write posts; admins approve them
author: Oliver
date: 2026-10-30
branch: main
cost: { minutes: 6, tokens: 107942 }
id: l-fb8b9cfb
scope: repo
status: active
replaces: l-34ceb49b
src: agent
touches:
  - app/actions/publishing.ts
  - components/publishing/PublicationEditor.tsx
---

## Decided
Professionals and NGOs write blogs and publications. Admins publish directly; everyone else submits for approval, and an admin approves or returns it with a note (the author is notified either way). A PDF upload can be shown as the PDF itself or as its extracted text.

## Watch out
Authors cannot edit once published. Only admins can publish or feature, enforced by row rules, not just the UI. The dev database is paused, so migration 20261063 is applied to prod only. Re-apply it to dev when it is resumed.

In the code:
- supabase/migrations/20261063_publisher_submissions.sql (is_publisher, author policies, display_mode)
- lib/auth/require-publisher.ts; app/actions/publishing.ts (setPublicationStatus, returnPublication, attachPdfFromStorage)
- author screens: app/dashboard/blogs; shared editor: components/publishing/PublicationEditor.tsx
