import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config');
}

/** Server errors in pages, actions and routes are reported (without anything personal) once a DSN is set. */
export const onRequestError = Sentry.captureRequestError;
