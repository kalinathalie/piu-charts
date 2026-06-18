# Catálogo (mantido à mão)

Fonte de dados do app. Edite os dois arquivos e rode o build para gerar o dataset.

## Arquivos

### `songlist.txt` — a ordem e o conjunto de músicas
Lista de músicas, **uma por linha, na ordem de lançamento** (a posição na lista é o que
determina a numeração no arcade). Linhas com os cabeçalhos de seção definem a versão:

```
1ST TO ZERO
NX to NXA
FIESTA TO FIESTA2
PRIME
PRIME2
XX
```

- Tudo que não for um desses cabeçalhos (e não for linha em branco) é uma música.
- O `id` de cada música é gerado a partir do título (minúsculas, `_`); títulos repetidos
  ganham sufixo `_2`, `_3`…
- Eras combinadas (ex.: "1ST TO ZERO") são aproximadas para a versão final do bloco
  (Zero, NXA, Fiesta2). Dá pra refinar por música no `metadata.json`.
- **Phoenix ainda não está aqui** (o vídeo-fonte ia só até XX). Adicione um cabeçalho
  `PHOENIX`/as músicas novas quando quiser — ou mantenha manual.

### `metadata.json` — metadados opcionais por música
Objeto keyed pelo `id` da música. Tudo é opcional; preencha aos poucos.

```json
{
  "gargoyle": {
    "artist": "SHK",
    "bpmMin": 128,
    "bpmMax": 128,
    "titleKr": "가고일",
    "debutVersion": "Fiesta2",
    "charts": [
      { "mode": "Single", "level": 16, "stepmaker": "...", "types": ["DRILL"] },
      { "mode": "Double", "level": 20, "stepmaker": "...", "types": ["RUN", "TWIST"] }
    ]
  }
}
```

- `debutVersion` aqui **sobrescreve** a era deduzida do `songlist.txt`.
- `charts[]`: `mode` (`Single|Double|CoOp|SinglePerf|DoublePerf`, padrão `Single`),
  `level` (obrigatório), `stepmaker`, `types` (DRILL/RUN/TWIST/GIMMICK/HALF/JUMP/STAIR/BRACKET),
  `typesSource` (`auto|manual|mixed`, padrão `manual`). O `id` do chart é gerado se omitido.

### `categories.json` — categoria de gênero do arcade (gerado)
Objeto `{ "<id>": "K-POP|ORIGINAL|WORLD|JMUSIC|XROSS" }` que define em qual aba do arcade
cada música aparece (K-Pop, Original, World Music, J-Music, XROSS). É o que ordena as
listas **por dificuldade** (agrupadas nessa ordem). **Gerado** por:

```
cd pipeline
npm run ingest:categories
```

Deriva das wikis vgost (seções "Returning Songs" = as 5 categorias reais do arcade, com
J-Music; e a seção XROSS) e namu (estreias do Phoenix). Não-encontradas caem em `ORIGINAL`.
**Não edite este arquivo à mão** — ele é sobrescrito a cada regeneração.

A ordem dentro de cada categoria nas listas por dificuldade é decidida no app: **versão
mais nova primeiro** e, dentro da mesma versão, ordem de lançamento crescente (espelha o
arcade). XROSS = só o lote de crossovers que o vgost lista; imports do Pump It Up M feitos
por compositores da casa entram em ORIGINAL/gênero, não em XROSS.

### `variants.json` — edições sem marca no título (gerado)
O mesmo `ingest:categories` também escreve `variants.json` (`{ "<id>": "REMIX|FULLSONG|SHORTCUT" }`):
medleys/remixes cujo título **não** tem "REMIX/Full Song/Short Cut" (ex.: "Fire Noodle
Challenge", "Prime Time", "Beethoven Influenza"). Eles caem nas seções Remix/Full/Shortcut
do vgost **e** não têm gênero — então são a própria edição e ficam fora das listas por
dificuldade (vão pra "Edições especiais"). O `catalog.ts` aplica isso como fallback do
`classifyVariant` (que só vê a marca no título).

### `categories-manual.json` — correções de categoria (à mão)
Mesmo formato `{ "<id>": "CATEGORIA" }`. **Vence** o `categories.json` no build. Use para
corrigir/preencher casos que as wikis erram ou não cobrem. Casos ainda incertos para
revisar: `horang_pungryuga` (Sangnoksu feat. HANANA), `district_v`, `catastrophe`, `boom`.

## Gerar o dataset

```
cd pipeline
npm run build:dataset
```

Valida, atribui `releaseIndex` pela posição na lista e escreve `data/dataset.json`. A
numeração posição/total é **calculada** pelo app a partir do `releaseIndex` (não é gravada).
