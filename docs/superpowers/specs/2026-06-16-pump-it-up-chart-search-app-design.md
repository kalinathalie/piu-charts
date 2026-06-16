# Design — App de Busca de Charts do Pump It Up

- **Data:** 2026-06-16
- **Status:** Aprovado (brainstorming) — pendente revisão do spec pelo usuário
- **Autor:** Kalina + Claude

---

## 1. Objetivo

Aplicativo mobile que permite **pesquisar charts do Pump It Up Phoenix** (por nome de
música, stepmaker, artista, tipo de chart e faixa de BPM) e, principalmente, descobrir a
**localização (numeração) de cada chart nas listas do arcade**, já que a máquina não tem
função de busca. O usuário pesquisa no celular, descobre a posição, e seleciona o chart no
arcade pela numeração.

A **numeração** é a feature-herói: para um dado chart, o app mostra sua posição em cada
"categoria" navegável do arcade — ex.:

```
Gargoyle
  S16  →  Nível S16: 5/100   ·  Versão Prime: 20/200   ·  Todas: 412/1500   — DRILL
  D20  →  Nível D20: 30/300  ·  Versão Prime: 21/200   ·  Todas: 980/1500   — RUN, TWIST
```

(números ilustrativos)

---

## 2. Contexto e problema

- O arcade do Pump It Up tem **centenas de músicas** e **não oferece busca**.
- O jogador navega por listas (por nível, por versão, etc.) e localiza a música pela
  **posição na lista**.
- A ordem dentro de cada lista é a **ordem de lançamento da música** (cronológica por
  versão: 1st → Zero → NX → NXA → Fiesta → Fiesta 2 → Prime → Prime 2 → XX → Phoenix).
- Hoje não existe nenhuma fonte pronta que entregue essa numeração. Ela precisa ser
  **derivada** de uma ordem-mestre de músicas.

**Propriedade-chave:** como a ordem é por lançamento, música nova entra no fim. As posições
antigas são estáveis; só o total cresce. (Remoção de músicas é a única coisa que desloca
posições — tratada como manutenção de dados.)

---

## 3. Escopo

### No escopo
- Plataforma: **Android** (APK), via React Native + Expo.
- Funcionamento **offline** (dados embutidos no app).
- Uso **pessoal / poucos amigos** (sem backend, sem contas).
- Alvo: **Pump It Up Phoenix** (versão atual; ver Item em Aberto sobre a versão exata).
- Busca por: nome de música, stepmaker, artista, tipo de chart, faixa de BPM.
- Tela de detalhe com numeração por categoria + metadados.

### Fora do escopo (por enquanto)
- iOS / web (a arquitetura facilita adicionar depois).
- Backend, contas de usuário, sincronização em nuvem.
- Cabines de versões antigas (XX, Prime 2, etc.) — só Phoenix.
- Funcionalidades sociais, scores, perfis.

---

## 4. Glossário

| Termo | Significado |
|---|---|
| **Song (música)** | Uma faixa. Tem título, artista, BPM, versão de estreia. |
| **Chart** | Uma coreografia jogável de uma música. Tem modo + nível + stepmaker + tipos. |
| **Mode (modo)** | Single, Double, Co-op (e variações de performance). |
| **Level (nível)** | Dificuldade numérica (ex.: 16, 20). Rótulo = modo+nível, ex.: `S16`, `D20`. |
| **Stepmaker** | Quem criou o chart. |
| **Version (versão)** | Versão em que a música estreou (Fiesta, Prime, Phoenix…). |
| **Category (categoria)** | Uma lista navegável do arcade (ex.: "Nível S16", "Versão Prime", "Todas"). |
| **`release_index`** | Ordinal global de lançamento da música. Base de toda a numeração. |
| **Tipo (de chart)** | Classificação de habilidade: DRILL, RUN, TWIST, GIMMICK, HALF, JUMP, STAIR, BRACKET. |

---

## 5. Modelo de dados

Três entidades principais.

