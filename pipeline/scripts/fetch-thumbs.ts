/**
 * Download a cover thumbnail for every song from pumpproplus, resize to 256x256
 * JPEG, and write app/assets/thumbs/<songId>.jpg + a static require() map in
 * app/src/thumbs.ts. Matching mirrors ingest-pumpproplus (full-name, then exact
 * base+variant, then fuzzy). Resumable: skips songs whose .jpg already exists.
 *
 * Usage: cd pipeline && npm run fetch:thumbs
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Jimp } from "jimp";
import { parseSonglist } from "../src/build/parseSonglist.js";
import { normalizeBase, splitVariant, type Variant } from "../src/build/piucenter.js";
import { similarity } from "../src/text/fuzzy.js";

const PAGE = "https://www.pumpproplus.com/song-search-piu.aspx";
const ORIGIN = "https://www.pumpproplus.com";
const pipelineRoot = join(import.meta.dirname, "..");
const songlistPath = join(pipelineRoot, "catalog", "songlist.txt");
const catalogCache = join(pipelineRoot, ".cache", "ppp_catalog_img.json");
const thumbsDir = join(pipelineRoot, "..", "app", "assets", "thumbs");
const thumbsModule = join(pipelineRoot, "..", "app", "src", "thumbs.ts");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hidden = (h: string, n: string) => {
  const m = h.match(new RegExp(`id="${n}"[^>]*value="([^"]*)"`));
  return m ? m[1] : "";
};
const decode = (s: string) => s.replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

function ppVariant(name: string): { base: string; variant: Variant } {
  let t = name.trim();
  let variant: Variant = "STANDARD";
  const m = t.match(/\s*\((short cut|full song|full ver\.?|remix)\)\s*$/i);
  if (m) {
    const k = m[1].toLowerCase();
    variant = k.startsWith("short") ? "SHORTCUT" : k.startsWith("remix") ? "REMIX" : "FULLSONG";
    t = t.slice(0, m.index);
  }
  return { base: normalizeBase(t), variant };
}

interface Row {
  img: string;
  name: string;
  artist: string;
}

function parseRows(html: string): Row[] {
  return [
    ...html.matchAll(
      /<img src='(\/images\/songs\/[^']+)'[^>]*>[\s\S]*?<a href="song-details-piu\.aspx\?id=[0-9a-f-]+">([^<]+)<\/a>\s*<\/td>\s*<td>\s*([^<]*?)\s*</gi,
    ),
  ].map((m) => ({ img: m[1], name: decode(m[2].trim()), artist: decode(m[3].trim()) }));
}

async function enumerateCatalog(): Promise<Row[]> {
  if (existsSync(catalogCache)) return JSON.parse(readFileSync(catalogCache, "utf8"));
  const g = await fetch(PAGE);
  const cookie = (g.headers.get("set-cookie") || "").split(";")[0];
  let html = await g.text();
  const tok = (h: string) => ({
    vs: hidden(h, "__VIEWSTATE"),
    vg: hidden(h, "__VIEWSTATEGENERATOR"),
    ev: hidden(h, "__EVENTVALIDATION"),
  });
  let t = tok(html);
  const byKey = new Map<string, Row>();
  for (const r of parseRows(html)) byKey.set(r.img, r);
  let page = 1;
  for (let i = 0; i < 200; i++) {
    const body = new URLSearchParams({
      __EVENTTARGET: "ctl00$cphContentBodyLeft$gvSongSearch",
      __EVENTARGUMENT: "Page$" + (page + 1),
      __VIEWSTATE: t.vs,
      __VIEWSTATEGENERATOR: t.vg,
      __EVENTVALIDATION: t.ev,
      "ctl00$cphContentBodyLeft$tbSongSearch": "",
    });
    const r = await fetch(PAGE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
      body,
    });
    if (r.status !== 200) break;
    const h = await r.text();
    const rows = parseRows(h);
    if (rows.length === 0) break;
    const before = byKey.size;
    for (const row of rows) byKey.set(row.img, row);
    t = tok(h);
    page++;
    if (byKey.size === before) break;
    await sleep(70);
  }
  const all = [...byKey.values()];
  mkdirSync(join(pipelineRoot, ".cache"), { recursive: true });
  writeFileSync(catalogCache, JSON.stringify(all));
  process.stderr.write(`catalog: ${all.length} rows across ${page} pages\n`);
  return all;
}

async function main() {
  mkdirSync(thumbsDir, { recursive: true });
  const songs = parseSonglist(readFileSync(songlistPath, "utf8"));
  const catalog = await enumerateCatalog();

  const fullIndex = new Map<string, Row>();
  const index = new Map<string, Map<Variant, Row>>();
  for (const row of catalog) {
    const fn = normalizeBase(row.name);
    if (!fullIndex.has(fn)) fullIndex.set(fn, row);
    const { base, variant } = ppVariant(row.name);
    let byV = index.get(base);
    if (!byV) index.set(base, (byV = new Map()));
    if (!byV.has(variant)) byV.set(variant, row);
  }
  const allBases = [...index.keys()];

  function match(title: string): Row | null {
    const fn = normalizeBase(title);
    const full = fullIndex.get(fn);
    if (full) return full;
    const { base, variant } = splitVariant(title);
    let key = index.has(base) ? base : "";
    if (!key) {
      let best = "";
      let bestS = 0;
      for (const b of allBases) {
        const s = similarity(base, b);
        if (s > bestS) {
          bestS = s;
          best = b;
        }
      }
      if (bestS >= 0.86) key = best;
    }
    if (!key) return null;
    const byV = index.get(key)!;
    return byV.get(variant) ?? byV.get("STANDARD") ?? byV.values().next().value ?? null;
  }

  let have = 0;
  let fetched = 0;
  let missing: string[] = [];
  const withImage: string[] = [];

  for (const song of songs) {
    const out = join(thumbsDir, song.id + ".jpg");
    if (existsSync(out)) {
      have++;
      withImage.push(song.id);
      continue;
    }
    const row = match(song.title);
    if (!row) {
      missing.push(song.title);
      continue;
    }
    try {
      const r = await fetch(ORIGIN + row.img);
      if (!r.ok) throw new Error("http " + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      const img = await Jimp.fromBuffer(buf);
      img.cover({ w: 256, h: 256 });
      const jpg = await img.getBuffer("image/jpeg", { quality: 82 });
      writeFileSync(out, jpg);
      fetched++;
      withImage.push(song.id);
    } catch (e) {
      process.stderr.write(`fail "${song.title}": ${e}\n`);
      missing.push(song.title);
    }
    await sleep(70);
  }

  // regenerate the require map from whatever .jpg files exist
  const ids = readdirSync(thumbsDir)
    .filter((f) => f.endsWith(".jpg"))
    .map((f) => f.slice(0, -4))
    .sort();
  const lines = ids.map((id) => `  ${JSON.stringify(id)}: require(${JSON.stringify("../assets/thumbs/" + id + ".jpg")}),`);
  const module = [
    "// Map of song id -> bundled cover thumbnail (256px JPEG). Generated by",
    "// pipeline/scripts/fetch-thumbs.ts — do not edit by hand.",
    "export const THUMBS: Record<string, number> = {",
    ...lines,
    "};",
    "",
  ].join("\n");
  writeFileSync(thumbsModule, module);

  process.stdout.write(
    JSON.stringify(
      {
        songs: songs.length,
        alreadyHad: have,
        fetchedNow: fetched,
        withImage: withImage.length,
        missingCount: missing.length,
        missingSample: missing.slice(0, 30),
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + "\n");
  process.exit(1);
});
