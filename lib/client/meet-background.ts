/**
 * Blur or replace the background behind a person on their own camera, on their own device, before the picture is
 * sent to anyone. The camera track goes in; a new track with the person cut out and the background changed comes
 * out. Nothing leaves the device for this: the model runs in the browser.
 */

export type BackgroundMode = { kind: "none" } | { kind: "blur"; strength: "light" | "strong" } | { kind: "image"; src: string };

const VERSION = "1.2.0";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const FPS = 24;

type Segmenter = {
	segmentForVideo: (v: HTMLVideoElement, ts: number, cb: (r: { confidenceMasks?: { getAsFloat32Array: () => Float32Array; width: number; height: number; close: () => void }[]; close?: () => void }) => void) => void;
	close: () => void;
};

let shared: Promise<Segmenter> | null = null;
/** The model is loaded once per page and kept, since changing the background back and forth is common. */
function loadSegmenter(): Promise<Segmenter> {
	if (!shared) {
		shared = (async () => {
			const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
			const files = await FilesetResolver.forVisionTasks(WASM);
			const make = (delegate: "GPU" | "CPU") => ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false });
			try { return (await make("GPU")) as unknown as Segmenter; } catch { return (await make("CPU")) as unknown as Segmenter; }
		})();
		shared.catch(() => { shared = null; });
	}
	return shared;
}

export const backgroundSupported = () => typeof window !== "undefined" && typeof Worker !== "undefined" && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;

export class BackgroundProcessor {
	private video = document.createElement("video");
	private out = document.createElement("canvas");
	private person = document.createElement("canvas");
	private maskCanvas = document.createElement("canvas");
	private tick: Worker | null = null;
	private tickUrl = "";
	private bg: HTMLImageElement | null = null;
	private mode: BackgroundMode;
	private busy = false;
	private stopped = false;
	private mask: Float32Array | null = null;
	private mw = 0;
	private mh = 0;
	private output: MediaStreamTrack | null = null;

	constructor(private raw: MediaStreamTrack, mode: BackgroundMode) {
		this.mode = mode;
	}

	/** Change what is behind the person without restarting the camera. */
	async setMode(mode: BackgroundMode) {
		this.mode = mode;
		this.bg = null;
		if (mode.kind === "image") this.bg = await loadImage(mode.src).catch(() => null);
	}

	async start(): Promise<MediaStreamTrack> {
		const seg = await loadSegmenter();
		await this.setMode(this.mode);
		const s = this.raw.getSettings();
		const w = s.width || 1280;
		const h = s.height || 720;
		this.out.width = this.person.width = w;
		this.out.height = this.person.height = h;
		this.video.muted = true;
		this.video.playsInline = true;
		this.video.srcObject = new MediaStream([this.raw]);
		await this.video.play().catch(() => undefined);

		const g = this.out.getContext("2d")!;
		const pg = this.person.getContext("2d")!;
		let last = -1;
		const frame = () => {
			if (this.stopped || this.busy || this.video.readyState < 2) return;
			if (this.video.currentTime === last) return;
			last = this.video.currentTime;
			// A switched-off camera sends nothing, so the real camera is let go too (its light goes out).
			if (this.output && this.raw.enabled !== this.output.enabled) this.raw.enabled = this.output.enabled;
			if (this.output && !this.output.enabled) return;
			this.busy = true;
			try {
				seg.segmentForVideo(this.video, performance.now(), (res) => {
					const m = res.confidenceMasks?.[0];
					if (m) {
						this.mask = m.getAsFloat32Array().slice();
						this.mw = m.width;
						this.mh = m.height;
						m.close();
					}
				});
				this.paint(g, pg, w, h);
			} catch { /* skip this frame */ }
			this.busy = false;
		};
		// Frames are driven by a worker's clock, not animation frames: those stop when the page is hidden or the
		// call is in the floating window, and the picture others see would freeze.
		this.tickUrl = URL.createObjectURL(new Blob([`setInterval(function(){postMessage(0)},${Math.round(1000 / FPS)})`], { type: "text/javascript" }));
		this.tick = new Worker(this.tickUrl);
		this.tick.onmessage = frame;
		this.output = this.out.captureStream(FPS).getVideoTracks()[0];
		this.output.enabled = this.raw.enabled;
		return this.output;
	}

