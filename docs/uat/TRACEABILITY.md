# Traceability — manual case ↔ automated check

Automated IDs refer to `scripts/e2e/uat/` (suite number in the name) and `scripts/e2e/`.

| Manual case | Automated check(s) |
|---|---|
| ADM-V1, V2, V3 | `01-verification` VER-02 – VER-07 |
| ADM-V4 | VER-08, VER-18 |
| ADM-V5 | VER-09 – VER-11 |
| ADM-V6 | VER-01, VER-12, VER-13 |
| ADM-V7 | VER-14 – VER-16 |
| ADM-V8 | VER-17 |
| ADM-V9 | VER-19 |
| ADM-V10, V11 | VER-04, `security` SEC-* |
| ADM-M1 – M4 | `02-reporting-matching` MAT-13, MAT-14; `simulate.mts` |
| PRO-03 | MAT-05, MAT-21 |
| PRO-04 | CASE-02, CASE-03, MAT-22 |
| PRO-05 | CASE-04, CASE-08, CASE-09 |
| PRO-06, PRO-07 | CASE-05, CASE-10, CASE-11 |
| PRO-08 | CASE-12 – CASE-14, `04-communication` COM-02 |
| PRO-10 | CASE-16 – CASE-18 |
| PRO-11 | MAT-12, `05-scheduling` SCH-21 |
| PRO-12 | MAT-09, MAT-10 |
| PRO-13 | SCH-17 – SCH-19 |
| PRO-14 | SCH-06 – SCH-10, SCH-25 |
| PRO-16 | COM-03 – COM-11 |
| SUR-01 – SUR-03 | REP-01 – REP-05 (voice recording verified in the browser with a fake microphone) |
| SUR-05, SUR-06 | REP-06, REP-07, MAT-01 – MAT-04, MAT-11 |
| SUR-07 | MAT-15 – MAT-17 |
| SUR-08, SUR-09 | MAT-06, CASE-09, CASE-12, MAT-22 |
| SUR-10 | MAT-18, MAT-23 |
| SUR-11 | `07-content` voice-note checks (private bucket, signed links) |
| SUR-12 | COM-01 |
| SUR-13 | COM-07 – COM-22 |
| SUR-14 | COM-23 – COM-25 |
| SUR-15 – SUR-17 | SCH-01 – SCH-05, SCH-11 – SCH-16, SCH-22 – SCH-24 |
| ADM-P1 – P12 | `07-content` publication checks (editor, draft, preview, import, publish, email, sitemap, audit) |
| ADM-C1 – C3, LRN-01 – 04 | `07-content` course checks |
| OPS-01 – OPS-08 | `06-monitoring` MON-01 – MON-15 |
| SEC-* | `security.mjs`, `public.mjs` |

Not automated (manual only): real email delivery through Mailtrap, Google Calendar OAuth, real phone microphone, visual/mobile polish.
