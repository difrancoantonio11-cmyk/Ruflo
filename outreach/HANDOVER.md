# Outreach — stato del progetto

> Documento di passaggio. Scritto il 6 ottobre 2026, alla chiusura della chat in cui
> il progetto è nato. Contiene tutto quello che serve per riprendere da zero senza
> quella conversazione.

---

## 1. Cosa deve fare questo progetto

Trovare attività locali **senza sito web**, contattarle brevemente, e produrre un
report di chi è stato contattato, chi ha risposto e chi è interessato.

| | |
|---|---|
| **Chi cerchiamo** | Attività locali con presenza online (es. pagina Facebook) ma **senza sito proprio** |
| **Zona** | Caselle Torinese e dintorni — raggio 8 km |
| **Tipo** | B2B, contatto diretto |
| **Cosa vendiamo** | Un sito web interattivo e personalizzabile |
| **Metrica** | Lead trovati · contattati · risposte · appuntamenti · progetti avviati |

**Fuori perimetro:** la costruzione del sito demo per il cliente. Quella avviene
altrove, non in questo progetto. (In una prima versione era dentro — è stato un
errore di impostazione, poi corretto. Vedi §7.)

---

## 2. Il flusso deciso

```
1. Trova le attività senza sito                  → software
2. Cerca l'email sulla loro pagina Facebook/IG   → software   (da fare)
3. Manda l'email, con template, max ~20/giorno   → software   (da fare)
4. Legge le risposte e aggiorna lo stato         → software   (da fare)
5. Report                                        → software   (da fare)
```

### Le due corsie

Il nodo centrale del progetto, da tenere sempre presente:

- **Corsia A — lead con email.** Il sistema contatta, riceve la risposta, aggiorna
  lo stato. Funziona da solo, nessun lavoro manuale.
- **Corsia B — lead con solo telefono.** Il sistema prepara la lista, la chiamata
  la fa una persona. Nessun software può ascoltare una telefonata.

L'email non filtra mai un lead: se c'è, è un canale in più; se non c'è, il lead
vale lo stesso e si chiama.

**La leva per automatizzare di più non è un tool migliore, è l'email.** È l'unico
canale gratuito e automatizzabile. Per questo il pezzo che estrae le email dalle
pagine Facebook (passo 2) non è un extra: è ciò che sposta i lead dalla corsia B
alla corsia A.

---

## 3. Dove vive tutto

### Google Cloud
- Progetto: **Outreach Software**
- API abilitata: **Places API (New)**
- Chiave da usare: **"Maps Platform API Key"** — creata automaticamente
  all'abilitazione di Places. (Una seconda chiave chiamata "APIOS" era stata
  avviata per errore: inutile, va eliminata se esiste.)
- Fatturazione: attivata il **13 settembre 2026**, periodo di prova 90 giorni →
  scade il **12 dicembre 2026**
- Blocco carta da ~25 € al momento dell'attivazione: è una **autorizzazione di
  verifica**, non un addebito. Si rilascia da sola in 7-14 giorni.

### Notion
- Pagina contenitore: **Outreach — Siti locali**
  https://app.notion.com/p/3e6b358166a78138b348ee5e4af489ba
- Database **Lead**
  https://app.notion.com/p/2567568dac3a43b8968a36904acc3c83
  Data source ID (serve a Make): `f77eec4f-db98-4639-9235-d495d72745d1`

Colonne: Nome · Stato · Punteggio · Segnali · Categoria · Zona · Indirizzo ·
Telefono · Email · Social · Sito rilevato · Maps · Recensioni · Valutazione ·
ID esterno · Fonte · Trovato il · Note

**Stato** (il percorso del lead):
`Da valutare → Approvato → Contattato → Ha risposto → Cliente | Perso | Scartato`

**Segnali** (perché è un buon lead):
`nessun-sito` · `solo-Facebook` · `solo-Instagram` · `solo-social` · `sito-morto` ·
`molte-recensioni` · `ha-telefono` · `ha-email`

### Make (make.com)
- Account: `difrancoantonio11@gmail.com` — user id `8402429`
- Zona: `eu1.make.com`
- Organizzazione: `8111716` ("My Organization") · Team: `1984746` ("My Team")
- Scenario: **"Outreach — trova lead senza sito (Caselle)"** — id `7621850`
  https://eu1.make.com/1984746/scenarios/7621850/edit
