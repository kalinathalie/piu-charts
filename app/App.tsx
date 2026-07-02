import { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import rawData from "./assets/app-data.json";
import { normalizeQuery, type AppData, type AppSong, type AppChart, type AppTitle } from "./src/appData";
import { THUMBS } from "./src/thumbs";

const data = rawData as AppData;
const songById = new Map(data.songs.map((s) => [s.id, s]));

const PHOENIX_VERSION = "2.12";
// On the web build (GitHub Pages / any browser), the phone-shaped layout is
// centered in a fixed-width column instead of stretching edge-to-edge across
// a wide window. Real mobile browsers stay under this width, so they're
// unaffected; the native Android app never triggers this (Platform.OS check).
const MAX_CONTENT_WIDTH = 480;
const VERSION_ORDER = ["1st", "Zero", "NX", "NXA", "Fiesta", "Fiesta2", "Prime", "Prime2", "XX", "Phoenix"];
const MODE_LABEL: Record<string, string> = { Single: "Single", Double: "Double", CoOp: "Co-Op" };
const MODE_ORDER = ["Single", "Double", "CoOp"];
// Each by-difficulty level opens with a "<MODE> RANDOM <lvl>" play option (arcade #1).
const MODE_RANDOM: Record<string, string> = { Single: "SINGLE", Double: "DOUBLE", CoOp: "CO-OP" };

// Arcade song-selection categories, in the order the arcade lists them.
const GENRE_ORDER = ["K-POP", "ORIGINAL", "WORLD", "JMUSIC", "XROSS"];
const GENRE_LABEL: Record<string, string> = {
  "K-POP": "K-POP",
  ORIGINAL: "Original",
  WORLD: "World Music",
  JMUSIC: "J-Music",
  XROSS: "XROSS",
};

interface FlatChart {
  song: AppSong;
  chart: AppChart;
}

// ---- derived datasets (computed once) ----
const allCharts: FlatChart[] = data.songs.flatMap((s) => s.charts.map((chart) => ({ song: s, chart })));

// Special editions (Remix / Short Cut / Full Song) are kept out of the by-difficulty
// views — they have their own menu section — but stay searchable and in their version.
const stdCharts: FlatChart[] = allCharts.filter((fc) => !fc.song.variant);

const chartsByModeLevel: Record<string, FlatChart[]> = {};
for (const fc of stdCharts) (chartsByModeLevel[`${fc.chart.mode}|${fc.chart.level}`] ??= []).push(fc);

const levelsByMode: Record<string, number[]> = {};
{
  const sets: Record<string, Set<number>> = {};
  for (const fc of stdCharts) (sets[fc.chart.mode] ??= new Set()).add(fc.chart.level);
  for (const m of Object.keys(sets)) levelsByMode[m] = [...sets[m]].sort((a, b) => a - b);
}

const VARIANT_ORDER = ["REMIX", "SHORTCUT", "FULLSONG"] as const;
const VARIANT_LABEL: Record<string, string> = { REMIX: "Remix", SHORTCUT: "Short Cut", FULLSONG: "Full Song" };
const songsByVariant: Record<string, AppSong[]> = { REMIX: [], SHORTCUT: [], FULLSONG: [] };
for (const s of data.songs) if (s.variant) songsByVariant[s.variant].push(s);
const variantsPresent = VARIANT_ORDER.filter((v) => songsByVariant[v].length);

const versionsPresent = VERSION_ORDER.filter((v) => data.songs.some((s) => s.debutVersion === v));
const songsByVersion: Record<string, AppSong[]> = {};
for (const v of versionsPresent) songsByVersion[v] = data.songs.filter((s) => s.debutVersion === v);

const titleCats = data.titles ?? [];
const titlesByKey: Record<string, AppTitle[]> = {};
for (const c of titleCats) titlesByKey[c.key] = c.titles;

const chartsByStepmaker: Record<string, FlatChart[]> = {};
for (const fc of allCharts) {
  const sm = fc.chart.stepmaker;
  if (sm) (chartsByStepmaker[sm] ??= []).push(fc);
}
const stepmakers = Object.entries(chartsByStepmaker)
  .map(([name, arr]) => ({ name, count: arr.length }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

function levelPos(c: AppChart): number {
  return c.placements.find((p) => p.label.startsWith("Nível"))?.position ?? 0;
}
function modeRowStyle(mode?: string) {
  const m = (mode ?? "").toLowerCase();
  return m === "single" ? styles.rowSingle : m === "double" ? styles.rowDouble : styles.rowCoop;
}

type Screen =
  | { k: "home" }
  | { k: "search" }
  | { k: "diffModes" }
  | { k: "diffLevels"; mode: string }
  | { k: "diffCharts"; mode: string; level: number }
  | { k: "versions" }
  | { k: "versionSongs"; version: string }
  | { k: "stepmakers" }
  | { k: "stepmakerCharts"; maker: string }
  | { k: "variants" }
  | { k: "variantSongs"; variant: string }
  | { k: "titles" }
  | { k: "titleList"; cat: string }
  | { k: "song"; id: string };

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width > MAX_CONTENT_WIDTH;
  const [stack, setStack] = useState<Screen[]>([{ k: "home" }]);
  const cur = stack[stack.length - 1];
  const push = (s: Screen) => setStack((st) => [...st, s]);
  const pop = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length]);

  const title = screenTitle(cur);

  return (
    <View style={[styles.webBackdrop, isWideWeb && styles.webBackdropWide]}>
      <View
        style={[
          styles.safe,
          isWideWeb && styles.webCanvas,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        {cur.k === "home" ? (
          <Home onNavigate={push} bottom={insets.bottom} />
        ) : (
          <View style={styles.flex}>
            <Header title={title} onBack={pop} />
            <Body screen={cur} push={push} bottom={insets.bottom} />
          </View>
        )}
      </View>
    </View>
  );
}

function screenTitle(s: Screen): string {
  switch (s.k) {
    case "search":
      return "Buscar";
    case "diffModes":
      return "Por dificuldade";
    case "diffLevels":
      return MODE_LABEL[s.mode] ?? s.mode;
    case "diffCharts":
      return `${MODE_LABEL[s.mode] ?? s.mode} · ${s.mode === "CoOp" ? "" : "Nível "}${s.level}`;
    case "versions":
      return "Por versão";
    case "versionSongs":
      return `Versão ${s.version}`;
    case "stepmakers":
      return "Por stepmaker";
    case "stepmakerCharts":
      return s.maker;
    case "variants":
      return "Edições especiais";
    case "variantSongs":
      return VARIANT_LABEL[s.variant] ?? s.variant;
    case "titles":
      return "Titles";
    case "titleList":
      return titleCats.find((c) => c.key === s.cat)?.label ?? s.cat;
    default:
      return "";
  }
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.headerBar}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
        <Text style={styles.backChevron}>‹</Text>
      </Pressable>
      <Text style={styles.headerBarTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function Body({
  screen,
  push,
  bottom,
}: {
  screen: Screen;
  push: (s: Screen) => void;
  bottom: number;
}) {
  switch (screen.k) {
    case "search":
      return <SearchScreen push={push} bottom={bottom} />;
    case "diffModes":
      return <DiffModes push={push} />;
    case "diffLevels":
      return <DiffLevels mode={screen.mode} push={push} bottom={bottom} />;
    case "diffCharts":
      return (
        <ChartList
          items={chartsByModeLevel[`${screen.mode}|${screen.level}`] ?? []}
          push={push}
          bottom={bottom}
          groupByGenre
          randomMode={screen.mode}
          randomLevel={screen.level}
        />
      );
    case "versions":
      return <Versions push={push} bottom={bottom} />;
    case "versionSongs":
      return <SongList songs={songsByVersion[screen.version] ?? []} push={push} bottom={bottom} />;
    case "stepmakers":
      return <Stepmakers push={push} bottom={bottom} />;
    case "stepmakerCharts":
      return <ChartList items={chartsByStepmaker[screen.maker] ?? []} push={push} bottom={bottom} showLabel />;
    case "variants":
      return <VariantModes push={push} />;
    case "variantSongs":
      return <SongList songs={songsByVariant[screen.variant] ?? []} push={push} bottom={bottom} numbered />;
    case "titles":
      return <TitlesMenu push={push} bottom={bottom} />;
    case "titleList":
      return <TitlesList titles={titlesByKey[screen.cat] ?? []} push={push} bottom={bottom} />;
    case "song": {
      const song = songById.get(screen.id);
      return song ? <Detail song={song} bottom={bottom} /> : null;
    }
    default:
      return null;
  }
}

// ---------- Home ----------
function Home({ onNavigate, bottom }: { onNavigate: (s: Screen) => void; bottom: number }) {
  const menu: { screen: Screen; icon: string; label: string; sub: string; accent: string }[] = [
    { screen: { k: "search" }, icon: "🔍", label: "Buscar", sub: "Por nome, artista", accent: "#5a6cff" },
    { screen: { k: "diffModes" }, icon: "🎚️", label: "Por dificuldade", sub: "Single · Double · Co-Op", accent: "#9e3340" },
    { screen: { k: "versions" }, icon: "🕹️", label: "Por versão", sub: "XX, Prime, Fiesta…", accent: "#247a4a" },
    { screen: { k: "stepmakers" }, icon: "👤", label: "Por stepmaker", sub: "Ordenado por nº de charts", accent: "#9a7d1f" },
    { screen: { k: "variants" }, icon: "💿", label: "Edições especiais", sub: "Remix · Short Cut · Full Song", accent: "#7a4fd0" },
    { screen: { k: "titles" }, icon: "🏆", label: "Titles", sub: "Como conseguir cada title", accent: "#c7892b" },
  ];
  return (
    <ScrollView contentContainerStyle={[styles.homePad, { paddingBottom: bottom + 24 }]}>
      <Text style={styles.homeTitle}>PIU Charts</Text>
      <Text style={styles.homeSub}>{data.songCount} músicas · {data.chartCount} charts</Text>
      {menu.map((m) => (
        <Pressable key={m.label} style={styles.menuCard} onPress={() => onNavigate(m.screen)}>
          <View style={[styles.menuAccent, { backgroundColor: m.accent }]} />
          <Text style={styles.menuIcon}>{m.icon}</Text>
          <View style={styles.flex}>
            <Text style={styles.menuLabel}>{m.label}</Text>
            <Text style={styles.menuSub}>{m.sub}</Text>
          </View>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>
      ))}
      <Text style={styles.disclaimer}>
        Os dados seguem a versão Pump It Up Phoenix {PHOENIX_VERSION}.
      </Text>
    </ScrollView>
  );
}

// ---------- Search ----------
function SearchScreen({ push, bottom }: { push: (s: Screen) => void; bottom: number }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return data.songs.slice(0, 60);
    return data.songs
      .filter(
        (s) =>
          s.titleNormalized.includes(q) ||
          normalizeQuery(s.artist).includes(q) ||
          (s.titleKr ? normalizeQuery(s.titleKr).includes(q) : false),
      )
      .slice(0, 200);
  }, [query]);

  return (
    <View style={styles.flex}>
      <TextInput
        style={styles.input}
        placeholder="Buscar música, artista…"
        placeholderTextColor="#7a7f8c"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <FlatList
        data={results}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottom + 12 }}
        renderItem={({ item }) => <SongRow song={item} onPress={() => push({ k: "song", id: item.id })} />}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma música encontrada.</Text>}
      />
    </View>
  );
}

