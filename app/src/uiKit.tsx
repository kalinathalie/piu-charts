import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { AppSong } from "./appData";
import type { FlatChart } from "./chartIndex";
import type { Screen } from "./screen";
import { THUMBS } from "./thumbs";

export interface PickToggle {
  active: boolean;
  onToggle: () => void;
}

export function modeRowStyle(mode?: string) {
  const m = (mode ?? "").toLowerCase();
  return m === "single" ? styles.rowSingle : m === "double" ? styles.rowDouble : styles.rowCoop;
}

export function Thumb({ id, size, radius }: { id: string; size: number; radius: number }) {
  const src = THUMBS[id];
  const style = { width: size, height: size, borderRadius: radius };
  if (src) return <Image source={src} style={style} resizeMode="cover" />;
  return <View style={[style, styles.thumbPlaceholder]} />;
}

export function ChartRow({
  item,
  push,
  badge,
  pick,
}: {
  item: FlatChart;
  push: (s: Screen) => void;
  badge: string;
  pick?: PickToggle;
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={pick ? pick.onToggle : () => push({ k: "song", id: item.song.id })}
    >
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
      {pick ? (
        <Text style={styles.pickToggle}>{pick.active ? "✓" : "+"}</Text>
      ) : (
        <View style={[styles.diffBadge, modeRowStyle(item.chart.mode)]}>
          <Text style={styles.diffBadgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function SongRow({
  song,
  onPress,
  badge,
  pick,
}: {
  song: AppSong;
  onPress: () => void;
  badge?: string;
  pick?: PickToggle;
}) {
  return (
    <Pressable style={styles.row} onPress={pick ? pick.onToggle : onPress}>
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
      {pick ? (
        <Text style={styles.pickToggle}>{pick.active ? "✓" : "+"}</Text>
      ) : (
        <Text style={styles.badge}>{badge ?? `#${song.releaseIndex}`}</Text>
      )}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
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
    maxWidth: 480,
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
  pickToggle: { color: "#5a6cff", fontSize: 22, fontWeight: "800", minWidth: 32, textAlign: "center" },
});
