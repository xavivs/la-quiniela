import { createWorker } from "tesseract.js";
import sharp from "sharp";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseMatchesFromRowTexts } from "../src/lib/parseQuinielaWeb.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, "..", "examples");

const TEXT_LEFT = 0.02;
const TEXT_WIDTH = 0.62;
const TARGET_WIDTH = 1400;
const ROW_FIRST_Y = 0.23;
const ROW_STEP_Y = 0.047;
const ROW_HEIGHT = 0.028;

async function preprocess(buffer) {
  return sharp(buffer)
    .grayscale()
    .normalize()
    .linear(1.4, -(128 * 0.4))
    .resize({ width: TARGET_WIDTH, withoutEnlargement: false })
    .raw()
    .toBuffer({ resolveWithObject: true });
}

function detectTextBands(data, w, h) {
  const scanW = Math.round(w * TEXT_WIDTH);
  const startY = Math.round(h * 0.11);
  const left = Math.round(w * TEXT_LEFT);
  const minInk = scanW * 0.012;
  const raw = [];
  let inBand = false;
  let bandStart = 0;

  for (let y = startY; y < h; y++) {
    let ink = 0;
    for (let x = left; x < left + scanW; x++) {
      if (data[y * w + x] < 145) ink++;
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

  const merged = [];
  for (const b of raw) {
    const last = merged[merged.length - 1];
    if (last && b.top - last.bottom < 10) {
      last.bottom = b.bottom;
      last.height = last.bottom - last.top;
    } else merged.push({ ...b });
  }

  const candidates = merged.filter((b) => b.height >= 12 && b.height < h * 0.07 && b.top > h * 0.11);
  if (candidates.length < 10) return [];

  const heights = candidates.map((b) => b.height).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] ?? 35;
  return candidates.filter((b) => b.height >= medianH * 0.45 && b.height <= medianH * 2.2);
}

function bandsToRowSpecs(bands, h) {
  if (bands.length < 12) {
    const rows = [];
    for (let i = 0; i < 14; i++) {
      rows.push({ top: Math.round(h * (ROW_FIRST_Y + i * ROW_STEP_Y)), height: Math.round(h * ROW_HEIGHT) });
    }
    rows.push({ top: Math.round(h * 0.875), height: Math.round(h * 0.115) });
    return rows;
  }

  let sorted = [...bands].sort((a, b) => a.top - b.top);
  while (sorted.length > 14 && sorted[0].top < h * 0.17) sorted = sorted.slice(1);

  const rows = sorted.slice(0, 14).map((b) => ({ top: Math.max(0, b.top - 2), height: b.height + 4 }));
  rows.push({ top: Math.round(h * 0.87), height: Math.round(h * 0.11) });
  return rows.slice(0, 15);
}

async function ocrRows(imagePath) {
  const { data, info } = await preprocess(await sharp(imagePath).toBuffer());
  const w = info.width;
  const h = info.height;
  const bands = detectTextBands(data, w, h);
  const specs = bandsToRowSpecs(bands, h);

  const processedPng = await sharp(data, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  const worker = await createWorker("spa");
  await worker.setParameters({ tessedit_pageseg_mode: "7" });

  const rowTexts = [];
  const left = Math.round(w * TEXT_LEFT);
  const width = Math.round(w * TEXT_WIDTH);

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    if (i === 14) await worker.setParameters({ tessedit_pageseg_mode: "6" });
    const crop = await sharp(processedPng)
      .extract({ left, top: spec.top, width, height: spec.height })
      .png()
      .toBuffer();
    const { data: ocr } = await worker.recognize(crop);
    if (i === 14) await worker.setParameters({ tessedit_pageseg_mode: "7" });
    rowTexts.push((ocr?.text ?? "").trim().replace(/\s+/g, " "));
  }
  await worker.terminate();
  return { rowTexts, h, w, bands: bands.length };
}

async function main() {
  const files = readdirSync(examplesDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  for (const file of files.sort()) {
    const path = join(examplesDir, file);
    console.log("\n" + "=".repeat(70));
    console.log("FILE:", file);
    const { rowTexts, h, w, bands } = await ocrRows(path);
    console.log(`Image: ${w}x${h}, bands detected: ${bands}`);
    rowTexts.forEach((t, i) => console.log(`  raw ${String(i + 1).padStart(2)}: ${JSON.stringify(t)}`));
    const parsed = parseMatchesFromRowTexts(rowTexts);
    console.log("--- parsed ---");
    parsed.forEach((m, i) => {
      const ok = m.home_team || m.away_team;
      console.log(`  ${String(i + 1).padStart(2)}: ${ok ? `${m.home_team} - ${m.away_team}` : "(vacío)"}`);
    });
    const empty = parsed.filter((m) => !m.home_team && !m.away_team).length;
    console.log(`=> ${15 - empty}/15 leídos, ${empty} vacíos`);
  }
}

main().catch(console.error);
