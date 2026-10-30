---
title: Blogs link goes to live publications; only admins can write them
author: Oliver
date: 2026-10-30
branch: main
cost: { minutes: 1, tokens: 52286 }
id: l-34ceb49b
scope: repo
status: active
src: agent
touches:
  - app/dashboard/blogs/page.tsx
  - supabase/migrations/20261007_publishing_and_courses.sql
---

## Decided
Blogs in professional mode are not "coming soon": publishing is live but admin-only. The old Blogs entry now sends admins to Publications and everyone else to the public publications page.

## Watch out
Non-admin professionals cannot write posts: database rules allow publication writes for admins only. Letting them submit for review needs new rules plus a submission screen. The old blog editor and vetting components are not wired to any page.

In the code:
- app/dashboard/blogs/page.tsx redirects by requireAdmin
- links: ProfessionalView.tsx Blog Posts card, resources/page.tsx button
- admin writes: supabase/migrations/20261007_publishing_and_courses.sql (publications_admin_write)
