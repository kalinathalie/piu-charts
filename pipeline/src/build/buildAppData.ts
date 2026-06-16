/**
 * Build the app-ready data file with all placements pre-computed.
 *
 * Reads the catalog (songlist.txt + metadata.json), computes per-song and per-chart
 * placements via the numbering engine, and writes a flat JSON the app bundles.
 *
 * Writes: app/assets/app-data.json
 * Usage:  cd pipeline && npm run build:appdata
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildDatasetFromCatalog } from "./catalog";
import { validateCatalog } from "./validateCatalog";
import { toAppData } from "./appData";

const pipelineRoot = join(import.meta.dirname, "..", "..");
const repoRoot = join(pipelineRoot, "..");

const dataset = buildDatasetFromCatalog(pipelineRoot);

const errors = validateCatalog(dataset);
if (errors.length > 0) {
  console.error("Catalog validation errors:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const appData = toAppData(dataset);
const outPath = join(repoRoot, "app", "assets", "app-data.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(appData));
console.log(`Wrote ${appData.songCount} songs / ${appData.chartCount} charts -> app/assets/app-data.json`);
