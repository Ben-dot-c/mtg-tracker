# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
API docs auto-generated at `http://localhost:8000/docs`.

### Frontend
```bash
cd frontend
npm install        # first time
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → frontend/dist/
```

### Local development note
`frontend/src/api.js` has `BASE` hardcoded to the Azure production backend. Uncomment the `localhost:8000` line and comment out the Azure URL when developing locally.

### Bulk import
`backend/import_csv.py` imports game history from a TSV (columns: Player, Deck, Date Played, Won, Game Number). It talks directly to the API, not the database.
```bash
python backend/import_csv.py <path_to_tsv> <admin_key>
```
TSV date format is `DD/MM/YYYY`. Games with 0 or 2+ winners are imported as draws.

## Architecture

**Stack:** React 18 + Vite frontend, FastAPI backend, SQLite (local) / PostgreSQL (Azure prod), deployed to Azure Static Web Apps + App Service.

### Frontend → Backend communication
All API calls go through `frontend/src/api.js`, which exports typed functions for every endpoint. Public endpoints (read-only stats/data) need no auth. Admin endpoints require an `x-admin-key` header.

### Authentication model
- **Master key** (`MASTER_KEY` env var, default `"mtg-admin"`): full access including key management, logs, and destructive operations. The master's display name is hardcoded as `MASTER_NAME = "Ben"` in `main.py`.
- **Secondary admin keys** (stored in `admin_keys.json`, managed via `/admin/keys/*`): can log games and import/delete specific records, but cannot access logs or manage keys
- Key is passed as `x-admin-key` request header; logged to `admin_logs` table with IP on each admin action
- Endpoints use `Depends(get_admin_user)` for any admin, or `Depends(require_master)` for master-only operations

### Database
`backend/database.py` auto-selects SQLite vs PostgreSQL based on presence of `DB_HOST` env var. Models in `backend/models.py`: `Player`, `Deck`, `Game`, `GameResult`, `AdminLog`. A game has multiple `GameResult` rows (one per deck), with exactly one `won=True` unless it's a draw.

### Key backend logic (`backend/main.py`)
- All business logic and endpoints are in a single file
- Leaderboard stats (win rates, streaks, best decks, head-to-head matrix) are computed at query time from raw `game_results` joins
- CORS is configured for the Azure frontend URL and `localhost:5173`

### Frontend structure
- `App.jsx` handles top-level page switching (Leaderboard, Decks, Game Log, Admin)
- `components/DeckStats.jsx` — per-deck win rates and matchup charts (uses Recharts)
- `components/Leaderboard.jsx` — player rankings with head-to-head matrix
- `components/AdminPanel.jsx` — master key features: import, delete, key management, audit logs
