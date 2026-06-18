# 🎮 PIU Charts

> App **offline** pra consultar os charts do **Pump It Up Phoenix** — busca, navegação na ordem do arcade, vídeos e como conseguir cada *title*.

`Expo` · `React Native` · `TypeScript` · **Phoenix 2.12** · **638 músicas / 4579 charts / 98 titles**

Feito pra ter na mão, no celular, sem internet: todos os dados (músicas, charts, capas) ficam embutidos no app.

---

## ✨ Funcionalidades

- 🔍 **Buscar** — por nome (PT/EN/coreano) ou artista.
- 🎚️ **Por dificuldade** — escolhe modo (Single / Double / Co-Op) → nível → charts, **agrupados pela categoria do arcade** (K-Pop → Original → World Music → J-Music → XROSS), versão mais nova primeiro, numerados `1..N` com o **RANDOM** como #1 — espelhando exatamente a tela do arcade.
- 🕹️ **Por versão** — de 1st a Phoenix.
- 👤 **Por stepmaker** — ordenado por nº de charts.
- 💿 **Edições especiais** — Remix · Short Cut · Full Song.
- 🏆 **Titles** — como conseguir cada *title* (Bracket, Twist, Run, Drill, Half, Gimmick, Boss Breaker e especiais), com o chart e o requisito; toca pra abrir a música.
- 🎵 **Detalhe da música** — "onde achar no arcade" (posição/total por versão e geral), charts coloridos por modo (Single 🔴 / Double 🟢 / Co-Op 🟡) com link do **vídeo no YouTube** por chart.
- 🖼️ **Capa pra todas as 638 músicas**.
- 📴 **100% offline.**

---

## 🏗️ Como funciona

Dois projetos:

```
pipeline/  (Node + TypeScript, ESM, vitest)   →   app/assets/app-data.json   →   app/  (Expo, só visualiza)
```

- O **`pipeline/`** pré-computa tudo (charts, posições/numeração, categorias de gênero, edições especiais, titles) num único `app-data.json`.
- O **`app/`** é um visualizador fino: lê o JSON embutido e renderiza. Sem backend, sem rede.

### Fonte de dados (catálogo, mantido à mão + ingests)
`pipeline/catalog/` — `songlist.txt` (as músicas, na ordem de lançamento) + `metadata.json` (charts por música) + `categories.json` / `variants.json` (gênero e edições) + `titles.txt`. Detalhes em [`pipeline/catalog/README.md`](pipeline/catalog/README.md).

---

## 🔌 Fontes externas & créditos

Os dados são compilados a partir de fontes públicas da comunidade — todo o crédito a elas:

- **[piugame.com](https://www.piugame.com)** — níveis oficiais do Phoenix, stepmaker, BPM e vídeos (`base.txt`).
- **[vgost.fandom.com](https://vgost.fandom.com)** — categorias de gênero do arcade e edições especiais.
- **[en.namu.wiki](https://en.namu.wiki)** — categorização das estreias do Phoenix.
- **[pumpproplus.com](https://www.pumpproplus.com)** — capas das músicas.

---

## 🚀 Rodar

### App (desenvolvimento)
```bash
cd app
npm install
npm run web        # abre no navegador (Expo Web)
# ou: npm run android   (dispositivo/emulador)
```

### Gerar o APK (Android)
Passo a passo em [`app/BUILD_ANDROID.md`](app/BUILD_ANDROID.md) (Android Studio ou `gradlew`, com as pegadinhas de Gradle/JDK/SDK já documentadas).

### Regenerar os dados (pipeline)
```bash
cd pipeline
npm install
npm run ingest:base        # charts a partir do base.txt (piugame)
npm run ingest:categories  # gênero/edições (vgost + namu)
npm run fetch:thumbs       # capas (pumpproplus)
npm run build:appdata      # escreve app/assets/app-data.json
npm test                   # vitest
```

---

## 🗂️ Estrutura

```
pump/
├─ app/                 # Expo / React Native (UI)
│  ├─ App.tsx           # toda a navegação e telas
│  ├─ assets/
│  │  ├─ app-data.json  # dados pré-computados (bundle)
│  │  └─ thumbs/        # capas 256px
│  └─ BUILD_ANDROID.md  # como gerar o APK
├─ pipeline/            # build dos dados (Node + TS)
│  ├─ catalog/          # fonte de verdade (songlist, metadata, categorias, titles)
│  └─ src/ · scripts/   # parsing, numeração, ingests
└─ README.md
```

---

## ⚠️ Aviso

Projeto **de fã**, sem qualquer vínculo com a **Andamiro**. *Pump It Up* e os nomes das músicas, áudios e capas pertencem aos seus respectivos donos; aqui são usados apenas para referência/consulta da comunidade. Os níveis e dados seguem a versão **Pump It Up Phoenix 2.12** e podem conter erros — correções são bem-vindas.