- Stato: creato, **mai eseguito**. Scheduling: on-demand.

Com'è composto:
1. `http:ActionSendData` — POST a `https://places.googleapis.com/v1/places:searchText`
   con `textQuery: "parrucchiere Caselle Torinese"`, centro `45.178 / 7.646`, raggio 8000 m
2. `builtin:BasicFeeder` — itera su `places[]`
3. `notion:createDataSourceItem` — scrive nel database Lead, con filtro
   *"Solo chi non ha un sito proprio"*: nessun `websiteUri`, **oppure** contiene
   `facebook.com` / `instagram.com` / `business.site`

### GitHub
- Repo: `difrancoantonio11-cmyk/Ruflo`
- Branch: `claude/outreach-software-design-vkts4v`
- Cartella: `outreach/`
- Commit: `f8475fa` (prima versione), `5872354` (rimozione demo/kit)

### Google Calendar
Tre promemoria già creati:
- **20 set** — controlla che i 25 € siano tornati
- **27 set** — se non sono tornati, apri ticket Google
- **8 dic** — la prova Google scade il 12/12, decidi se continuare

---

## 4. Il codice TypeScript: leggere prima di usarlo

In `outreach/src/` c'è un programma Node.js/TypeScript funzionante (typecheck
pulito, 13 test verdi) che fa scout + qualificazione + scrittura su Notion.

**Non è utilizzabile allo stato attuale**, per un motivo che non è tecnico:
richiede terminale, npm, git e un file `.env`. Antonio non usa il terminale.
Per questo si è passati a **Make**, che è visuale e gira nel cloud.

Il codice resta nel repo perché:
- la logica di qualificazione (`src/scout/qualify.ts`) è la specifica di
  riferimento delle regole, ed è testata;
- se un giorno ci fosse un ambiente dove farlo girare, è pronto.

**Non ricostruire il progetto su quel codice senza prima verificare che esista un
posto dove eseguirlo.** È stato l'errore principale della prima fase.

---

## 5. Vincoli da non dimenticare

- **Niente terminale.** Qualunque soluzione deve essere usabile da browser.
  Niente `npm`, niente `git clone`, niente file `.env` da creare a mano.
- **Jarvis è una chat su Claude**, non un servizio in esecuzione. Non esegue
  codice tra un messaggio e l'altro, non si sveglia da solo.
- **WhatsApp e Instagram non si automatizzano.** Violano i termini di Meta e
  portano al blocco dell'account. L'unica via legale è WhatsApp Business API
  (verifica aziendale + costo a messaggio).
- **Google Places non restituisce email.** Mai. Le email vanno cercate altrove
  (pagine Facebook/Instagram).
- **Prima del primo invio a un cliente vero servono:**
  - un **dominio separato** per l'invio (~10 €/anno) con SPF, DKIM e DMARC
    configurati — mai il dominio principale, altrimenti si bruciano anche le
    email di lavoro;
  - un **link di disiscrizione** reale in ogni messaggio, e chi dice no finisce
    subito in lista esclusi (requisito GDPR, non opzionale).
- **Tetto di quota su Places**: va impostato nella console Google
  (*API e servizi → Places API (New) → Quote*). L'avviso di budget notifica
  **dopo** aver speso; la quota invece ferma davvero le chiamate.
- **Mai incollare la chiave API in chat.**

---

## 6. ANCORA DA FARE

