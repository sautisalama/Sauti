---
title: "2026-10-17 round: WordCraft 0.3.6 native top bar/comments, commitments engine, Salama AI…"
author: Oliver
date: 2026-10-23
id: l-700e7b36
scope: repo
status: active
touches:
  - lib/mjengo/commitments.ts
  - lib/mjengo/salama.ts
  - app/actions/mjengo-salama.ts
  - scripts/test-salama.mts
  - lib/mjengo/entity-view.ts
  - lib/mjengo/timeline.ts
  - app/actions/mjengo-timeline.ts
  - scripts/test-timeline.mts
  - lib/mjengo/grant-agent.ts
  - app/actions/mjengo-grant-agent.ts
---

## Decided
Done and committed 2026-10-17: WordCraft 0.3.6 (topBar, fileMenu, ui, icons, comments exclusive) replaced our DocBar and the CSS hacks in the editor page and the guest page /d/[id]; mentions/assignments notify via notifyDocComment (vault.ts); commitments engine (lib/mjengo/commitments.ts: call notes become to-dos on a "From calls" track); Salama (lib/mjengo/salama.ts + salama-shared.ts, app/actions/mjengo-salama.ts): sourced answers gated by the asker's module access and vault levels, dock panel (SalamaPanel), call chat ("Salama, ..." typed or spoken with captions, quick asks, Hear Salama), doc comments (@Salama replies in the thread as "Salama: ...", posted under the asker's name).

Verified: e2e 32 (top bar), 33 (dock panel), 34 (call chat), scripts/test-salama.mts --live, test-commitments.mts. NOT verified: the @Salama doc-comment path (canvas editor, no e2e), spoken trigger (needs real microphone), e2e 31 is stale (looks for page text, editor draws on canvas), dev DB has no real data so answers were tested with seeded rows.

**Why:** the user wants AI as a reliable team member and the "10x" concepts: shared timeline per partner/grant (not built), ask-anything search (built as Salama), commitments engine (built), funder-aware grant agent (not built).

## Watch out
next candidates are the shared timeline and the grant agent; tool shell chokes on heredocs with apostrophes or backslashes, so write patch scripts with the Write tool and run them. See round-2026-10-13-followups and suite-round-2026-10-13.

**Timeline (same day, later)**
Built and committed: lib/mjengo/entity-view.ts (what a person may see of grants/opportunities/projects/fellowships, honours "only me" and hidden fields; Salama now uses it too), lib/mjengo/timeline.ts + auto-link.ts, app/actions/mjengo-timeline.ts, EntityTimeline in the entity sheet (Coming up / What happened, Link a call o
…

_From Claude Code's memory of this repo, last updated Oct 17._
