# Baited Workflow Builder POC

POC fullstack per un editor visuale di workflow orientato a campagne di security awareness/phishing.

## Cosa dimostra

- Workflow builder visuale con canvas, nodi custom, branching, selezione multipla, undo e inspector laterale.
- Persistenza reale su PostgreSQL.
- Catalogo blocchi DB-backed con parametri, output e regole di branching esposti via API.
- API FastAPI per CRUD, validazione DAG e submit dimostrativo.
- Reset esplicito del workflow demo originale tramite API backend.
- Separazione tra `definition` del workflow e `layout` del canvas.
- Payload workflow strutturato e versionato per mostrare cosa verrebbe salvato/eseguito.

## Stack

- Frontend: Next.js, React, TypeScript, React Flow, Tailwind CSS.
- Backend: FastAPI, SQLModel, PostgreSQL.
- Dev environment: Docker Compose.

## Deploy pubblico

- Frontend Vercel: https://baited-workflows.vercel.app/workflows/demo
- Backend Render: https://baited-workflows-backend.onrender.com
- Backend health: https://baited-workflows-backend.onrender.com/api/health
- Repository GitHub: https://github.com/Mieti/Baited-Workflows

Il database del deploy e' un progetto Supabase PostgreSQL collegato al backend tramite Shared Pooler. Il backend delega a quel pooler la gestione del pooling e non mantiene un `QueuePool` SQLAlchemy locale.

Il frontend Vercel e' collegato direttamente a GitHub. Le chiamate browser usano endpoint same-origin `/api/*`; una rewrite Vercel configurata in `next.config.mjs` inoltra le richieste al backend Render usando `API_PROXY_URL`. Il backend Render viene ridistribuito automaticamente da una GitHub Action che chiama il deploy hook Render quando cambia `main` nella cartella `backend/`.

Usare sempre il dominio stabile `https://baited-workflows.vercel.app/workflows/demo`. Gli URL Vercel specifici del singolo deployment sono snapshot immutabili e possono contenere variabili build-time non aggiornate.

## Avvio con Docker

```bash
docker compose up --build
```

Poi apri:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs

## Avvio manuale

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload
```

Per l'avvio manuale serve un Postgres locale con:

```txt
database: baited_workflows
user: baited
password: baited
```

Variabili utili:

```env
DATABASE_URL=postgresql+psycopg://baited:baited@localhost:5432/baited_workflows
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CORS_ORIGIN_REGEX=
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Verifiche rapide

Frontend:

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
```

Backend:

```bash
cd backend
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest tests
.\.venv\Scripts\python.exe -m ruff check app tests
```

Smoke API locale:

```powershell
.\scripts\smoke-api.ps1
```

Smoke API produzione:

```powershell
.\scripts\smoke-api.ps1 -ApiUrl https://baited-workflows.vercel.app -FrontendOrigin https://baited-workflows.vercel.app
```

Smoke API produzione con submit mockato:

```powershell
.\scripts\smoke-api.ps1 -ApiUrl https://baited-workflows.vercel.app -FrontendOrigin https://baited-workflows.vercel.app -IncludeSubmit
```

## Percorso demo consigliato

1. Apri il workflow demo.
2. Sposta un nodo e aggiungi un blocco dalla sidebar.
3. Seleziona piu' nodi con un rettangolo sul canvas e spostali insieme.
4. Usa `Ctrl+Z` o `Undo` per annullare l'ultima modifica.
5. Configura il nodo selezionato dall'inspector laterale.
6. Collega i nodi e osserva le label di branch sugli edge.
7. Clicca `Validate`.
8. Clicca `Save` e poi `Submit`.
9. Controlla la tab `Activity`.
10. Usa `Reset demo` per ripristinare il workflow demo originale.

## Modello dati

Il backend mantiene il payload workflow come snapshot JSONB versionato e persiste il catalogo blocchi in tabelle dedicate:

- definizioni blocchi, parametri, opzioni, output e output rules;
- workflow metadata, versioni e submission mockate.

`GET /api/workflow-blocks` legge il catalogo dal database. In produzione il browser chiama `/api/workflow-blocks` sul dominio Vercel, poi la rewrite Vercel inoltra al backend Render. Il frontend usa quel catalogo per palette, inspector, branch disponibili e serializzazione.

Il frontend non contiene fallback runtime per catalogo, demo workflow o validazione: FastAPI e' la fonte di verita'. Se il backend non e' raggiungibile, la UI mostra un errore esplicito e blocca le azioni sul workflow.

## Scope intenzionale

Il POC non include autenticazione, scheduler, invio reale di email/SMS/IM o un motore di esecuzione. La parte importante e' mostrare una UX solida per costruire, validare e persistere un DAG di automazione.
