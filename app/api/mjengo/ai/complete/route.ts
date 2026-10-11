import { getActor } from "@/lib/access/super-admin";
import { describeAiRequest } from "@gamine/wordcraft-react/core";
import { NO_DASH_RULE } from "@/lib/plain-text";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash-lite";

/** Writing help for the document editor: streams plain text, using the organisation's OpenRouter key. */
export async function POST(request: Request) {
	const actor = await getActor();
	if (!actor?.isAdmin) return new Response("Please sign in again.", { status: 401 });
	const key = process.env.OPENROUTER_API_KEY;
	if (!key) return new Response("AI is not set up on this site yet.", { status: 503 });

	let b: { prompt?: string; action?: string; selection?: string; document?: string; instructions?: string };
	try { b = await request.json(); } catch { return new Response("Bad request.", { status: 400 }); }

	const task = describeAiRequest({ action: (b.action ?? "write") as never, prompt: b.prompt ?? "", selection: b.selection ?? "" });
	const system = [
		"You help people write in a word processor. Reply with only the text to put in the document: no preamble, no quotes around it, no Markdown headings or bold markers. Use blank lines between paragraphs. Match the language and tone of the document unless asked otherwise.",
		NO_DASH_RULE,
		b.instructions ?? "",
	].filter(Boolean).join("\n\n");
	const user = [
		b.document ? `Document so far:\n"""\n${b.document.slice(0, 12000)}\n"""` : "",
		b.selection ? `Selected text:\n"""\n${b.selection.slice(0, 6000)}\n"""` : "",
		`Task: ${task}`,
	].filter(Boolean).join("\n\n");

	const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		signal: request.signal,
		headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Sauti Salama Documents" },
		body: JSON.stringify({ model: MODEL, stream: true, temperature: 0.5, max_tokens: 1500, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
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
