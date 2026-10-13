"use client";

const CHUNK = 4 * 1024 * 1024;

/** Send a recording to the storage host in pieces, each retried a few times. The address carries its own signature. */
export async function sendRecording(putUrl: string, blob: Blob, onProgress?: (pct: number) => void): Promise<void> {
	let offset = 0;
	do {
		const end = Math.min(blob.size, offset + CHUNK);
		const body = blob.slice(offset, end);
		let ok = false;
		let last = "";
		for (let attempt = 0; attempt < 3 && !ok; attempt++) {
			try {
				const res = await fetch(`${putUrl}&offset=${offset}`, { method: "POST", body, headers: { "Content-Type": "application/octet-stream" } });
				if (res.ok) ok = true;
				else last = `${res.status}`;
			} catch (e) {
				last = e instanceof Error ? e.message : "network";
			}
			if (!ok) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
		}
		if (!ok) throw new Error(`The recording could not be sent (${last}).`);
		offset = end;
		onProgress?.(Math.round((offset / blob.size) * 100));
	} while (offset < blob.size);
}
