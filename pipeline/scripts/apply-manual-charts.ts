/**
 * Apply ground-truth charts from catalog/manual-charts.json (read directly off the
 * Phoenix arcade) into metadata.json. This is the authoritative layer — run it LAST,
 * after the scraped ingests, so hand-verified data wins. Keyed by exact song title.
 *
 * Usage: cd pipeline && npm run ingest:manual
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseSonglist } from "../src/build/parseSonglist.js";
import type { SongMeta, ChartMeta } from "../src/build/catalog.js";
import type { Mode } from "../src/model/types.js";

const pipelineRoot = join(import.meta.dirname, "..");
const songlistPath = join(pipelineRoot, "catalog", "songlist.txt");
const metadataPath = join(pipelineRoot, "catalog", "metadata.json");
const manualPath = join(pipelineRoot, "catalog", "manual-charts.json");

interface ManualEntry {
  artist?: string;
  bpm?: number;
  bpmMin?: number;
  bpmMax?: number;
  charts: string[];
}

function tokenToChart(tok: string): ChartMeta {
  const m = tok.trim().match(/^([SD])(\d{1,2})$/i);
  if (!m) throw new Error(`bad chart token: ${tok}`);
  const mode: Mode = m[1].toUpperCase() === "S" ? "Single" : "Double";
  return { mode, level: Number(m[2]), types: [], typesSource: "manual" };
}

function main() {
  const songs = parseSonglist(readFileSync(songlistPath, "utf8"));
  const meta: Record<string, SongMeta> = existsSync(metadataPath)
    ? (JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, SongMeta>)
    : {};
  const manual = JSON.parse(readFileSync(manualPath, "utf8")).songs as Record<string, ManualEntry>;

  const titleToId = new Map(songs.map((s) => [s.title, s.id]));
  let applied = 0;
  const notFound: string[] = [];

  for (const [title, entry] of Object.entries(manual)) {
    const id = titleToId.get(title);
    if (!id) {
      notFound.push(title);
      continue;
    }
    const charts: ChartMeta[] = entry.charts
      .map(tokenToChart)
      .sort((a, b) => (a.mode === b.mode ? a.level - b.level : a.mode === "Single" ? -1 : 1));
    const prev = meta[id] ?? {};
    meta[id] = {
      ...prev,
      artist: entry.artist ?? prev.artist,
      bpmMin: entry.bpmMin ?? entry.bpm ?? prev.bpmMin,
      bpmMax: entry.bpmMax ?? entry.bpm ?? prev.bpmMax,
      charts,
    };
    applied++;
  }

  writeFileSync(metadataPath, JSON.stringify(meta, null, 2) + "\n");
  process.stdout.write(
    JSON.stringify({ applied, total: Object.keys(manual).length, notFound }, null, 2) + "\n",
  );
}

main();
