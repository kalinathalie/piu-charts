/**
 * Build the app-ready data file with all placements pre-computed.
 *
 * Reads the catalog (songlist.txt + metadata.json), computes per-song and per-chart
 * placements via the numbering engine, and writes a flat JSON the app bundles.
 *
 * Writes: app/assets/app-data.json
 * Usage:  cd pipeline && npm run build:appdata
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildDatasetFromCatalog } from "./catalog";
import { validateCatalog } from "./validateCatalog";
import { toAppData } from "./appData";
import { parseTitles } from "./titles";

const pipelineRoot = join(import.meta.dirname, "..", "..");
const repoRoot = join(pipelineRoot, "..");

const dataset = buildDatasetFromCatalog(pipelineRoot);

const errors = validateCatalog(dataset);
if (errors.length > 0) {
  console.error("Catalog validation errors:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const titlesPath = join(pipelineRoot, "catalog", "titles.txt");
const titles = existsSync(titlesPath)
  ? parseTitles(readFileSync(titlesPath, "utf8"), dataset.songs)
  : [];
const titleCount = titles.reduce((n, c) => n + c.titles.length, 0);
const unresolved = titles.flatMap((c) => c.titles).filter((t) => !t.songId);
if (unresolved.length) {
  console.warn(`titles: ${unresolved.length}/${titleCount} unresolved song(s):`);
  for (const t of unresolved) console.warn(`  - ${t.songTitle} (${t.chartLabel})`);
}

const appData = toAppData(dataset, titles);
const outPath = join(repoRoot, "app", "assets", "app-data.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(appData));
console.log(
  `Wrote ${appData.songCount} songs / ${appData.chartCount} charts / ${titleCount} titles -> app/assets/app-data.json`,
);
