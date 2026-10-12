import { NO_DASH_RULE } from "@/lib/plain-text";

/**
 * Stream a completion from the organisation's model as plain text chunks, so the first words reach the screen
 * in a moment instead of after the whole answer. This is how Gmail's Help me write and Gemini summaries feel
 * fast: the model is asked for little, with the email text already in hand, and tokens are shown as they come.
 */
export async function streamChat(opts: { system: string; user: string; maxTokens: number; temperature?: number; signal?: AbortSignal }): Promise<Response> {
	const key = process.env.OPENROUTER_API_KEY;
	if (!key) return new Response("AI is not set up on this site yet.", { status: 503 });
	const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		signal: opts.signal,
		headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Sauti Salama Mail" },
		body: JSON.stringify({
			model: process.env.OPENROUTER_MODEL ?? "qwen/qwen3.7-flash",
			reasoning: { enabled: false },
			stream: true,
			temperature: opts.temperature ?? 0.4,
			max_tokens: opts.maxTokens,
			messages: [{ role: "system", content: `${opts.system}\n${NO_DASH_RULE}` }, { role: "user", content: opts.user }],
		}),
	});
	if (!upstream.ok || !upstream.body) return new Response(upstream.status === 402 ? "The AI credit has run out. An administrator needs to top up OpenRouter." : "The AI service is unavailable right now.", { status: upstream.status === 402 ? 402 : 502 });

	const enc = new TextEncoder();
	const dec = new TextDecoder();
	let buf = "";
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const reader = upstream.body!.getReader();
			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					buf += dec.decode(value, { stream: true });
					let i: number;
					while ((i = buf.indexOf("\n")) >= 0) {
						const line = buf.slice(0, i).trim();
						buf = buf.slice(i + 1);
						if (!line.startsWith("data:")) continue;
						const data = line.slice(5).trim();
						if (data === "[DONE]") continue;
						try {
							const t = JSON.parse(data)?.choices?.[0]?.delta?.content as string | undefined;
							if (t) controller.enqueue(enc.encode(t));
						} catch { /* a partial line */ }
					}
				}
			} finally {
				controller.close();
			}
		},
		cancel() { upstream.body?.cancel().catch(() => undefined); },
	});
	return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
