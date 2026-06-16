import { describe, it, expect } from "vitest";
import { extractOrderFromOcr, type OcrFrame } from "./extractOrder";
import type { Song } from "../model/types";

const song = (id: string, title: string, titleKr?: string): Song => ({
  id, title, titleNormalized: title.toLowerCase(), titleKr,
  artist: "a", bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex: 0,
});

const songs = [
  song("s1", "Overdive"),
  song("s2", "Bee"),
  song("s3", "Cherry Blossom", "벚꽃"),
];

describe("extractOrderFromOcr", () => {
  it("produces an ordered, deduped song sequence from noisy frames", () => {
    const frames: OcrFrame[] = [
      { timestamp: 0.0, text: "NEXT" },          // junk, no match
      { timestamp: 0.5, text: "0verdlve" },        // OCR error -> s1
      { timestamp: 1.0, text: "Overdive" },        // dup of s1
      { timestamp: 1.5, text: "Bee" },             // s2
      { timestamp: 2.0, text: "벚꽃" },             // s3 via Korean title
    ];
    const order = extractOrderFromOcr(frames, songs, 0.6);
    expect(order.map((o) => o.songId)).toEqual(["s1", "s2", "s3"]);
    expect(order[0].firstSeen).toBeCloseTo(0.5, 2);
  });

  it("matches a title buried in a noisy multi-line frame", () => {
    const frames: OcrFrame[] = [
      { timestamp: 5, text: "EVENT 50000\nsome junk line\nOverdive - SHORT CUT\n037/105\n@@@@0000" },
    ];
    const order = extractOrderFromOcr(frames, songs, 0.6);
    expect(order.map((o) => o.songId)).toEqual(["s1"]);
  });

  it("does not re-add a song that reappears after others", () => {
    const frames: OcrFrame[] = [
      { timestamp: 0, text: "Overdive" },
      { timestamp: 1, text: "Bee" },
      { timestamp: 2, text: "Overdive" }, // jitter; must be ignored
    ];
    const order = extractOrderFromOcr(frames, songs, 0.6);
    expect(order.map((o) => o.songId)).toEqual(["s1", "s2"]);
  });
});
