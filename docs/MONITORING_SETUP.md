# Security and error monitoring: what is set up and what you still do

The repo is public. Four tools watch it, and each one has one job so there are few dashboards and few alerts.

| Tool | Job | Where you look |
|---|---|---|
| Dependabot | Known vulnerabilities (CVEs) in packages, plus update pull requests | GitHub → Security → Dependabot |
| Semgrep | Security mistakes in our own code | GitHub → Security → Code scanning |
| Sentry | Errors happening for real users | sentry.io |
| CodeRabbit | Review comments on pull requests | The pull request itself |

CodeQL, Snyk and a separate `npm audit` job are left out on purpose. They would report the same things again.

## Already in the repo

- `.github/dependabot.yml`: weekly grouped npm updates (max 3 open), monthly GitHub Actions updates.
- `.github/workflows/semgrep.yml`: runs on pushes to `main`, on pull requests and every Monday. Results go to the Security tab.
- `.coderabbit.yaml`: reviews pull requests for logic and correctness. Its own security scanners are off to avoid repeating Semgrep.
- Sentry code: `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `lib/sentry-scrub.ts`, and the error pages `app/error.tsx` and `app/global-error.tsx`.
  - It does nothing until a DSN is set, and only runs in production.
  - It removes request bodies, cookies, headers, query strings, IP addresses and emails, and keeps only a user id. There is no session replay. People using this app report abuse, so nothing they type or see is recorded.

## What you need to do

### 1. GitHub security settings (about 3 minutes)

In the repo: **Settings → Code security** (called "Advanced Security" on some accounts).

1. Turn on **Dependabot alerts**. This is the CVE feed.
2. Turn on **Dependabot security updates**. GitHub then opens a fix pull request when a vulnerable package has a fix.
3. Turn on **Secret scanning** and **Push protection**. This blocks a push that contains a key or token.
4. Turn on **Private vulnerability reporting** so people can report a problem to you without posting it publicly.
5. Under **Code scanning**, nothing to set up. The Semgrep workflow uploads its results by itself. Check **Actions → semgrep** to see the first run finished.

### 2. Fewer GitHub emails

1. Go to GitHub → profile photo → **Settings → Notifications**.
2. Under **Dependabot alerts**, untick **Email** and keep **Web**, or choose a weekly digest.
3. Under **Actions**, set it to notify on failed workflows only.

### 3. Sentry (about 5 minutes)

1. Create a free account at sentry.io and a new project. Choose **Next.js**. Skip the wizard if it offers to change files, since the code is already in the repo.
2. Copy the **DSN** from Project Settings → Client Keys.
3. In Vercel, open the project → **Settings → Environment Variables** and add, for **Production** only:
   - `NEXT_PUBLIC_SENTRY_DSN` = the DSN
   - `SENTRY_DSN` = the same DSN (optional, used by the server)
4. Redeploy. The DSN is baked into the browser build, so a redeploy is needed.
5. In Sentry → **Alerts**, keep one rule: **a new issue is created**, sent to your email. Delete the other default rules.
6. In Sentry → **Settings → Security & Privacy**, turn on **Prevent Storing of IP Addresses** and **Data Scrubber**. The code already scrubs data, and this is a second layer.
7. To check it works, trigger one error on the live site and see it appear in Sentry within a minute.

Not set up yet: readable stack traces. Without source maps, Sentry shows built file names. If that gets in the way, add `withSentryConfig` in `next.config.mjs` and a `SENTRY_AUTH_TOKEN` in Vercel.

### 4. CodeRabbit (about 3 minutes)

1. Go to coderabbit.ai and sign in with GitHub.
2. Install the app on the `sautisalama/Sauti` repository only.
3. Check its pricing page that the free tier covers public repositories.
4. CodeRabbit only reviews **pull requests**. Work that goes straight to `main` is not reviewed. For bigger changes, open a branch and a pull request.
5. If its comments get noisy, change `profile: chill` in `.coderabbit.yaml` or add paths to `path_filters`.

## Routine, once it is running

- **Weekly:** open GitHub → Security. Handle anything marked critical or high first.
- **When a Dependabot security pull request arrives:** check the build passes, then merge it.
- **When Sentry emails a new issue:** open it, see which page and release it came from, and fix or ignore it.
- **When a CVE is in the news:** look under Security → Dependabot to see whether we use that package. Nothing is listed if we don't.
