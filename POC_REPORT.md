# Baited Workflow Builder POC - Report Tecnico

## Stato Aggiornato

Il POC implementa un workflow builder visuale per campagne di security awareness/phishing, con frontend Next.js/React Flow, backend FastAPI e persistenza PostgreSQL.

Rispetto alla prima review sono stati corretti i punti principali emersi:

- validazione frontend non piu' stantia dopo modifiche semantiche;
- CORS allineato per `localhost:3000` e `127.0.0.1:3000`;
- viewport del canvas persistito nel payload;
- branch degli edge configurabile da inspector;
- fallback validation frontend riallineato alle regole backend principali.

Rispetto alla review successiva sono stati aggiunti anche:

- validazione forte dei parametri per tipo `text`, `number`, `select`;
- fallback API limitato ai soli errori di rete/offline;
- errori HTTP backend mostrati in UI invece che nascosti;
- demo workflow ricercato con identificatore stabile;
- endpoint submissions con `404` su workflow inesistente;
- vincolo unico `(workflow_id, version)` per DB creati da zero;
- undo/history estratto in hook dedicato;
- config ESLint flat e rimozione dipendenza inutilizzata `zod`;
- test unitari backend per il validatore workflow.

## Stack

### Frontend

- Next.js 15
- React 19
- TypeScript
- React Flow / `@xyflow/react`
- Tailwind CSS
- Lucide React

### Backend

- FastAPI
- Pydantic
- SQLModel
- SQLAlchemy
- Psycopg 3
- PostgreSQL
- Uvicorn

### Dev/Infra

- Docker Compose previsto per ambiente completo;
- avvio manuale supportato con Python virtualenv e Postgres locale.

## Struttura Del Progetto

```txt
Baited-POC/
  backend/
    app/
      api/routes.py
      core/config.py
      db/session.py
      models/workflow.py
      schemas/workflow.py
      services/blocks.py
      services/demo.py
      services/validation.py
    tests/
      test_validation.py
    Dockerfile
    pyproject.toml

  frontend/
    src/
      app/
      components/workflow/
        useWorkflowHistory.ts
      lib/api/
      lib/workflow/
    Dockerfile
    eslint.config.mjs
    package.json

  docker-compose.yml
  README.md
  POC_REPORT.md
  AGENTS.md
```

## Funzionalita' Presenti

### Workflow Builder

La UI e' una schermata unica composta da:

- top bar con nome workflow, stato, `Validate`, `Save`, `Submit mock`;
- sidebar sinistra con catalogo blocchi;
- canvas centrale con nodi trascinabili e collegabili;
- inspector destro per configurare nodi o edge;
- bottom panel con tab `Validation`, `Payload`, `Submission Log`;
- controlli zoom/fit e mini map in tema dark.

### Interazione Canvas

Implementato:

- caricamento del workflow demo;
- drag/drop di blocchi dalla sidebar;
- aggiunta blocchi via click;
- connessione tra nodi;
- prevenzione cicli lato frontend;
- label automatiche sui nuovi edge;
- selezione multipla tramite rettangolo sul canvas;
- spostamento simultaneo dei nodi selezionati;
- cancellazione bulk di nodi/branch selezionati;
- undo tramite `Ctrl+Z` o bottone in toolbar;
- selezione edge;
- modifica branch edge da inspector;
- rimozione edge selezionato;
- rimozione nodo selezionato;
- rimozione automatica degli edge collegati al nodo eliminato;
- focus su nodo cliccando un errore di validazione;
- salvataggio del viewport corrente nel payload.

### Blocchi Disponibili

Entry:

- `campaign_entrypoint`

Campaign Actions:

- `create_campaign`
- `send_message`
- `start_awareness_campaign`

Target Management:

- `add_target_to_group`
- `start_osint_on_targets`

Logic:

- `wait_for_event`
- `condition`

End States:

- `mark_low_risk`
- `mark_medium_risk`
- `mark_high_risk`

### Workflow Demo

Scenario incluso:

