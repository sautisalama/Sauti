import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { looseAdmin } from "@/lib/loose-db";
import { BUILTIN_DOCUMENTS, BUILTIN_POSTS } from "@/lib/mjengo/templates";
import { CHANNELS, type Channel } from "@/lib/mjengo/channels";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * A small Model Context Protocol endpoint (JSON-RPC over HTTP) so an AI client can work with the suite's
 * media: list templates, make an image, and queue a post. It is switched on by setting MJENGO_MCP_TOKEN;
 * clients send it as a bearer token. Everything it creates is a draft for a person to review.
 */
const TOOLS = [
	{ name: "list_templates", description: "List the document and post templates, and saved design templates.", inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["document", "post", "design"] } } } },
	{ name: "list_assets", description: "List images in Studio with their ids.", inputSchema: { type: "object", properties: {} } },
	{
		name: "generate_image",
		description: "Create an image (poster, banner, illustration) from a description and save it to Studio. Returns its asset id.",
		inputSchema: { type: "object", properties: { prompt: { type: "string" }, name: { type: "string" } }, required: ["prompt"] },
	},
	{
		name: "create_post_draft",
		description: "Save a social post as a draft in Content for the team to review. Channels: website, linkedin, x, facebook, instagram, tiktok.",
		inputSchema: { type: "object", properties: { body: { type: "string" }, channels: { type: "array", items: { type: "string" } }, asset_id: { type: "string" }, title: { type: "string" } }, required: ["body", "channels"] },
	},
] as const;

function authorised(req: Request): boolean {
	const secret = process.env.MJENGO_MCP_TOKEN;
	if (!secret) return false;
	const given = req.headers.get("authorization") ?? "";
	const expected = `Bearer ${secret}`;
	return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const ok = (id: unknown, result: unknown) => NextResponse.json({ jsonrpc: "2.0", id, result });
const err = (id: unknown, code: number, message: string) => NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
const text = (t: string) => ({ content: [{ type: "text", text: t }] });

async function call(name: string, a: Record<string, unknown>) {
	const db = looseAdmin();
	if (name === "list_templates") {
		const kind = String(a.kind ?? "");
		const { data } = await db.from("mjengo_templates").select("id, kind, name, description").order("created_at", { ascending: false }).limit(100);
		const builtin = [...BUILTIN_DOCUMENTS.map((t) => ({ id: t.id, kind: "document", name: t.name, description: t.description })), ...BUILTIN_POSTS.map((t) => ({ id: t.id, kind: "post", name: t.name, description: t.description }))];
		const all = [...builtin, ...(data ?? [])].filter((t) => !kind || t.kind === kind);
		return text(JSON.stringify(all));
	}
	if (name === "list_assets") {
		const { data } = await db.from("mjengo_assets").select("id, name, prompt, created_at").order("created_at", { ascending: false }).limit(50);
		return text(JSON.stringify(data ?? []));
	}
	if (name === "generate_image") {
		const key = process.env.OPENROUTER_API_KEY;
		const prompt = String(a.prompt ?? "").slice(0, 1500);
		if (!key || !prompt) throw new Error("An image prompt and the server's AI key are needed.");
		const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			signal: AbortSignal.timeout(55_000),
			headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Sauti Salama MCP" },
			body: JSON.stringify({ model: "google/gemini-2.5-flash-image-preview", modalities: ["image", "text"], messages: [{ role: "user", content: prompt }] }),
		});
		const j = (await res.json()) as { choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[] };
		const m = /^data:image\/\w+;base64,(.+)$/.exec(j.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? "");
		if (!res.ok || !m) throw new Error("No image came back.");
		const path = `studio/${randomUUID()}.png`;
		const up = await db.storage.from("mjengo-docs").upload(path, Buffer.from(m[1], "base64"), { contentType: "image/png" });
		if (up.error) throw new Error("Could not save the image.");
		const { data } = await db.from("mjengo_assets").insert({ name: String(a.name ?? prompt).slice(0, 80), path, mime: "image/png", kind: "image", prompt }).select("id").single();
		return text(JSON.stringify({ asset_id: data?.id }));
	}
	if (name === "create_post_draft") {
		const channels = (Array.isArray(a.channels) ? a.channels : []).map(String).filter((c): c is Channel => (CHANNELS as string[]).includes(c));
		const body = String(a.body ?? "").trim().slice(0, 10000);
		if (!body || !channels.length) throw new Error("A body and at least one valid channel are needed.");
		const { data, error } = await db.from("mjengo_posts").insert({ title: a.title ? String(a.title).slice(0, 120) : null, body, channels, media: a.asset_id ? [String(a.asset_id)] : [], status: "draft" }).select("id").single();
		if (error || !data) throw new Error("Could not save the draft.");
		return text(JSON.stringify({ post_id: data.id, status: "draft" }));
	}
	throw new Error(`Unknown tool: ${name}`);
}

export async function POST(req: Request) {
	if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	let msg: { id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
	try { msg = await req.json(); } catch { return err(null, -32700, "Parse error"); }
	const id = msg.id ?? null;
	switch (msg.method) {
		case "initialize":
			return ok(id, { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "sauti-salama-mjengo", version: "1.0.0" } });
		case "notifications/initialized":
			return new Response(null, { status: 202 });
		case "ping":
			return ok(id, {});
		case "tools/list":
			return ok(id, { tools: TOOLS });
		case "tools/call":
			try {
				return ok(id, await call(String(msg.params?.name ?? ""), msg.params?.arguments ?? {}));
			} catch (e) {
				return ok(id, { isError: true, ...text(e instanceof Error ? e.message : "The tool failed.") });
			}
		default:
			return err(id, -32601, "Method not found");
	}
}
