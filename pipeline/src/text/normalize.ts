const SUFFIX_RE = /\s*-\s*(short cut|full song|short ver\.?|remix)\s*$/i;

// Latin combining diacritics, U+0300–U+036F
const DIACRITICS_RE = /[̀-ͯ]/g;

export function normalizeTitle(input: string): string {
  return input
    .replace(SUFFIX_RE, "")
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // keep Unicode letters/digits + space
    .replace(/\s+/g, " ")
    .trim();
}
