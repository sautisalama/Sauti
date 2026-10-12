/** Dominant colours of a picture: pixels are sampled on a small canvas and grouped, then the most common distinct groups win. */
export async function paletteFromImage(src: string | Blob, count = 6): Promise<string[]> {
	const url = typeof src === "string" ? src : URL.createObjectURL(src);
	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const i = new Image();
			i.crossOrigin = "anonymous";
			i.onload = () => resolve(i);
			i.onerror = () => reject(new Error("Could not read the picture."));
			i.src = url;
		});
		const size = 72;
		const c = document.createElement("canvas");
		const ratio = img.width / img.height || 1;
		c.width = ratio >= 1 ? size : Math.max(8, Math.round(size * ratio));
		c.height = ratio >= 1 ? Math.max(8, Math.round(size / ratio)) : size;
		const ctx = c.getContext("2d", { willReadFrequently: true });
		if (!ctx) return [];
		ctx.drawImage(img, 0, 0, c.width, c.height);
		const { data } = ctx.getImageData(0, 0, c.width, c.height);
		// Groups of 32 levels per channel; near-white, near-black and transparent pixels are skipped.
		const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
		for (let i = 0; i < data.length; i += 4) {
			const a = data[i + 3];
			if (a < 200) continue;
			const r = data[i], g = data[i + 1], b = data[i + 2];
			const max = Math.max(r, g, b), min = Math.min(r, g, b);
			if (max > 245 && min > 235) continue;
			if (max < 22) continue;
			const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
			const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
			e.n++; e.r += r; e.g += g; e.b += b;
			bins.set(key, e);
		}
		const sorted = [...bins.values()].sort((x, y) => y.n - x.n).map((e) => [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)] as const);
		const out: (readonly [number, number, number])[] = [];
		for (const col of sorted) {
			if (out.every((o) => Math.hypot(o[0] - col[0], o[1] - col[1], o[2] - col[2]) > 52)) out.push(col);
			if (out.length >= count) break;
		}
		return out.map(([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase());
	} finally {
		if (typeof src !== "string") URL.revokeObjectURL(url);
	}
}