```txt
Campaign Start
  -> Create Email Campaign
  -> Wait 48h For Event
  -> Condition: Email opened?
      opened -> Mark Low Risk
      not_opened -> Send SMS
        -> Wait 24h For Credentials
        -> Condition: Credentials submitted?
            credentials_submitted -> Add To High Risk Group
              -> Start Awareness Campaign
              -> Mark High Risk
            not_submitted -> Mark Medium Risk
```

## Modello Dati

La persistenza separa:

- `definition`: significato del workflow;
- `layout`: posizioni nodi e viewport canvas.

Tabelle:

- `workflows`;
- `workflow_versions`;
- `workflow_submissions`.

Campi JSONB:

- `workflow_versions.definition`;
- `workflow_versions.layout`;
- `workflow_versions.validation_result`;
- `workflow_submissions.payload`.

Questa scelta mantiene metadati relazionali e consente di salvare workflow flessibili senza normalizzare prematuramente ogni tipo di nodo.

## API

Endpoint implementati:

```txt
GET  /api/health
GET  /api/workflow-blocks
GET  /api/workflows/demo
GET  /api/workflows
POST /api/workflows
GET  /api/workflows/{workflow_id}
PUT  /api/workflows/{workflow_id}
POST /api/workflows/validate
POST /api/workflows/{workflow_id}/validate
POST /api/workflows/{workflow_id}/submit
GET  /api/workflows/{workflow_id}/submissions
```

## Validazione

### Backend

Il backend e' la fonte autorevole.

Regole:

- workflow non vuoto;
- node id univoci;
- un solo `campaign_entrypoint`;
- almeno un end-state;
- tipi nodo conosciuti;
- source/target edge esistenti;
- branch ammessi per tipo nodo;
- nessun edge in uscita da terminal node;
- parametri obbligatori presenti;
- parametri `select` limitati alle opzioni di catalogo;
- parametri `number` obbligati a numeri finiti;
- parametri `text` obbligati a stringhe;
- branch duplicati vietati dallo stesso source;
- `condition` con almeno due uscite;
- warning su action node con piu' output;
- warning su nodi senza incoming edge;
- warning su nodi non raggiungibili dallo start;
- grafo aciclico.

### Frontend

Il fallback client in `frontend/src/lib/workflow/validation.ts` e' stato riallineato alle principali regole backend. Serve quando l'API non e' raggiungibile, ma il backend resta comunque la validazione definitiva.

### Stato Validazione

La validazione viene invalidata quando cambia la semantica del workflow:

- modifica parametri/label nodo;
- aggiunta nodo;
- rimozione nodo;
- aggiunta edge;
- rimozione edge;
- modifica branch edge.

Le modifiche solo di layout non invalidano la validazione semantica.

- Lo spostamento dei nodi e' undoable.
- Pan/zoom del viewport marca il workflow come da salvare e viene persistito in `layout.viewport`, ma non viene inserito nello stack undo.

## Fix Applicati Dopo Review

### 1. Validazione Frontend Stantia

Problema iniziale:

- i nodi potevano restare verdi dopo modifiche al workflow.

Fix:

- introdotta invalidazione semantica tramite `markWorkflowEdited`;
- `validation` viene azzerata su modifiche a nodi, edge e branch;
- la submission precedente viene azzerata se il workflow cambia semanticamente.

File:

- `frontend/src/components/workflow/WorkflowBuilder.tsx`

### 2. CORS `localhost` / `127.0.0.1`

Problema iniziale:

- backend consentiva solo `http://localhost:3000`.

Fix:

- aggiunto `http://127.0.0.1:3000` ai default backend;
- aggiornato `docker-compose.yml`;
- aggiornato `.env.example`;
- verificato preflight `OPTIONS` con origin `127.0.0.1`.

File:

- `backend/app/core/config.py`
- `docker-compose.yml`
- `.env.example`

### 3. Viewport Non Persistito

Problema iniziale:

- `layout.viewport` veniva sempre salvato come `{ x: 0, y: 0, zoom: 1 }`.

