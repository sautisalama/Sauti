import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin-client";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

// Gemini 2.5 Flash Lite: cheap, fast and strong in Swahili/English. Override with OPENROUTER_MODEL.
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
const MAX_MESSAGES = 20;
const MAX_CHARS = 4000;
const RATE_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 };

/** Best-effort per-instance limiter so one account can't burn the API budget. */
const hits = new Map<string, number[]>();
function limited(userId: string): boolean {
	const now = Date.now();
	const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
	recent.push(now);
	hits.set(userId, recent);
	if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_LIMIT.windowMs)) hits.delete(k);
	return recent.length > RATE_LIMIT.max;
}

const SYSTEM_PROMPT = [
	"You are Salama, the support assistant inside Sauti Salama — a survivor-led Kenyan platform that connects people affected by gender-based violence (GBV) to counselling, medical care, legal aid and shelter.",
	"",
	"HOW YOU SPEAK:",
	"- Warm, calm, unhurried and non-judgemental. Believe the person. Never blame them. Plain words, short paragraphs.",
	"- Reply in the language of the user's latest message (English, Kiswahili, or Sheng). Switch when they switch.",
	"",
	"WHAT YOU DO:",
	"- Explain options and rights in a Kenyan context: reporting (police, P3 form, Gender Desk), the 72-hour window for post-rape care and PEP/emergency contraception at health facilities, protection orders under the Protection Against Domestic Violence Act, free legal aid, counselling and safe shelter.",
	"- Explain how Sauti Salama works: they can submit a report (anonymously if they prefer), get matched with a verified service, chat securely and book appointments from their dashboard.",
	"- Help with safety planning: safe contacts, a packed bag, important documents, using a quick exit, and clearing browsing history on a shared device.",
	"- Help people prepare what to say to a counsellor, doctor, police officer or lawyer.",
	"",
	"LIMITS — ALWAYS:",
	"- You give general information, not legal, medical or psychological advice. Encourage them to speak to a qualified professional or a matched Sauti Salama service.",
	"- If someone may be in immediate danger, say so first and clearly: call 999 or 112 (police), the national GBV helpline 1195 (free, 24/7), or Childline 116 for a child. Then offer to continue helping.",
	"- If someone mentions wanting to harm themselves, respond with care, encourage reaching someone they trust and urge them to call 1195 or go to the nearest hospital.",
	"- If a child is being abused, explain that it should be reported (Childline 116, police or a children's officer) and that Sauti Salama can help them do this.",
	"- Never ask for or repeat names, phone numbers, exact addresses or other identifying details. If the user shares some, don't echo them back.",
	"- Never promise outcomes or speak for Sauti Salama staff. Never guess when unsure — say you're not certain and point to 1195 or a professional.",
	"- Stay in scope: GBV, safety, wellbeing, rights and support services. Politely decline unrelated requests and steer back.",
	"- Do not claim to be human. If asked, say you are an AI assistant.",
	"",
	"FORMAT: light Markdown only — short paragraphs, **bold** for key terms, bullets for steps or options. Keep replies concise (usually under 180 words) unless asked for more.",
].join("\n");

export async function POST(req: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Please sign in to chat with Salama." }, { status: 401 });

	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) return NextResponse.json({ error: "The assistant is not configured yet." }, { status: 503 });

	if (limited(user.id)) {
		return NextResponse.json({ error: "You're sending messages very quickly. Please wait a few minutes and try again." }, { status: 429 });
	}

	let body: { messages?: ChatMessage[] };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid request." }, { status: 400 });
	}

	const messages = (Array.isArray(body.messages) ? body.messages : [])
		.filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
		.slice(-MAX_MESSAGES)
		.map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
	if (!messages.length || messages[messages.length - 1].role !== "user") {
		return NextResponse.json({ error: "No message provided." }, { status: 400 });
	}

	// History: the conversation is kept per user so it is still there next time they open Salama.
	const history = createAdminClient().from("assistant_messages");
	await history.insert({ user_id: user.id, role: "user", content: messages[messages.length - 1].content });

	let upstream: Response;
	try {
		upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			signal: AbortSignal.timeout(55_000),
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL?.startsWith("http") ? process.env.NEXT_PUBLIC_APP_URL : "https://sautisalama.org",
				"X-Title": "Sauti Salama Assistant",
			},
			body: JSON.stringify({
				model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
				messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
				temperature: 0.5,
				max_tokens: 600,
				stream: true,
			}),
		});
	} catch (e) {
		console.error("[assistant] upstream request failed:", e instanceof Error ? e.message : e);
		return NextResponse.json({ error: "Salama is unavailable right now. If you need help urgently, call 1195." }, { status: 502 });
	}

	if (!upstream.ok || !upstream.body) {
		console.error("[assistant] OpenRouter error", upstream.status, (await upstream.text().catch(() => "")).slice(0, 300));
		return NextResponse.json({ error: "Salama is unavailable right now. If you need help urgently, call 1195." }, { status: 502 });
	}

	// Re-emit OpenRouter's SSE as a plain text stream of deltas.
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	const reader = upstream.body.getReader();
	let buffer = "";
	let reply = "";
	const saveReply = async () => {
		if (reply.trim()) await history.insert({ user_id: user.id, role: "assistant", content: reply.slice(0, 8000) });
	};
	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					await saveReply();
					return controller.close();
				}
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const raw of lines) {
					const line = raw.trim();
					if (!line.startsWith("data:")) continue;
					const payload = line.slice(5).trim();
					if (!payload || payload === "[DONE]") continue;
					try {
						const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
						if (typeof delta === "string" && delta) {
							reply += delta;
							controller.enqueue(encoder.encode(delta));
						}
					} catch {
						/* ignore keep-alive / partial frames */
					}
				}
			} catch (e) {
				controller.error(e);
			}
		},
		cancel() {
			saveReply().catch(() => undefined); // user left mid-answer: keep what was said
			reader.cancel().catch(() => undefined);
		},
	});

	return new Response(stream, {
		headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
	});
}
