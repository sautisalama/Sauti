# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project context
- Framework: Next.js 14 (App Router) with TypeScript
- Styling: Tailwind CSS + shadcn/ui (Radix primitives)
- Backend/data: Supabase (auth, database, realtime)
- Messaging: Stream Chat (client key required)
- Deployment: Vercel (includes a scheduled cron route)
- PWA: next-pwa configured (disabled in development)

Commands
- Install deps (npm is canonical due to package-lock.json):
  - npm install
- Dev server:
  - npm run dev
- Build and run production:
  - npm run build
  - npm run start
- Lint (Next + ESLint):
  - npm run lint
  - npm run lint -- --fix
- Type check:
  - npm run type-check
- Tests:
  - No test framework or test files are configured at this time (no test script in package.json and no *.test.* present).

Environment
- Define the following in a local env file (e.g., .env.local). Do not commit secrets.
- Variables referenced by code include (non-exhaustive):
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - NEXT_PUBLIC_SERVICE_ROLE_KEY
  - NEXT_PUBLIC_APP_URL
  - NEXT_PUBLIC_OPENWEATHER_API_KEY
  - MAILTRAP_TOKEN
  - NEXT_PUBLIC_STREAM_KEY
  - STREAM_CHAT_SECRET

High-level architecture
- App routing (app/)
  - app/layout.tsx defines global metadata, fonts, toaster, and PWA install prompt.
  - app/page.tsx renders the landing page; authenticated dashboard lives under app/dashboard.
  - API routes under app/api/* implement core server endpoints (Next.js Route Handlers):
    - reports: accepts incident reports, persists to Supabase, triggers matching, and sends email notifications.
    - support-services: CRUD/listing for service providers.
    - matched-services: match retrieval/update.
    - appointments: scheduling endpoints.
    - auth/*: OAuth and email confirmation callbacks.
    - stream/*: Stream Chat token/reset endpoints.
    - cron/daily-reminder: invoked by Vercel cron (see vercel.json).
- Authentication and session handling
  - utils/supabase/server.ts creates a server-side Supabase client bound to Next cookies. Helpers: getSession(), getUser() (profiles row fetch).
  - utils/supabase/client.ts creates a browser Supabase client for client components and hooks.
  - middleware.ts refreshes Supabase sessions and centrally gates routes:
    - Redirects unauthenticated users away from protected paths.
    - Redirects authenticated users away from auth pages to /dashboard.
- Data model and migrations
  - Database schema is defined in migrations/create_schema.sql with enums and tables:
    - profiles, reports, support_services, matched_services, appointments.
    - Trigger public.handle_new_user() creates a profiles row on auth.users insert.
  - types/db-schema.ts contains generated TypeScript types (Tables, Enums, etc.) used across client and server code.
- Matching algorithm (core domain logic)
  - app/actions/match-services.ts implements report-to-service matching:
    - Filters by required service type and computes distances via the Haversine formula.
    - Selects the closest matches and writes matched_services rows.
    - Updates the report’s match status to pending when matches exist.
  - app/api/reports/route.ts (POST) persists a new report, invokes the matching action, and sends email notifications via Mailtrap.
  - matching-algorithm.md provides additional background on scoring and planned enhancements.
- UI composition
  - components/ui/* contains shadcn-derived primitives; components/* holds feature widgets (forms, cards, dialogs).
  - app/dashboard/* composes tabs (Overview, Reports, Matched Cases, Support Services, Appointments) and uses server actions + Supabase queries.
  - hooks/* includes useUser (auth + profile fetch) and UI toast utilities.
- Path aliases and config
  - tsconfig.json maps @/* to repo root.
  - components.json (shadcn) defines aliases: components -> @/components, ui -> @/components/ui, lib -> @/lib, utils -> @/lib/utils, hooks -> @/hooks.
- Scheduling and PWA
  - vercel.json schedules GET /api/cron/daily-reminder at 06:00 daily.
  - next.config.mjs wraps config with next-pwa; PWA disabled in development, registered in production with service worker in public/.

Notes for agents
- Use the server-side Supabase client from utils/supabase/server for server actions and route handlers; use the browser client from utils/supabase/client in client components and hooks.
- When adding code that touches authentication or cookies, be mindful of middleware.ts redirect rules and the guidance comments within.
- Respect the existing path aliases when importing modules (e.g., @/utils/..., @/lib/...).

