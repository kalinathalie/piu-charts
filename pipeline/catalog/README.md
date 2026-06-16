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

## Gerar o dataset

```
cd pipeline
npm run build:dataset
```

Valida, atribui `releaseIndex` pela posição na lista e escreve `data/dataset.json`. A
numeração posição/total é **calculada** pelo app a partir do `releaseIndex` (não é gravada).
