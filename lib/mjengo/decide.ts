/**
 * Typed decisions from TypeSafe's Jev (System One) through OpenRouter, with the same OPENROUTER_API_KEY as every
 * other AI call: no extra key. You give it text and a question with a fixed set of answers, it returns one of
 * them with probabilities, in one fast pass and without writing prose. The right tool for "which of these is
 * it" and "yes or no"; the wrong one for writing, arithmetic or counting.
 *
 * Every function returns null when it cannot answer, and the caller then uses its own rule or the language model.
 */

export interface Choice<K extends string> { choice: K; probability: number; confidence: number; probabilities: Record<string, number> }

export const decideConfigured = () => !!process.env.OPENROUTER_API_KEY;

async function evaluate(state: string, instructions: string, criteria: Record<string, string>): Promise<{ choice: string; probabilities: Record<string, number>; confidence: number } | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST',
      signal: AbortSignal.timeout(6_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.JEV_MODEL || 'typesafe/jev-1.13', state: { text: state.slice(0, 24_000) }, questions: { q: { type: 'choice', instructions, criteria } } }),
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
