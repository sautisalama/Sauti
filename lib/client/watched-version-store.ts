import type { VersionStore } from "@gamine/wordcraft-react";

/**
 * Wraps a version store so a failure is never silent: the first failure in a minute is reported to `onError`
 * (a toast or a banner) and the error still goes to the editor.
 */
export function watchedVersionStore(inner: VersionStore, onError: (what: "save" | "load", message: string) => void): VersionStore {
	let last = 0;
	const report = (what: "save" | "load", e: unknown) => {
		if (Date.now() - last < 60_000) return;
		last = Date.now();
		onError(what, e instanceof Error ? e.message : "Something went wrong");
	};
	return {
		list: () => inner.list().catch((e) => { report("load", e); throw e; }),
		get: (id) => inner.get(id).catch((e) => { report("load", e); throw e; }),
		put: (meta, bytes) => inner.put(meta, bytes).catch((e) => { report("save", e); throw e; }),
		rename: (id, name) => inner.rename(id, name).catch((e) => { report("save", e); throw e; }),
		remove: (id) => inner.remove(id).catch((e) => { report("save", e); throw e; }),
	};
}
