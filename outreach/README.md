# @ruflo/outreach

Trova attività locali **senza sito web**, le qualifica e le scrive su Notion.

Non costruisce siti e non prepara demo: quella parte è fuori da questo progetto.

## Il disegno completo

```
1. Trova le attività senza sito                      → software  (fatto)
2. Cerca l'email sulla loro pagina Facebook/Instagram → software  (da fare)
3. Manda l'email, con template, max ~20 al giorno     → software  (da fare)
4. Legge le risposte e aggiorna lo stato              → software  (da fare)
5. Report                                             → software  (da fare)
```

I lead con solo il telefono restano su Notion e li lavori a mano: nessun
software può ascoltare una telefonata al posto tuo.

## Cosa c'è adesso

| Comando | Cosa fa |
|---|---|
| `setup` | crea i 5 database su Notion (una volta sola) |
| `scout` | cerca su Google Places, qualifica, scrive i nuovi lead su Notion |
| `digest` | manda una mail con i lead in attesa e tre bottoni |
| `serve` | riceve i click di quella mail |
| `suppress` | aggiunge un contatto alla lista "non contattare mai" |

`digest` e `serve` sono in attesa di una decisione: con l'invio automatico
probabilmente non servono più.

## Setup

**Google Places** — su console.cloud.google.com: progetto, abilita *Places API
(New)*, crea una chiave da *API e servizi → Credenziali*, limitala a Places, e
metti un tetto di quota giornaliero.

**Notion** — integrazione su notion.so/my-integrations, poi condividi con essa
una pagina contenitore e copia l'id della pagina dall'URL.

```bash
npm install
cp .env.example .env          # chiave Google, token Notion, id pagina
openssl rand -hex 32          # → APPROVAL_SECRET
npm run outreach setup        # crea i database, stampa gli id per il .env
cp outreach.config.example.json outreach.config.json
```

In `outreach.config.json` metti la tua zona: `area`, `center` (coordinate da
Google Maps, tasto destro sul punto) e `radiusMeters`.

## Uso

```bash
npm run outreach scout -- --dry   # cerca e qualifica, non scrive nulla
npm run outreach scout            # scrive i nuovi lead su Notion
npm test
```

Nota: `--dry` non evita le chiamate a Google, evita solo la scrittura su Notion.

## Com'è fatto

| File | Cosa fa |
|---|---|
| `src/scout/places.ts` | Google Places, solo i campi della fascia economica |
| `src/scout/qualify.ts` | le regole: chi ha un sito vero viene scartato, chi ha solo Facebook vale di più di chi non ha nulla |
| `src/storage/notion.ts` | l'unico file che parla con Notion |
| `src/storage/seen.ts` | indice locale degli id già visti: impedisce i doppioni |
| `src/approve/tokens.ts` | link firmati con scadenza per i bottoni nelle mail |

## Prima del primo invio ai clienti

Due cose che non servono finché le mail le mandi a te stesso, ma che servono
il giorno in cui scrivi a un'attività:

- un **dominio separato** per l'invio, con SPF, DKIM e DMARC configurati
- un **link di disiscrizione** reale in ogni messaggio, e chi dice no finisce
  subito in `suppress`
