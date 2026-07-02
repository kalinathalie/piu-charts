import {
  createPlaylist,
  renamePlaylist,
  recolorPlaylist,
  addChart,
  removeChart,
  reorderChart,
  reorderPlaylist,
  deletePlaylist,
  importPlaylist,
} from "./mutations";
import type { Playlist } from "./types";

function makePlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: "p1",
    name: "warmup",
    color: "#ffffff",
    chartIds: [1, 2, 3],
    createdAt: 1000,
    modifiedAt: 1000,
    ...overrides,
  };
}

describe("createPlaylist", () => {
  it("prepends a new playlist with the given name/color and no charts", () => {
    const result = createPlaylist([], "warmup", "#ffffff");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "warmup", color: "#ffffff", chartIds: [] });
    expect(result[0].createdAt).toBe(result[0].modifiedAt);
  });

  it("truncates the name to 50 characters", () => {
    const result = createPlaylist([], "x".repeat(60), "#ffffff");
    expect(result[0].name).toHaveLength(50);
  });

  it("puts the new playlist at the front of the list", () => {
    const existing = makePlaylist({ id: "old" });
    const result = createPlaylist([existing], "new one", "#ffffff");
    expect(result.map((p) => p.id)).toEqual([result[0].id, "old"]);
  });
});

describe("renamePlaylist / recolorPlaylist", () => {
  it("updates name and bumps modifiedAt", () => {
    const before = [makePlaylist()];
    const after = renamePlaylist(before, "p1", "new name");
    expect(after[0].name).toBe("new name");
    expect(after[0].modifiedAt).toBeGreaterThanOrEqual(before[0].modifiedAt);
    expect(before[0].name).toBe("warmup"); // original untouched
  });

  it("updates color and bumps modifiedAt", () => {
    const after = recolorPlaylist([makePlaylist()], "p1", "#000000");
    expect(after[0].color).toBe("#000000");
  });
});

describe("addChart / removeChart", () => {
  it("adds a new chart id", () => {
    const after = addChart([makePlaylist({ chartIds: [1] })], "p1", 2);
    expect(after[0].chartIds).toEqual([1, 2]);
  });

  it("is a no-op when the chart is already present", () => {
    const before = makePlaylist({ chartIds: [1, 2] });
    const after = addChart([before], "p1", 2);
    expect(after[0].chartIds).toEqual([1, 2]);
    expect(after[0].modifiedAt).toBe(before.modifiedAt);
  });

  it("refuses to add past the 100-chart cap", () => {
    const full = makePlaylist({ chartIds: Array.from({ length: 100 }, (_, i) => i + 1) });
    const after = addChart([full], "p1", 999);
    expect(after[0].chartIds).toHaveLength(100);
  });

  it("removes a chart id", () => {
    const after = removeChart([makePlaylist({ chartIds: [1, 2, 3] })], "p1", 2);
    expect(after[0].chartIds).toEqual([1, 3]);
  });
});

describe("reorderChart", () => {
  it("moves a chart id from one index to another", () => {
    const after = reorderChart([makePlaylist({ chartIds: [1, 2, 3] })], "p1", 0, 2);
    expect(after[0].chartIds).toEqual([2, 3, 1]);
  });
});

describe("deletePlaylist", () => {
  it("removes the playlist by id", () => {
    const after = deletePlaylist([makePlaylist(), makePlaylist({ id: "p2" })], "p1");
    expect(after.map((p) => p.id)).toEqual(["p2"]);
  });
});

describe("importPlaylist", () => {
  it("creates a new playlist from parsed data with a generated color-agnostic default", () => {
    const after = importPlaylist([], { name: "shared", color: "#123456", chartIds: [1, 2], warnings: [] });
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ name: "shared", color: "#123456", chartIds: [1, 2] });
  });

  it("puts the imported playlist at the front of the list", () => {
    const existing = makePlaylist({ id: "old" });
    const after = importPlaylist([existing], { name: "shared", color: "#123456", chartIds: [1], warnings: [] });
    expect(after.map((p) => p.id)).toEqual([after[0].id, "old"]);
  });
});

describe("reorderPlaylist", () => {
  it("moves a playlist from one index to another", () => {
    const a = makePlaylist({ id: "a" });
    const b = makePlaylist({ id: "b" });
    const c = makePlaylist({ id: "c" });
    const after = reorderPlaylist([a, b, c], 0, 2);
    expect(after.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });
});
