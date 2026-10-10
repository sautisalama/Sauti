/**
 * Server actions that THROW lose their message in production (Next replaces it with a generic
 * "error occurred in the Server Components render", which React shows as error #441). Actions whose
 * message the person needs to read return a result instead, and the client unwraps it.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Server side: run `fn`, turning a thrown Error into `{ ok: false, error }`. */
export function guard<A extends unknown[], T>(fn: (...args: A) => Promise<T>): (...args: A) => Promise<Result<T>> {
  return async (...args: A) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (e) {
      console.error('[action]', fn.name || 'anonymous', e instanceof Error ? e.message : e);
      return { ok: false, error: e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.' };
    }
  };
}

/** Client side: resolve to the data, or throw an Error carrying the readable message. */
export async function unwrap<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
