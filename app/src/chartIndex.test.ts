import { allCharts, chartByGlobalIndex, songById } from "./chartIndex";

describe("chartIndex", () => {
  it("builds one FlatChart per song/chart pair", () => {
    const total = allCharts.length;
    expect(total).toBeGreaterThan(0);
    expect(total).toBe(
      allCharts.reduce((sum, fc) => sum + (fc.song.charts.includes(fc.chart) ? 1 : 0), 0),
    );
  });

  it("maps chartByGlobalIndex using each chart's Todas placement position", () => {
    for (const fc of allCharts) {
      const todas = fc.chart.placements.find((p) => p.label === "Todas");
      if (!todas) continue;
      expect(chartByGlobalIndex.get(todas.position)).toBe(fc);
    }
  });

  it("indexes songs by id", () => {
    const first = allCharts[0].song;
    expect(songById.get(first.id)).toBe(first);
  });
});
