/**
 * Build the bundled dataset from the hand-maintained catalog.
 *
 * Reads:  catalog/songlist.txt  (ordered song list with version section headers)
 *         catalog/metadata.json  (optional per-song artist/bpm/charts/types, keyed by id)
 * Writes: data/dataset.json      (normalized Dataset; releaseIndex = position in the list)
 *
 * Usage: cd pipeline && npm run build:dataset
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildDatasetFromCatalog } from "./catalog";
import { validateCatalog } from "./validateCatalog";

const root = join(import.meta.dirname, "..", "..");
const dataset = buildDatasetFromCatalog(root);

const errors = validateCatalog(dataset);
if (errors.length > 0) {
  console.error("Catalog validation errors:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const outDir = join(root, "data");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "dataset.json"), JSON.stringify(dataset, null, 2));
console.log(`Wrote ${dataset.songs.length} songs, ${dataset.charts.length} charts -> data/dataset.json`);

const withCharts = new Set(dataset.charts.map((c) => c.songId)).size;
console.log(`${withCharts}/${dataset.songs.length} songs have at least one chart (add charts in metadata.json).`);
