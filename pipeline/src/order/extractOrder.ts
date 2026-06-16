import type { Song } from "../model/types";
import { normalizeTitle } from "../text/normalize";
import { bestMatch, type Candidate } from "../text/fuzzy";

export interface OcrFrame {
  timestamp: number;
  text: string;
}

export interface OrderedEntry {
  songId: string;
  firstSeen: number;
  score: number;
}

function buildCandidates(songs: Song[]): Candidate[] {
  const out: Candidate[] = [];
  for (const s of songs) {
    out.push({ id: s.id, normalized: s.titleNormalized });
    if (s.titleKr) out.push({ id: s.id, normalized: normalizeTitle(s.titleKr) });
  }
  return out;
}

export function extractOrderFromOcr(
  frames: OcrFrame[],
  songs: Song[],
  threshold = 0.6,
): OrderedEntry[] {
  const candidates = buildCandidates(songs);
  const seen = new Set<string>();
  const result: OrderedEntry[] = [];
  let lastId: string | null = null;

  for (const f of frames) {
    const q = normalizeTitle(f.text);
    if (!q) continue;
    const m = bestMatch(q, candidates, threshold);
    if (!m) continue;
    if (m.id === lastId) continue; // consecutive duplicate
    lastId = m.id;
    if (seen.has(m.id)) continue; // reappearance jitter
    seen.add(m.id);
    result.push({ songId: m.id, firstSeen: f.timestamp, score: m.score });
  }

  return result;
}
