# Phase 0 Spike — Order Extraction

## How to run
```
cd pipeline
npx tsx scripts/spike-order.ts <youtubeUrl> <startSec> <durationSec> [catalogPath]
```

Videos:
- English (1st→XX): https://www.youtube.com/watch?v=VkntM4p7-yA
- Full incl. Phoenix (2.11.0): https://www.youtube.com/watch?v=5wIJuYuhvkw

## Tuning knobs (top of spike-order.ts)
- `FPS`: frames sampled per second (start 2).
- `THRESHOLD`: fuzzy match floor (start 0.55).
- Title-region crop: if full-frame OCR is noisy, add an ffmpeg `crop` filter on the
  input (the song title sits in the middle band of the frame).

## Findings (run 2026-06-16, video 1, slice 410–435s, 360p / fps=2)
- **End-to-end works:** download (yt-dlp) → frame sampling (ffmpeg-static) → OCR
  (tesseract.js eng+kor) → line-aware fuzzy match → ordered sequence. No crashes.
- **Titles are readable but full-frame OCR is very noisy** — it captures the whole busy
  preview screen (timer, EVENT label, score digits). The title appears on its own line
  as `<Title> - SHORT CUT`. Matching was therefore made **line-aware**
  (`matchFrame` in `extractOrder.ts`): each OCR line is matched, best line wins.
- **Recovered correctly, in order:** `Night Duty` (422.5s, score 0.67),
  `Pine Nut` (432.5s, score 0.56).
- **Missed:** `Take Out`, `Overblow`. Cause: OCR appended garbage *after* `- SHORT CUT`
  (e.g. `Overblow - SHORT CUT 후 기 (`), so the end-anchored suffix strip in
  `normalizeTitle` did not fire and similarity to the bare title dropped below threshold.

## Concrete next tuning steps (for the full-extraction plan)
1. Strip `short cut` / `full song` **anywhere** in a line, not only when anchored at end.
2. Crop the title band before OCR (ffmpeg `crop`) to remove HUD/score noise.
3. Try 480p (`-f 135`) or 720p (`-f 298`) — higher res should sharply improve OCR.
4. With the **full** catalog (hundreds of titles) more candidates help recall but raise
   false-positive risk; calibrate `THRESHOLD` (likely 0.50–0.60) on a labelled slice.
5. Exercise Korean titles on video 2 (titleKr candidates already built in `extractOrder`).

## Best settings so far
- FPS: 2 (workable; revisit after cropping)
- THRESHOLD: 0.55 (line-aware)
- Resolution: 360p tested; 480p+ recommended next

## Manual arcade validation checklist (numbering correctness)
Pick 5 charts spanning versions and levels. For each, on the real Phoenix machine,
browse the category and record the on-screen position/total, then compare to the app:

| Chart | Category | Arcade position/total | App position/total | Match? |
|-------|----------|-----------------------|--------------------|--------|
|       |          |                       |                    |        |

Decision gate: the numbering is "validated" only when the sampled charts match the
machine. Discrepancies feed back into sort/tiebreak rules or order overrides.
