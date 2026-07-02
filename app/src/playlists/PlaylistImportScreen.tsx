import { useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { styles } from "../uiKit";
import { chartByGlobalIndex } from "../chartIndex";
import { parsePlaylistString } from "./format";
import type { Screen } from "../screen";
import type { usePlaylists } from "./usePlaylists";

function isValidChartId(id: number): boolean {
  return chartByGlobalIndex.has(id);
}

export function PlaylistImportScreen({
  playlists,
  replace,
}: {
  playlists: ReturnType<typeof usePlaylists>;
  replace: (s: Screen) => void;
}) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanHandledRef = useRef(false);

  function runImport(raw: string) {
    const result = parsePlaylistString(raw.trim(), isValidChartId);
    if ("error" in result) {
      setMessage(result.error);
      return;
    }
    const created = playlists.importPlaylist(result);
    setMessage(
      result.warnings.length > 0
        ? `Importado "${result.name}" — ${result.warnings.join(", ")}`
        : `Importado "${result.name}" com sucesso.`,
    );
    setScanning(false);
    replace({ k: "playlistDetail", id: created.id });
  }

  if (scanning) {
    if (!permission?.granted) {
      return (
        <View style={[styles.pad, { alignItems: "center" }]}>
          <Text style={styles.rowMeta}>Precisamos da câmera para ler o QR code.</Text>
          <Pressable style={[styles.bigBtn, { marginTop: 16 }]} onPress={requestPermission}>
            <Text style={styles.bigBtnText}>Permitir câmera</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <CameraView
        style={styles.flex}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => {
          if (scanHandledRef.current) return;
          scanHandledRef.current = true;
          runImport(data);
        }}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.section}>Colar código da playlist</Text>
      <TextInput
        style={[styles.input, { minHeight: 80 }]}
        value={text}
        onChangeText={setText}
        placeholder='"nome" #rrggbb (1 2 3)'
        placeholderTextColor="#7a7f8c"
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable style={[styles.bigBtn, { marginTop: 12, backgroundColor: "#247a4a" }]} onPress={() => runImport(text)}>
        <Text style={styles.bigBtnText}>Importar</Text>
      </Pressable>

      {Platform.OS !== "web" && (
        <Pressable style={[styles.bigBtn, { marginTop: 12, backgroundColor: "#5a6cff" }]} onPress={() => {
          scanHandledRef.current = false;
          setScanning(true);
        }}>
          <Text style={styles.bigBtnText}>Ler QR code</Text>
        </Pressable>
      )}

      {message && <Text style={[styles.rowMeta, { marginTop: 16 }]}>{message}</Text>}
    </ScrollView>
  );
}
