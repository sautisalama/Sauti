/** Meaning vectors for text, from the organisation's AI key. bge-m3 reads Swahili and English alike. */
export const EMBED_MODEL = 'baai/bge-m3';
export const EMBED_DIMS = 1024;

/** One vector per text, in order. Throws a readable error when the service is not available. */
export async function embed(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('AI is not set up on this site yet.');
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 24) {
    const batch = texts.slice(i, i + 24).map((t) => t.slice(0, 6000) || ' ');
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      signal: AbortSignal.timeout(45_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Sauti Salama Suite' },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
    });
    if (!res.ok) throw new Error(res.status === 402 ? 'The AI credit has run out. An administrator needs to top up OpenRouter.' : 'The search service is unavailable right now.');
    const j = (await res.json()) as { data?: { index: number; embedding: number[] }[] };
    const rows = (j.data ?? []).slice().sort((a, b) => a.index - b.index);
    if (rows.length !== batch.length || rows.some((r) => r.embedding.length !== EMBED_DIMS)) throw new Error('The search service returned something unexpected.');
    for (const r of rows) out.push(r.embedding);
  }
  return out;
}

/** The text form pgvector reads. */
export const toVector = (v: number[]) => `[${v.join(',')}]`;
