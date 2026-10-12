/**
 * Records a call from this device the way a meeting host does: everything people can see (the presented screen
 * on the stage, or the grid of cameras) drawn onto one canvas, with every voice in the call mixed into one
 * audio track. Nothing is sent anywhere until the person stops the recording.
 */

export interface RecorderSources {
	/** Local microphone and every remote voice. */
	streams: () => MediaStream[];
	/** The <video> elements to draw; one may be marked as the stage (data-rec-stage). */
	videos: () => HTMLVideoElement[];
	title: string;
}

const W = 1280;
const H = 720;

export class MeetRecorder {
	private canvas = document.createElement("canvas");
	private ctx: AudioContext | null = null;
	private dest: MediaStreamAudioDestinationNode | null = null;
	private connected = new Set<string>();
	private raf = 0;
	private syncTimer: ReturnType<typeof setInterval> | null = null;
	private rec: MediaRecorder | null = null;
	private chunks: Blob[] = [];
	private startedAt = 0;
	mime = "video/webm";

	constructor(private src: RecorderSources) {
		this.canvas.width = W;
		this.canvas.height = H;
	}

	get seconds() { return this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0; }

	start() {
		const g = this.canvas.getContext("2d")!;
		const draw = () => {
			this.paint(g);
			this.raf = requestAnimationFrame(draw);
		};
		this.raf = requestAnimationFrame(draw);

		this.ctx = new AudioContext();
		this.dest = this.ctx.createMediaStreamDestination();
		const sync = () => {
			for (const s of this.src.streams()) {
				if (!s.getAudioTracks().length || this.connected.has(s.id)) continue;
				try { this.ctx!.createMediaStreamSource(s).connect(this.dest!); this.connected.add(s.id); } catch { /* skip */ }
			}
		};
		sync();
		this.syncTimer = setInterval(sync, 1500);

		const out = new MediaStream([...this.canvas.captureStream(24).getVideoTracks(), ...this.dest.stream.getAudioTracks()]);
		const options = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
		const mime = options.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
		this.mime = mime || "video/webm";
		this.rec = new MediaRecorder(out, { mimeType: mime || undefined, videoBitsPerSecond: 900_000, audioBitsPerSecond: 64_000 });
		this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
		this.rec.start(4000);
		this.startedAt = Date.now();
	}

	stop(): Promise<Blob> {
		return new Promise((resolve) => {
			const finish = () => {
				cancelAnimationFrame(this.raf);
				if (this.syncTimer) clearInterval(this.syncTimer);
				this.ctx?.close().catch(() => undefined);
				resolve(new Blob(this.chunks, { type: this.mime }));
			};
			if (!this.rec || this.rec.state === "inactive") return finish();
			this.rec.onstop = finish;
			this.rec.stop();
		});
	}

	private paint(g: CanvasRenderingContext2D) {
		g.fillStyle = "#0E1318";
		g.fillRect(0, 0, W, H);
		const vids = this.src.videos().filter((v) => v.readyState >= 2 && v.videoWidth > 0);
		const stage = vids.find((v) => v.dataset.recStage === "1");
		const draw = (v: HTMLVideoElement, x: number, y: number, w: number, h: number, cover: boolean) => {
			const r = v.videoWidth / v.videoHeight;
			let dw = w, dh = w / r;
			if (cover ? dh < h : dh > h) { dh = h; dw = h * r; }
			g.save();
			g.beginPath(); g.roundRect(x, y, w, h, 14); g.clip();
			g.fillStyle = "#1B232B"; g.fillRect(x, y, w, h);
			g.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
			g.restore();
		};
		if (!vids.length) {
			g.fillStyle = "#9CA3AF";
			g.font = "28px Inter, sans-serif";
			g.textAlign = "center";
			g.fillText(this.src.title || "Meeting", W / 2, H / 2);
			return;
		}
		if (stage) {
			const rest = vids.filter((v) => v !== stage);
			const stripW = rest.length ? 240 : 0;
			draw(stage, 16, 16, W - 32 - (stripW ? stripW + 12 : 0), H - 32, false);
			rest.slice(0, 4).forEach((v, i) => draw(v, W - 16 - stripW, 16 + i * 150, stripW, 138, true));
			return;
		}
		const n = vids.length;
		const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
		const rows = Math.ceil(n / cols);
		const gap = 12;
		const cw = (W - gap * (cols + 1)) / cols;
		const ch = (H - gap * (rows + 1)) / rows;
		vids.forEach((v, i) => draw(v, gap + (i % cols) * (cw + gap), gap + Math.floor(i / cols) * (ch + gap), cw, ch, true));
	}
}
