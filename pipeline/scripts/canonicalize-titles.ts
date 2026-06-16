/**
 * Rewrite catalog/songlist.txt song titles to their canonical piucenter spelling
 * (the hand-typed titles had transcription errors). Order and version headers are
 * preserved exactly; only song lines that match piucenter are renamed. Songs that
 * don't match (severe typos, or Phoenix-only songs absent from the XX-era data) are
 * left untouched.
 *
 * Variant entries (full song / short cut / remix) keep a variant marker so they stay
 * distinct from the base song, unless the canonical title already encodes one.
 *
 * Dry-run by default (prints a diff). Set APPLY=1 to write songlist.txt.
 * Usage: cd pipeline && npm run canonicalize:titles   (then APPLY=1 ... to write)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildIndex,
  loadTable,
  matchSongs,
  titleHasVariantMarker,
  VARIANT_LABEL,
  type Variant,
} from "../src/build/piucenter.js";

const pipelineRoot = join(import.meta.dirname, "..");
const cachePath = join(pipelineRoot, ".cache", "table.json");
const songlistPath = join(pipelineRoot, "catalog", "songlist.txt");

// Mirror parseSonglist's forward-only header detection so the exact same lines are
// treated as headers (protects a song literally named like a *passed* header).
const HEADER_SEQUENCE = [
  "1ST TO ZERO",
  "NX TO NXA",
  "FIESTA TO FIESTA2",
  "PRIME",
  "PRIME2",
  "XX",
  "PHOENIX",
];

function canonicalTitle(rawBaseTitle: string, variant: Variant): string {
  if (variant === "STANDARD" || titleHasVariantMarker(rawBaseTitle)) return rawBaseTitle;
  return `${rawBaseTitle} ${VARIANT_LABEL[variant]}`;
}

async function main() {
  const rows = await loadTable(cachePath);
  const { index } = buildIndex(rows);

  const lines = readFileSync(songlistPath, "utf8").split(/\r?\n/);

  // Pass 1: classify each line as header / blank / song (forward-only headers).
  type Kind = "header" | "blank" | "song";
  const kinds: Kind[] = [];
  const songTitles: string[] = [];
  let headerIdx = -1;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      kinds.push("blank");
      continue;
    }
    const norm = line.toUpperCase().replace(/\s+/g, " ");
    const matchIdx = HEADER_SEQUENCE.findIndex((h, idx) => idx > headerIdx && h === norm);
    if (matchIdx !== -1) {
      headerIdx = matchIdx;
      kinds.push("header");
      continue;
    }
    kinds.push("song");
    songTitles.push(line);
  }

  // Match all song titles together so the collision guard can run globally.
  const matches = matchSongs(songTitles, index);

  // Pass 2: rebuild the file, renaming matched song lines.
  const out: string[] = [];
  const diff: { from: string; to: string; how: string }[] = [];
  let renamed = 0;
  let unchangedMatched = 0;
  let unmatched = 0;
  let songCursor = 0;

  for (let i = 0; i < lines.length; i++) {
    const kind = kinds[i];
    if (kind === "blank" || kind === "header") {
      out.push(lines[i]);
      continue;
    }
    const m = matches[songCursor++];
    if (!m.key || !m.how) {
      out.push(m.title);
      unmatched++;
      continue;
    }
    const newTitle = canonicalTitle(index.get(m.key)!.raw, m.variant);
    out.push(newTitle);
    if (newTitle !== m.title) {
      renamed++;
      diff.push({ from: m.title, to: newTitle, how: m.how });
    } else {
      unchangedMatched++;
    }
  }

  const apply = process.env.APPLY === "1";
  if (apply) writeFileSync(songlistPath, out.join("\n"));

  // print diff grouped by match stage so prefix renames (the riskier ones) are easy to scan
  for (const how of ["exact", "fuzzy", "prefix"] as const) {
    const group = diff.filter((d) => d.how === how);
    process.stdout.write(`\n=== renamed via ${how} (${group.length}) ===\n`);
    for (const d of group) process.stdout.write(`  ${d.from}\n    -> ${d.to}\n`);
  }
  process.stdout.write(
    `\nSUMMARY ${JSON.stringify({
      applied: apply,
      renamed,
      unchangedMatched,
      unmatched,
    })}\n`,
  );
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + "\n");
  process.exit(1);
});
