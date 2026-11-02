---
title: "Application tab is agent-driven, with context the user chooses"
author: Oliver
date: 2026-11-02
branch: main
cost: { minutes: 22, tokens: 231777 }
id: l-6371e295
scope: repo
status: active
src: agent
touches:
  - app/actions/mjengo-attach.ts
  - app/actions/mjengo-entity-tasks.ts
  - app/actions/mjengo.ts
  - app/dashboard/mjengo/_components/AddDocumentDialog.tsx
  - app/dashboard/mjengo/_components/DeckStudio.tsx
  - app/dashboard/mjengo/_components/DocumentsPanel.tsx
  - app/dashboard/mjengo/_components/EntityExtras.tsx
  - app/dashboard/mjengo/_components/EntityTasks.tsx
  - app/dashboard/mjengo/_components/EntityWorkspace.tsx
  - app/dashboard/mjengo/_components/FilePreviewDialog.tsx
---

## Decided
- The opportunity page has one Application tab: an agent, the context it reads (instructions, skills, notes, links, vault and Drive files), and the documents shown in full. Cover letter and CV are pills that ask about a template first. The agent only writes from what it is given and marks gaps as [to confirm].
- Files in the vault that look like application paperwork are suggested one at a time rather than added automatically, so the user decides what the agent sees.
- Details (deadline, owner, amount, link) collapse to quiet chips when empty.

## Watch out
- Server actions run one after another in the browser, so tabs load lazily and per-item calls are batched (documentPreviews). Many single calls make the page feel stuck.
- The model is chosen per run from OPENROUTER_MODELS; without OPENROUTER_API_KEY the agent explains why it is off.

In the code: app/dashboard/mjengo/_components/ApplicationStudio.tsx, app/actions/mjengo-workbench.ts, lib/mjengo/md-docx.ts, migration 20261103_application_context.sql.
