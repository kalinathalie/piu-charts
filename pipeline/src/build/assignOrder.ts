import type { Dataset } from "../model/types";

export function assignReleaseIndex(orderedSongIds: string[]): Map<string, number> {
  const m = new Map<string, number>();
  orderedSongIds.forEach((id, i) => m.set(id, i + 1));
  return m;
}

export function applyOrder(
  ds: Dataset,
  orderedSongIds: string[],
): { dataset: Dataset; missing: string[] } {
  const index = assignReleaseIndex(orderedSongIds);
  const songs = ds.songs.map((s) => ({ ...s, releaseIndex: index.get(s.id) ?? 0 }));
  const missing = songs.filter((s) => s.releaseIndex === 0).map((s) => s.id);
  return { dataset: { songs, charts: ds.charts }, missing };
}
