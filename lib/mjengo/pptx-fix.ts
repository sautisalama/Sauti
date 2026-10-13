import JSZip from "jszip";

/**
 * Makes a .pptx safe for readers that are strict about the package. Some generators (pptxgenjs among them)
 * list parts in [Content_Types].xml that are not in the file, for example a second slide master. PowerPoint
 * repairs that silently; the in-app viewer stops reading at the first missing part and draws nothing. Missing
 * parts are removed from the list, and the rest is put in the order PowerPoint writes (themes, masters and
 * layouts before slides).
 */
export async function fixPptx(input: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
	const original = input instanceof Uint8Array ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer : input;
	try {
		const zip = await JSZip.loadAsync(original);
		const file = zip.file("[Content_Types].xml");
		if (!file) return original;
		const xml = await file.async("string");
		const parts = xml.match(/<Override[^>]*\/>/g);
		if (!parts) return original;
		const present = parts.filter((o) => {
			const name = /PartName="([^"]+)"/.exec(o)?.[1]?.replace(/^\//, "");
			return !name || !!zip.file(name);
		});
		const rank = (o: string) => (/\/ppt\/presentation/.test(o) ? 0 : /\/theme\//.test(o) ? 1 : /slideMasters\//.test(o) ? 2 : /slideLayouts\//.test(o) ? 3 : /\/ppt\/slides\//.test(o) ? 5 : /notesSlides\//.test(o) ? 6 : 4);
		const sorted = [...present].sort((a, b) => rank(a) - rank(b));
		const unchanged = sorted.length === parts.length && sorted.every((p, i) => p === parts[i]);
		if (unchanged) return original;
		let i = 0;
		// The first overrides take the sorted list; the rest of the original entries are dropped.
		let next = xml.replace(/<Override[^>]*\/>/g, () => (i < sorted.length ? sorted[i++] : ""));
		next = next.replace(/>\s+</g, "><");
		zip.file("[Content_Types].xml", next);
		return await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
	} catch {
		return original;
	}
}
