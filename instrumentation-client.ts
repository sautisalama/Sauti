import * as Sentry from '@sentry/nextjs';
import { SENTRY_COMMON, scrub } from '@/lib/sentry-scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Browser errors. No session replay and no input capture: people here report abuse and must not be recorded.
Sentry.init({
  ...SENTRY_COMMON,
  dsn,
  enabled: !!dsn && process.env.NODE_ENV === 'production',
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_BUILD_ID,
  beforeSend: scrub,
  integrations: (defaults) => defaults.filter((i) => i.name !== 'Replay'),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
