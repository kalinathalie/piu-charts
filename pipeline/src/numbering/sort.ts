import type { Chart, Song, Mode } from "../model/types";

const MODE_ORDER: Record<Mode, number> = {
  Single: 0,
  SinglePerf: 1,
  Double: 2,
  DoublePerf: 3,
  CoOp: 4,
};

export function compareSongs(a: Song, b: Song): number {
  if (a.releaseIndex !== b.releaseIndex) return a.releaseIndex - b.releaseIndex;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function compareCharts(
  a: Chart,
  b: Chart,
  songById: Map<string, Song>,
): number {
  const sa = songById.get(a.songId)!;
  const sb = songById.get(b.songId)!;
  if (sa.releaseIndex !== sb.releaseIndex) return sa.releaseIndex - sb.releaseIndex;
  if (MODE_ORDER[a.mode] !== MODE_ORDER[b.mode]) return MODE_ORDER[a.mode] - MODE_ORDER[b.mode];
  if (a.level !== b.level) return a.level - b.level;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
