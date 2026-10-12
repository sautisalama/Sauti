import { getActor } from "@/lib/access/super-admin";
import { streamChat } from "@/lib/mjengo/stream-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type Task = "summary" | "reply" | "refine";

interface Body {
	task: Task;
	subject?: string;
	from?: string;
	/** The message being read or answered, already on the page: no mailbox round trip is needed. */
	text?: string;
	/** Earlier messages in the conversation, oldest first, as short snippets. */
	earlier?: { from: string; text: string }[];
	/** For reply: what to say. For refine: the mode. */
	instruction?: string;
	/** For refine: the draft to rewrite. */
	draft?: string;
	tone?: string;
}

const clip = (s: string | undefined, n: number) => (s ?? "").replace(/\r/g, "").trim().slice(0, n);

/**
 * Mail writing help that streams: a summary at the top of a long message, a first draft of a reply, and
 * refinements of a draft (Formalize, Elaborate, Shorten, Recreate), the same shape as Gmail's Help me write.
 */
export async function POST(request: Request) {
	const actor = await getActor();
	if (!actor?.isAdmin) return new Response("Please sign in again.", { status: 401 });
	let b: Body;
	try { b = (await request.json()) as Body; } catch { return new Response("Bad request.", { status: 400 }); }

	const text = clip(b.text, 7000);
	const subject = clip(b.subject, 200);
	const from = clip(b.from, 120);
	const earlier = (b.earlier ?? []).slice(-4).map((e) => `${clip(e.from, 60)}: ${clip(e.text, 600)}`).join("\n---\n");

	if (b.task === "summary") {
		return streamChat({
			system: "You summarise an email thread for a busy colleague at Sauti Salama, a survivor-led GBV support organisation in Kenya. Reply in plain text only, in this shape: first a line starting with \"TL;DR: \" of at most 25 words. Then up to four short bullet lines each starting with \"- \" with the key points. If something is asked of the reader, add a last line \"Needs: \" with the ask and any date. Only use what is in the email. Never invent details. Use the language of the email.",
			user: `Subject: ${subject}\nFrom: ${from}\n${earlier ? `Earlier in the thread:\n${earlier}\n\n` : ""}Latest message:\n${text}`,
			maxTokens: 220,
			temperature: 0.2,
			signal: request.signal,
		});
	}

	if (b.task === "refine") {
		const draft = clip(b.draft, 4000);
		if (!draft) return new Response("Nothing to rewrite.", { status: 400 });
		const how: Record<string, string> = {
			formalize: "Rewrite it in a formal, polite register suitable for a funder or senior contact.",
			elaborate: "Expand it with a little more helpful detail and a clear next step, without inventing facts.",
			shorten: "Make it clearly shorter, keeping the key points.",
			recreate: "Write a fresh version with different wording and structure but the same meaning.",
			friendlier: "Make it warmer and friendlier while staying professional.",
		};
		return streamChat({
			system: `You edit email drafts. ${how[b.tone ?? "recreate"] ?? how.recreate} Keep the language of the draft. Reply with only the rewritten body, no greeting changes unless needed, no subject, no commentary. Use blank lines between paragraphs.`,
			user: `Draft:\n${draft}${text ? `\n\nThe email being answered, for context:\n${text.slice(0, 2500)}` : ""}`,
			maxTokens: 700,
			temperature: 0.6,
			signal: request.signal,
		});
	}

	// reply
	return streamChat({
		system: "You write email replies for the team at Sauti Salama, a survivor-led GBV support organisation in Kenya. Write only the body of the reply: clear, warm and brief, in the language and tone of the email being answered (formal if they are formal, relaxed if they are relaxed). Answer what was asked. No subject line, no sign-off name, no placeholders in brackets, no invented facts or dates. Use blank lines between paragraphs.",
		user: `Reply to ${from || "the sender"} about \"${subject}\".\n${b.instruction ? `What to say: ${clip(b.instruction, 500)}\n` : ""}${earlier ? `\nEarlier in the thread:\n${earlier}\n` : ""}\nTheir email:\n${text}`,
		maxTokens: 450,
		temperature: 0.5,
		signal: request.signal,
	});
}
