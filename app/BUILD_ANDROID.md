# Gerar o APK (Android Studio)

O app é Expo. O projeto nativo `android/` é **gerado** (não versionado) e já foi
criado nesta máquina. Se um dia sumir, recrie com:

```bash
cd app
npx expo prebuild --platform android --no-install
```

## Pré-requisitos
- **Android Studio** (versão recente). Ele já traz o **Android SDK** e um **JDK** próprio.
- Na primeira abertura ele pede pra instalar pacotes do SDK (Platform + Build-Tools) —
  aceite. Não precisa instalar Java à parte (o do Android Studio é usado).

## Passos (interface do Android Studio)
1. **Open** → selecione a pasta `pump/app/android` (a pasta `android`, não a raiz).
2. Espere o **Gradle sync** terminar (baixa Gradle 9.3.1 + dependências; alguns minutos
   na primeira vez). Se pedir pra instalar componentes do SDK, aceite.
3. Selecione a variante **release**: menu **Build → Select Build Variant…** (ou a aba
   "Build Variants" na lateral) e mude `app` de `debug` para **`release`**.
   - Use **release** porque o `debug` precisa do servidor Metro rodando; o **release**
     empacota o JS + os dados dentro do APK → funciona **offline**, sozinho.
4. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Quando terminar, clique em **locate** no aviso, ou pegue em:
   ```
   app/android/app/build/outputs/apk/release/app-release.apk
   ```

> Assinatura: o build de **release já vem assinado com a keystore de debug** (`debug.keystore`),
> então o APK instala direto pra uso pessoal — não precisa criar keystore.
> (Para publicar na Play Store aí sim seria preciso uma keystore própria.)

## Alternativa por linha de comando
No terminal do Android Studio (que já enxerga o SDK):
```bash
cd android
./gradlew assembleRelease        # Windows: .\gradlew.bat assembleRelease
```
APK em `app/build/outputs/apk/release/app-release.apk`.

## Instalar no celular
- Transfira o `app-release.apk` pro telefone e abra (permita "instalar de fontes
  desconhecidas"), **ou** com o celular plugado (depuração USB):
  ```bash
  adb install -r app/android/app/build/outputs/apk/release/app-release.apk
  ```

## Problemas conhecidos

### `SDK location not found` (após `expo prebuild --clean`)
O `--clean` apaga o `android/` inteiro, **incluindo o `android/local.properties`** (que
aponta o SDK e é por-máquina, fora do git). Abrir o projeto no Android Studio recria ele
sozinho; pela linha de comando, crie manualmente `android/local.properties` com:
```
sdk.dir=C:/Users/<voce>/AppData/Local/Android/Sdk
```

### JDK do build
Use **o JDK do Android Studio (jbr)** — não o Java do sistema. Aqui o PATH tem Java 24
(novo demais) e `JAVA_HOME` aponta pra JDK 11 (antigo demais); ambos quebram o AGP 8.12.
No Android Studio isso é automático. Pela linha de comando, aponte o `JAVA_HOME` pro jbr:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android ; .\gradlew.bat :app:assembleRelease
```


### `JvmVendorSpec does not have member field 'IBM_SEMERU'`
O `expo prebuild` gera o wrapper com **Gradle 9.3.1**, mas o React Native 0.85.3
fixa **AGP 8.12.0 + Kotlin 2.1.20**, que são da era Gradle 8 e usam o campo
`JvmVendorSpec.IBM_SEMERU` — campo que o **Gradle 9 removeu**. Resultado: o build
quebra.

**Correção** (já aplicada neste projeto): em
`android/gradle/wrapper/gradle-wrapper.properties`, usar Gradle 8.x:
```
distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip
```
⚠️ Se você rodar `npx expo prebuild` de novo, ele volta pra 9.3.1 — reaplique esta linha.

### Gradle JDK
O AGP 8.12 roda em **JDK 17** (não use o Java 24 do sistema). No Android Studio:
**Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK** →
escolha o **JDK 17 embutido** (ex.: `jbr-17` / "Embedded JDK"). Depois
**File → Sync Project with Gradle Files**.

## Observações
- O `app-data.json` (todas as músicas/charts) é embutido no bundle JS → app 100% offline.
- **Ícone**: `assets/icon.png` (ícone completo, usado no Android <8 e na web) e
  `assets/adaptive-icon.png` (foreground do *adaptive icon* do Android 8+ — o logo
  centralizado na "safe zone" sobre fundo transparente; `app.json` →
  `expo.android.adaptiveIcon`, `backgroundColor #000000`). ⚠️ **Trocou o ícone? Rode
  `npx expo prebuild --platform android --clean` de novo** — os mipmaps (`android/app/
  src/main/res/mipmap-*`) são gerados no prebuild; se não regenerar, o APK continua com
  o ícone antigo/padrão (aparece o robô do Android). Ao reinstalar, se o launcher ainda
  mostrar o ícone velho, **desinstale o app antes** (cache de ícone do launcher).
- Tema escuro nativo (splash/barras): opcional instalar `expo-system-ui`. A UI do app
  já é escura independentemente disso.
