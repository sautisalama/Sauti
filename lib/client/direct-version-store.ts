import type { VersionMeta, VersionStore } from "@gamine/wordcraft-react";

/**
 * Version history on the server where the bytes travel straight between the browser and storage. A document
 * with pictures is larger than a function accepts or returns (4.5 MB), so only small JSON goes through the
 * app: the list, a one-time address, and a note that the upload finished.
 */
export function directVersionStore(baseUrl: string): VersionStore {
	const base = baseUrl.replace(/\/$/, "");
	const one = (id: string) => `${base}/${encodeURIComponent(id)}`;
	const ok = async (r: Response) => {
		if (!r.ok) {
			const why = (await r.text().catch(() => "")).slice(0, 120);
			throw new Error(why || `Version history request failed (${r.status})`);
		}
		return r;
	};
	return {
		async list() {
			return (await (await ok(await fetch(base))).json()) as VersionMeta[];
		},
		async get(id) {
			const r = await fetch(`${one(id)}?url=1`);
			if (r.status === 404) return null;
			const { url } = (await (await ok(r)).json()) as { url: string };
			const bytes = await fetch(url);
			if (bytes.status === 404 || bytes.status === 400) return null;
			return new Uint8Array(await (await ok(bytes)).arrayBuffer());
		},
		async put(meta, bytes) {
			const target = (await (await ok(await fetch(`${one(meta.id)}/upload`, { method: "POST" }))).json()) as { signedUrl: string };
			const form = new FormData();
			form.append("cacheControl", "3600");
			form.append("", new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
			await ok(await fetch(target.signedUrl, { method: "PUT", body: form }));
			await ok(await fetch(`${one(meta.id)}/commit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(meta) }));
		},
		async rename(id, name) {
			await ok(await fetch(one(id), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }));
		},
		async remove(id) {
			await ok(await fetch(one(id), { method: "DELETE" }));
		},
	};
}
