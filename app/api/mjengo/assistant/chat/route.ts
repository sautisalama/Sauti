import { randomUUID } from "node:crypto";
import { getActor } from "@/lib/access/super-admin";
import { looseAdmin } from "@/lib/loose-db";
import { decryptField, encryptField } from "@/lib/security/crypto";
import { NO_DASH_RULE, stripDashes } from "@/lib/plain-text";
import { readableFile } from "@/lib/mjengo/files-text";

export const runtime = "nodejs";
export const maxDuration = 60;

const FREE_TOKENS = Number(process.env.MJENGO_AI_FREE_TOKENS ?? 50000);
const SHARED_MODEL = process.env.OPENROUTER_MODEL ?? "qwen/qwen3.7-flash";
const IMAGE_MODEL = "google/gemini-2.5-flash-image-preview";
const BUCKET = "mjengo-docs";

type Provider = "openrouter" | "openai" | "chatgpt";
interface Key { provider: Provider; key: string; model: string | null; shared: boolean }

const line = (o: unknown) => JSON.stringify(o) + "\n";
const estimate = (s: string) => Math.ceil(s.length / 4);

/**
 * One turn of the assistant. Streams newline-delimited JSON events: {t:"thread"}, {t:"delta"}, {t:"image"},
 * {t:"done"}, {t:"limit"} and {t:"error"}. The shared organisation key is limited to a small allowance per
 * person; after that they connect their own key.
 */
