import * as Sentry from '@sentry/nextjs';
import { SENTRY_COMMON, scrub } from '@/lib/sentry-scrub';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  ...SENTRY_COMMON,
  dsn,
  enabled: !!dsn && process.env.NODE_ENV === 'production',
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  beforeSend: scrub,
});