	private paint(g: CanvasRenderingContext2D, pg: CanvasRenderingContext2D, w: number, h: number) {
		const mode = this.mode;
		if (!this.mask || mode.kind === "none") {
			g.drawImage(this.video, 0, 0, w, h);
			return;
		}
		// The mask (how sure the model is that a pixel is the person) becomes the person layer's transparency.
		if (this.maskCanvas.width !== this.mw) { this.maskCanvas.width = this.mw; this.maskCanvas.height = this.mh; }
		const mg = this.maskCanvas.getContext("2d")!;
		const img = mg.createImageData(this.mw, this.mh);
		const m = this.mask;
		for (let i = 0; i < m.length; i++) {
			// A soft edge: confident pixels are solid, unsure ones fade, so hair does not look cut out.
			const a = Math.max(0, Math.min(1, (m[i] - 0.35) / 0.3));
			img.data[i * 4 + 3] = Math.round(a * 255);
		}
		mg.putImageData(img, 0, 0);
		pg.globalCompositeOperation = "source-over";
		pg.clearRect(0, 0, w, h);
		pg.drawImage(this.video, 0, 0, w, h);
		pg.globalCompositeOperation = "destination-in";
		pg.filter = "blur(2px)";
		pg.imageSmoothingEnabled = true;
		pg.drawImage(this.maskCanvas, 0, 0, w, h);
		pg.filter = "none";
		pg.globalCompositeOperation = "source-over";

		g.save();
		if (mode.kind === "blur") {
			g.filter = `blur(${mode.strength === "strong" ? 22 : 11}px)`;
			// Draw a little larger so the blurred edges do not show a thin line at the borders.
			g.drawImage(this.video, -24, -24, w + 48, h + 48);
		} else if (this.bg) {
			cover(g, this.bg, w, h);
		} else {
			g.fillStyle = "#1B232B";
			g.fillRect(0, 0, w, h);
		}
		g.restore();
		g.drawImage(this.person, 0, 0, w, h);
	}

	/** Stops drawing and the output track. The camera track it was given is not stopped here. */
	stop() {
		this.stopped = true;
		this.tick?.terminate();
		if (this.tickUrl) URL.revokeObjectURL(this.tickUrl);
		this.output?.stop();
		this.video.srcObject = null;
	}
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const i = new Image();
		i.crossOrigin = "anonymous";
		i.onload = () => resolve(i);
		i.onerror = reject;
		i.src = src;
	});
}

function cover(g: CanvasRenderingContext2D, i: HTMLImageElement, w: number, h: number) {
	const r = Math.max(w / i.naturalWidth, h / i.naturalHeight);
	const dw = i.naturalWidth * r;
	const dh = i.naturalHeight * r;
	g.drawImage(i, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Ready-made backgrounds drawn in the browser on demand, so there is nothing to download. */
export const PRESET_BACKGROUNDS: { id: string; label: string; colours: [string, string] }[] = [
	{ id: "teal", label: "Teal", colours: ["#0b2f3a", "#068297"] },
	{ id: "dusk", label: "Dusk", colours: ["#1a365d", "#e8762b"] },
	{ id: "forest", label: "Forest", colours: ["#0b3d2e", "#7fd3a0"] },
	{ id: "slate", label: "Slate", colours: ["#1B232B", "#5f6368"] },
];
const presetCache = new Map<string, string>();
export const presetImage = (id: string) => {
	let v = presetCache.get(id);
	if (!v) { v = gradient((PRESET_BACKGROUNDS.find((p) => p.id === id) ?? PRESET_BACKGROUNDS[0]).colours); presetCache.set(id, v); }
	return v;
};

function gradient([a, b]: [string, string]): string {
	if (typeof document === "undefined") return "";
	const c = document.createElement("canvas");
	c.width = 1280;
	c.height = 720;
	const g = c.getContext("2d")!;
	const gr = g.createLinearGradient(0, 0, 1280, 720);
	gr.addColorStop(0, a);
	gr.addColorStop(1, b);
	g.fillStyle = gr;
	g.fillRect(0, 0, 1280, 720);
	return c.toDataURL("image/jpeg", 0.85);
}
