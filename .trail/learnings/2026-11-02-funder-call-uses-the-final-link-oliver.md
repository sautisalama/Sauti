---
title: Funder call uses the final link; AI chats and GitHub repos are application context
author: Oliver
date: 2026-11-02
branch: main
cost: { minutes: 52, tokens: 216316 }
id: l-dce6e40a
scope: repo
status: active
src: agent
touches:
  - app/actions/mjengo-panel-prefs.ts
  - app/actions/mjengo-workbench.ts
  - app/dashboard/mjengo/_components/ApplicationStudio.tsx
  - app/dashboard/mjengo/_components/EntityWorkspace.tsx
  - scripts/e2e/audit-application.mjs
  - scripts/e2e/audit-dark-suite.mjs
  - scripts/e2e/audit-opp-docs.mjs
  - scripts/e2e/audit-opp-layout.mjs
  - scripts/e2e/audit-vault-suite.mjs
  - app/dashboard/mjengo/_components/DocumentsPanel.tsx
---

## Decided
- The funder call shown and read by the agent is the address the shared link ends up at on the funder own site (verification.finalUrl), then the application link, then the saved link. It carries more detail than the shared post.
- An AI chat about an opportunity is a normal Assistant thread with entity_type and entity_id set, and a context item of kind chat links it. GitHub repositories are stored as link context with the README read at add time (public repos only).

In the code: lib/mjengo/entity-brief.ts, app/actions/mjengo-workbench.ts, app/api/mjengo/assistant/chat/route.ts, migration 20261104_application_chat.sql.
