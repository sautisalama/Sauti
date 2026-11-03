/**
 * Blur or replace the background behind a person on their own camera, on their own device, before the picture is
 * sent to anyone. The camera track goes in; a new track with the person cut out and the background changed comes
 * out. Nothing leaves the device for this: the model runs in the browser.
 */

/** blur: amount is 0 to 100. color: one colour, or a gradient when b is given. image: a picture, cover-fitted. */
export type BackgroundMode =
	| { kind: "none" }
	| { kind: "blur"; amount: number }
	| { kind: "color"; a: string; b?: string }
	| { kind: "image"; src: string };

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
			const px = 2 + (Math.max(0, Math.min(100, mode.amount)) / 100) * 38;
			g.filter = `blur(${px.toFixed(1)}px)`;
			// Draw a little larger so the blurred edges do not show a thin line at the borders.
			const pad = Math.ceil(px * 1.5);
			g.drawImage(this.video, -pad, -pad, w + pad * 2, h + pad * 2);
		} else if (mode.kind === "color") {
			if (mode.b) {
				const gr = g.createLinearGradient(0, 0, w, h);
				gr.addColorStop(0, mode.a);
				gr.addColorStop(1, mode.b);
				g.fillStyle = gr;
			} else g.fillStyle = mode.a;
			g.fillRect(0, 0, w, h);
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

/** Ready-made colours and gradients, drawn straight onto the call, so there is nothing to download. */
export const COLOR_PRESETS: { label: string; a: string; b?: string }[] = [
	{ label: "Teal", a: "#0b2f3a", b: "#068297" },
	{ label: "Dusk", a: "#1a365d", b: "#e8762b" },
	{ label: "Forest", a: "#0b3d2e", b: "#7fd3a0" },
	{ label: "Slate", a: "#1B232B", b: "#5f6368" },
	{ label: "White", a: "#f4f6f7" },
	{ label: "Green", a: "#1e8e3e" },
	{ label: "Charcoal", a: "#202124" },
];

/* ------------------------------------------------------------ remembered choices */

export interface BackgroundPrefs {
	/** What was last chosen; a picture is stored as its place in `photos`, so it is only saved once. */
	mode: BackgroundMode;
	blur: number;
	color: { a: string; b: string; gradient: boolean };
	photos: string[];
}

const KEY = "ss_meet_bg_v2";
const MAX_PHOTOS = 8;
export const DEFAULT_PREFS: BackgroundPrefs = { mode: { kind: "none" }, blur: 55, color: { a: "#0b2f3a", b: "#068297", gradient: true }, photos: [] };

export function loadBackgroundPrefs(): BackgroundPrefs {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) || "null") as { mode?: { kind?: string; amount?: number; a?: string; b?: string; photo?: number }; blur?: number; color?: BackgroundPrefs["color"]; photos?: string[] } | null;
		if (!raw) return DEFAULT_PREFS;
		const photos = Array.isArray(raw.photos) ? raw.photos.filter((p) => typeof p === "string").slice(0, MAX_PHOTOS) : [];
		const blur = typeof raw.blur === "number" ? Math.max(0, Math.min(100, raw.blur)) : DEFAULT_PREFS.blur;
		const color = raw.color && typeof raw.color.a === "string" ? { a: raw.color.a, b: raw.color.b || DEFAULT_PREFS.color.b, gradient: !!raw.color.gradient } : DEFAULT_PREFS.color;
		const m = raw.mode;
		let mode: BackgroundMode = { kind: "none" };
		if (m?.kind === "blur") mode = { kind: "blur", amount: typeof m.amount === "number" ? m.amount : blur };
		else if (m?.kind === "color" && typeof m.a === "string") mode = { kind: "color", a: m.a, b: m.b };
		else if (m?.kind === "image" && typeof m.photo === "number" && photos[m.photo]) mode = { kind: "image", src: photos[m.photo] };
		return { mode, blur, color, photos };
	} catch { return DEFAULT_PREFS; }
}

export function saveBackgroundPrefs(p: BackgroundPrefs) {
	const store = (photos: string[]) => {
		const photo = p.mode.kind === "image" ? photos.indexOf(p.mode.src) : -1;
		const mode = p.mode.kind === "image" ? (photo >= 0 ? { kind: "image", photo } : { kind: "none" }) : p.mode;
		localStorage.setItem(KEY, JSON.stringify({ mode, blur: p.blur, color: p.color, photos }));
	};
	try { store(p.photos); return; } catch { /* storage full: keep the newest pictures only */ }
	try { store(p.photos.slice(0, Math.max(1, Math.floor(p.photos.length / 2)))); } catch { /* not remembered */ }
}

/** A picture from the device, shrunk to the size the call uses and re-encoded, so it is quick to load and small to keep. */
export async function optimiseBackgroundPhoto(file: File): Promise<string> {
	const url = URL.createObjectURL(file);
	try {
		const img = await loadImage(url);
		const r = Math.min(1, 1280 / img.naturalWidth, 720 / img.naturalHeight);
		const c = document.createElement("canvas");
		c.width = Math.max(1, Math.round(img.naturalWidth * r));
		c.height = Math.max(1, Math.round(img.naturalHeight * r));
		c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
		return c.toDataURL("image/jpeg", 0.8);
	} finally { URL.revokeObjectURL(url); }
}

export const addBackgroundPhoto = (photos: string[], photo: string) => [photo, ...photos.filter((p) => p !== photo)].slice(0, MAX_PHOTOS);
