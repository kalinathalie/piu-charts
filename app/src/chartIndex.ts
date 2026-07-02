import rawData from "../assets/app-data.json";
import type { AppData, AppChart, AppSong } from "./appData";

const data = rawData as AppData;

export interface FlatChart {
  song: AppSong;
  chart: AppChart;
}

export const songById = new Map(data.songs.map((s) => [s.id, s]));

export const allCharts: FlatChart[] = data.songs.flatMap((s) =>
  s.charts.map((chart) => ({ song: s, chart })),
);

export const chartByGlobalIndex: Map<number, FlatChart> = new Map();
for (const fc of allCharts) {
  const todas = fc.chart.placements.find((p) => p.label === "Todas");
  if (todas) chartByGlobalIndex.set(todas.position, fc);
}

export const globalIndexByChartId: Map<string, number> = new Map(
  [...chartByGlobalIndex.entries()].map(([globalId, fc]) => [fc.chart.id, globalId]),
);
