# @ruflo/outreach — Fase 1

Trova attività locali **senza sito web**, le qualifica, le scrive su Notion e ti manda
una mail con tre bottoni per decidere quali vale la pena costruire.

Non manda nulla ai clienti. In questa fase il sistema si ferma prima del contatto:
il suo lavoro è togliere di mezzo la ricerca su Google e la raccolta dei dati.

## Il flusso

```
outreach scout   →  cerca su Google Places, qualifica, scrive i nuovi lead su Notion
outreach digest  →  ti manda la mail con i lead in attesa (Cancello A)
        ↓ clicchi COSTRUISCI
outreach serve   →  riceve il click, segna "Approvato" e scarica il kit del sito
```

## Setup (una volta sola)

**1. Google Places**
Su [console.cloud.google.com](https://console.cloud.google.com): crea un progetto,
abilita **Places API (New)**, genera una chiave API. Metti un budget di allerta —
le chiamate si pagano a consumo.

**2. Notion**
Crea un'integrazione su [notion.so/my-integrations](https://www.notion.so/my-integrations),
copia il token. Crea una pagina vuota che farà da contenitore, aprila,
`···` → *Connessioni* → aggiungi la tua integrazione. Copia l'id della pagina
dall'URL (i 32 caratteri finali).

**3. Configurazione**

```bash
cp .env.example .env          # riempi GOOGLE_PLACES_API_KEY, NOTION_TOKEN, NOTION_PARENT_PAGE_ID
openssl rand -hex 32          # incolla il risultato in APPROVAL_SECRET
npm install
npm run outreach setup        # crea i 5 database e stampa gli id da incollare nel .env
cp outreach.config.example.json outreach.config.json
```

In `outreach.config.json` metti la **tua** zona: `area`, `center` (latitudine e
longitudine — le prendi da Google Maps col tasto destro sul punto) e `radiusMeters`.

## Uso quotidiano

```bash
npm run outreach scout --  --dry      # prova a vuoto: cerca e qualifica, non scrive nulla
npm run outreach scout                # scrive i nuovi lead su Notion
npm run outreach digest -- --limit 10 # ti manda i 10 migliori da valutare
npm run outreach serve                # tieni acceso: riceve i click della mail
```

## Cliccare i bottoni dal telefono

`serve` ascolta solo in locale. Per usarlo dal telefono serve un indirizzo pubblico:

```bash
cloudflared tunnel --url http://localhost:8787
```

Copia l'URL che stampa dentro `PUBLIC_BASE_URL` nel `.env` e rilancia `digest`.
Senza tunnel i bottoni funzionano solo dal computer sulla stessa rete.

## Cosa c'è dentro

| File | Cosa fa |
|---|---|
| `src/scout/places.ts` | client Google Places — campi economici nello scout, campi cari solo per i lead approvati |
| `src/scout/qualify.ts` | le regole: chi ha un sito vero viene scartato, chi ha solo Facebook vale di più di chi non ha nulla |
| `src/storage/notion.ts` | **l'unico** file che parla con Notion — per cambiare database si riscrive solo questo |
| `src/storage/seen.ts` | indice locale dei `place_id` già visti: è ciò che impedisce i doppioni |
| `src/approve/tokens.ts` | link firmati con scadenza: nessun login nella mail, nessun link falsificabile |
| `src/kit/builder.ts` | scarica foto, orari, recensioni e descrizione in `.data/kits/<nome>/` |

```bash
npm test          # regole di qualificazione e sicurezza dei token
npm run typecheck
```

## Limiti noti di questa fase

- L'invio ai clienti non è implementato (Fase 3). Il `Cancello B` neanche.
- Le email dei lead non vengono cercate: Places non le restituisce. In questa fase
  hai il telefono, che per questo target è comunque il canale che risponde.
- `serve` deve restare acceso perché i bottoni funzionino.
