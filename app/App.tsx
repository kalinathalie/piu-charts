import { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StatusBar,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import rawData from "./assets/app-data.json";
import { normalizeQuery, type AppData, type AppSong, type AppChart, type AppTitle } from "./src/appData";
import { allCharts, globalIndexByChartId, songById, type FlatChart } from "./src/chartIndex";
import { PlaylistsListScreen } from "./src/playlists/PlaylistsListScreen";
import { PlaylistEditScreen } from "./src/playlists/PlaylistEditScreen";
import { PlaylistDetailScreen } from "./src/playlists/PlaylistDetailScreen";
import { PlaylistImportScreen } from "./src/playlists/PlaylistImportScreen";
import { PlaylistShareScreen } from "./src/playlists/PlaylistShareScreen";
import { usePlaylists } from "./src/playlists/usePlaylists";
import type { Playlist } from "./src/playlists/types";
import type { Screen } from "./src/screen";
import { styles, modeRowStyle, Thumb, ChartRow, SongRow } from "./src/uiKit";

const data = rawData as AppData;

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

// ---- derived datasets (computed once) ----
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
export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <Main />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width > MAX_CONTENT_WIDTH;
  const playlistsApi = usePlaylists();
  const [stack, setStack] = useState<Screen[]>([{ k: "home" }]);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const cur = stack[stack.length - 1];
  const push = (s: Screen) => {
    if (s.k === "playlistDetail") setPickingFor(null);
    setStack((st) => [...st, s]);
  };
  const pop = () => {
    setStack((st) => {
      if (st.length <= 1) return st;
      const next = st.slice(0, -1);
      // Only end pick mode once backing out lands back on the playlist's
      // own detail screen — not on every back-tap, since picking spans
      // multiple screens (e.g. Search -> a multi-chart song's detail for
      // disambiguation -> back to Search to pick more).
      if (next[next.length - 1].k === "playlistDetail") setPickingFor(null);
      return next;
    });
  };
  // Swaps the current top screen for a new one instead of pushing on top of
  // it — used when a form-style screen (create/import) finishes and should
  // not remain behind its result in the back history.
  const replace = (s: Screen) => {
    if (s.k === "playlistDetail") setPickingFor(null);
    setStack((st) => [...st.slice(0, -1), s]);
  };
  // Used to finish "pick mode": returns to the playlist detail screen that
  // pick mode was entered from, truncating whatever was pushed while
  // picking (Search/Difficulty/Song screens), rather than pushing a
  // duplicate detail screen on top of the one already in the stack.
  const goToPlaylistDetail = (id: string) => {
    setPickingFor(null);
    setStack((st) => {
      const idx = st.findIndex((s) => s.k === "playlistDetail" && s.id === id);
      if (idx !== -1) return st.slice(0, idx + 1);
      return [...st, { k: "playlistDetail", id }];
    });
  };

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

  // On web/desktop, let Escape act as the back button.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") pop();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
            <Body
              screen={cur}
              push={push}
              pop={pop}
              replace={replace}
              bottom={insets.bottom}
              playlists={playlistsApi}
              pickingFor={pickingFor}
              setPickingFor={setPickingFor}
            />
            {pickingFor && (
              <Pressable
                style={{
                  position: "absolute",
                  left: 16,
                  right: 16,
                  bottom: insets.bottom + 16,
                  backgroundColor: "#5a6cff",
                  borderRadius: 14,
                  padding: 16,
                  alignItems: "center",
                }}
                onPress={() => goToPlaylistDetail(pickingFor)}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                  Concluído ({playlistsApi.playlists.find((p) => p.id === pickingFor)?.chartIds.length ?? 0} na playlist)
                </Text>
              </Pressable>
            )}
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
    case "playlists":
      return "Playlists";
    case "playlistDetail":
      return "Playlist";
    case "playlistEdit":
      return s.id ? "Editar playlist" : "Nova playlist";
    case "playlistImport":
      return "Importar playlist";
    case "playlistShare":
      return "Compartilhar playlist";
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
  pop,
  replace,
  bottom,
  playlists,
  pickingFor,
  setPickingFor,
}: {
  screen: Screen;
  push: (s: Screen) => void;
  pop: () => void;
  replace: (s: Screen) => void;
  bottom: number;
  playlists: ReturnType<typeof usePlaylists>;
  pickingFor: string | null;
  setPickingFor: (id: string | null) => void;
}) {
  const pick: { playlist: Playlist; onToggle: (chartId: number) => void } | undefined =
    pickingFor && playlists.playlists.some((p) => p.id === pickingFor)
      ? {
          playlist: playlists.playlists.find((p) => p.id === pickingFor)!,
          onToggle: (chartId: number) => {
            const current = playlists.playlists.find((p) => p.id === pickingFor);
            if (current?.chartIds.includes(chartId)) playlists.removeChart(pickingFor, chartId);
            else playlists.addChart(pickingFor, chartId);
          },
        }
      : undefined;

  switch (screen.k) {
    case "search":
      return <SearchScreen push={push} bottom={bottom} pick={pick} />;
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
          pick={pick}
        />
      );
    case "versions":
      return <Versions push={push} bottom={bottom} />;
    case "versionSongs":
      return <SongList songs={songsByVersion[screen.version] ?? []} push={push} bottom={bottom} />;
    case "stepmakers":
      return <Stepmakers push={push} bottom={bottom} />;
    case "stepmakerCharts":
      return (
        <ChartList items={chartsByStepmaker[screen.maker] ?? []} push={push} bottom={bottom} showLabel pick={pick} />
      );
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
      return song ? <Detail song={song} bottom={bottom} pick={pick} /> : null;
    }
    case "playlists":
      return (
        <PlaylistsListScreen
          playlists={playlists.playlists}
          push={push}
          bottom={bottom}
          reorderPlaylist={playlists.reorderPlaylist}
        />
      );
    case "playlistEdit": {
      const editing = screen.id ? playlists.playlists.find((p) => p.id === screen.id) : undefined;
      return (
        <PlaylistEditScreen
          playlist={editing}
          playlists={playlists}
          onDone={(id) => {
            // Editing an existing playlist: its detail screen is already
            // below this one in the stack, so just go back to it. Creating
            // a new one: there's no detail screen to go back to yet, so
            // swap this form for the new playlist's detail instead of
            // pushing on top of it (which would leave the form in history).
            if (screen.id) pop();
            else replace({ k: "playlistDetail", id });
          }}
        />
      );
    }
    case "playlistDetail": {
      const playlist = playlists.playlists.find((p) => p.id === screen.id);
      return playlist ? (
        <PlaylistDetailScreen
          playlist={playlist}
          playlists={playlists}
          push={push}
          bottom={bottom}
          onAdd={() => {
            setPickingFor(playlist.id);
            push({ k: "search" });
          }}
        />
      ) : null;
    }
    case "playlistImport":
      return <PlaylistImportScreen playlists={playlists} replace={replace} />;
    case "playlistShare": {
      const playlist = playlists.playlists.find((p) => p.id === screen.id);
      return playlist ? <PlaylistShareScreen playlist={playlist} /> : null;
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
    { screen: { k: "playlists" }, icon: "📃", label: "Playlists", sub: "Suas playlists de charts", accent: "#5a6cff" },
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
function SearchScreen({
  push,
  bottom,
  pick,
}: {
  push: (s: Screen) => void;
  bottom: number;
  pick?: { playlist: Playlist; onToggle: (chartId: number) => void };
}) {
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
        renderItem={({ item }) => {
          // Search lists songs, not individual charts. A song with exactly
          // one chart is unambiguous, so tapping it while picking toggles
          // that chart directly. A song with multiple charts (different
          // modes/levels) needs disambiguation, so tapping it opens the
          // song's own detail screen (still in pick mode), which lists each
          // chart individually with its own toggle.
          const onlyChart = item.charts.length === 1 ? item.charts[0] : undefined;
          const globalId = onlyChart ? globalIndexByChartId.get(onlyChart.id) : undefined;
          return (
            <SongRow
              song={item}
              onPress={() => push({ k: "song", id: item.id })}
              pick={
                pick
                  ? globalId != null
                    ? { active: pick.playlist.chartIds.includes(globalId), onToggle: () => pick.onToggle(globalId) }
                    : { active: false, onToggle: () => push({ k: "song", id: item.id }) }
                  : undefined
              }
            />
          );
        }}
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

function ChartList({
  items,
  push,
  bottom,
  showLabel,
  sortByPos,
  groupByGenre,
  randomMode,
  randomLevel,
  pick,
}: {
  items: FlatChart[];
  push: (s: Screen) => void;
  bottom: number;
  showLabel?: boolean;
  sortByPos?: boolean;
  groupByGenre?: boolean;
  randomMode?: string;
  randomLevel?: number;
  pick?: { playlist: Playlist; onToggle: (chartId: number) => void };
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
            <View style={styles.row}>
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
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.genreHeader}>
            <Text style={styles.genreHeaderText}>{section.title}</Text>
            <Text style={styles.genreHeaderCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const globalId = globalIndexByChartId.get(item.chart.id);
          return (
            <ChartRow
              item={item}
              push={push}
              badge={`#${item.seq}`}
              pick={pick && globalId != null ? { active: pick.playlist.chartIds.includes(globalId), onToggle: () => pick.onToggle(globalId) } : undefined}
            />
          );
        }}
      />
    );
  }

  const list = sortByPos ? [...items].sort((a, b) => levelPos(a.chart) - levelPos(b.chart)) : items;
  return (
    <FlatList
      data={list}
      keyExtractor={(fc) => fc.chart.id}
      contentContainerStyle={{ paddingBottom: bottom + 12 }}
      renderItem={({ item }) => {
        const globalId = globalIndexByChartId.get(item.chart.id);
        return (
          <ChartRow
            item={item}
            push={push}
            badge={showLabel ? item.chart.label : `#${levelPos(item.chart)}`}
            pick={pick && globalId != null ? { active: pick.playlist.chartIds.includes(globalId), onToggle: () => pick.onToggle(globalId) } : undefined}
          />
        );
      }}
    />
  );
}

