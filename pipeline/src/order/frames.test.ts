import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { sampleFrames } from "./frames";

let dir: string;
let video: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "piu-frames-"));
  video = join(dir, "test.mp4");
  // 2s synthetic test video, 1 fps source
  execFileSync(ffmpegPath as string, [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc=duration=2:size=320x180:rate=1",
    video,
  ]);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("sampleFrames", () => {
  it("extracts frames at the requested fps", () => {
    const outDir = join(dir, "frames");
    const frames = sampleFrames(video, outDir, { ffmpegPath: ffmpegPath as string, fps: 1 });
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames[0].path.endsWith(".png")).toBe(true);
    expect(frames[0].timestamp).toBeCloseTo(0, 1);
    expect(frames[1].timestamp).toBeCloseTo(1, 1);
  });
});
