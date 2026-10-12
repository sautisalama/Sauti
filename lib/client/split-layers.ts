/**
 * Turn a flat picture into layers, in the browser: a backdrop with the subject lifted out, the subject as a
 * cutout with a transparent background, and every line of text found in the picture as real editable text
 * (with the printed words painted out of the backdrop). Nothing leaves the device: the models are downloaded
 * once and run locally.
 */

export interface SplitText { text: string; x: number; y: number; w: number; h: number; color: string; size: number }
export interface LayerSplit {
  width: number;
  height: number;
  /** The scene without the subject or the printed words. */
  backdrop: string;
  /** The subject on a transparent background; null when no clear subject was found. */
  subject: string | null;
  texts: SplitText[];
}

const MAX = 1400;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Could not read the picture.'));
    img.src = /^(data:|blob:)/.test(src) ? src : (() => { try { return encodeURI(decodeURI(src)); } catch { return src; } })();
  });
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };

/** The average colour of a thin ring just outside a box: what the background around some text looks like. */
function ringColour(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, W: number, H: number): [number, number, number] {
  const pad = 4;
  const x0 = Math.max(0, Math.floor(x - pad)), y0 = Math.max(0, Math.floor(y - pad));
  const x1 = Math.min(W, Math.ceil(x + w + pad)), y1 = Math.min(H, Math.ceil(y + h + pad));
  const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (let j = 0; j < img.height; j++) {
    for (let i = 0; i < img.width; i++) {
      const gx = x0 + i, gy = y0 + j;
      const inside = gx >= x && gx < x + w && gy >= y && gy < y + h;
      if (inside) continue;
      const k = (j * img.width + i) * 4;
      rs.push(img.data[k]); gs.push(img.data[k + 1]); bs.push(img.data[k + 2]);
    }
  }
  return rs.length ? [median(rs), median(gs), median(bs)] : [255, 255, 255];
}