function YouTubeButton({ url }: { url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={styles.ytBtn} hitSlop={10} accessibilityLabel="Ver vídeo no YouTube">
      <View style={styles.ytTriangle} />
    </Pressable>
  );
}

// ---------- song detail ----------
function Detail({
  song,
  bottom,
  pick,
}: {
  song: AppSong;
  bottom: number;
  pick?: { playlist: Playlist; onToggle: (chartId: number) => void };
}) {
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
          const globalId = globalIndexByChartId.get(c.id);
          const toggle =
            pick && globalId != null
              ? { active: pick.playlist.chartIds.includes(globalId), onToggle: () => pick.onToggle(globalId) }
              : undefined;
          const RowWrapper = toggle ? Pressable : View;
          return (
            <RowWrapper
              key={c.id}
              style={[styles.chartRow, modeRowStyle(c.mode)]}
              {...(toggle ? { onPress: toggle.onToggle } : {})}
            >
              <View style={styles.flex}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartLabel}>{c.label}</Text>
                  {c.types.length > 0 && <Text style={styles.types}>{c.types.join(" · ")}</Text>}
                </View>
                {c.stepmaker ? <Text style={styles.stepmaker}>por {c.stepmaker}</Text> : null}
              </View>
              {toggle ? (
                <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", minWidth: 32, textAlign: "center" }}>
                  {toggle.active ? "✓" : "+"}
                </Text>
              ) : (
                <>
                  {c.youtubeUrl ? <YouTubeButton url={c.youtubeUrl} /> : null}
                  {level && (
                    <Text style={styles.chartValue}>
                      {level.position}
                      <Text style={styles.chartTotal}>/{level.total}</Text>
                    </Text>
                  )}
                </>
              )}
            </RowWrapper>
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