Fix:

- aggiunto stato `viewport` nel builder;
- aggiornato su `onMoveEnd`;
- passato a `canvasToPayload`;
- ripristinato al caricamento tramite `setViewport`.

File:

- `frontend/src/components/workflow/WorkflowBuilder.tsx`
- `frontend/src/lib/workflow/transform.ts`

### 4. Branch Edge Configurabile

Problema iniziale:

- i branch erano solo automatici.

Fix:

- aggiunta selezione edge;
- aggiunto inspector per edge;
- branch modificabile con select;
- opzioni derivate dal tipo di blocco sorgente;
- edge cancellabile dall'inspector.

File:

- `frontend/src/components/workflow/WorkflowBuilder.tsx`
- `frontend/src/components/workflow/NodeInspector.tsx`

### 5. Validazione Frontend/Backend Non Allineata

Problema iniziale:

- fallback client molto piu' debole del backend.

Fix:

- aggiunti controlli frontend per duplicate node id;
- unknown node type;
- missing edge source/target;
- invalid branch;
- terminal node con output;
- missing required params;
- duplicate branch;
- condition con meno di due branch;
- warnings su multi-output action;
- warnings su missing incoming edge;
- warnings su nodi irraggiungibili;
- cycle detection;
- parametri `select` fuori opzione;
- parametri `number` non numerici;
- parametri `text` non testuali.

File:

- `frontend/src/lib/workflow/validation.ts`
- `backend/app/services/validation.py`

### 6. Selezione Multipla Canvas

Implementazione aggiuntiva:

- drag sinistro su area vuota per creare un rettangolo di selezione;
- selezione parziale dei blocchi intercettati dal rettangolo;
- inspector dedicato quando sono selezionati piu' elementi;
- cancellazione bulk da inspector o da tastiera;
- spostamento simultaneo dei nodi selezionati tramite React Flow.

File:

- `frontend/src/components/workflow/WorkflowBuilder.tsx`
- `frontend/src/components/workflow/NodeInspector.tsx`
- `frontend/src/app/globals.css`

### 7. Undo Modifiche Workflow

Implementazione aggiuntiva:

- stack locale di snapshot del canvas;
- `Ctrl+Z` globale quando il focus non e' dentro input/select/textarea;
- bottone `Undo` in top bar;
- ripristino di nodi, edge, selezione, metadata, validazione e submission;
- copertura per aggiunta blocchi, cancellazioni, connessioni, branch, parametri, label e spostamento nodi;
- pan/zoom del viewport non vengono tracciati da undo.

File:

- `frontend/src/components/workflow/WorkflowBuilder.tsx`
- `frontend/src/components/workflow/TopBar.tsx`
- `frontend/src/components/workflow/useWorkflowHistory.ts`

### 8. Parametri Blocco Validati Per Tipo

Problema trovato:

- il backend controllava solo la presenza dei parametri richiesti;
- valori come `channel = fax` o `dueInDays = "seven"` potevano risultare validi;
- il form numerico frontend convertiva stringa vuota in `0`.

Fix:

- validazione backend per `select`, `number`, `text`;
- fallback frontend allineato alle stesse regole;
- input numerici che preservano il valore vuoto come mancante;
- test unitari backend su demo valida, select invalida e number invalido.

File:

- `backend/app/services/validation.py`
- `backend/tests/test_validation.py`
- `frontend/src/lib/workflow/validation.ts`
- `frontend/src/components/workflow/NodeInspector.tsx`

### 9. Errori API Non Piu' Nascosti

Problema trovato:

- il client frontend faceva fallback locale su qualunque errore API;
- errori HTTP reali del backend potevano sembrare semplicemente "API offline".

Fix:

- introdotti errori distinti per network/offline e risposta HTTP;
- fallback locale solo per errori di rete;
- errori HTTP mostrati in UI per load, validate, save e submit;
- validazione remota fallita rappresentata come issue nel pannello Validation.

File:

- `frontend/src/lib/api/client.ts`
- `frontend/src/components/workflow/WorkflowBuilder.tsx`

