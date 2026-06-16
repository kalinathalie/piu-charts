import type { Dataset } from "../model/types";

/** Returns a list of human-readable problems; empty means the catalog is valid. */
export function validateCatalog(ds: Dataset): string[] {
  const errors: string[] = [];

  const songIds = new Set<string>();
  for (const s of ds.songs) {
    if (!s.id) errors.push("song with empty id");
    else if (songIds.has(s.id)) errors.push(`duplicate song id: ${s.id}`);
    else songIds.add(s.id);
    if (!s.title) errors.push(`song ${s.id || "(no id)"} has empty title`);
  }

  const chartIds = new Set<string>();
  for (const c of ds.charts) {
    if (!c.id) errors.push("chart with empty id");
    else if (chartIds.has(c.id)) errors.push(`duplicate chart id: ${c.id}`);
    else chartIds.add(c.id);
    if (!songIds.has(c.songId)) errors.push(`chart ${c.id || "(no id)"} references unknown song ${c.songId}`);
    if (!(c.level > 0)) errors.push(`chart ${c.id || "(no id)"} has invalid level`);
  }

  return errors;
}
