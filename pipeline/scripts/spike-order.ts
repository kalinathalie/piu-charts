/**
 * Phase 0 spike: prove order extraction on a real clip.
 *
 * Usage:
 *   cd pipeline
 *   npx tsx scripts/spike-order.ts <youtubeUrl> <startSec> <durationSec>
 *
 * Requires: yt-dlp on PATH (or `python -m yt_dlp`), ffmpeg via ffmpeg-static.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { sampleFrames } from "../src/order/frames";
import { ocrImage } from "../src/order/ocr";
import { extractOrderFromOcr, type OcrFrame } from "../src/order/extractOrder";
import type { Dataset } from "../src/model/types";

const FPS = 2; // tune: higher catches fast transitions, slower to OCR
const THRESHOLD = 0.55; // tune: fuzzy-match confidence floor

async function main() {
  const [url, startSec, durSec, catalogArg] = process.argv.slice(2);
  if (!url || !startSec || !durSec) {
    console.error("usage: tsx scripts/spike-order.ts <url> <startSec> <durationSec> [catalogPath]");
    process.exit(1);
  }
  const catalogFile = catalogArg ?? join(import.meta.dirname, "..", "fixtures", "sample-catalog.json");

  const dir = mkdtempSync(join(tmpdir(), "piu-spike-"));
  const clip = join(dir, "clip.mp4");
  const section = `*${startSec}-${Number(startSec) + Number(durSec)}`;

  console.log("Downloading clip...");
  // Try yt-dlp on PATH; fall back to python module.
  const ytArgs = ["-q", "--no-warnings", "-f", "135",
    "--ffmpeg-location", ffmpegPath as string,
    "--download-sections", section, "-o", clip, url];
  try {
    execFileSync("yt-dlp", ytArgs, { stdio: "inherit" });
  } catch {
    execFileSync("python", ["-m", "yt_dlp", ...ytArgs], { stdio: "inherit" });
  }

  console.log("Sampling frames...");
  const frames = sampleFrames(clip, join(dir, "frames"), { ffmpegPath: ffmpegPath as string, fps: FPS });

  console.log(`OCR on ${frames.length} frames...`);
  const ocrFrames: OcrFrame[] = [];
  for (const f of frames) {
    const text = await ocrImage(f.path, "eng+kor");
    ocrFrames.push({ timestamp: Number(startSec) + f.timestamp, text });
  }

  const catalog = JSON.parse(readFileSync(catalogFile, "utf8")) as Dataset;

  const order = extractOrderFromOcr(ocrFrames, catalog.songs, THRESHOLD);

  console.log("\n=== Raw OCR per frame ===");
  for (const f of ocrFrames) console.log(`${f.timestamp.toFixed(1)}s: ${JSON.stringify(f.text)}`);

  console.log("\n=== Recovered order ===");
  for (const o of order) {
    const s = catalog.songs.find((x) => x.id === o.songId)!;
    console.log(`${o.firstSeen.toFixed(1)}s  ${s.title}  (score ${o.score.toFixed(2)})`);
  }

  rmSync(dir, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
