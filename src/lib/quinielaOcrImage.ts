const TARGET_WIDTH = 1400;

export type RowCrop = { canvas: HTMLCanvasElement; index: number };
export type TextBand = { top: number; bottom: number; height: number };
export type QuinielaRowSpec = { top: number; height: number; textRight: number };
export type QuinielaRowLayout = {
  rows: QuinielaRowSpec[];
  textLeft: number;
  textWidth: number;
};

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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Text lines in the team-name column, from the top of the image.
 * A fixed skip of the top 11% drops the first matches when the photo is a tight crop of the table.
 */
function collectTextBands(gray: Uint8Array, w: number, h: number): TextBand[] {
  const left = Math.round(w * 0.02);
  const scanW = Math.round(w * 0.46);
  const minInk = Math.max(8, scanW * 0.015);
  const raw: TextBand[] = [];
  let inBand = false;
  let bandStart = 0;

  for (let y = 0; y < h; y++) {
    let ink = 0;
    const row = y * w;
    for (let x = left; x < left + scanW; x++) {
      if (gray[row + x] < 145) ink++;
    }
    if (ink > minInk) {
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
    // The dotted leader under a short name is a thin band a few pixels below the text.
    if (last && b.top - last.bottom < 8 && (b.height < 14 || last.height < 14)) {
      last.bottom = b.bottom;
      last.height = last.bottom - last.top;
    } else {
      merged.push({ ...b });
    }
  }

  const sized = merged.filter((b) => b.height >= 16 && b.height <= 90);
  const medianH = median(sized.map((b) => b.height));
  if (medianH <= 0) return [];
  return sized.filter((b) => b.height >= medianH * 0.55 && b.height <= medianH * 1.45);
}

function mergeSplitLines(bands: TextBand[], pitch: number): TextBand[] {
  if (pitch <= 0) return bands;
  const out: TextBand[] = [];
  for (const b of bands) {
    const last = out[out.length - 1];
    if (last && b.top - last.top < pitch * 0.45) {
      last.bottom = Math.max(last.bottom, b.bottom);
      last.height = last.bottom - last.top;
    } else {
      out.push({ ...b });
    }
  }
  return out;
}

/** Longest run of lines spaced like the 14 matches plus the two pleno lines. */
function longestRowRun(bands: TextBand[], pitch: number): TextBand[] {
  if (bands.length === 0 || pitch < 20) return [];
  let best: TextBand[] = [];
  let current: TextBand[] = [bands[0]];

  const keep = () => {
    if (current.length > best.length) best = current;
  };

  for (let i = 1; i < bands.length; i++) {
    const gap = bands[i].top - bands[i - 1].top;
    const ratio = gap / pitch;
    const heightRatio = bands[i - 1].height / Math.max(1, bands[i].height);
    const sameSize = heightRatio >= 0.75 && heightRatio <= 1.33;
    if (ratio >= 0.72 && ratio <= 1.28) {
      current.push(bands[i]);
    } else if (ratio >= 1.75 && ratio <= 2.35 && sameSize) {
      const top = bands[i - 1].top + Math.round(pitch);
      const height = bands[i - 1].height;
      current.push({ top, bottom: top + height, height });
      current.push(bands[i]);
    } else {
      keep();
      current = [bands[i]];
    }
  }
  keep();
  return best;
}

function toFifteenRows(run: TextBand[], imageH: number): { top: number; height: number }[] {
  if (run.length < 14) return [];
  const bands = run.length > 16 ? run.slice(run.length - 16) : run;
  const matchCount = bands.length >= 16 ? 14 : bands.length - 1;
  const rows: { top: number; height: number }[] = [];

  for (let i = 0; i < matchCount; i++) {
    const b = bands[i];
    const next = bands[i + 1];
    const top = Math.max(0, b.top - 2);
    let bottom = b.bottom + 3;
    if (next) bottom = Math.min(bottom, Math.round((b.bottom + next.top) / 2));
    bottom = Math.min(imageH, bottom);
    rows.push({ top, height: Math.max(12, bottom - top) });
  }

  const plenoStart = bands[matchCount];
  const plenoEnd = bands[bands.length - 1];
  const top = Math.max(0, plenoStart.top - 3);
  const bottom = Math.min(imageH, plenoEnd.bottom + 4);
  rows.push({ top, height: Math.max(12, bottom - top) });

  while (rows.length < 15) rows.push({ top: imageH - 1, height: 1 });
  return rows.slice(0, 15);
}

/**
 * Right edge of the team names on one row.
 * Stops before the dotted leader (a wide gap) so Tesseract does not read the dots as letters.
 * The gap between home and away is about 35–50px at the working width; the leader is much wider.
 */
function rowTextRight(
  gray: Uint8Array,
  w: number,
  h: number,
  row: { top: number; height: number },
  left: number,
  maxRight: number
): number {
  const y0 = Math.max(0, row.top);
  const y1 = Math.min(h, row.top + row.height);
  let last = left;
  let gap = 0;
  let seen = false;
  for (let x = left; x < maxRight; x++) {
    let ink = 0;
    for (let y = y0; y < y1; y++) {
      if (gray[y * w + x] < 120) ink++;
    }
    if (ink >= 8) {
      if (seen && gap > 70) break;
      last = x;
      seen = true;
      gap = 0;
    } else {
      gap++;
    }
  }
  return Math.max(left + 48, Math.min(maxRight, last + 18));
}

/** Crop ends before the match-number / kickoff column, which Tesseract mixes into the team names. */
function findTextWindow(
  gray: Uint8Array,
  w: number,
  h: number,
  rows: TextBand[]
): { left: number; width: number } {
  const sample = rows.slice(0, 14);
  const hits = new Uint16Array(w);
  const need = Math.max(3, Math.round(sample.length * 0.18));

  for (const row of sample) {
    const y1 = Math.min(h, row.bottom);
    for (let x = 0; x < w; x++) {
      let ink = 0;
      for (let y = row.top; y < y1; y++) {
        if (gray[y * w + x] < 120) ink++;
      }
      if (ink >= 6) hits[x]++;
    }
  }

  let left = Math.round(w * 0.015);
  for (let x = 0; x < Math.round(w * 0.25); x++) {
    if (hits[x] >= need) {
      left = Math.max(0, x - 6);
      break;
    }
  }

  let lastDense = left;
  let gap = 0;
  let right = Math.round(w * 0.55);
  let foundPeak = false;
  for (let x = left; x < Math.round(w * 0.82); x++) {
    if (hits[x] >= need) {
      if (gap > w * 0.05 && x > w * 0.4) {
        right = x - Math.round(w * 0.015);
        foundPeak = true;
        break;
      }
      lastDense = x;
      gap = 0;
    } else {
      gap++;
    }
  }

  if (!foundPeak) right = Math.min(w - 8, lastDense + Math.round(w * 0.08));
  right = Math.min(right, Math.round(w * 0.6));
  right = Math.max(right, lastDense + 8);
  return { left, width: Math.max(40, right - left) };
}

/**
 * Locate the 15 quiniela rows on a grayscale slip.
 * Works for a full jornada screenshot and for a crop that starts at match 1.
 */
export function layoutQuinielaFromGray(gray: Uint8Array, w: number, h: number): QuinielaRowLayout {
  const fallback: QuinielaRowLayout = {
    rows: [],
    textLeft: Math.round(w * 0.02),
    textWidth: Math.round(w * 0.55),
  };

  let bands = collectTextBands(gray, w, h);
  const earlyGaps = bands.slice(1).map((b, i) => b.top - bands[i].top).filter((g) => g >= 40 && g <= 160);
  const earlyPitch = median(earlyGaps);
  if (earlyPitch > 0) bands = mergeSplitLines(bands, earlyPitch);

  const gaps = bands.slice(1).map((b, i) => b.top - bands[i].top).filter((g) => g >= 40 && g <= 140);
  const pitch = median(gaps);
  const run = longestRowRun(bands, pitch);
  const rows = toFifteenRows(run, h);
  if (rows.length < 15 || run.length < 14) return fallback;

  const window = findTextWindow(gray, w, h, run.length > 16 ? run.slice(run.length - 16) : run);
  const maxRight = Math.min(w - 2, window.left + window.width);
  return {
    rows: rows.map((row) => ({
      ...row,
      textRight: rowTextRight(gray, w, h, row, window.left, maxRight),
    })),
    textLeft: window.left,
    textWidth: window.width,
  };
}

function grayFromCanvas(processed: HTMLCanvasElement): Uint8Array {
  const w = processed.width;
  const h = processed.height;
  const ctx = processed.getContext("2d");
  if (!ctx) return new Uint8Array(w * h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) gray[p] = d[i];
  return gray;
}

function cropRegion(
  processed: HTMLCanvasElement,
  top: number,
  height: number,
  textLeft: number,
  textWidth: number
): HTMLCanvasElement {
  const h = processed.height;
  const safeTop = Math.max(0, Math.min(top, h - 1));
  const safeH = Math.max(1, Math.min(height, h - safeTop));
  const safeLeft = Math.max(0, Math.min(textLeft, processed.width - 2));
  const safeW = Math.max(1, Math.min(textWidth, processed.width - safeLeft));
  const scale = 2;
  const pad = 16;

  const canvas = document.createElement("canvas");
  canvas.width = safeW * scale + pad * 2;
  canvas.height = safeH * scale + pad * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(processed, safeLeft, safeTop, safeW, safeH, pad, pad, safeW * scale, safeH * scale);
  return canvas;
}

export function getQuinielaRowCrops(processed: HTMLCanvasElement): RowCrop[] {
  const layout = layoutQuinielaFromGray(grayFromCanvas(processed), processed.width, processed.height);
  const specs =
    layout.rows.length === 15
      ? layout.rows
      : fixedFallbackRows(processed.height);

  return specs.map((spec, index) => ({
    canvas: cropRegion(
      processed,
      spec.top,
      spec.height,
      layout.textLeft,
      "textRight" in spec && spec.textRight > layout.textLeft
        ? spec.textRight - layout.textLeft
        : layout.textWidth
    ),
    index,
  }));
}

function fixedFallbackRows(h: number): QuinielaRowSpec[] {
  const rows: QuinielaRowSpec[] = [];
  for (let i = 0; i < 14; i++) {
    rows.push({
      top: Math.round(h * (0.23 + i * 0.047)),
      height: Math.round(h * 0.028),
      textRight: 0,
    });
  }
  rows.push({ top: Math.round(h * 0.875), height: Math.round(h * 0.115), textRight: 0 });
  return rows;
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