// ---------- By difficulty ----------
function DiffModes({ push }: { push: (s: Screen) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      {MODE_ORDER.filter((m) => levelsByMode[m]?.length).map((m) => (
        <Pressable key={m} style={[styles.bigBtn, modeRowStyle(m)]} onPress={() => push({ k: "diffLevels", mode: m })}>
          <Text style={styles.bigBtnText}>{MODE_LABEL[m]}</Text>
          <Text style={styles.bigBtnChevron}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function DiffLevels({ mode, push, bottom }: { mode: string; push: (s: Screen) => void; bottom: number }) {
  const levels = levelsByMode[mode] ?? [];
  return (
    <ScrollView contentContainerStyle={[styles.pad, styles.chipWrap, { paddingBottom: bottom + 24 }]}>
      {levels.map((lv) => {
        const count = chartsByModeLevel[`${mode}|${lv}`]?.length ?? 0;
        return (
          <Pressable key={lv} style={[styles.chip, modeRowStyle(mode)]} onPress={() => push({ k: "diffCharts", mode, level: lv })}>
            <Text style={styles.chipText}>{mode === "CoOp" ? `C${lv}` : `${mode[0]}${lv}`}</Text>
            <Text style={styles.chipCount}>{count}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------- Special editions ----------
function VariantModes({ push }: { push: (s: Screen) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      {variantsPresent.map((v) => (
        <Pressable key={v} style={[styles.bigBtn, styles.rowVariant]} onPress={() => push({ k: "variantSongs", variant: v })}>
          <Text style={styles.bigBtnText}>{VARIANT_LABEL[v]}</Text>
          <View style={styles.bigBtnRight}>
            <Text style={styles.bigBtnCount}>{songsByVariant[v].length}</Text>
            <Text style={styles.bigBtnChevron}>›</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ---------- Titles ----------
function TitlesMenu({ push, bottom }: { push: (s: Screen) => void; bottom: number }) {
  return (
    <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: bottom + 24 }]}>
      {titleCats.map((c) => (
        <Pressable key={c.key} style={[styles.bigBtn, styles.rowTitleCat]} onPress={() => push({ k: "titleList", cat: c.key })}>
          <Text style={styles.bigBtnText}>{c.label}</Text>
          <View style={styles.bigBtnRight}>
            <Text style={styles.bigBtnCount}>{c.titles.length}</Text>
            <Text style={styles.bigBtnChevron}>›</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function TitlesList({ titles, push, bottom }: { titles: AppTitle[]; push: (s: Screen) => void; bottom: number }) {
  return (
    <FlatList
      data={titles}
      keyExtractor={(t, i) => `${t.name}_${i}`}
      contentContainerStyle={{ paddingBottom: bottom + 12 }}
      renderItem={({ item }) => {
        const mode = item.chartLabel.startsWith("D") ? "double" : "single";
        const song = item.songId ? songById.get(item.songId) : undefined;
        const open = item.songId ? () => push({ k: "song", id: item.songId! }) : undefined;
        return (
          <Pressable style={styles.row} onPress={open} disabled={!open}>
            <Thumb id={item.songId ?? ""} size={48} radius={8} />
            <View style={[styles.flex, styles.rowText]}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {song?.title ?? item.songTitle}
              </Text>
              <Text style={styles.titleReq} numberOfLines={2}>
                {item.requirement}
              </Text>
            </View>
            <View style={[styles.diffBadge, modeRowStyle(mode)]}>
              <Text style={styles.diffBadgeText}>{item.chartLabel}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

// ---------- By version ----------
function Versions({ push, bottom }: { push: (s: Screen) => void; bottom: number }) {
  return (
    <FlatList
      data={versionsPresent}
      keyExtractor={(v) => v}
      contentContainerStyle={{ paddingBottom: bottom + 12 }}
      renderItem={({ item }) => (
        <Pressable style={styles.listRow} onPress={() => push({ k: "versionSongs", version: item })}>
          <Text style={styles.listRowTitle}>{item}</Text>
          <Text style={styles.listRowCount}>{songsByVersion[item].length}</Text>
        </Pressable>
      )}
    />
  );
}

// ---------- By stepmaker ----------
function Stepmakers({ push, bottom }: { push: (s: Screen) => void; bottom: number }) {
  return (
    <FlatList
      data={stepmakers}
      keyExtractor={(s) => s.name}
      contentContainerStyle={{ paddingBottom: bottom + 12 }}
      renderItem={({ item }) => (
        <Pressable style={styles.listRow} onPress={() => push({ k: "stepmakerCharts", maker: item.name })}>
          <Text style={styles.listRowTitle}>{item.name}</Text>
          <Text style={styles.listRowCount}>{item.count}</Text>
        </Pressable>
      )}
    />
  );
}

// ---------- shared lists ----------
function SongList({
  songs,
  push,
  bottom,
  numbered,
}: {
  songs: AppSong[];
  push: (s: Screen) => void;
  bottom: number;
  numbered?: boolean;
}) {
  return (
    <FlatList
      data={songs}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ paddingBottom: bottom + 12 }}
      renderItem={({ item, index }) => (
        <SongRow song={item} onPress={() => push({ k: "song", id: item.id })} badge={numbered ? `#${index + 1}` : undefined} />
      )}
    />
  );
}

function ChartRow({ item, push, badge }: { item: FlatChart; push: (s: Screen) => void; badge: string }) {
  return (
    <Pressable style={styles.row} onPress={() => push({ k: "song", id: item.song.id })}>
      <Thumb id={item.song.id} size={48} radius={8} />
      <View style={[styles.flex, styles.rowText]}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.song.title}
        </Text>
        <Text style={styles.rowMeta}>
          {item.song.debutVersion}
          {item.chart.stepmaker ? ` · ${item.chart.stepmaker}` : ""}
        </Text>
      </View>
      <View style={[styles.diffBadge, modeRowStyle(item.chart.mode)]}>
        <Text style={styles.diffBadgeText}>{badge}</Text>
      </View>
    </Pressable>
  );
}

function ChartList({
  items,
  push,
  bottom,
  showLabel,
  sortByPos,
  groupByGenre,
  randomMode,
  randomLevel,
}: {
  items: FlatChart[];
  push: (s: Screen) => void;
  bottom: number;
  showLabel?: boolean;
  sortByPos?: boolean;
  groupByGenre?: boolean;
  randomMode?: string;
  randomLevel?: number;
}) {
  // #1 in every arcade level is a "<MODE> RANDOM <lvl>" play option.
  const randomLabel =
    randomMode != null && randomLevel != null
      ? `${MODE_RANDOM[randomMode] ?? randomMode.toUpperCase()} RANDOM ${String(randomLevel).padStart(2, "0")}`
      : null;

  // By-difficulty view: group by the arcade category (K-Pop, Original, World,
  // J-Music, XROSS), keeping the version/release order inside each group.
  const sections = useMemo(() => {
    if (!groupByGenre) return null;
    const byGenre: Record<string, FlatChart[]> = {};
    for (const fc of items) (byGenre[fc.song.category] ??= []).push(fc);
    // Arcade order inside a category: newest version first, then release order
    // (oldest first) within the same version.
    const cmp = (a: FlatChart, b: FlatChart) => {
      const va = VERSION_ORDER.indexOf(a.song.debutVersion);
      const vb = VERSION_ORDER.indexOf(b.song.debutVersion);
      if (va !== vb) return vb - va;
      return a.song.releaseIndex - b.song.releaseIndex;
    };
    // Number the rows 1..N continuously; the RANDOM option (if any) takes #1.
    let n = randomLabel ? 1 : 0;
    return GENRE_ORDER.filter((g) => byGenre[g]?.length).map((g) => ({
      title: GENRE_LABEL[g] ?? g,
      data: byGenre[g].sort(cmp).map((fc) => ({ ...fc, seq: ++n })),
    }));
  }, [items, groupByGenre, randomLabel]);

  if (sections) {
    return (
      <SectionList
        sections={sections}
        keyExtractor={(fc) => fc.chart.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: bottom + 12 }}
        ListHeaderComponent={
          randomLabel ? (
            <Pressable
              style={styles.row}
              onPress={() => {
                const fc = items[Math.floor(Math.random() * items.length)];
                if (fc) push({ k: "song", id: fc.song.id });
              }}
            >
              <View style={[styles.thumbPlaceholder, styles.randomThumb]}>
                <Text style={styles.randomDice}>🎲</Text>
              </View>
              <View style={[styles.flex, styles.rowText]}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {randomLabel}
                </Text>
                <Text style={styles.rowMeta}>Chart aleatório</Text>
              </View>
              <View style={[styles.diffBadge, modeRowStyle(randomMode)]}>
                <Text style={styles.diffBadgeText}>#1</Text>
              </View>
            </Pressable>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.genreHeader}>
            <Text style={styles.genreHeaderText}>{section.title}</Text>
            <Text style={styles.genreHeaderCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => <ChartRow item={item} push={push} badge={`#${item.seq}`} />}
      />
    );
  }

  const list = sortByPos ? [...items].sort((a, b) => levelPos(a.chart) - levelPos(b.chart)) : items;
  return (
    <FlatList
      data={list}
      keyExtractor={(fc) => fc.chart.id}
      contentContainerStyle={{ paddingBottom: bottom + 12 }}
      renderItem={({ item }) => (
        <ChartRow item={item} push={push} badge={showLabel ? item.chart.label : `#${levelPos(item.chart)}`} />
      )}
    />
  );
}

function SongRow({ song, onPress, badge }: { song: AppSong; onPress: () => void; badge?: string }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Thumb id={song.id} size={48} radius={8} />
      <View style={[styles.flex, styles.rowText]}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.rowMeta}>
          {song.debutVersion}
          {song.artist ? ` · ${song.artist}` : ""}
        </Text>
      </View>
      <Text style={styles.badge}>{badge ?? `#${song.releaseIndex}`}</Text>
    </Pressable>
  );
}

function Thumb({ id, size, radius }: { id: string; size: number; radius: number }) {
  const src = THUMBS[id];
  const style = { width: size, height: size, borderRadius: radius };
  if (src) return <Image source={src} style={style} resizeMode="cover" />;
  return <View style={[style, styles.thumbPlaceholder]} />;
}

function YouTubeButton({ url }: { url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={styles.ytBtn} hitSlop={10} accessibilityLabel="Ver vídeo no YouTube">
      <View style={styles.ytTriangle} />
    </Pressable>
  );
}

// ---------- song detail ----------
function Detail({ song, bottom }: { song: AppSong; bottom: number }) {
  const bpm =
    song.bpmMin > 0
      ? song.bpmMin === song.bpmMax
        ? `${song.bpmMin} BPM`
        : `${song.bpmMin}–${song.bpmMax} BPM`
      : null;

  return (
    <ScrollView contentContainerStyle={[styles.detail, { paddingBottom: bottom + 32 }]}>
      <View style={styles.detailHead}>
        <Thumb id={song.id} size={96} radius={14} />
        <View style={styles.detailHeadText}>
          <Text style={styles.title}>{song.title}</Text>
          <Text style={styles.metaHead}>
            {song.debutVersion}
            {song.artist ? ` · ${song.artist}` : ""}
            {bpm ? ` · ${bpm}` : ""}
          </Text>
        </View>
      </View>

      <Text style={styles.section}>Onde achar no arcade</Text>
      <View style={styles.card}>
        {song.placements.map((p) => (
          <PlacementRow key={p.label} label={p.label} position={p.position} total={p.total} />
        ))}
      </View>

      {song.charts.length === 0 ? (
        <Text style={styles.note}>Charts (S16/D20…) ainda não cadastrados para esta música.</Text>
      ) : (
        song.charts.map((c) => {
          const level = c.placements.find((p) => p.label.startsWith("Nível"));
          return (
            <View key={c.id} style={[styles.chartRow, modeRowStyle(c.mode)]}>
              <View style={styles.flex}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartLabel}>{c.label}</Text>
                  {c.types.length > 0 && <Text style={styles.types}>{c.types.join(" · ")}</Text>}
                </View>
                {c.stepmaker ? <Text style={styles.stepmaker}>por {c.stepmaker}</Text> : null}
              </View>
              {c.youtubeUrl ? <YouTubeButton url={c.youtubeUrl} /> : null}
              {level && (
                <Text style={styles.chartValue}>
                  {level.position}
                  <Text style={styles.chartTotal}>/{level.total}</Text>
                </Text>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function PlacementRow({ label, position, total }: { label: string; position: number; total: number }) {
  return (
    <View style={styles.placement}>
      <Text style={styles.placementLabel}>{label}</Text>
      <Text style={styles.placementValue}>
        {position}
        <Text style={styles.placementTotal}>/{total}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0e0f14" },
  flex: { flex: 1 },
  pad: { padding: 16 },

  // web: on a wide browser window, frame the phone-shaped layout as a
  // centered column instead of stretching it edge-to-edge. Inert on native
  // and on real mobile-browser widths (below MAX_CONTENT_WIDTH).
  webBackdrop: { flex: 1 },
  webBackdropWide: { backgroundColor: "#000000", alignItems: "center" },
  webCanvas: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
  },

  // home
  homePad: { padding: 16 },
  homeTitle: { color: "#fff", fontSize: 30, fontWeight: "800", marginTop: 8 },
  homeSub: { color: "#7a7f8c", fontSize: 13, marginTop: 2, marginBottom: 18 },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1b1d27",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  menuAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  menuIcon: { fontSize: 24, marginRight: 14 },
  menuLabel: { color: "#fff", fontSize: 18, fontWeight: "700" },
  menuSub: { color: "#8b90a0", fontSize: 13, marginTop: 2 },
  menuChevron: { color: "#5a6cff", fontSize: 26, fontWeight: "700" },
  disclaimer: { color: "#6b7080", fontSize: 12, marginTop: 16, lineHeight: 17, fontStyle: "italic" },

  // header bar
  headerBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
  backBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  backChevron: { color: "#5a6cff", fontSize: 30, fontWeight: "700", lineHeight: 34 },
  headerBarTitle: { color: "#fff", fontSize: 20, fontWeight: "800", flex: 1 },

  input: {
    backgroundColor: "#1b1d27",
    color: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
  },

  // generic rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#22242f",
  },
  rowText: { marginLeft: 12 },
  rowTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  rowMeta: { color: "#8b90a0", fontSize: 13, marginTop: 2 },
  badge: { color: "#5a6cff", fontSize: 13, fontWeight: "700" },
  empty: { color: "#7a7f8c", textAlign: "center", marginTop: 40 },
  thumbPlaceholder: { backgroundColor: "#22242f" },

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#22242f",
  },
  listRowTitle: { color: "#fff", fontSize: 17, fontWeight: "600" },
  listRowCount: { color: "#7a7f8c", fontSize: 14, fontWeight: "700" },

  // difficulty mode buttons
  bigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 22,
    marginBottom: 12,
  },
  bigBtnText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  bigBtnChevron: { color: "rgba(255,255,255,0.8)", fontSize: 24, fontWeight: "700" },
  bigBtnRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  bigBtnCount: { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "700" },

  // level chips
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", minWidth: 64 },
  chipText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  chipCount: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600", marginTop: 2 },

  diffBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 46, alignItems: "center" },
  diffBadgeText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  // genre section headers (by-difficulty grouping)
  genreHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#15161d",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2d3a",
  },
  genreHeaderText: { color: "#c7ccda", fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  genreHeaderCount: { color: "#7a7f8c", fontSize: 12, fontWeight: "700" },

  // mode colors
  rowSingle: { backgroundColor: "#9e3340" },
  rowDouble: { backgroundColor: "#247a4a" },
  rowCoop: { backgroundColor: "#9a7d1f" },
  rowVariant: { backgroundColor: "#5d4b9e" },
  rowTitleCat: { backgroundColor: "#7a5a2e" },
  titleReq: { color: "#d8a85a", fontSize: 12, fontWeight: "600", marginTop: 3 },
  randomThumb: { width: 48, height: 48, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  randomDice: { fontSize: 24 },

  // detail
  detail: { padding: 16 },
  detailHead: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 18 },
  detailHeadText: { flex: 1, marginLeft: 14 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  metaHead: { color: "#8b90a0", fontSize: 14, marginTop: 4 },
  section: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  card: { backgroundColor: "#1b1d27", borderRadius: 12, paddingHorizontal: 14, marginBottom: 16 },
  placement: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#22242f",
  },
  placementLabel: { color: "#c7ccda", fontSize: 15 },
  placementValue: { color: "#fff", fontSize: 18, fontWeight: "800" },
  placementTotal: { color: "#7a7f8c", fontSize: 14, fontWeight: "600" },
  note: { color: "#8b90a0", fontSize: 13, lineHeight: 19, fontStyle: "italic" },

  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  chartHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  chartLabel: { color: "#fff", fontSize: 18, fontWeight: "800" },
  types: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "700" },
  stepmaker: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 3 },
  chartValue: { color: "#fff", fontSize: 18, fontWeight: "800", minWidth: 56, textAlign: "right" },
  chartTotal: { color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: "600" },
  ytBtn: {
    width: 36,
    height: 26,
    borderRadius: 7,
    backgroundColor: "#FF0000",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  ytTriangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 6,
    borderTopColor: "transparent",
    borderBottomWidth: 6,
    borderBottomColor: "transparent",
    borderLeftWidth: 10,
    borderLeftColor: "#fff",
  },
});
