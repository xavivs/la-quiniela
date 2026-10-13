import { createWorker } from "tesseract.js";
import sharp from "sharp";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { layoutQuinielaFromGray } from "../src/lib/quinielaOcrImage.ts";
import { parseMatchesFromRowTexts } from "../src/lib/parseQuinielaWeb.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, "..", "examples");

const EXPECTED = {
  "2026-01-14": [
    ["BETIS", "VILLARREAL"], ["CELTA", "RAYO"], ["ELCHE", "SEVILLA"], ["GETAFE", "VALENCIA"],
    ["OSASUNA", "R.OVIEDO"], ["AT.MADRID", "ALAVÉS"], ["MALLORCA", "ATH.CLUB"], ["R.MADRID", "LEVANTE"],
    ["ALBACETE", "CÁDIZ"], ["BURGOS", "HUESCA"], ["C. LEONESA", "SPORTING"], ["ALMERÍA", "DEPORTIVO"],
    ["GRANADA", "EIBAR"], ["RACING S.", "LAS PALMAS"], ["R.SOCIEDAD", "BARCELONA"],
  ],
  "2026-01-22": [
    ["RAYO", "OSASUNA"], ["VALENCIA", "ESPANYOL"], ["SEVILLA", "ATH.CLUB"], ["VILLARREAL", "R.MADRID"],
    ["AT.MADRID", "MALLORCA"], ["BARCELONA", "R.OVIEDO"], ["R.SOCIEDAD", "CELTA"], ["ALAVÉS", "BETIS"],
    ["VALLADOLID", "ALBACETE"], ["LAS PALMAS", "CÓRDOBA"], ["ANDORRA FC", "HUESCA"], ["EIBAR", "ALMERÍA"],
    ["R.ZARAGOZA", "CASTELLÓN"], ["DEPORTIVO", "RACING S."], ["GIRONA", "GETAFE"],
  ],
  "2026-01-29": [
    ["R.OVIEDO", "GIRONA"], ["OSASUNA", "VILLARREAL"], ["LEVANTE", "AT.MADRID"], ["ELCHE", "BARCELONA"],
    ["R.MADRID", "RAYO"], ["BETIS", "VALENCIA"], ["GETAFE", "CELTA"], ["MALLORCA", "SEVILLA"],
    ["C. LEONESA", "DEPORTIVO"], ["ALMERÍA", "CEUTA"], ["EIBAR", "SPORTING"], ["HUESCA", "CÁDIZ"],
    ["GRANADA", "RACING S."], ["MIRANDÉS", "MÁLAGA"], ["ATH.CLUB", "R.SOCIEDAD"],
  ],
  "2026-02-04": [
    ["RAYO", "R.OVIEDO"], ["BARCELONA", "MALLORCA"], ["SEVILLA", "GIRONA"], ["R.SOCIEDAD", "ELCHE"],
    ["ALAVÉS", "GETAFE"], ["ATH.CLUB", "LEVANTE"], ["AT.MADRID", "BETIS"], ["VILLARREAL", "ESPANYOL"],
    ["CÁDIZ", "ALMERÍA"], ["VALLADOLID", "CASTELLÓN"], ["CEUTA", "CÓRDOBA"], ["DEPORTIVO", "ALBACETE"],
    ["SPORTING", "HUESCA"], ["MÁLAGA", "C. LEONESA"], ["VALENCIA", "R.MADRID"],
  ],
  "2026-03-18": [
    ["ELCHE", "MALLORCA"], ["ESPANYOL", "GETAFE"], ["LEVANTE", "R.OVIEDO"], ["OSASUNA", "GIRONA"],
    ["SEVILLA", "VALENCIA"], ["BARCELONA", "RAYO"], ["CELTA", "ALAVÉS"], ["ATH.CLUB", "BETIS"],
    ["LEGANÉS", "CEUTA"], ["ANDORRA FC", "EIBAR"], ["CÁDIZ", "MÁLAGA"], ["BURGOS", "CÓRDOBA"],
    ["MIRANDÉS", "VALLADOLID"], ["LAS PALMAS", "SPORTING"], ["R.MADRID", "AT.MADRID"],
  ],
  "2026-06-29": [
    ["PORTUGAL", "CROACIA"], ["SUIZA", "ARGELIA"], ["AUSTRALIA", "EGIPTO"], ["ARGENTINA", "CABO VERDE"],
    ["COLOMBIA", "GHANA"], ["FC LAHTI", "IF GNISTAN"], ["SJK", "TPS"], ["FF JARO", "ILVES"],
    ["VPS", "IFK MARIEHAMN"], ["SIRIUS", "MJALLBY"], ["HALMSTADS", "VASTERAS"], ["DEGERFORS", "MALMO"],
    ["GOTEBORG", "AIK"], ["KALMAR", "ORGRYTE"], ["ELFSBORG", "HAMMARBY"],
  ],
  "2026-10-06": [
    ["RAYO", "ATH.CLUB"], ["ALAVÉS", "AT.MADRID"], ["BARCELONA", "GETAFE"], ["ELCHE", "CELTA"],
    ["R.SOCIEDAD", "DEPORTIVO"], ["BETIS", "OSASUNA"], ["RACING S.", "VALENCIA"], ["LEVANTE", "SEVILLA"],
    ["ELDENSE", "CÓRDOBA"], ["ANDORRA FC", "CASTELLÓN"], ["ALMERÍA", "LEGANÉS"], ["MALLORCA", "LAS PALMAS"],
    ["BURGOS", "GRANADA"], ["R.OVIEDO", "EIBAR"], ["R.MADRID", "VILLARREAL"],
  ],
};

