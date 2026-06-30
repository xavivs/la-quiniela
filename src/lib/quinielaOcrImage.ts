const TEXT_LEFT = 0.02;
const TEXT_WIDTH = 0.62;
const TARGET_WIDTH = 1400;

/** Fallback when band detection fails */
const ROW_FIRST_Y = 0.23;
const ROW_STEP_Y = 0.047;
const ROW_HEIGHT = 0.028;

export type RowCrop = { canvas: HTMLCanvasElement; index: number };
export type TextBand = { top: number; bottom: number; height: number };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen"));
    };
    img.src = url;
  });
}

/** Grayscale + contrast + resize for better Tesseract accuracy. */
export function preprocessQuinielaCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const scale = TARGET_WIDTH / img.width;
  const w = TARGET_WIDTH;
  const h = Math.round(img.height * scale);

  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const sctx = src.getContext("2d");
  if (!sctx) throw new Error("Canvas no disponible");
  sctx.drawImage(img, 0, 0, w, h);

  const imageData = sctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(max - min, 1);
  for (let i = 0; i < d.length; i += 4) {
    let g = ((d[i] - min) / range) * 255;
    g = Math.min(255, Math.max(0, (g - 128) * 1.4 + 128));
    const v = Math.round(g);
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  sctx.putImageData(imageData, 0, 0);
  return src;
}

/** Detect horizontal text bands in the team-name area (adapts to different ticket sizes). */
export function detectTextBands(processed: HTMLCanvasElement): TextBand[] {
  const w = processed.width;
  const h = processed.height;
  const ctx = processed.getContext("2d");
  if (!ctx) return [];

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const scanW = Math.round(w * TEXT_WIDTH);
  const startY = Math.round(h * 0.11);
  const inkThreshold = 145;

  const projection = new Float32Array(h);
  for (let y = startY; y < h; y++) {
    let ink = 0;
    for (let x = Math.round(w * TEXT_LEFT); x < Math.round(w * TEXT_LEFT) + scanW; x++) {
      if (d[(y * w + x) * 4] < inkThreshold) ink++;
    }
    projection[y] = ink;
  }

  const minInk = scanW * 0.012;
  const raw: TextBand[] = [];
  let inBand = false;
  let bandStart = 0;

  for (let y = startY; y < h; y++) {
    if (projection[y] > minInk) {
      if (!inBand) {
        bandStart = y;
        inBand = true;
      }
    } else if (inBand) {
      raw.push({ top: bandStart, bottom: y, height: y - bandStart });
      inBand = false;
    }
  }
  if (inBand) raw.push({ top: bandStart, bottom: h, height: h - bandStart });

  const merged: TextBand[] = [];
  for (const b of raw) {
    const last = merged[merged.length - 1];
    if (last && b.top - last.bottom < 10) {
      last.bottom = b.bottom;
      last.height = last.bottom - last.top;
    } else {
      merged.push({ ...b });
    }
  }

  const candidates = merged.filter((b) => b.height >= 12 && b.height < h * 0.07 && b.top > h * 0.11);
  if (candidates.length < 10) return [];

  const heights = candidates.map((b) => b.height).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] ?? 35;

  return candidates.filter((b) => b.height >= medianH * 0.45 && b.height <= medianH * 2.2);
}

function cropRegion(
  processed: HTMLCanvasElement,
  top: number,
  height: number
): HTMLCanvasElement {
  const w = processed.width;
  const h = processed.height;
  const left = Math.round(w * TEXT_LEFT);
  const width = Math.round(w * TEXT_WIDTH);
  const safeTop = Math.max(0, Math.min(top, h - 1));
  const safeH = Math.max(1, Math.min(height, h - safeTop));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = safeH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.drawImage(processed, left, safeTop, width, safeH, 0, 0, width, safeH);
  return canvas;
}

function fixedRowTops(h: number): { top: number; height: number }[] {
  const rows: { top: number; height: number }[] = [];
  for (let i = 0; i < 14; i++) {
    rows.push({
      top: Math.round(h * (ROW_FIRST_Y + i * ROW_STEP_Y)),
      height: Math.round(h * ROW_HEIGHT),
    });
  }
  rows.push({
    top: Math.round(h * 0.875),
    height: Math.round(h * 0.115),
  });
  return rows;
}

function bandsToRowSpecs(bands: TextBand[], h: number): { top: number; height: number }[] {
  if (bands.length < 12) return fixedRowTops(h);

  let sorted = [...bands].sort((a, b) => a.top - b.top);

  // Saltar bandas de cabecera (JORNADA, PRONÓSTICO…)
  while (sorted.length > 14 && sorted[0].top < h * 0.17) {
    sorted = sorted.slice(1);
  }

  const matchBands = sorted.slice(0, 14);
  const rows = matchBands.map((b) => ({
    top: Math.max(0, b.top - 2),
    height: b.height + 4,
  }));

  // Pleno al 15: recorte fijo en la zona inferior (dos líneas de equipos)
  rows.push({
    top: Math.round(h * 0.875),
    height: Math.round(h * 0.115),
  });

  return rows.slice(0, 15);
}

export function getQuinielaRowCrops(processed: HTMLCanvasElement): RowCrop[] {
  const bands = detectTextBands(processed);
  const specs = bandsToRowSpecs(bands, processed.height);

  return specs.map((spec, index) => ({
    canvas: cropRegion(processed, spec.top, spec.height),
    index,
  }));
}

export async function prepareQuinielaImage(file: File): Promise<{
  processed: HTMLCanvasElement;
  rows: RowCrop[];
}> {
  const img = await loadImage(file);
  const processed = preprocessQuinielaCanvas(img);
  return { processed, rows: getQuinielaRowCrops(processed) };
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo convertir el recorte"));
    }, "image/png");
  });
}