### Song
- `id`
- `title` — título canônico (inglês quando houver)
- `title_kr` — título coreano (quando houver; ajuda no matching de OCR)
- `title_normalized` — sem acento/maiúscula, para busca
- `artist`
- `bpm_min`, `bpm_max` — iguais para BPM fixo; diferentes para BPM variável
- `debut_version` — enum (1st, Zero, NX, NXA, Fiesta, Fiesta2, Prime, Prime2, XX, Phoenix)
- `release_index` — inteiro, ordem global de lançamento
- `jacket_url` / asset opcional

### Chart
- `id`
- `song_id` → Song
- `mode` — enum (Single, Double, CoOp, SinglePerf, DoublePerf)
- `level` — inteiro
- `label` — derivado (ex.: `S16`, `D20`)
- `stepmaker`
- `types` — lista de enum (DRILL, RUN, TWIST, GIMMICK, HALF, JUMP, STAIR, BRACKET)
- `types_source` — enum (auto, manual, mixed)

### Category (derivada, não persistida como números)
- `id`, `name` (display)
- `kind` — enum (LEVEL, VERSION, ALL, …extensível)
- `unit` — enum (CHART, SONG) — se a posição conta charts ou músicas
- `member_predicate` — regra de pertencimento
- `ordering` — sempre `release_index` asc + desempate determinístico

> A posição/total **nunca** é armazenada. É calculada em runtime (ver seção 6).

---

## 6. Motor de numeração (núcleo)

Para um chart `C` numa categoria `K`:

1. `membros = todos os itens (charts ou songs, conforme K.unit) que satisfazem K.member_predicate`,
   restritos ao dataset Phoenix atual.
2. `membros.sort(por song.release_index asc, depois por desempate)`.
3. `posição = índice de C (ou da song de C) em membros + 1`.
4. `total = len(membros)`.

**Desempate determinístico** (quando há empate de `release_index`, ou múltiplos charts da
mesma música na mesma categoria): por `(mode, level, chart_id)`. O critério exato será
**validado contra a máquina real** na Fase 0/1.

### Categorias iniciais (a confirmar na máquina)
- **LEVEL** — uma por `(mode, level)` presente. Ex.: `S16`, `D20`. Unit = CHART.
  *(Premissa a validar: o arcade separa Single/Double na navegação por nível.)*
- **VERSION** — uma por `debut_version` presente no Phoenix. Unit = SONG (provável) — a
  confirmar se conta música ou chart.
- **ALL** — todas as músicas/charts. Unit a definir.
- Extensível para outras categorias que o arcade exponha ("e por aí vai").

### Casos de borda
- Músicas removidas do Phoenix não entram em `membros` (dataset reflete só a versão alvo).
- BPM variável: ver matching na busca (seção 7).
- Música nova: `release_index` maior → entra no fim → posições antigas preservadas.

---

## 7. Busca

Filtro unificado e **combinável**:

- **Texto** — casa contra título de música, artista e stepmaker (normalizado, parcial, sem acento).
- **Modo** — Single / Double / etc.
- **Nível** — exato ou faixa.
- **Tipo** — um ou vários dos 8 tipos (com modo E/OU).
- **BPM** — faixa `[min, max]`. Para música de BPM variável, casa se a faixa do filtro
  **sobrepõe** `[bpm_min, bpm_max]` da música.

Resultado: lista de **charts** (linha = música + selo de modo/nível + tipos + BPM). Toque → detalhe.

---

## 8. Telas / UX

1. **Busca** — barra de texto + chips de filtro (modo, nível, tipo, BPM, stepmaker, artista).
2. **Resultados** — lista de charts; cada linha mostra música, artista, selo `S16`/`D20`, tipos, BPM.
3. **Detalhe (herói)** — cabeçalho da música (título, artista, BPM, versão, capa) e, para cada
   chart da música: modo+nível, stepmaker, tipos, e o **bloco de numeração** (lista de
   categorias com `posição/total`). Esta é a tela central do app.
4. **Editor de tipos (manual)** — *(Fase 3)* permite ajustar/confirmar tipos por cima da
   classificação automática (grava override).

