import { looseAdmin } from "@/lib/loose-db";

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
