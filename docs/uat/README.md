# Sauti Salama — User Acceptance Testing

This folder is the acceptance pack for the platform. Every scenario exists twice:

* as a **manual script** a person can follow in a browser (the role files below), and
* as an **automated check** (`scripts/e2e/uat/*.mjs`) that drives a real browser and the real database.

`TRACEABILITY.md` links each manual test case to the automated check that covers it, so a sign-off can rely on either.

| File | Audience | Covers |
|---|---|---|
| `01-admin.md` | Sauti Salama administrators | Approving professionals and NGOs, verifying services, bans, matching oversight, publishing, courses |
| `02-professional-ngo.md` | Lawyers, medics, counsellors, NGOs | Onboarding, receiving and accepting cases, secure chat, scheduling, completing cases |
| `03-survivor.md` | Survivors (including anonymous) | Reporting, being matched, chatting, booking, communities, AI assistant, privacy |
| `04-publishing-learning.md` | Admins and learners | Publications (Word/PDF import, preview, publish, email), courses and progress |
| `05-monitoring-and-security.md` | Operations | 24h "Delayed Support" escalation, cron protection, access-control attacks |
| `TRACEABILITY.md` | QA / sign-off | Manual case ↔ automated check |
| `KNOWN-GAPS.md` | Everyone | What is not built or behaves unexpectedly |
| `RESULTS.md` | Generated | Output of the last automated run |

## Environments

Run acceptance on **dev** ("sauti salama - dev"). Production is only changed after dev passes; the gated migrations listed in the handoff are applied after the code is deployed.

## Running the automated suites

```bash
# Terminal 1 – app with test-mode email (nothing is sent; mail is written to .e2e-outbox.jsonl)
EMAIL_MODE=capture CRON_SECRET=e2e-cron-secret \
PUBLICATIONS_EMAIL=publications@sautisalama.org \
ESCALATION_EMAILS=malkia@sautisalama.org,oliver@sautisalama.org \
DATA_ENCRYPTION_KEY=$(openssl rand -base64 32) npm run dev

# Terminal 2 – everything (reseeds before each suite, writes docs/uat/RESULTS.md)
node --env-file=.env.local scripts/e2e/run-all.mjs

# one suite
node --env-file=.env.local scripts/e2e/run-all.mjs 05      # or "security", "monitoring" …
```

Unit tests: `npm run test:content`, `npx tsx scripts/test-crypto.mts`, `scripts/test-ssrf.mts`, `scripts/test-escalation-email.mts`.

> `EMAIL_MODE=capture` is ignored in production builds. Without it the suites send **real** email (including to the escalation recipients).

## Test accounts (dev only)

`node --env-file=.env.local scripts/e2e/seed.mjs` creates eight accounts and fixtures; credentials are written to the git-ignored `.e2e-accounts.local.json`. `seed.mjs --cleanup` removes them.

| Key | Role | State |
|---|---|---|
| `admin` | Administrator | – |
| `professional` | Lawyer (E2E Lawyer, E2E Legal Aid Clinic) | verified, public booking on |
| `medic` | Nurse (E2E Nurse) | verified, no public booking |
| `ngo` | Shelter NGO | verified |
| `pending_pro` | Counsellor (E2E Counsellor) | awaiting review |
| `pending_ngo` | NGO | awaiting review |
| `survivor`, `survivor2` | Survivors (E2E Learner is `survivor`) | – |

For manual runs, sign in with these (the password is in the JSON file; never share it).

## Sign-off

| Role | Name | Date | All cases passed? | Open issues (IDs) | Signature |
|---|---|---|---|---|---|
| Product owner | | | | | |
| Admin representative | | | | | |
| Professional / NGO representative | | | | | |
| Survivor-support representative | | | | | |
| Engineering | | | | | |

A release is accepted when every case marked **Must** passes, or each failure has a documented workaround and an owner.
