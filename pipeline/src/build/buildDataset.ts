/**
 * Build the bundled dataset from the hand-maintained catalog.
 *
 * Reads:  catalog/songlist.txt  (ordered song list with version section headers)
 *         catalog/metadata.json  (optional per-song artist/bpm/charts/types, keyed by id)
 * Writes: data/dataset.json      (normalized Dataset; releaseIndex = position in the list)
 *
 * Usage: cd pipeline && npm run build:dataset
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseSonglist } from "./parseSonglist";
import { validateCatalog } from "./validateCatalog";
import { normalizeTitle } from "../text/normalize";
import type { Dataset, Song, Chart, Version } from "../model/types";

interface ChartMeta {
  id?: string;
  mode?: Chart["mode"];
  level: number;
  stepmaker?: string;
  types?: Chart["types"];
  typesSource?: Chart["typesSource"];
}

interface SongMeta {
  artist?: string;
  titleKr?: string;
  bpmMin?: number;
  bpmMax?: number;
  debutVersion?: Version;
  charts?: ChartMeta[];
}

const root = join(import.meta.dirname, "..", "..");
const songlistPath = join(root, "catalog", "songlist.txt");
const metadataPath = join(root, "catalog", "metadata.json");
const outDir = join(root, "data");
const outPath = join(outDir, "dataset.json");

const parsed = parseSonglist(readFileSync(songlistPath, "utf8"));
const metadata: Record<string, SongMeta> = existsSync(metadataPath)
  ? (JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, SongMeta>)
  : {};

const songs: Song[] = parsed.map((p, i) => {
  const m = metadata[p.id] ?? {};
  return {
    id: p.id,
    title: p.title,
    titleKr: m.titleKr,
    titleNormalized: normalizeTitle(p.title),
    artist: m.artist ?? "",
    bpmMin: m.bpmMin ?? 0,
    bpmMax: m.bpmMax ?? m.bpmMin ?? 0,
    debutVersion: m.debutVersion ?? p.debutVersion,
    releaseIndex: i + 1,
  };
});

const charts: Chart[] = [];
for (const p of parsed) {
  const m = metadata[p.id];
  if (!m?.charts) continue;
  m.charts.forEach((c, j) => {
    const mode = c.mode ?? "Single";
    charts.push({
      id: c.id ?? `${p.id}_${mode[0].toLowerCase()}${c.level}_${j}`,
      songId: p.id,
      mode,
      level: c.level,
      stepmaker: c.stepmaker,
      types: c.types ?? [],
      typesSource: c.typesSource ?? "manual",
    });
  });
}

const dataset: Dataset = { songs, charts };

const errors = validateCatalog(dataset);
if (errors.length > 0) {
  console.error("Catalog validation errors:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(dataset, null, 2));
console.log(`Wrote ${songs.length} songs, ${charts.length} charts -> ${outPath}`);

const withCharts = new Set(charts.map((c) => c.songId)).size;
console.log(`${withCharts}/${songs.length} songs have at least one chart (add charts in metadata.json).`);
