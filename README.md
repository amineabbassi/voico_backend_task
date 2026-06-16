# Voico Calls Dashboard

A full-stack interview project built with FastAPI + SQLite on the backend and React + TypeScript on the frontend. It displays a real-time dashboard of phone calls with status tracking.

---

## Architecture

```
voico-test-interview/
  backend/    FastAPI + SQLModel + SQLite + Alembic
  frontend/   React + Vite + TypeScript + Tailwind CSS + TanStack Query
```

---

## Backend

**Stack:** Python 3.12, FastAPI, SQLModel, SQLite (aiosqlite), Alembic

### Setup

```bash
cd backend

# Install dependencies
uv sync

# Copy environment file
cp .env.example .env

# Start the development server
uv run uvicorn app.main:app --reload --port 8000
```

The database (`db.sqlite3`) is included in the repo and already contains 100 sample calls — no migrations or seeding needed to get started.

### Migrations

```bash
# Apply all pending migrations
uv run alembic upgrade head

# Create a new migration (after changing a model)
uv run alembic revision --autogenerate -m "your_message"
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/calls` | List calls (filterable by status, caller name, phone, label, duration; sortable; paginated) |
| `GET` | `/api/calls/{id}` | Get single call |
| `PATCH` | `/api/calls/{id}/notes` | Update notes on a call |
| `POST` | `/api/webhook/call` | Update an existing call with AI enrichment |
| `GET` | `/health` | Health check |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite database path (default: `sqlite+aiosqlite:///./db.sqlite3`) |
| `OPENAI_API_KEY` | OpenAI API key — needed for Task 4 AI enrichment |
| `STALE_CALL_CHECK_INTERVAL_MINUTES` | How often the stale-call expiry job runs (default: `10`) |
| `STALE_CALL_THRESHOLD_MINUTES` | How long a call must be in_progress before it's expired (default: `30`) |

---

## Frontend

**Stack:** React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, axios, lucide-react, date-fns

### Setup

```bash
cd frontend

npm install
npm run dev
```

The UI will be available at `http://localhost:5173`.

### Environment Variables

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `http://localhost:8000` |

---

## Development Notes

- All Python code is fully async (FastAPI + SQLModel async)
- Database interactions use `session.flush()` — commits are handled by the `@session_manager` decorator at the router level
- CORS is open for all origins (demo project)
- No authentication

---

## Interview Tasks — Solutions

---

### Task 1 — Call Notes ✅

**What I built:**

- Added a `notes: Optional[str]` field to the `Call` SQLModel model.
- Created Alembic migration `0002_add_notes_to_calls.py` which adds the nullable `notes` column to the `calls` table.
- Added `UpdateNotesPayload` schema (accepts `{"notes": "..."}`) and `PATCH /api/calls/{id}/notes` endpoint in the router.
- Added `update_notes()` method in `CallService` — finds the call by ID, updates the `notes` field and `updated_at`, persists via the repository.
- Added `notes` to `CallResponse` so it's returned in all call-related responses.

**Frontend:** The call detail drawer now has an inline editable notes section. Clicking the notes area or the pencil icon switches it to a `<textarea>`. Saving calls `PATCH /api/calls/{id}/notes` via TanStack Query mutation, then invalidates the calls query to refresh the table. Cancel restores the original value without an API call.

**Key decision:** I store `null` when notes are cleared (empty string maps to `null`) rather than an empty string, to keep the data consistent with other optional nullable fields on the model.

---

### Task 2 — Advanced Filtering & Search ✅

**What I built:**

**Backend:** Extended `GET /api/calls` with optional query parameters:
- `caller_name` — partial match using `ILIKE %value%`
- `phone_number` — partial match using `ILIKE %value%`
- `label` — exact match
- `min_duration` / `max_duration` — range filter on `duration_seconds`
- `sort_by` — one of `started_at`, `ended_at`, `duration_seconds`, `caller_name`, `phone_number`, `status`, `created_at`
- `sort_order` — `asc` or `desc` (validated via regex pattern in Query)

All filters are optional and combined with `AND`. The `sort_by` parameter is validated against a whitelist dictionary to prevent SQL injection — unknown column names fall back to `created_at`.

**Frontend:** Added a filter panel above the table with inputs for all filter types. Active filters appear as removable chips. Sort controls sit in the tab bar — clicking a column name toggles asc/desc and shows a chevron indicator. All filter and sort state is reflected in the `useQuery` key so any change triggers a fresh API call.

**Key decision:** Status counts in the response always reflect the full dataset (unfiltered by status), so the tab badges remain accurate even when other filters are active.

---

### Task 3 — Stale Call Auto-Expiry ✅

**What I built:**

- `expire_stale_calls(stale_before: datetime)` method on `CallRepository` — selects all `in_progress` calls where `started_at < stale_before`, sets their `status` to `failed`, updates `updated_at`, and flushes in a single session. Returns the count of expired calls.
- `run_stale_call_expiry_loop()` async function in `tasks.py` — runs in an infinite loop, sleeping `STALE_CALL_CHECK_INTERVAL_MINUTES * 60` seconds between runs. Each iteration calls `expire_stale_calls` inside its own async session with an explicit transaction.
- The loop is launched with `asyncio.create_task()` inside the FastAPI `@app.on_event("startup")` handler in `main.py`, so it starts automatically with the server.
- Added `stale_call_check_interval_minutes` and `stale_call_threshold_minutes` to `Settings` in `config.py` with defaults of 10 and 30.
- Added both variables to `.env` and `.env.example` for easy configuration without touching code.

Errors inside the loop are caught and logged — the loop does not crash the server.

---

### Task 4 — Webhook AI Integration ✅

**What I built:**

**Endpoint:** `POST /api/webhook/call` — implemented `process_webhook()` in `CallService`.

**Call update:** Finds the call by `call_id` (404 if not found). Updates `status`, `duration_seconds`, `raw_transcript`, and `ended_at` from the payload (all fields except `call_id` and `status` are only applied if provided in the payload).

**AI enrichment:** If the new status is `success` or `failed` and a `raw_transcript` is present, calls `gpt-4o-mini` with a structured prompt asking for:
- `summary` — a 2-3 sentence summary
- `label` — one of the `CallLabel` enum values

I use `response_format={"type": "json_object"}` to guarantee valid JSON back from the model, then parse and validate the label against the `CallLabel` enum. If the label value is unrecognized, it logs a warning and sets `label` to `None`.

**Error handling:** The entire OpenAI call is wrapped in a try/except. If it fails for any reason (network error, invalid key, rate limit), the error is logged and the function continues — the call is still updated, just without `summary` and `label`.

**Key decision:** I used `response_format={"type": "json_object"}` rather than asking the model to return JSON in plain text and hoping for the best. This eliminates the need to strip markdown code fences and makes parsing reliable.