> Mockups visuais não foram feitos (telas convencionais de lista/detalhe). Podem ser
> produzidos depois se necessário.

---

## 9. Stack técnica

- **App:** React Native + Expo (TypeScript). Distribuição via APK (EAS Build).
- **Dados no app:** SQLite embutido (expo-sqlite) com índice de texto (FTS) para busca rápida
  e offline. Dataset pequeno (~1–1,5 mil músicas / alguns milhares de charts) → busca instantânea.
- **Pipeline de dados:** Node + TypeScript (mesma linguagem do app).
- **Estrutura do repositório (monorepo simples):**
  ```
  /app        — aplicativo Expo (RN, TS)
  /pipeline   — scraping, OCR de ordem, classificação, geração do dataset (Node, TS)
  /data       — overrides manuais (types-overrides, order-overrides) e dataset gerado
  /docs       — specs e documentação
  ```

---

## 10. Pipeline de dados

Roda na máquina de desenvolvimento (não no celular). Produz o SQLite que é embutido no app.

### Fontes
| Fonte | Fornece | Acesso |
|---|---|---|
| **Vídeos oficiais (preview reels)** | **Ordem de lançamento** (`release_index`) | yt-dlp + ffmpeg + OCR |
| `piugame.com` (logado) / wikis (Namu, Fandom, Miraheze) / Pump Pro+ | Catálogo + metadados (artista, BPM, níveis, stepmaker, títulos en/kr, versão) | scraping (login do usuário quando necessário) |
| `piucenter.com` | Classificação de tipos (drill/run/twist/etc.) — camada base | scraping/análise |
| Arquivos `.ssc` da comunidade | Insumo p/ classificação automática de tipos (fallback) | download |
| **Overrides manuais** (no repo) | Correções de ordem e de tipos | arquivos JSON versionados |

### Vídeos de ordem identificados
- **Vídeo 1 — "All Songs except New Tunes (English)"** (`VkntM4p7-yA`, 21min): ordem das
  músicas **antigas** (1st → XX), títulos em inglês (bom para matching).
- **Vídeo 2 — "2.11.0 Final Update FULL SONG LIST"** (`5wIJuYuhvkw`, 13min): inclui a era
  **Phoenix** (cauda que falta no vídeo 1); parte dos títulos em coreano.

Ambos são *preview reels* (tocam um trecho de cada música, com cards "NEXT" de transição e a
roda de jaquetas), **não** listas de texto.

### Etapas
1. **Catálogo + metadados:** raspar fontes → montar conjunto canônico de músicas/charts com
   títulos (en/kr), artista, BPM, níveis, stepmaker, versão.
2. **Extração de ordem:** dos vídeos:
   - amostrar frames (ex.: ~2 fps) com ffmpeg;
   - filtrar frames de transição (cards "NEXT") e detectar troca de música;
   - OCR do título (tesseract com en+kr);
   - **fuzzy-match** do título OCR contra o catálogo (usando `title` e `title_kr`) →
     identifica a música de forma robusta a erros de OCR;
   - dedupe de matches consecutivos → sequência ordenada com timestamps (para QA).
3. **Atribuir `release_index`** a partir da sequência (vídeo 1 p/ antigas, vídeo 2 p/ cauda Phoenix).
4. **Classificar tipos:** camada base do piucenter + heurística sobre `.ssc` quando faltar.
5. **Aplicar overrides manuais** (ordem e tipos).
6. **Gerar SQLite** com versão/checksum do dataset.

### Estratégia de OCR (detalhe)
- O vídeo dá **ordem**, não metadados nem números — os títulos servem só para identificar a
  música e sua posição na sequência.
- Robustez vem do **fuzzy-match contra o catálogo**, não da precisão bruta do OCR.
- Saída inclui timestamps por música para permitir **conferência manual** rápida.

---

## 11. Fases (ordem de construção)

### Fase 0 — Spike de dados (de-risk)
- Provar a extração de ordem de ponta a ponta num **trecho** dos vídeos: frames → OCR →
  fuzzy-match → sequência.
