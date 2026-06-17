import { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import rawData from "./assets/app-data.json";
import { normalizeQuery, type AppData, type AppSong, type AppChart } from "./src/appData";
import { THUMBS } from "./src/thumbs";

const data = rawData as AppData;
const songById = new Map(data.songs.map((s) => [s.id, s]));

const PHOENIX_VERSION = "2.12";
const VERSION_ORDER = ["1st", "Zero", "NX", "NXA", "Fiesta", "Fiesta2", "Prime", "Prime2", "XX", "Phoenix"];
const MODE_LABEL: Record<string, string> = { Single: "Single", Double: "Double", CoOp: "Co-Op" };
const MODE_ORDER = ["Single", "Double", "CoOp"];

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
    <View
      style={[
        styles.safe,
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
      return <ChartList items={chartsByModeLevel[`${screen.mode}|${screen.level}`] ?? []} push={push} bottom={bottom} sortByPos />;
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
      return <SongList songs={songsByVariant[screen.variant] ?? []} push={push} bottom={bottom} />;
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
function SongList({ songs, push, bottom }: { songs: AppSong[]; push: (s: Screen) => void; bottom: number }) {
  return (
    <FlatList
      data={songs}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ paddingBottom: bottom + 12 }}
      renderItem={({ item }) => <SongRow song={item} onPress={() => push({ k: "song", id: item.id })} />}
    />
  );
}

function ChartList({
  items,
  push,
  bottom,
  showLabel,
  sortByPos,
}: {
  items: FlatChart[];
  push: (s: Screen) => void;
  bottom: number;
  showLabel?: boolean;
  sortByPos?: boolean;
}) {
  const list = useMemo(
    () => (sortByPos ? [...items].sort((a, b) => levelPos(a.chart) - levelPos(b.chart)) : items),
    [items, sortByPos],
  );
  return (
    <FlatList
      data={list}
      keyExtractor={(fc) => fc.chart.id}
      contentContainerStyle={{ paddingBottom: bottom + 12 }}
      renderItem={({ item }) => (
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
            <Text style={styles.diffBadgeText}>{showLabel ? item.chart.label : `#${levelPos(item.chart)}`}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

function SongRow({ song, onPress }: { song: AppSong; onPress: () => void }) {
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
      <Text style={styles.badge}>#{song.releaseIndex}</Text>
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

  // mode colors
  rowSingle: { backgroundColor: "#9e3340" },
  rowDouble: { backgroundColor: "#247a4a" },
  rowCoop: { backgroundColor: "#9a7d1f" },
  rowVariant: { backgroundColor: "#5d4b9e" },

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
