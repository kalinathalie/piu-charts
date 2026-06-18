import { describe, it, expect } from "vitest";
import { compareCharts, compareSongs } from "./sort";
import type { Song, Chart } from "../model/types";

const song = (id: string, releaseIndex: number): Song => ({
  id, title: id, titleNormalized: id, artist: "a", category: "ORIGINAL",
  bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex,
});

const chart = (id: string, songId: string, mode: Chart["mode"], level: number): Chart => ({
  id, songId, mode, level, types: [], typesSource: "auto",
});

describe("compareSongs", () => {
  it("orders by releaseIndex ascending", () => {
    const arr = [song("b", 5), song("a", 2)];
    arr.sort(compareSongs);
    expect(arr.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("compareCharts", () => {
  it("orders by song releaseIndex, then mode, then level", () => {
    const songs = new Map([
      ["x", song("x", 1)],
      ["y", song("y", 2)],
    ]);
    const charts = [
      chart("c4", "y", "Single", 20),
      chart("c2", "x", "Double", 16),
      chart("c1", "x", "Single", 16),
      chart("c3", "x", "Single", 20),
    ];
    charts.sort((a, b) => compareCharts(a, b, songs));
    expect(charts.map((c) => c.id)).toEqual(["c1", "c3", "c2", "c4"]);
  });
});
