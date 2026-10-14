import { getActor } from "@/lib/access/super-admin";
import { aiSystemPrompt, aiUserMessage } from "@gamine/wordcraft-react/core";
import { NO_DASH_RULE } from "@/lib/plain-text";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.OPENROUTER_MODEL ?? "qwen/qwen3.7-flash";

/** Writing help for the document editor: streams plain text, using the organisation's OpenRouter key. */
export async function POST(request: Request) {
	const actor = await getActor();
	if (!actor?.isAdmin) return new Response("Please sign in again.", { status: 401 });
	const key = process.env.OPENROUTER_API_KEY;
	if (!key) return new Response("AI is not set up on this site yet.", { status: 503 });

	let b: { prompt?: string; action?: string; selection?: string; document?: string; instructions?: string; history?: { role: "user" | "assistant"; content: string }[]; goals?: Record<string, string>; language?: string; data?: string };
	try { b = await request.json(); } catch { return new Response("Bad request.", { status: 400 }); }

	// The editor's own prompts: plain writing, structured blocks, document chat, writing checks and translation.
	const req = {
		prompt: String(b.prompt ?? "").slice(0, 4000),
		action: (b.action ?? "write") as never,
		selection: String(b.selection ?? "").slice(0, 6000),
		document: String(b.document ?? "").slice(0, 12000),
		history: Array.isArray(b.history) ? b.history.slice(-12).map((h) => ({ role: h.role === "assistant" ? "assistant" as const : "user" as const, content: String(h.content ?? "").slice(0, 4000) })) : undefined,
		goals: b.goals,
		language: b.language ? String(b.language).slice(0, 40) : undefined,
		data: b.data ? String(b.data).slice(0, 60_000) : undefined,
	};
	const system = [aiSystemPrompt({ instructions: b.instructions ?? "", action: req.action, goals: req.goals }), NO_DASH_RULE].filter(Boolean).join(String.fromCharCode(10, 10));
	const user = aiUserMessage(req as never);
	const structured = ["structure", "check", "ask", "translate"].includes(String(b.action));

	const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		signal: request.signal,
		headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Sauti Salama Documents" },
		body: JSON.stringify({ model: MODEL, reasoning: { enabled: false }, stream: true, temperature: 0.5, max_tokens: structured ? 3500 : 1500, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
	});
	if (!upstream.ok || !upstream.body) return new Response("The AI service is unavailable right now.", { status: 502 });

	// OpenRouter streams server-sent events; the editor wants plain text chunks.
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
							if (t) controller.enqueue(enc.encode(t.replace(/\s*[–—]\s*/g, ", ")));
						} catch { /* keep-alive comments and partial lines */ }
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