- Montar uma **amostra** de catálogo (1 versão, ex.: Prime) com metadados.
- **Validar a numeração** de alguns charts contra a máquina real.
- *Pronto quando:* uma amostra ordenada é gerada e bate com o arcade numa verificação manual.

### Fase 1 — Catálogo completo + motor de numeração
- Catálogo Phoenix completo + `release_index` de todas as músicas.
- Motor de numeração com testes (TDD).
- *Pronto quando:* posições/totais calculados para todas as categorias, validados em amostra.

### Fase 2 — App Android (busca + detalhe)
- Busca (nome / stepmaker / artista / BPM) offline.
- Tela de detalhe com numeração por categoria.
- *Pronto quando:* APK roda, busca e numeração funcionam offline.

### Fase 3 — Tipos (auto + manual) + busca por tipo
- Classificação automática + editor de override.
- Filtro de busca por tipo.
- *Pronto quando:* tipos cobrem o catálogo e a busca por tipo funciona.

**Primeira leva de implementação:** Fases 0 + 1 (dados corretos primeiro; a UI não vale nada
com numeração errada).

---

## 12. Estratégia de testes

- **Motor de numeração:** TDD com fixtures → posição/total corretos; desempate determinístico;
  casos de borda (música nova no fim, empate de índice).
- **Parsing/normalização:** testes de snapshot sobre amostras de fontes.
- **Pipeline de OCR/ordem:** teste com um trecho curto conhecido (sequência esperada).
- **App:** testes de componente da busca (filtros combináveis).
- **Portão de validação (manual):** comparar números do app vs arcade real numa amostra antes
  de considerar a numeração "pronta".

---

## 13. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Ordem imprecisa (OCR + fuzzy ruidoso) | Fuzzy-match contra catálogo; passada de QA manual; validação na máquina; propriedade de append estável. |
| Semântica das categorias incerta (S/D separados? conta música ou chart?) | Modelo flexível (`unit` por categoria); validar na máquina na Fase 0/1. |
| Drift de versão do arcade (totais mudam) | Dataset versionado; rebuild a cada update; app exibe a versão do dataset. |
| Títulos em coreano (vídeo 2) | Catálogo guarda `title` e `title_kr`; fuzzy-match nos dois. |
| Manutenção dos dados | Pipeline re-executável; overrides manuais preservados em arquivos versionados. |
| Acesso a fontes (login/scraping) | Login feito pelo usuário; uso pessoal; rate respeitoso. |

---

## 14. Itens em aberto (a validar)

1. **Versão exata do Phoenix** do arcade do usuário (vídeo 2 é 2.11.0). Os totais dependem disso.
2. **Conjunto e semântica das categorias** que o arcade expõe: a navegação por nível separa
   Single/Double? A categoria "versão" conta músicas ou charts? Que outras categorias existem?
3. **Ordem/desempate exatos** dentro de cada categoria (validar na máquina).
4. **Acesso e cobertura do piucenter** para os tipos.
5. **Completude do stepmaker** nas fontes de metadados.

> Itens 2 e 3 são os de maior risco de correção e precisam de conferência no arcade real
> (fotos/vídeo do usuário ou vídeos de gameplay).

---

## 15. Decisões registradas (do brainstorming)

- Alvo: **só Phoenix atual**.
- Plataforma: **Android** primeiro; arquitetura permite iOS/web depois.
- **Offline**, uso pessoal, sem backend/contas.
- Numeração é **multidimensional** (uma posição por categoria), **calculada** a partir de
  `release_index`.
- Ordem dentro de categoria = **ordem de lançamento da música**.
- Tipos: **DRILL, RUN, TWIST, GIMMICK, HALF, JUMP, STAIR, BRACKET**; vários por chart;
  abordagem **híbrida** (auto + ajuste manual).
- Stack: **React Native + Expo** com **SQLite** embutido.
- Tipos: base no **piucenter**.
- Ordem: extraída dos **vídeos oficiais** + fuzzy-match contra catálogo; site/wikis para metadados.
