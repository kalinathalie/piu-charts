import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface FrameSamplingOptions {
  ffmpegPath: string;
  fps: number;
}

export interface SampledFrame {
  path: string;
  /** Seconds from the start of the input, derived from frame index / fps. */
  timestamp: number;
}

export function sampleFrames(
  videoPath: string,
  outDir: string,
  opts: FrameSamplingOptions,
): SampledFrame[] {
  mkdirSync(outDir, { recursive: true });
  execFileSync(opts.ffmpegPath, [
    "-y", "-loglevel", "error",
    "-i", videoPath,
    "-vf", `fps=${opts.fps}`,
    join(outDir, "frame_%05d.png"),
  ]);

  const files = readdirSync(outDir).filter((f) => f.endsWith(".png")).sort();
  return files.map((f, i) => ({ path: join(outDir, f), timestamp: i / opts.fps }));
}
