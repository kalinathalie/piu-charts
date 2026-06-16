import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { ocrImage } from "./ocr";

let dir: string;
let image: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "piu-ocr-"));
  image = join(dir, "text.png");
  // White background with large black text "OVERDIVE"
  execFileSync(ffmpegPath as string, [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=white:s=640x160",
    "-vf", "drawtext=text='OVERDIVE':fontcolor=black:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2",
    "-frames:v", "1", image,
  ]);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("ocrImage", () => {
  it("reads rendered text", async () => {
    const text = await ocrImage(image, "eng");
    expect(text.toUpperCase().replace(/[^A-Z]/g, "")).toContain("OVERDIVE");
  });
});
