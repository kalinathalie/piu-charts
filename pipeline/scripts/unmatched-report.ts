/**
 * Print the songs in catalog/songlist.txt that did NOT match piucenter, grouped by
 * debut version, with their release index. Use this to spot titles that still need a
 * manual fix (transcription typos) vs songs genuinely absent from the XX-era data.
 *
 * Usage: cd pipeline && npm run report:unmatched
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSonglist } from "../src/build/parseSonglist.js";
import { buildIndex, loadTable, matchSongs } from "../src/build/piucenter.js";

const pipelineRoot = join(import.meta.dirname, "..");
const cachePath = join(pipelineRoot, ".cache", "table.json");
const songlistPath = join(pipelineRoot, "catalog", "songlist.txt");

async function main() {
  const rows = await loadTable(cachePath);
  const { index } = buildIndex(rows);
  const songs = parseSonglist(readFileSync(songlistPath, "utf8"));
  const matches = matchSongs(
    songs.map((s) => s.title),
    index,
  );

  const byVersion = new Map<string, { idx: number; title: string }[]>();
  songs.forEach((song, i) => {
    if (matches[i].key) return; // matched
    const list = byVersion.get(song.debutVersion) ?? [];
    list.push({ idx: i + 1, title: song.title });
    byVersion.set(song.debutVersion, list);
  });

  const ORDER = ["Zero", "NXA", "Fiesta2", "Prime", "Prime2", "XX", "Phoenix"];
  let total = 0;
  for (const v of ORDER) {
    const list = byVersion.get(v);
    if (!list || list.length === 0) continue;
    total += list.length;
    process.stdout.write(`\n## ${v} (${list.length})\n`);
    for (const { idx, title } of list) process.stdout.write(`#${idx}  ${title}\n`);
  }
  process.stdout.write(`\nTOTAL unmatched: ${total} / ${songs.length}\n`);
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + "\n");
  process.exit(1);
});
