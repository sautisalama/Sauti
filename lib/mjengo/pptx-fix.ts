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
		let changed = await fixCharts(zip);
		const file = zip.file("[Content_Types].xml");
		if (file) {
			const xml = await file.async("string");
			const parts = xml.match(/<Override[^>]*\/>/g);
			if (parts) {
				const present = parts.filter((o) => {
					const name = /PartName="([^"]+)"/.exec(o)?.[1]?.replace(/^\//, "");
					return !name || !!zip.file(name);
				});
				const rank = (o: string) => (/\/ppt\/presentation/.test(o) ? 0 : /\/theme\//.test(o) ? 1 : /slideMasters\//.test(o) ? 2 : /slideLayouts\//.test(o) ? 3 : /\/ppt\/slides\//.test(o) ? 4 : 5);
				const sorted = [...present].sort((a, b) => rank(a) - rank(b));
				const unchanged = sorted.length === parts.length && sorted.every((p, i) => p === parts[i]);
				if (!unchanged) {
					let i = 0;
					// The first overrides take the sorted list; the rest of the original entries are dropped.
					let next = xml.replace(/<Override[^>]*\/>/g, () => (i < sorted.length ? sorted[i++] : ""));
					next = next.replace(/>\s+</g, "><");
					zip.file("[Content_Types].xml", next);
					changed = true;
				}
			}
		}
		if (!changed) return original;
		return await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
	} catch {
		return original;
	}
}

/**
 * Charts as the in-app reader wants them: category names written as plain string references (generators such
 * as pptxgenjs write them as multi-level references, which the reader shows as 0, 1, 2), and a chart with no
 * title gets an empty one, since the reader would otherwise print a placeholder title in Chinese.
 */
async function fixCharts(zip: JSZip): Promise<boolean> {
	let changed = false;
	for (const name of Object.keys(zip.files).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n))) {
		const xml = await zip.file(name)!.async("string");
		let next = xml.replace(
			/<c:multiLvlStrRef>\s*(<c:f>[\s\S]*?<\/c:f>)\s*<c:multiLvlStrCache>\s*(<c:ptCount[^>]*\/>)\s*<c:lvl>([\s\S]*?)<\/c:lvl>\s*<\/c:multiLvlStrCache>\s*<\/c:multiLvlStrRef>/g,
			(_m, f: string, count: string, pts: string) => `<c:strRef>${f}<c:strCache>${count}${pts}</c:strCache></c:strRef>`,
		);
		if (!/<c:title>/.test(next)) {
			next = next.replace(/<c:chart>(\s*)/, `<c:chart>$1<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:rPr lang="en-US" sz="100"/><a:t> </a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`);
		}
		if (next !== xml) { zip.file(name, next); changed = true; }
	}
	return changed;
}
