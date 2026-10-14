import { looseAdmin } from "@/lib/loose-db";
import { getActor } from "@/lib/access/super-admin";
import { atLeast, levelFor, loadIndex as loadVault, oversightFor } from "@/lib/vault/access";

export interface VersionMeta {
	id: string;
	createdAt: string;
	author?: { name: string; color?: string };
	name?: string;
	reason: "open" | "autosave" | "save" | "manual" | "restore";
	size: number;
	title?: string;
	words?: number;
}

export const storage = () => looseAdmin().storage.from("mjengo-docs");

type Row = { id: string; created_at: string; reason: VersionMeta["reason"]; name: string | null; title: string | null; words: number | null; size: number | string; author: VersionMeta["author"] | null };
const fromRow = (r: Row): VersionMeta => ({
	id: r.id,
	createdAt: r.created_at,
	reason: r.reason,
	size: Number(r.size) || 0,
	...(r.author ? { author: r.author } : {}),
	...(r.name ? { name: r.name } : {}),
	...(r.title ? { title: r.title } : {}),
	...(typeof r.words === "number" ? { words: r.words } : {}),
});
const table = () => looseAdmin().from("mjengo_doc_versions");

/**
 * The history of one document, newest first. It lives in a table (one row per version), so saves that happen
 * together cannot drop each other. A document whose list was kept in the older index file is moved over the
 * first time it is read.
 */
export async function loadIndex(fileId: string): Promise<VersionMeta[]> {
	if (!/^[0-9a-f-]{36}$/i.test(fileId)) return [];
	const { data } = await table().select("id, created_at, reason, name, title, words, size, author").eq("file_id", fileId).order("created_at", { ascending: false }).limit(300);
	if (data && data.length) return (data as Row[]).map(fromRow);
	// Not in the table: bring over an older index file, once.
	const old = await storage().download(`versions/${fileId}/index.json`);
	if (!old.data) return [];
	let list: VersionMeta[] = [];
	try { list = JSON.parse(await old.data.text()) as VersionMeta[]; } catch { return []; }
	if (!Array.isArray(list) || !list.length) return [];
	await table().upsert(list.slice(0, 300).map((m) => ({ file_id: fileId, id: String(m.id).slice(0, 80), created_at: m.createdAt, reason: m.reason, name: m.name ?? null, title: m.title ?? null, words: m.words ?? null, size: m.size ?? 0, author: m.author ?? null })), { onConflict: "file_id,id" });
	return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Add or replace one version: a single row, so nothing else in the list can be lost. */
export async function upsertVersion(fileId: string, m: VersionMeta, max = 300) {
	await table().upsert({ file_id: fileId, id: m.id, created_at: m.createdAt, reason: m.reason, name: m.name ?? null, title: m.title ?? null, words: m.words ?? null, size: m.size ?? 0, author: m.author ?? null }, { onConflict: "file_id,id" });
	// Keep the newest `max` unnamed versions; named ones stay.
	const { data } = await table().select("id, name").eq("file_id", fileId).order("created_at", { ascending: false }).range(max, max + 200);
	const drop = ((data ?? []) as { id: string; name: string | null }[]).filter((r) => !r.name).map((r) => r.id);
	if (drop.length) {
		await table().delete().eq("file_id", fileId).in("id", drop);
		await storage().remove(drop.map((id) => `versions/${fileId}/${id}.bin`));
	}
}

export async function renameVersion(fileId: string, id: string, name: string | null) {
	await table().update({ name: name ? name.slice(0, 80) : null }).eq("file_id", fileId).eq("id", id);
}

export async function removeVersion(fileId: string, id: string) {
	await table().delete().eq("file_id", fileId).eq("id", id);
	await storage().remove([`versions/${fileId}/${id}.bin`]);
}

/** The version details sent in the x-version-meta header: JSON, percent-encoded by the editor's HTTP store. */
export function parseVersionMeta(header: string | null): VersionMeta | null {
  if (!header) return null;
  for (const raw of [() => decodeURIComponent(header), () => header]) {
    try {
      const m = JSON.parse(raw()) as VersionMeta;
      if (m && typeof m === 'object') return m;
    } catch { /* try the next form */ }
  }
  return null;
}


const UUID = /^[0-9a-f-]{36}$/i;
const VID = /^[A-Za-z0-9_-]{6,80}$/;

/**
 * Who may touch a document's history: whoever can open the file may read it, whoever can edit it may add,
 * name or delete versions. Returns a ready answer to send back when the request is refused.
 */
export async function versionAccess(fileId: string, need: "view" | "edit", versionId?: string): Promise<Response | null> {
	if (!UUID.test(fileId) || (versionId !== undefined && !VID.test(versionId))) return new Response("Bad request.", { status: 400 });
	const actor = await getActor();
	if (!actor) return new Response("Please sign in again.", { status: 401 });
	const ix = await loadVault();
	const level = levelFor(ix, actor.id, "file", fileId, await oversightFor(actor.email));
	if (!level) return new Response("You do not have access to this document.", { status: 403 });
	if (need === "edit" && !atLeast(level, "edit")) return new Response("You can read this document but not change its history.", { status: 403 });
	return null;
}

/**
 * The size of an uploaded version, read from storage (never taken from the request). The listing can lag a
 * moment behind an upload, so when it has no size yet the object itself is asked for its length.
 */
export async function versionSize(dir: string, name: string): Promise<number | null> {
	const found = await storage().list(dir, { search: name, limit: 5 });
	const file = (found.data ?? []).find((f) => f.name === name);
	const listed = Number((file?.metadata as { size?: number } | null)?.size ?? 0);
	if (listed > 0) return listed;
	const { data } = await storage().createSignedUrl(`${dir}/${name}`, 30);
	if (!data?.signedUrl) return file ? 0 : null;
	// A one-byte range request answers with the whole length ("bytes 0-0/12345").
	const probe = await fetch(data.signedUrl, { headers: { Range: "bytes=0-0" } }).catch(() => null);
	if (!probe || (!probe.ok && probe.status !== 206)) return file ? 0 : null;
	const total = Number(/\/(\d+)\s*$/.exec(probe.headers.get("content-range") ?? "")?.[1] ?? probe.headers.get("content-length") ?? 0);
	await probe.arrayBuffer().catch(() => undefined);
	return Number.isFinite(total) ? total : 0;
}
