import { describe, it, expect } from "vitest";
import { parseSonglist, slugify } from "./parseSonglist";

describe("slugify", () => {
  it("makes a url-ish id", () => {
    expect(slugify("Love is a Danger Zone pt.2")).toBe("love_is_a_danger_zone_pt_2");
  });
  it("strips accents", () => {
    expect(slugify("Café")).toBe("cafe");
  });
});

describe("parseSonglist", () => {
  const text = [
    "1ST TO ZERO",
    "",
    "bee",
    "love is a danger pt.2",
    "PRIME",
    "super fantasy",
    "prime", // a song literally named 'prime', NOT the header
    "XX",
    "jogging",
    "bee", // duplicate title -> deduped id
  ].join("\n");

  const songs = parseSonglist(text);

  it("keeps order by position", () => {
    expect(songs.map((s) => s.id)).toEqual([
      "bee", "love_is_a_danger_pt_2", "super_fantasy", "prime", "jogging", "bee_2",
    ]);
  });

  it("assigns era from the section header", () => {
    expect(songs.find((s) => s.id === "bee")!.debutVersion).toBe("Zero");
    expect(songs.find((s) => s.id === "super_fantasy")!.debutVersion).toBe("Prime");
    expect(songs.find((s) => s.id === "jogging")!.debutVersion).toBe("XX");
  });

  it("treats a song named like a passed header as a song", () => {
    const prime = songs.find((s) => s.id === "prime")!;
    expect(prime.title).toBe("prime");
    expect(prime.debutVersion).toBe("Prime");
  });
});