### Subito — sbloccare il primo giro
- [ ] Entrare su [make.com](https://make.com) con *Continua con Google*
      (`difrancoantonio11@gmail.com`) — l'account esiste, non ci si è mai entrati
- [ ] Aprire lo scenario `7621850` e **collegare Notion** (terzo blocco →
      *Create a connection*). Quando Notion chiede a quali pagine dare accesso,
      selezionare **"Outreach — Siti locali"**, altrimenti Make non vede il database
- [ ] Nel primo blocco, sezione *Headers*: sostituire il testo
      `INCOLLA_QUI_LA_CHIAVE_GOOGLE` con la *Maps Platform API Key*
- [ ] Premere **"Run once"** e guardare cosa succede
- [ ] Impostare il tetto di quota giornaliero su Places (200 richieste/giorno)
- [ ] Verificare in Notion che le righe create siano lead veri e sensati

### Dopo il primo giro — tarare
- [ ] Controllare i falsi positivi del filtro `sito-morto`: certi siti bloccano
      le richieste automatiche e sembrano morti senza esserlo
- [ ] Decidere se `solo-Facebook` merita davvero un punteggio più alto di
      `nessun-sito` (ipotesi di partenza, da verificare sui dati)
- [ ] Aggiungere il calcolo del **Punteggio** e dei **Segnali** nello scenario
      (al momento quelle colonne restano vuote)
- [ ] Aggiungere la **deduplica**: Notion non ha vincoli di unicità, due
      esecuzioni sulla stessa zona creano doppioni. Usare `ID esterno` come
      chiave — cercare prima di scrivere
- [ ] Estendere ad altre categorie oltre "parrucchiere" (partire da 3-5, non 20)

### Passo 2 — le email
- [ ] Aggiungere allo scenario l'estrazione dell'email dalla pagina
      Facebook/Instagram del lead
- [ ] **Misurare la resa**: su 100 lead, quante email si riescono a estrarre?
      Se è il 10%, la corsia automatica raccoglie poco e va ripensata.
      È il numero che decide se il progetto funziona

### Passo 3 — l'invio
- [ ] Comprare e configurare il dominio di invio (SPF/DKIM/DMARC) e scaldarlo
      per 2-3 settimane prima di andare a regime
- [ ] **Scrivere il template dell'email** — rimandato esplicitamente, mai scritto
- [ ] Inviare in automatico, con tetto giornaliero (~20) e link di disiscrizione
- [ ] Creare il database **Esclusi** su Notion e consultarlo prima di ogni invio

### Passo 4-5 — risposte e report
- [ ] Leggere le risposte dalla casella e aggiornare lo `Stato` del lead
- [ ] Report: contattati · risposte · appuntamenti · progetti avviati

### Decisioni ancora aperte
- [ ] Come gestire la corsia B (telefono): serve una lista da chiamare e un modo
      comodo di segnare l'esito. **L'email non va bene come canale di notifica**
      — Antonio le perde. Telegram è stato scartato. Da trovare un'alternativa
- [ ] Multi-progetto: oggi c'è un solo progetto. Quando ce ne sarà più di uno,
      serve una lista esclusi **globale** (chi dice no non deve ricomparire da
      un'altra campagna)

---

## 7. Errori fatti, per non rifarli

Utile a chiunque riprenda il lavoro, me compreso.

1. **Ho inserito io la costruzione della demo** nel progetto e ci ho costruito
   sopra l'intera architettura. Non era il funnel richiesto. Rimosso dopo due
   giri a vuoto.
2. **Ho costruito un CLI prima di chiedere se c'era un posto dove eseguirlo.**
   Non c'era. Chiedere sempre: dove gira questa cosa, e chi la lancia?
3. **Ho dato istruzioni da sviluppatore** (terminale, git, `.env`) senza mai
   verificare il livello tecnico. Verificarlo prima.
4. **Ho mandato sulla pagina sbagliata della console Google** (Agent Platform
   invece di *API e servizi → Credenziali*), facendo perdere diverso tempo su un
   blocco che non esisteva.
5. **Ho presentato Google come l'unica strada**, facendo attivare una
   fatturazione che si poteva rimandare. OpenStreetMap sarebbe stato un punto di
   partenza gratuito — ha però una copertura peggiore e quasi mai il numero di
   telefono, che per questo progetto è il campo più importante.
6. **Risposte troppo lunghe.** Fuori dai documenti come questo, rispondere corto.

---

## 8. La verità scomoda da ricordare

Il software non è il collo di bottiglia. Quando lo scout funzionerà, tirerà
fuori più lead di quanti se ne riescano a lavorare. Il numero che decide se
tutto questo serve a qualcosa è **quante risposte positive arrivano a
settimana**, non quanti lead vengono trovati.

E finché non c'è il template dell'email, il sistema non può produrre neanche una
risposta. È il pezzo più piccolo ed è quello che manca di più.
