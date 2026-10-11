import { NO_DASH_RULE, stripDashes } from '@/lib/plain-text';

/** One-shot text completion on the organisation key. Throws a readable error when AI is unavailable. */
export async function askAi(system: string, user: string, maxTokens = 600, opts: { json?: boolean; temperature?: number } = {}): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('AI is not set up on this site yet.');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Sauti Salama Suite' },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash-lite',
      temperature: opts.temperature ?? 0.4,
      max_tokens: maxTokens,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'system', content: `${system}\n${NO_DASH_RULE}` }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error('The AI service is unavailable right now.');
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return stripDashes((j.choices?.[0]?.message?.content ?? '').trim());
}