export async function POST(request: Request) {
	const actor = await getActor();
	if (!actor?.isAdmin) return new Response(line({ t: "error", message: "Please sign in again." }), { status: 401 });

	let body: { threadId?: string | null; message?: string; mode?: "chat" | "image"; designSystemId?: string | null; fileIds?: string[] };
	try { body = await request.json(); } catch { return new Response(line({ t: "error", message: "Bad request." }), { status: 400 }); }
	const text = (body.message ?? "").trim().slice(0, 6000);
	if (!text) return new Response(line({ t: "error", message: "Write a message first." }), { status: 400 });
	const mode = body.mode === "image" ? "image" : "chat";

	const db = looseAdmin();
	const { data: st } = await db.from("mjengo_ai_settings").select("provider, api_key_enc, refresh_token_enc, token_expires_at, chatgpt_client_id, model, free_tokens_used").eq("owner_id", actor.id).maybeSingle();
	const used = st?.free_tokens_used ?? 0;

	let key: Key | null = null;
	if (st?.api_key_enc && st.provider) {
		let k = decryptField(st.api_key_enc);
		// A ChatGPT sign-in expires: renew it from the refresh token when it is close to ending.
		if (st.provider === "chatgpt" && st.refresh_token_enc && st.chatgpt_client_id && (!st.token_expires_at || new Date(st.token_expires_at).getTime() < Date.now() + 60_000)) {
			const r = await fetch("https://auth.openai.com/api/accounts/oauth/token", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ grant_type: "refresh_token", client_id: st.chatgpt_client_id, refresh_token: decryptField(st.refresh_token_enc) ?? "", resource: "https://api.openai.com/v1" }),
				signal: AbortSignal.timeout(15_000),
			}).catch(() => null);
			if (r?.ok) {
				const t = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
				if (t.access_token) {
					k = t.access_token;
					await db.from("mjengo_ai_settings").update({ api_key_enc: encryptField(t.access_token), refresh_token_enc: t.refresh_token ? encryptField(t.refresh_token) : st.refresh_token_enc, token_expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString() }).eq("owner_id", actor.id);
				}
			} else {
				return new Response(line({ t: "error", message: "Your ChatGPT sign-in ended. Connect it again in the assistant settings." }), { status: 401 });
			}
		}
		if (k) key = { provider: st.provider as Provider, key: k, model: st.model, shared: false };
	}
	if (!key) {
		if (mode === "image") return new Response(line({ t: "limit", reason: "image" }), { status: 402 });
		if (!process.env.OPENROUTER_API_KEY || used >= FREE_TOKENS) return new Response(line({ t: "limit", reason: "tokens" }), { status: 402 });
		key = { provider: "openrouter", key: process.env.OPENROUTER_API_KEY, model: SHARED_MODEL, shared: true };
	}

	// The thread (a new one is started when none is given) and its history.
	let threadId = body.threadId ?? null;
	let designId = body.designSystemId ?? null;
	if (threadId) {
		const { data: t } = await db.from("mjengo_ai_threads").select("id, design_system_id").eq("id", threadId).eq("owner_id", actor.id).maybeSingle();
		if (!t) return new Response(line({ t: "error", message: "That chat no longer exists." }), { status: 404 });
		designId = designId ?? t.design_system_id;
	} else {
		const { data: t } = await db.from("mjengo_ai_threads").insert({ owner_id: actor.id, title: text.slice(0, 60), design_system_id: designId }).select("id").single();
		threadId = t?.id ?? null;
	}
	if (!threadId) return new Response(line({ t: "error", message: "Could not start the chat." }), { status: 500 });

	const { data: hist } = await db.from("mjengo_ai_messages").select("role, content").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(20);
	const history = ((hist ?? []) as { role: "user" | "assistant"; content: string }[]).reverse().filter((m) => m.content);

	let design = "";
	if (designId) {
		const { data: d } = await db.from("mjengo_design_systems").select("name, description, colors, fonts, voice, notes").eq("id", designId).maybeSingle();
		if (d) {
			design = [
				`Follow the "${d.name}" design system for any copy, layouts or images.`,
				d.description ? `About it: ${d.description}` : "",
				(d.colors as string[])?.length ? `Colours: ${(d.colors as string[]).join(", ")}.` : "",
				d.fonts ? `Fonts: ${d.fonts}.` : "",
				d.voice ? `Voice and tone: ${d.voice}` : "",
				d.notes ? `Rules: ${d.notes}` : "",
			].filter(Boolean).join("\n");
		}
		const { data: refs } = await db.from("mjengo_design_system_files").select("excerpt").eq("design_system_id", designId).limit(4);
		const texts = ((refs ?? []) as { excerpt: string | null }[]).map((r) => r.excerpt).filter(Boolean) as string[];
		if (texts.length) design += `\n\nReference documents for this design system:\n${texts.map((t, i) => `[${i + 1}] ${t.slice(0, 3500)}`).join("\n\n")}`;
	}

	// Documents attached to this message are read for context (and stay in the person's private docs).
	const attached: { id: string; name: string; text: string }[] = [];
	for (const fid of (body.fileIds ?? []).slice(0, 3)) {
		try { attached.push(await readableFile(actor.id, actor.email, fid, 6000)); } catch { /* skip files they cannot open */ }
	}
	const withFiles = attached.length
		? `${attached.map((f) => `Attached file "${f.name}":\n${f.text || "(the contents could not be read)"}`).join("\n\n")}\n\n${text}`
		: text;

	await db.from("mjengo_ai_messages").insert({ thread_id: threadId, role: "user", content: text, file_ids: attached.map((f) => f.id) });
	await db.from("mjengo_ai_threads").update({ status: "running", error: null }).eq("id", threadId);

	const enc = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let open = true;
			const send = (o: unknown) => { if (!open) return; try { controller.enqueue(enc.encode(line(o))); } catch { open = false; } };
			const finish = async (assistantText: string, tokens: number, assetId?: string | null) => {
				await db.from("mjengo_ai_messages").insert({ thread_id: threadId, role: "assistant", content: assistantText, asset_id: assetId ?? null, tokens });
				await db.from("mjengo_ai_threads").update({ updated_at: new Date().toISOString(), status: "idle", error: null }).eq("id", threadId);
				if (key!.shared) await db.from("mjengo_ai_settings").upsert({ owner_id: actor.id, free_tokens_used: used + tokens, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
			};
			try {
				send({ t: "thread", id: threadId });
				if (mode === "image") {
					const prompt = design ? `${design}\n\nCreate: ${text}` : text;
					const bytes = key!.provider === "openrouter" ? await openrouterImage(key!, prompt) : await openaiImage(key!, prompt);
					const path = `studio/${randomUUID()}.png`;
					const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png" });
					if (up.error) throw new Error("Could not save the image.");
					const { data: asset } = await db.from("mjengo_assets").insert({ name: text.slice(0, 60) || "Image", path, mime: "image/png", kind: "image", prompt: text, design_system_id: designId, created_by: actor.id }).select("id").single();
					const signed = await db.storage.from(BUCKET).createSignedUrl(path, 3600);
					send({ t: "image", assetId: asset?.id, url: signed.data?.signedUrl });
					await finish("", 0, asset?.id);
					send({ t: "done", tokens: 0 });
					return;
				}

				const system = [
					"You are the team assistant inside the Mjengo suite of Sauti Salama, a survivor-led Kenyan organisation working on gender-based violence. Help with grant writing, partnerships, communications, planning and everyday work. Be clear, practical and concise. Use light Markdown.",
					NO_DASH_RULE,
					design,
				].filter(Boolean).join("\n\n");
				const remaining = Math.max(0, FREE_TOKENS - used);
				const maxTokens = key!.shared ? Math.max(1, remaining) : 2000;
				const messages = [{ role: "system", content: system }, ...history, { role: "user", content: withFiles }];

				const url = key!.provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
				const model = key!.model || (key!.provider === "openrouter" ? SHARED_MODEL : "gpt-4o-mini");
				const res = await fetch(url, {
					method: "POST",
					headers: { Authorization: `Bearer ${key!.key}`, "Content-Type": "application/json", "X-Title": "Sauti Salama Assistant" },
					body: JSON.stringify({ model, stream: true, stream_options: { include_usage: true }, max_tokens: maxTokens, temperature: 0.6, messages, ...(key!.provider === "openrouter" ? { reasoning: { enabled: false } } : {}) }),
				});
				if (!res.ok || !res.body) {
					const err = await res.text().catch(() => "");
					if (res.status === 401 || res.status === 403) throw new Error("Your API key was refused. Check it in the assistant settings.");
					if (res.status === 402 || /insufficient|quota|credit/i.test(err)) throw new Error("The account behind this key is out of credit.");
					throw new Error("The AI service is unavailable right now.");
				}
				const reader = res.body.getReader();
				const dec = new TextDecoder();
				let buf = "";
				let out = "";
				let usage = 0;
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					buf += dec.decode(value, { stream: true });
					let i: number;
					while ((i = buf.indexOf("\n")) >= 0) {
						const l = buf.slice(0, i).trim();
						buf = buf.slice(i + 1);
						if (!l.startsWith("data:")) continue;
						const d = l.slice(5).trim();
						if (d === "[DONE]") continue;
						try {
							const j = JSON.parse(d);
							const t = j?.choices?.[0]?.delta?.content as string | undefined;
							if (t) {
								const clean = t.replace(/\s*[–—]\s*/g, ", ");
								out += clean;
								send({ t: "delta", text: clean });
							}
							if (j?.usage?.total_tokens) usage = j.usage.total_tokens;
						} catch { /* partial line */ }
					}
				}
				const tokens = usage || estimate(text) + estimate(out);
				await finish(stripDashes(out), tokens);
				send({ t: "done", tokens, usedFree: key!.shared ? used + tokens : undefined, hitLimit: key!.shared && used + tokens >= FREE_TOKENS });
			} catch (e) {
				const message = e instanceof Error ? e.message : "Something went wrong.";
				await db.from("mjengo_ai_threads").update({ status: "failed", error: message.slice(0, 300) }).eq("id", threadId);
				send({ t: "error", message });
			} finally {
				try { controller.close(); } catch { /* the client has gone */ }
			}
		},
	});
	return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

