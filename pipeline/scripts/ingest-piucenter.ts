/**
 * Ingest Single/Double chart levels from piucenter (maxwshen/piu-app static/table.json)
 * and write them into catalog/metadata.json, keyed by our song slug.
 *
 * This dataset is XX-era (last updated 2021); Phoenix-exclusive songs won't match and
 * some levels may differ slightly from Phoenix. Best-effort, manual fixes expected.
 *
 * Matching is variant-aware (arcade/fullsong/shortcut/remix) — see src/build/piucenter.ts.
 *
 * Usage: cd pipeline && npm run ingest:piucenter   (DRY=1 to preview without writing)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseSonglist } from "../src/build/parseSonglist.js";
import type { SongMeta, ChartMeta } from "../src/build/catalog.js";
import { buildIndex, loadTable, matchSongs, pickVariant } from "../src/build/piucenter.js";

const pipelineRoot = join(import.meta.dirname, "..");
const cachePath = join(pipelineRoot, ".cache", "table.json");
const songlistPath = join(pipelineRoot, "catalog", "songlist.txt");
const metadataPath = join(pipelineRoot, "catalog", "metadata.json");

async function main() {
  const rows = await loadTable(cachePath);
  const { index, parsed } = buildIndex(rows);

  const songs = parseSonglist(readFileSync(songlistPath, "utf8"));
  const songMatches = matchSongs(
    songs.map((s) => s.title),
    index,
  );

  const existing: Record<string, SongMeta> = existsSync(metadataPath)
    ? (JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, SongMeta>)
    : {};
  const out: Record<string, SongMeta> = { ...existing };

  const matched = { exact: 0, fuzzy: 0, prefix: 0 };
  let totalCharts = 0;
  const unmatched: string[] = [];

  songs.forEach((song, i) => {
    const hit = songMatches[i];
    if (!hit.key || !hit.how) {
      unmatched.push(song.title);
      return;
    }

    const entry = pickVariant(index.get(hit.key)!, hit.variant);
    const charts: ChartMeta[] = [...entry.charts.values()]
      .sort((a, b) => (a.mode === b.mode ? a.level - b.level : a.mode === "Single" ? -1 : 1))
      .map((c) => ({ mode: c.mode, level: c.level, types: [], typesSource: "auto" as const }));

    if (charts.length === 0) {
      unmatched.push(song.title);
      return;
    }

    matched[hit.how]++;
    totalCharts += charts.length;

    const prev = out[song.id] ?? {};
    out[song.id] = { ...prev, artist: prev.artist || entry.artist, charts };
  });

  const dry = process.env.DRY === "1";
  if (!dry) writeFileSync(metadataPath, JSON.stringify(out, null, 2) + "\n");

  process.stdout.write(
    JSON.stringify(
      {
        dryRun: dry,
        tableRows: rows.length,
        parsedSD: parsed,
        distinctBases: index.size,
        songs: songs.length,
        matched,
        matchedTotal: matched.exact + matched.fuzzy + matched.prefix,
        unmatchedCount: unmatched.length,
        totalCharts,
        unmatchedSample: unmatched.slice(0, 40),
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + "\n");
  process.exit(1);
});