async function ocrFile(worker, imagePath) {
  const { data, info } = await sharp(readFileSync(imagePath))
    .grayscale()
    .normalize()
    .linear(1.4, -(128 * 0.4))
    .resize({ width: 1400 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toBuffer();
  const layout = layoutQuinielaFromGray(data, info.width, info.height);
  const rowTexts = [];
  for (let i = 0; i < layout.rows.length; i++) {
    const spec = layout.rows[i];
    const width = Math.max(1, spec.textRight - layout.textLeft);
    if (i === 14) await worker.setParameters({ tessedit_pageseg_mode: "6", user_defined_dpi: "300" });
    const crop = await sharp(png)
      .extract({ left: layout.textLeft, top: spec.top, width, height: spec.height })
      .resize({ width: width * 2, height: spec.height * 2, kernel: "nearest" })
      .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();
    const { data: ocr } = await worker.recognize(crop);
    if (i === 14) await worker.setParameters({ tessedit_pageseg_mode: "7", user_defined_dpi: "300" });
    rowTexts.push((ocr?.text ?? "").trim().replace(/\s+/g, " "));
  }
  return { rowTexts, parsed: parseMatchesFromRowTexts(rowTexts) };
}

async function main() {
  const worker = await createWorker("spa");
  await worker.setParameters({ tessedit_pageseg_mode: "7", user_defined_dpi: "300" });
  const files = readdirSync(examplesDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  let bad = 0;
  let total = 0;
  for (const file of files) {
    const key = Object.keys(EXPECTED).find((k) => file.includes(k));
    console.log("\n" + "=".repeat(70));
    console.log(file);
    const { rowTexts, parsed } = await ocrFile(worker, join(examplesDir, file));
    if (!key) {
      parsed.forEach((m, i) => console.log(`  ${i + 1}: ${m.home_team} - ${m.away_team} | ${rowTexts[i]}`));
      continue;
    }
    parsed.forEach((m, i) => {
      total++;
      const [home, away] = EXPECTED[key][i];
      const ok = m.home_team === home && m.away_team === away;
      if (!ok) {
        bad++;
        console.log(`  MIS ${i + 1}: ${JSON.stringify(m.home_team + " - " + m.away_team)} != ${home} - ${away}`);
        console.log(`       raw: ${JSON.stringify(rowTexts[i])}`);
      }
    });
    const n = parsed.filter((m, i) => m.home_team === EXPECTED[key][i][0] && m.away_team === EXPECTED[key][i][1]).length;
    console.log(`=> ${n}/15`);
  }
  await worker.terminate();
  console.log(`\n${total - bad}/${total} correctos`);
  if (bad > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
