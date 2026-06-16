import { describe, it, expect } from "vitest";
import { assignReleaseIndex, applyOrder } from "./assignOrder";
import type { Dataset, Song } from "../model/types";

const song = (id: string): Song => ({
  id, title: id, titleNormalized: id, artist: "a",
  bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex: 0,
});

describe("assignReleaseIndex", () => {
  it("maps ordered ids to 1-based indices", () => {
    const m = assignReleaseIndex(["b", "a", "c"]);
    expect(m.get("b")).toBe(1);
    expect(m.get("a")).toBe(2);
    expect(m.get("c")).toBe(3);
  });
});

describe("applyOrder", () => {
  it("sets releaseIndex and reports unordered songs", () => {
    const ds: Dataset = { songs: [song("a"), song("b"), song("z")], charts: [] };
    const { dataset, missing } = applyOrder(ds, ["b", "a"]);
    const byId = new Map(dataset.songs.map((s) => [s.id, s.releaseIndex]));
    expect(byId.get("b")).toBe(1);
    expect(byId.get("a")).toBe(2);
    expect(byId.get("z")).toBe(0);
    expect(missing).toEqual(["z"]);
  });
});
