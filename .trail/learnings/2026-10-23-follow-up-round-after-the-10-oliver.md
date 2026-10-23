---
title: "Follow-up round after the 10-13 suite: what was fixed (PiP, previews, comments,…"
author: Oliver
date: 2026-10-23
id: l-aba9d441
scope: repo
status: active
touches:
  - lib/seo/previews.ts
  - utils/supabase/middleware.ts
  - lib/finance/receipt-qr.ts
  - lib/mjengo/pptx-fix.ts
  - docs/wordcraft-letterhead-prompt.md
---

## Decided
Committed on main (unpushed), in order: PDF editor pen fix + e2e 20 (12/12); rotate-phone overlay removed; Meet picture in picture = Document PiP window with mic/cam/leave; link previews via lib/seo/previews.ts + app/api/og (forms, docs, meet, Sauti ID, group invite, schedule; /connect made public in utils/supabase/middleware.ts); design selection toolbar icons; background removal fixed for GPUs with <24 storage buffers (CPU modnet, BiRefNet only on big GPUs); Manage button per person (ManageAccess.tsx) + Shared by me filter; PDF comments (migration 20261051_pdf_comments applied dev+prod, e2e 22); companion mode only for signed-in account (userId prop, uid in presence); finance QR scan (lib/finance/receipt-qr.ts, jsqr, e2e 23); PPTX chart/nav/header fixes in lib/mjengo/pptx-fix.ts.

**Open / unclear:** echo on host not reproduced (needs two devices; mitigations only); "design system not custom like forms" unclear which screen; legacy .ppt still unsupported; pptx master-slide shapes (footer bars) not drawn by pptx-preview; docx letterhead e2e 21 still paused (editor loads, form prefill unconfirmed); Document PiP untested in a real browser; generating receipts/KRA documents from the suite not built (only scan + tag); Zoom best-practice review of Meet not done; `outline` Button variant has min-w-[40%] globally (stretches in flex rows).

**Why:** user sent a long mid-turn list on 2026-10-13.

## Watch out
ask which items to continue; verify before assuming done.

**Later in the same day (round 3)**
Done and committed: outline buttons no min-w; DeckStudio (pictures/logo/colours, e2e 24); pptx fallback viewer + .ppt text + damaged-file guard (e2e 25); meet end-for-everyone prompt, overtime note (endsAt, invited only), pinned chat; forms access levels + restrict (migration 20261052); fund details from link + consultancy type + empty fields omitted (migration 20261053, e2e 26); docs AI rewrite/continue test (e2e 27). All migrations applied dev+prod.
…

_From Claude Code's memory of this repo, last updated Oct 13._
