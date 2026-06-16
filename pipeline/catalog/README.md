# Catálogo (editável à mão)

Esta pasta é a **fonte de dados** do app, mantida manualmente. Edite os dois arquivos e
rode o build para gerar o dataset que o app consome.

> Os dados que já vêm aqui são **exemplos** demonstrando o formato (algumas músicas de
> Prime). Substitua/complete com o catálogo real do Phoenix.

## Arquivos

### `songs.json`
Objeto com `songs[]` e `charts[]`.

**Song** (campos):
- `id` *(obrigatório)* — identificador único, em minúsculas com `_` (ex.: `love_danger_2`).
- `title` *(obrigatório)* — nome da música. O `titleNormalized` (para busca) é derivado automaticamente.
- `titleKr` *(opcional)* — título em coreano (ajuda no casamento por OCR dos vídeos).
- `artist`, `bpmMin`, `bpmMax` — metadados. Se `bpmMax` faltar, vira igual a `bpmMin`.
- `debutVersion` — uma de: `1st, Zero, NX, NXA, Fiesta, Fiesta2, Prime, Prime2, XX, Phoenix`.

**Chart** (campos):
- `id` *(obrigatório)* — único (ex.: `love2_d20`).
- `songId` *(obrigatório)* — precisa referenciar um `song.id` existente.
- `mode` — `Single | Double | CoOp | SinglePerf | DoublePerf` (padrão `Single`).
- `level` — número da dificuldade (ex.: `16`, `20`).
- `stepmaker` — quem fez o chart.
- `types` — lista de: `DRILL, RUN, TWIST, GIMMICK, HALF, JUMP, STAIR, BRACKET` (padrão `[]`).
- `typesSource` — `auto | manual | mixed` (padrão `manual`).

### `order.json`
Array com os `song.id` na **ordem de lançamento** (a posição na lista é o índice aqui).
Música que não estiver nesse array recebe `releaseIndex = 0` e o build avisa.

> Dica: dá para gerar um rascunho desse `order.json` a partir dos vídeos oficiais com
> `npx tsx scripts/spike-order.ts` (ver `scripts/SPIKE.md`), e depois ajustar à mão.

## Gerar o dataset

```
cd pipeline
npm run build:dataset
```

Isso valida o catálogo, aplica a ordem e escreve `data/dataset.json` (a numeração
posição/total é **calculada** pelo app a partir do `releaseIndex` — não fica gravada).
