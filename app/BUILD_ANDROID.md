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

## Observações
- O `app-data.json` (todas as músicas/charts) é embutido no bundle JS → app 100% offline.
- Ícone: usando o padrão do Expo. Pra um ícone próprio, coloque `assets/icon.png`
  (1024×1024), referencie em `app.json` (`expo.icon`) e rode o prebuild de novo.
- Tema escuro nativo (splash/barras): opcional instalar `expo-system-ui`. A UI do app
  já é escura independentemente disso.
