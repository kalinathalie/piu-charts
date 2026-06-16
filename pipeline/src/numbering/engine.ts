import type { Dataset, Chart, Category, Placement } from "../model/types";
import { compareCharts, compareSongs } from "./sort";

function songMap(ds: Dataset) {
  return new Map(ds.songs.map((s) => [s.id, s]));
}

export function computePlacement(chart: Chart, category: Category, ds: Dataset): Placement {
  const songById = songMap(ds);

  if (category.unit === "CHART") {
    const members = ds.charts.filter((c) => category.includesChart(c, songById.get(c.songId)!));
    members.sort((x, y) => compareCharts(x, y, songById));
    const idx = members.findIndex((c) => c.id === chart.id);
    return { categoryId: category.id, categoryName: category.name, position: idx + 1, total: members.length };
  }

  // SONG unit: rank the chart's song among distinct member songs
  const memberSongIds = new Set(
    ds.charts.filter((c) => category.includesChart(c, songById.get(c.songId)!)).map((c) => c.songId),
  );
  const memberSongs = ds.songs.filter((s) => memberSongIds.has(s.id));
  memberSongs.sort(compareSongs);
  const idx = memberSongs.findIndex((s) => s.id === chart.songId);
  return { categoryId: category.id, categoryName: category.name, position: idx + 1, total: memberSongs.length };
}

export function computeAllPlacements(chart: Chart, ds: Dataset, categories: Category[]): Placement[] {
  const song = ds.songs.find((s) => s.id === chart.songId)!;
  return categories
    .filter((cat) => cat.includesChart(chart, song))
    .map((cat) => computePlacement(chart, cat, ds));
}