/** The colour of the lettering: the pixels in the box that differ most from the surroundings. */
function inkColour(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bg: [number, number, number]): string {
  const img = ctx.getImageData(Math.max(0, Math.floor(x)), Math.max(0, Math.floor(y)), Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
  const scored: { d: number; r: number; g: number; b: number }[] = [];
  for (let k = 0; k < img.data.length; k += 4) {
    const r = img.data[k], g = img.data[k + 1], b = img.data[k + 2];
    scored.push({ d: Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]), r, g, b });
  }
  scored.sort((a, b) => b.d - a.d);
  const top = scored.slice(0, Math.max(3, Math.floor(scored.length * 0.08)));
  const avg = (k: 'r' | 'g' | 'b') => Math.round(top.reduce((n, p) => n + p[k], 0) / Math.max(1, top.length));
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(avg('r'))}${hex(avg('g'))}${hex(avg('b'))}`;
}

/** Fill the holes (where the subject was) from what surrounds them, by letting the colours diffuse inward. */
function inpaint(source: HTMLCanvasElement, hole: Uint8ClampedArray, W: number, H: number): HTMLCanvasElement {
  const s = Math.min(1, 140 / Math.max(W, H));
  const w = Math.max(8, Math.round(W * s)), h = Math.max(8, Math.round(H * s));
  const small = document.createElement('canvas');
  small.width = w; small.height = h;
  const sc = small.getContext('2d')!;
  sc.drawImage(source, 0, 0, w, h);
  const px = sc.getImageData(0, 0, w, h);
  const known = new Uint8Array(w * h);
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const fx = Math.min(W - 1, Math.floor(i / s)), fy = Math.min(H - 1, Math.floor(j / s));
      const isHole = hole[fy * W + fx] > 128;
      known[j * w + i] = isHole ? 0 : 1;
      if (!isHole) { const k = (j * w + i) * 4; sr += px.data[k]; sg += px.data[k + 1]; sb += px.data[k + 2]; n++; }
    }
  }
  if (!n) return source;
  const mr = sr / n, mg = sg / n, mb = sb / n;
  const d = new Float32Array(w * h * 3);
  for (let p = 0; p < w * h; p++) {
    d[p * 3] = known[p] ? px.data[p * 4] : mr;
    d[p * 3 + 1] = known[p] ? px.data[p * 4 + 1] : mg;
    d[p * 3 + 2] = known[p] ? px.data[p * 4 + 2] : mb;
  }
  for (let it = 0; it < 90; it++) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const p = j * w + i;
        if (known[p]) continue;
        let r = 0, g = 0, b = 0, c = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = i + dx, y = j + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const q = y * w + x;
          r += d[q * 3]; g += d[q * 3 + 1]; b += d[q * 3 + 2]; c++;
        }
        if (c) { d[p * 3] = r / c; d[p * 3 + 1] = g / c; d[p * 3 + 2] = b / c; }
      }
    }
  }
  for (let p = 0; p < w * h; p++) {
    px.data[p * 4] = d[p * 3]; px.data[p * 4 + 1] = d[p * 3 + 1]; px.data[p * 4 + 2] = d[p * 3 + 2]; px.data[p * 4 + 3] = 255;
  }
  sc.putImageData(px, 0, 0);
  const big = document.createElement('canvas');
  big.width = W; big.height = H;
  const bc = big.getContext('2d')!;
  bc.filter = 'blur(6px)';
  bc.imageSmoothingQuality = 'high';
  bc.drawImage(small, 0, 0, W, H);
  return big;
}

export async function splitIntoLayers(src: string, onStep?: (message: string) => void): Promise<LayerSplit> {
  const img = await load(src);
  const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.max(2, Math.round(img.naturalWidth * k)), H = Math.max(2, Math.round(img.naturalHeight * k));
  const base = document.createElement('canvas');
  base.width = W; base.height = H;
  const bctx = base.getContext('2d', { willReadFrequently: true })!;
  bctx.drawImage(img, 0, 0, W, H);

  /* ---- 1. text: find lines of lettering */
  const texts: SplitText[] = [];
  onStep?.('Finding the words in the picture');
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await worker.recognize(base, {}, { blocks: true, text: true });
    await worker.terminate();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines: any[] = res?.data?.lines ?? (res?.data?.blocks ?? []).flatMap((b: any) => (b.paragraphs ?? []).flatMap((p: any) => p.lines ?? []));
    for (const l of lines) {
      const text = String(l.text ?? '').replace(/\s+/g, ' ').trim();
      const b = l.bbox;
      if (!b || text.length < 2 || (l.confidence ?? 0) < 62) continue;
      if (!/[\p{L}\p{N}]/u.test(text) || text.replace(/[^\p{L}\p{N}]/gu, '').length < 2) continue;
      const x = b.x0, y = b.y0, w = b.x1 - b.x0, h = b.y1 - b.y0;
      if (h < 10 || w < 14 || h > H * 0.35) continue;
      texts.push({ text, x, y, w, h, color: '#000000', size: h * 0.82 });
    }
  } catch {
    // No text recognition available: carry on with the picture and its subject.
  }
  // Paint the printed words out of the picture so the editable text can sit on a clean backdrop.
  const clean = document.createElement('canvas');
  clean.width = W; clean.height = H;
  const cctx = clean.getContext('2d', { willReadFrequently: true })!;
  cctx.drawImage(base, 0, 0);
  for (const t of texts) {
    const bg = ringColour(bctx, t.x, t.y, t.w, t.h, W, H);
    t.color = inkColour(bctx, t.x, t.y, t.w, t.h, bg);
    cctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    cctx.fillRect(Math.floor(t.x - 2), Math.floor(t.y - 2), Math.ceil(t.w + 4), Math.ceil(t.h + 4));
  }

  /* ---- 2. subject: lift it out */
  let subject: string | null = null;
  let backdropCanvas: HTMLCanvasElement = clean;
  onStep?.('Separating the subject (the first time downloads a small model)');
  try {
    const { pipeline } = await import('@huggingface/transformers');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const remover: any = await pipeline('background-removal', 'Xenova/modnet');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = await remover(base.toDataURL('image/png'));
    const cut = Array.isArray(out) ? out[0] : out;
    const oc = document.createElement('canvas');
    oc.width = cut.width; oc.height = cut.height;
    const octx = oc.getContext('2d')!;
    const id = new ImageData(new Uint8ClampedArray(cut.data), cut.width, cut.height);
    if (cut.channels === 4) octx.putImageData(id, 0, 0);
    else {
      const rgba = new Uint8ClampedArray(cut.width * cut.height * 4);
      for (let p = 0; p < cut.width * cut.height; p++) { rgba[p * 4] = rgba[p * 4 + 1] = rgba[p * 4 + 2] = 255; rgba[p * 4 + 3] = cut.data[p * cut.channels]; }
      octx.putImageData(new ImageData(rgba, cut.width, cut.height), 0, 0);
    }
    // Same size as the working picture.
    const sub = document.createElement('canvas');
    sub.width = W; sub.height = H;
    const sctx = sub.getContext('2d', { willReadFrequently: true })!;
    sctx.drawImage(oc, 0, 0, W, H);
    const px = sctx.getImageData(0, 0, W, H);
    let covered = 0;
    for (let p = 0; p < W * H; p++) if (px.data[p * 4 + 3] > 128) covered++;
    const share = covered / (W * H);
    if (share > 0.02 && share < 0.92) {
      // Keep the subject's own colours from the picture, with the mask as its edge.
      const cutout = document.createElement('canvas');
      cutout.width = W; cutout.height = H;
      const kx = cutout.getContext('2d')!;
      kx.drawImage(clean, 0, 0);
      kx.globalCompositeOperation = 'destination-in';
      kx.drawImage(sub, 0, 0);
      subject = cutout.toDataURL('image/png');

      onStep?.('Rebuilding the background behind it');
      // Grow the hole a little so no fringe of the subject is left behind.
      const grow = document.createElement('canvas');
      grow.width = W; grow.height = H;
      const gx = grow.getContext('2d', { willReadFrequently: true })!;
      gx.filter = 'blur(5px)';
      gx.drawImage(sub, 0, 0);
      const gp = gx.getImageData(0, 0, W, H);
      const hole = new Uint8ClampedArray(W * H);
      for (let p = 0; p < W * H; p++) hole[p] = Math.min(255, gp.data[p * 4 + 3] * 4);
      const filled = inpaint(clean, hole, W, H);
      // Only the hole takes the rebuilt colours; everything else stays exactly as it was.
      const maskC = document.createElement('canvas');
      maskC.width = W; maskC.height = H;
      const mx = maskC.getContext('2d')!;
      const mi = mx.createImageData(W, H);
      for (let p = 0; p < W * H; p++) { mi.data[p * 4] = mi.data[p * 4 + 1] = mi.data[p * 4 + 2] = 255; mi.data[p * 4 + 3] = hole[p]; }
      mx.putImageData(mi, 0, 0);
      const patch = document.createElement('canvas');
      patch.width = W; patch.height = H;
      const px2 = patch.getContext('2d')!;
      px2.drawImage(filled, 0, 0);
      px2.globalCompositeOperation = 'destination-in';
      px2.drawImage(maskC, 0, 0);
      const out2 = document.createElement('canvas');
      out2.width = W; out2.height = H;
      const o2 = out2.getContext('2d')!;
      o2.drawImage(clean, 0, 0);
      o2.drawImage(patch, 0, 0);
      backdropCanvas = out2;
    }
  } catch {
    // The subject could not be separated: the backdrop stays the whole picture.
  }

  return { width: W, height: H, backdrop: backdropCanvas.toDataURL('image/jpeg', 0.92), subject, texts };
}
