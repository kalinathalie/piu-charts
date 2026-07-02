import { decodePlaylists, encodePlaylists } from "./storage";
import type { Playlist } from "./types";

const sample: Playlist = {
  id: "p1",
  name: "warmup",
  color: "#ffffff",
  chartIds: [1, 2],
  createdAt: 1,
  modifiedAt: 2,
};

describe("encodePlaylists / decodePlaylists", () => {
  it("round-trips a list of playlists", () => {
    expect(decodePlaylists(encodePlaylists([sample]))).toEqual([sample]);
  });

  it("returns an empty array for null", () => {
    expect(decodePlaylists(null)).toEqual([]);
  });

  it("returns an empty array for invalid JSON", () => {
    expect(decodePlaylists("{not json")).toEqual([]);
  });

  it("returns an empty array for JSON that isn't an array", () => {
    expect(decodePlaylists('{"oops": true}')).toEqual([]);
  });
});
