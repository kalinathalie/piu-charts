import type { Version } from "../model/types";

/**
 * Section headers appear once each, in this order. We match the *next expected*
 * header only, so a song literally named "prime" inside the PRIME section is not
 * mistaken for the PRIME header (that header was already consumed).
 *
 * Combined eras (e.g. "1ST TO ZERO") are approximated to the block's later version;
 * refine per song via metadata.json `debutVersion` if needed.
 */
const HEADER_SEQUENCE: { header: string; version: Version }[] = [
  { header: "1ST TO ZERO", version: "Zero" },
  { header: "NX TO NXA", version: "NXA" },
  { header: "FIESTA TO FIESTA2", version: "Fiesta2" },
  { header: "PRIME", version: "Prime" },
  { header: "PRIME2", version: "Prime2" },
  { header: "XX", version: "XX" },
];

function norm(line: string): string {
  return line.trim().toUpperCase().replace(/\s+/g, " ");
}

export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "song";
}

export interface ParsedSong {
  id: string;
  title: string;
  debutVersion: Version;
}

export function parseSonglist(text: string): ParsedSong[] {
  const lines = text.split(/\r?\n/);
  let headerIdx = -1;
  let currentVersion: Version = "1st";
  const songs: ParsedSong[] = [];
  const idCounts = new Map<string, number>();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // A line is a header only if it matches a not-yet-consumed header (forward-only).
    // Forward-only protects songs named like a *passed* header (e.g. the song "prime"
    // inside the PRIME section) while still tolerating skipped sections.
    const matchIdx = HEADER_SEQUENCE.findIndex(
      (h, idx) => idx > headerIdx && h.header === norm(line),
    );
    if (matchIdx !== -1) {
      headerIdx = matchIdx;
      currentVersion = HEADER_SEQUENCE[matchIdx].version;
      continue;
    }

    let id = slugify(line);
    const n = (idCounts.get(id) ?? 0) + 1;
    idCounts.set(id, n);
    if (n > 1) id = `${id}_${n}`;

    songs.push({ id, title: line, debutVersion: currentVersion });
  }

  return songs;
}
