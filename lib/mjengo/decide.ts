/**
 * Typed decisions from TypeSafe's Jev (System One): you give it text and a question with a fixed set of
 * answers, it returns one of them with probabilities, in one fast pass and without writing prose. It is the
 * right tool for "which of these is it", "yes or no", and "should I call the language model at all", and the
 * wrong one for writing, arithmetic or counting.
 *
 * Switched on by TYPESAFE_API_KEY. Without it every function returns null and the caller uses its own rule or
 * the language model, so nothing depends on it. Base URL can be changed with TYPESAFE_API_BASE (a gateway).
 */

export interface Choice<K extends string> { choice: K; probability: number; confidence: number; probabilities: Record<string, number> }

export const decideConfigured = () => !!process.env.TYPESAFE_API_KEY;

async function evaluate(state: string, instructions: string, criteria: Record<string, string>): Promise<{ choice: string; probabilities: Record<string, number>; confidence: number } | null> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) return null;
  const base = (process.env.TYPESAFE_API_BASE || 'https://api.typesafe.ai').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      signal: AbortSignal.timeout(6_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: state.slice(0, 24_000), model: process.env.TYPESAFE_MODEL || 'jev-latest', questions: { q: { type: 'choice', instructions, criteria } } }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { answers?: { q?: { choice?: string; probabilities?: Record<string, number>; confidence?: number } } };
    const a = j.answers?.q;
    if (!a?.choice) return null;
    return { choice: a.choice, probabilities: a.probabilities ?? {}, confidence: a.confidence ?? a.probabilities?.[a.choice] ?? 0 };
  } catch {
    return null;
  }
}

/** Pick one of the given answers. Null when Jev is not configured or did not answer. */
export async function decideChoice<K extends string>(state: string, instructions: string, options: Record<K, string>): Promise<Choice<K> | null> {
  const r = await evaluate(state, instructions, options);
  if (!r || !(r.choice in options)) return null;
  return { choice: r.choice as K, probability: r.probabilities[r.choice] ?? r.confidence, confidence: r.confidence, probabilities: r.probabilities };
}

/** Yes or no with a probability for yes. */
export async function decideYesNo(state: string, question: string, yes: string, no: string): Promise<{ yes: boolean; probability: number } | null> {
  const r = await decideChoice(state, question, { yes, no });
  if (!r) return null;
  const p = r.probabilities.yes ?? (r.choice === 'yes' ? r.probability : 1 - r.probability);
  return { yes: r.choice === 'yes', probability: p };
}
