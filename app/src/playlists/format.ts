import { PLAYLIST_NAME_MAX, PLAYLIST_SONGS_MAX } from "./types";

const PATTERN = /^"((?:[^"\\]|\\.)*)"\s*#([0-9a-fA-F]{6})\s*\(([\d\s]*)\)$/;

export function serializePlaylist(p: { name: string; color: string; chartIds: number[] }): string {
  const escapedName = p.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escapedName}" ${p.color} (${p.chartIds.join(" ")})`;
}

export interface ParsedPlaylist {
  name: string;
  color: string;
  chartIds: number[];
  warnings: string[];
}

export function parsePlaylistString(
  input: string,
  isValidChartId: (id: number) => boolean,
): ParsedPlaylist | { error: string } {
  const match = PATTERN.exec(input.trim());
  if (!match) return { error: "Not a valid playlist string." };

  const [, rawName, rawColor, rawIds] = match;
  const warnings: string[] = [];

  let name = rawName.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  if (name.length > PLAYLIST_NAME_MAX) {
    name = name.slice(0, PLAYLIST_NAME_MAX);
    warnings.push(`name truncated to ${PLAYLIST_NAME_MAX} characters`);
  }

  const color = `#${rawColor.toLowerCase()}`;

  const parsedIds = rawIds
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number.parseInt(s, 10));

  const seen = new Set<number>();
  const validIds: number[] = [];
  let skippedUnknown = 0;
  for (const id of parsedIds) {
    if (!Number.isInteger(id) || !isValidChartId(id)) {
      skippedUnknown++;
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    validIds.push(id);
  }
  if (skippedUnknown > 0) {
    warnings.push(`${skippedUnknown} chart${skippedUnknown === 1 ? "" : "s"} skipped (not found)`);
  }

  let chartIds = validIds;
  if (chartIds.length > PLAYLIST_SONGS_MAX) {
    const overflow = chartIds.length - PLAYLIST_SONGS_MAX;
    chartIds = chartIds.slice(0, PLAYLIST_SONGS_MAX);
    warnings.push(`${overflow} chart${overflow === 1 ? "" : "s"} skipped (playlist limit is ${PLAYLIST_SONGS_MAX})`);
  }

  return { name, color, chartIds, warnings };
}
