import { useState } from "react";
import { Platform, Pressable, Share, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { styles } from "../uiKit";
import { serializePlaylist } from "./format";
import type { Playlist } from "./types";

export function PlaylistShareScreen({ playlist }: { playlist: Playlist }) {
  const [copied, setCopied] = useState(false);
  const shareString = serializePlaylist(playlist);

  async function copy() {
    if (Platform.OS === "web") {
      await navigator.clipboard.writeText(shareString);
    } else {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(shareString);
    }
    setCopied(true);
  }

  return (
    <View style={[styles.pad, { alignItems: "center" }]}>
      <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16, marginTop: 12 }}>
        <QRCode value={shareString} size={220} />
      </View>
      <Text selectable style={[styles.rowMeta, { marginTop: 20, textAlign: "center" }]}>
        {shareString}
      </Text>
      <Pressable style={[styles.bigBtn, { marginTop: 20, width: "100%", backgroundColor: "#5a6cff" }]} onPress={copy}>
        <Text style={styles.bigBtnText}>{copied ? "Copiado!" : "Copiar"}</Text>
      </Pressable>
      {Platform.OS !== "web" && (
        <Pressable
          style={[styles.bigBtn, { marginTop: 12, width: "100%", backgroundColor: "#247a4a" }]}
          onPress={() => Share.share({ message: shareString })}
        >
          <Text style={styles.bigBtnText}>Compartilhar</Text>
        </Pressable>
      )}
    </View>
  );
}
