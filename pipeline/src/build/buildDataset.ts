/**
 * Build the bundled dataset from the hand-editable catalog.
 *
 * Reads:  catalog/songs.json  (songs + charts)
 *         catalog/order.json   (song ids in release order)
 * Writes: data/dataset.json    (normalized Dataset with releaseIndex assigned)
 *
 * Usage: cd pipeline && npm run build:dataset
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadCatalog } from "./loadCatalog";
import { validateCatalog } from "./validateCatalog";
import { applyOrder } from "./assignOrder";

const root = join(import.meta.dirname, "..", "..");
const catalogPath = join(root, "catalog", "songs.json");
const orderPath = join(root, "catalog", "order.json");
const outDir = join(root, "data");
const outPath = join(outDir, "dataset.json");

const ds = loadCatalog(catalogPath);

const errors = validateCatalog(ds);
if (errors.length > 0) {
  console.error("Catalog validation errors:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const order = JSON.parse(readFileSync(orderPath, "utf8")) as string[];
const { dataset, missing } = applyOrder(ds, order);

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(dataset, null, 2));
console.log(`Wrote ${dataset.songs.length} songs, ${dataset.charts.length} charts -> ${outPath}`);

if (missing.length > 0) {
  console.warn(`\n${missing.length} song(s) missing from catalog/order.json (releaseIndex=0):`);
  for (const m of missing) console.warn("  - " + m);
  console.warn("Add them to catalog/order.json so they get positioned correctly.");
}