### 10. Demo Workflow Con Identificatore Stabile

Problema trovato:

- `/api/workflows/demo` cercava il demo workflow tramite nome modificabile;
- rinominando il workflow si rischiavano duplicati al caricamento successivo.

Fix:

- aggiunti costanti demo per id, nome e descrizione;
- ricerca primaria tramite UUID stabile;
- fallback su descrizione demo e nome storico per non rompere DB gia' popolati.

File:

- `backend/app/services/demo.py`
- `backend/app/api/routes.py`

### 11. Persistenza E Versioning Piu' Robusti

Fix:

- `GET /api/workflows/{workflow_id}/submissions` restituisce `404` se il workflow non esiste;
- `PUT /api/workflows/{workflow_id}` permette stringhe vuote esplicite per nome/descrizione invece di ignorarle;
- submit crea una nuova versione anche quando cambia solo il layout;
- aggiunto vincolo unico `(workflow_id, version)` sui nuovi database.

Nota:

- senza Alembic/migrations, il vincolo unico non viene applicato automaticamente a tabelle gia' esistenti.

File:

- `backend/app/api/routes.py`
- `backend/app/models/workflow.py`

### 12. Tooling Frontend E Packaging Backend

Fix:

- sostituito script `next lint` con `eslint .`;
- aggiunta config flat `eslint.config.mjs`;
- rimossa dipendenza inutilizzata `zod`;
- esplicitato package discovery backend su `app*`, evitando che `logs/` blocchi `pip install -e ".[dev]"`.

File:

- `frontend/eslint.config.mjs`
- `frontend/package.json`
- `frontend/package-lock.json`
- `backend/pyproject.toml`

## Setup

### Docker

```bash
docker compose up --build
```

Servizi:

- frontend: `http://localhost:3000`
- backend docs: `http://localhost:8000/docs`
- postgres: `localhost:5432`

### Manuale

Postgres richiesto:

```txt
database: baited_workflows
user: baited
password: baited
```

Backend:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Verifiche Eseguite

Frontend:

```txt
npm run typecheck     OK
npm run lint          OK
npm run build         OK
npm audit --omit=dev  0 vulnerabilities
```

Backend:

```txt
python -m pytest tests       OK, 3 passed
python -m ruff check app tests OK
python -m compileall app tests OK
python -m pip check          OK
```

API:

```txt
GET  /api/health                       OK
GET  /api/workflow-blocks              OK
GET  /api/workflows/demo               OK
POST /api/workflows/{id}/validate      OK
OPTIONS CORS da 127.0.0.1:3000         OK
```

Browser/UI:

```txt
Caricamento workflow demo                 OK
Aggiunta blocco da palette                OK
Selezione rettangolare canvas           OK
Spostamento gruppo nodi selezionati     OK
Cancellazione bulk con Delete           OK
Undo Ctrl+Z / toolbar                   OK
Validazione da UI                       OK
Console browser                         0 errori
```

## Limiti Residui Accettati Per POC

- Non c'e' autenticazione.
- Non c'e' multi-tenancy.
- Non c'e' scheduler.
- Non c'e' motore di esecuzione reale.
- Non vengono inviate email/SMS/IM reali.
- Non c'e' redo.
- Non c'e' conferma prima della cancellazione nodo/edge.
- Il versioning crea ancora una nuova versione su ogni `PUT`, anche se il payload e' identico.
- Non c'e' ancora Alembic: i vincoli aggiunti ai modelli valgono automaticamente sui DB creati da zero, ma non migrano tabelle gia' esistenti.
- Non ci sono ancora test end-to-end browser automatizzati.

## Prossimi Step Consigliati

Prima di una consegna formale:

- aggiungere smoke test API scriptato;
- introdurre Alembic per migrazioni DB;
- valutare test Playwright per i flussi UI principali;
- valutare redo dopo undo;
- evitare versioni duplicate se definition/layout non cambiano;
- preparare screenshot o GIF per la follow-up call.
