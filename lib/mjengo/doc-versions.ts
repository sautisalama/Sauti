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

/** One small index file per document keeps the history list to a single read. */
export async function loadIndex(fileId: string): Promise<VersionMeta[]> {
	if (!/^[0-9a-f-]{36}$/i.test(fileId)) return [];
	const { data } = await storage().download(`versions/${fileId}/index.json`);
	if (!data) return [];
	try { return (JSON.parse(await data.text()) as VersionMeta[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); } catch { return []; }
}

export async function saveIndex(fileId: string, list: VersionMeta[]) {
	await storage().upload(`versions/${fileId}/index.json`, new Blob([JSON.stringify(list)], { type: "application/json" }), { upsert: true, contentType: "application/json" });
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
