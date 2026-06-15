# Baited Workflow Builder POC

POC fullstack per un editor visuale di workflow orientato a campagne di security awareness/phishing.

## Cosa dimostra

- Workflow builder visuale con canvas, nodi custom, branching, selezione multipla, undo e inspector laterale.
- Persistenza reale su PostgreSQL.
- Catalogo blocchi DB-backed con parametri, output e regole di branching esposti via API.
- Proiezione relazionale di nodi ed edge per ogni versione workflow, oltre al payload JSONB.
- API FastAPI per CRUD, validazione DAG e submit mockato.
- Separazione tra `definition` del workflow e `layout` del canvas.
- Payload JSON leggibile per mostrare cosa verrebbe salvato/eseguito.

## Stack

- Frontend: Next.js, React, TypeScript, React Flow, Tailwind CSS.
- Backend: FastAPI, SQLModel, PostgreSQL.
- Dev environment: Docker Compose.

## Deploy pubblico

- Frontend Vercel: https://baited-workflows.vercel.app/workflows/demo
- Backend Render: https://baited-workflows-backend.onrender.com
- Backend health: https://baited-workflows-backend.onrender.com/api/health
- Repository GitHub: https://github.com/Mieti/Baited-Workflows

Il database del deploy e' un progetto Supabase PostgreSQL collegato al backend tramite Shared Pooler.

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

## Percorso demo consigliato

1. Apri il workflow demo.
2. Sposta un nodo e aggiungi un blocco dalla sidebar.
3. Seleziona piu' nodi con un rettangolo sul canvas e spostali insieme.
4. Usa `Ctrl+Z` o `Undo` per annullare l'ultima modifica.
5. Configura il nodo selezionato dall'inspector laterale.
6. Collega i nodi e osserva le label di branch sugli edge.
7. Clicca `Validate`.
8. Controlla tab `Payload`.
9. Clicca `Save` e poi `Submit mock`.

## Modello dati

Il backend mantiene il payload workflow come snapshot JSONB versionato, ma ora persiste anche:

- definizioni blocchi, parametri, opzioni, output e output rules;
- nodi normalizzati per versione workflow;
- edge normalizzati con `sourceOutput`.

`GET /api/workflow-blocks` legge il catalogo dal database. Il frontend usa quel catalogo per palette, inspector, branch disponibili e serializzazione.

## Scope intenzionale

Il POC non include autenticazione, scheduler, invio reale di email/SMS/IM o un motore di esecuzione. La parte importante e' mostrare una UX solida per costruire, validare e persistere un DAG di automazione.