async function openrouterImage(k: Key, prompt: string): Promise<Buffer> {
	const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		signal: AbortSignal.timeout(55_000),
		headers: { Authorization: `Bearer ${k.key}`, "Content-Type": "application/json", "X-Title": "Sauti Salama Studio" },
		body: JSON.stringify({ model: IMAGE_MODEL, modalities: ["image", "text"], messages: [{ role: "user", content: prompt }] }),
	});
	if (!res.ok) throw new Error("The image service refused the request.");
	const j = (await res.json()) as { choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[] };
	const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
	const m = url ? /^data:image\/\w+;base64,(.+)$/.exec(url) : null;
	if (!m) throw new Error("No image came back. Try describing it differently.");
	return Buffer.from(m[1], "base64");
}

async function openaiImage(k: Key, prompt: string): Promise<Buffer> {
	const res = await fetch("https://api.openai.com/v1/images/generations", {
		method: "POST",
		signal: AbortSignal.timeout(55_000),
		headers: { Authorization: `Bearer ${k.key}`, "Content-Type": "application/json" },
		body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024" }),
	});
	if (!res.ok) throw new Error("OpenAI refused the image request.");
	const j = (await res.json()) as { data?: { b64_json?: string }[] };
	const b = j.data?.[0]?.b64_json;
	if (!b) throw new Error("No image came back.");
	return Buffer.from(b, "base64");
}
