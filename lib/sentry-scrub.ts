import type { ErrorEvent } from '@sentry/nextjs';

/**
 * Sauti Salama handles reports from survivors of abuse. Error reports must say what broke and where, never who
 * was using it or what they typed: no request bodies, cookies, headers, query strings, IP addresses or emails.
 */
export function scrub(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split('?')[0];
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => {
      const { data, ...rest } = b;
      void data;
      return rest;
    });
  }
  return event;
}

/** Errors that are part of normal use, not faults. */
export const IGNORED = [
  'ResizeObserver loop',
  'NEXT_REDIRECT',
  'NEXT_NOT_FOUND',
  'AbortError',
  'Non-Error promise rejection captured',
  /Failed to fetch/i,
  /Load failed/i,
  /NetworkError/i,
];

export const SENTRY_COMMON = {
  sendDefaultPii: false,
  // Errors only, plus a small sample of slow pages; no session recording of what people do.
  tracesSampleRate: 0.05,
  ignoreErrors: IGNORED,
} as const;
