import { distance } from "fastest-levenshtein";

export interface Candidate {
  id: string;
  normalized: string;
}

export interface MatchResult {
  id: string;
  score: number;
}

export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance(a, b) / maxLen;
}

export function bestMatch(
  query: string,
  candidates: Candidate[],
  threshold = 0.6,
): MatchResult | null {
  let best: MatchResult | null = null;
  for (const c of candidates) {
    const score = similarity(query, c.normalized);
    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best && best.score >= threshold ? best : null;
}
