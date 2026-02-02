import { NextResponse } from "next/server";
import {
  parseTeamNamesFromText,
  tryParseJsonFromHtml,
} from "@/lib/parseQuinielaWeb";

const QUINIELA_URL = "https://www.loteriasyapuestas.es/es/resultados/quiniela";

/**
 * Fetch quiniela page and parse team names (HOME - AWAY) for the 15 matches.
 * Tries: (1) JSON embedded in page, (2) text with "LOCAL - VISITANTE" pattern (various dashes).
 */
export async function GET() {
  try {
    const res = await fetch(QUINIELA_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      next: { revalidate: 0 },
    });
    const html = await res.text();

    // 1) Try embedded JSON (Next.js, etc.)
    const fromJson = tryParseJsonFromHtml(html);
    if (fromJson && fromJson.some((m) => m.home_team || m.away_team)) {
      const padded = Array.from({ length: 15 }, (_, i) => ({
        home_team: fromJson[i]?.home_team ?? "",
        away_team: fromJson[i]?.away_team ?? "",
      }));
      return NextResponse.json({
        ok: true,
        matches: padded,
        message: `Se encontraron ${fromJson.filter((m) => m.home_team || m.away_team).length} partidos (desde datos de la página).`,
      });
    }

    // 2) Normalize HTML dashes so "TEAM – AWAY" becomes "TEAM - AWAY" in text
    const htmlNormalized = html
      .replace(/&#8211;/g, " - ")
      .replace(/&ndash;/gi, " - ")
      .replace(/\u2013/g, " - ")
      .replace(/\u2014/g, " - ");

    // Build text: keep structure so we get one block per row (tr/div)
    const text = htmlNormalized
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/td>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .replace(/\n\s*/g, "\n")
      .trim();

    const matches = parseTeamNamesFromText(text);

    if (matches.length === 0) {
      return NextResponse.json({
        ok: true,
        matches: Array.from({ length: 15 }, () => ({
          home_team: "",
          away_team: "",
        })),
        message:
          "No se encontraron partidos en el HTML (la página puede cargar datos por JavaScript). Rellena los equipos a mano o prueba más tarde.",
      });
    }

    const padded = Array.from({ length: 15 }, (_, i) => ({
      home_team: matches[i]?.home_team ?? "",
      away_team: matches[i]?.away_team ?? "",
    }));

    return NextResponse.json({
      ok: true,
      matches: padded,
      message: `Se encontraron ${matches.length} partidos. Revisa y corrige si hace falta.`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error al leer la web de la Quiniela.", details: String(err) },
      { status: 500 }
    );
  }
}
