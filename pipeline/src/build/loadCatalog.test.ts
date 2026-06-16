import { describe, it, expect } from "vitest";
import { parseCatalog } from "./loadCatalog";

describe("parseCatalog", () => {
  it("derives titleNormalized and applies defaults", () => {
    const ds = parseCatalog({
      songs: [{ id: "a", title: "Café", artist: "x", bpmMin: 100, bpmMax: 120, debutVersion: "Prime" }],
      charts: [{ id: "a_s16", songId: "a", mode: "Single", level: 16 }],
    });
    expect(ds.songs[0].titleNormalized).toBe("cafe");
    expect(ds.songs[0].releaseIndex).toBe(0);
    expect(ds.charts[0].types).toEqual([]);
    expect(ds.charts[0].typesSource).toBe("manual");
  });

  it("defaults bpmMax to bpmMin when omitted", () => {
    const ds = parseCatalog({
      songs: [{ id: "a", title: "A", bpmMin: 180 }],
      charts: [],
    });
    expect(ds.songs[0].bpmMax).toBe(180);
  });
});
