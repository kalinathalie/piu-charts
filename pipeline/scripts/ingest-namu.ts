/**
 * Last-resort chart source: namu.wiki (English mirror). For songs still lacking
 * charts after piucenter + pumpproplus, fetch the song's namu.wiki article and
 * parse its Phoenix difficulty table ("type / level and maker"), reading Single
 * (orange) and Double (green) levels plus the stepmaker.
 *
 * Article titles often differ from our display titles, so an optional override map
 * (NAMU_TITLES) lets you point a song id at the exact namu article name.
 *
 * Usage: cd pipeline && npm run ingest:namu   (DRY=1 to preview without writing)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseSonglist } from "../src/build/parseSonglist.js";
import type { SongMeta, ChartMeta } from "../src/build/catalog.js";

const pipelineRoot = join(import.meta.dirname, "..");
const songlistPath = join(pipelineRoot, "catalog", "songlist.txt");
const metadataPath = join(pipelineRoot, "catalog", "metadata.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Override namu article titles for songs whose article name differs from ours. */
const NAMU_TITLES: Record<string, string> = {};

interface Parsed {
  charts: { mode: "Single" | "Double"; level: number }[];
  stepmaker?: string;
}

function parseNamu(html: string): Parsed | null {
  if (!/Pump It Up/i.test(html)) return null;
  const ti = html.indexOf("level and maker");
  if (ti < 0) return null;
  const tStart = html.lastIndexOf("<table", ti);
  const tEnd = html.indexOf("</table>", ti) + 8;
  const tbl = html.slice(tStart, tEnd);

  const cellsFor = (bg: RegExp) =>
    [...tbl.matchAll(new RegExp(`background-color:rgb\\(${bg.source}\\)[^>]*>\\s*<div[^>]*>([^<]+)<`, "g"))].map(
      (m) => m[1],
    );
  const sCells = cellsFor(/255,\s*84,\s*0/);
  const dCells = cellsFor(/0,\s*136,\s*26/);
  const levels = (cells: string[], p: "S" | "D") => [
    ...new Set((cells.join(" ").match(new RegExp(`${p}(\\d{1,2})`, "g")) || []).map((x) => Number(x.slice(1)))),
  ];
  const sLevels = levels(sCells, "S");
  const dLevels = levels(dCells, "D");
  if (sLevels.length === 0 && dLevels.length === 0) return null;

  const makers = [...tbl.matchAll(/rowspan=['"]2['"][^>]*>\s*<div[^>]*>([^<]+)<\/div>/g)]
    .map((m) => m[1].trim())
    .filter((x) => !/^(Normal|type)$/i.test(x));

  return {
    charts: [
      ...sLevels.sort((a, b) => a - b).map((level) => ({ mode: "Single" as const, level })),
      ...dLevels.sort((a, b) => a - b).map((level) => ({ mode: "Double" as const, level })),
    ],
    stepmaker: makers[0],
  };
}

async function main() {
  const songs = parseSonglist(readFileSync(songlistPath, "utf8"));
  const meta: Record<string, SongMeta> = existsSync(metadataPath)
    ? (JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, SongMeta>)
    : {};
  const toFill = songs.filter((s) => !meta[s.id]?.charts?.length);
  process.stderr.write(`songs needing charts: ${toFill.length}\n`);

  let matched = 0;
  let chartsAdded = 0;
  const filled: string[] = [];
  const stillMissing: string[] = [];

  for (const song of toFill) {
    const title = NAMU_TITLES[song.id] ?? stripVariant(song.title);
    const url = "https://en.namu.wiki/w/" + encodeURIComponent(title);
    let html = "";
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } });
      if (r.status === 200) html = await r.text();
    } catch (e) {
      process.stderr.write(`fetch error "${title}": ${e}\n`);
    }
    await sleep(300);
    const parsed = html ? parseNamu(html) : null;
    if (!parsed) {
      stillMissing.push(`${song.title}  (${url})`);
      continue;
    }
    matched++;
    chartsAdded += parsed.charts.length;
    filled.push(`${song.title} -> ${parsed.charts.map((c) => (c.mode === "Single" ? "S" : "D") + c.level).join(" ")}${parsed.stepmaker ? ` [${parsed.stepmaker}]` : ""}`);
    const chartMetas: ChartMeta[] = parsed.charts.map((c) => ({
      mode: c.mode,
      level: c.level,
      stepmaker: parsed.stepmaker,
      types: [],
      typesSource: "auto" as const,
    }));
    const prev = meta[song.id] ?? {};
    meta[song.id] = { ...prev, charts: chartMetas };
  }

  const dry = process.env.DRY === "1";
  if (!dry) writeFileSync(metadataPath, JSON.stringify(meta, null, 2) + "\n");

  process.stdout.write(
    `\n=== filled (${filled.length}) ===\n` +
      filled.join("\n") +
      `\n\n=== still missing (${stillMissing.length}) ===\n` +
      stillMissing.join("\n") +
      "\n\n" +
      JSON.stringify({ dryRun: dry, needed: toFill.length, matched, chartsAdded }, null, 2) +
      "\n",
  );
}

function stripVariant(t: string): string {
  return t.replace(/\s*-?\s*(short cut|full song|full ver\.?|remix)\s*$/i, "").trim();
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + "\n");
  process.exit(1);
});
