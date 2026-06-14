# 🐉 Dragodinde Notif

Dofus dragodinde breeding tracker that sends a Discord notification when the
stats you're focusing reach their goal. See the
[breeder's guide](https://www.dofuspourlesnoobs.com/guide-de-l-eleveur.html).

**Stack:** TypeScript + [Effect](https://effect.website) (HTTP `@effect/platform`,
storage `@effect/sql` + SQLite) for the backend, **React + TypeScript (Vite)** for
the frontend.

## How it works

- 1–6 **enclosures**, each with shared **fuel bars** (0–100,000):
  Serenity − / Serenity + / Endurance / Maturity / Love.
- Each enclosure holds up to **10 dragodindes**. A dragodinde has 4 stats:
  Endurance / Maturity / Love (goal **20,000**) and Serenity (**−5,000…+5,000**,
  goal = inside the **[−200, +200]** band).
- Every **10 s** each fuel bar drains by a rate based on its level, feeding the
  matching stat of every dragodinde by the same amount:
  - `> 90,000` → ±40 / tick
  - `> 70,000` → ±30 / tick
  - `> 40,000` → ±20 / tick
  - `> 0` → ±10 / tick
- **Focus**: check up to **2 bars** per enclosure (rolling — checking a 3rd
  unchecks the oldest). Only checked bars tick and grant XP; Serenity + raises
  serenity, Serenity − lowers it. A bar auto-unchecks once **every** dragodinde
  has reached its goal.
- **Notification**: per dragodinde, when all the enclosure's checked bars have
  reached their goal *for that dragodinde*. It fires only on the transition
  (never when already satisfied), and dragodindes that finish in the same tick
  are grouped into one Discord message.
- Each active bar shows two ETAs: time until the fuel drops to the next step, and
  time until the bar maxes out (every dragodinde done).

The server advances the simulation continuously (an Effect fiber, tick every
10 s) even with the window closed. State is persisted to SQLite (`data.db`).

## Requirements

Node 18 (works) or Node 20+/22 (recommended — `nvm use 22`). On Node 18 the
backend uses a small `File` polyfill and the frontend is pinned to Vite 5.
Docker is the easiest deploy path (see below).

## Install & run

```bash
# backend
npm install

# frontend (build once for production)
npm run build          # = npm --prefix web install && build  -> web/dist

npm start              # http://localhost:3000 (serves the React app + the API)
```

### Development (frontend hot reload)

Two terminals:

```bash
npm run dev            # Effect backend in watch mode (port 3000)
npm run web:dev        # Vite on http://localhost:5173, proxies /api -> :3000
```

Open **http://localhost:5173**.

### Production build (without Docker)

```bash
npm run build:server   # compile src/ -> dist/ (plain JS, no tsx in prod)
npm run build          # bundle the frontend -> web/dist
npm run start:prod     # node dist/main.js
```

## Docker / deployment

The easiest path. Requires Docker (Desktop running).

```bash
cp .env.example .env          # set DISCORD_WEBHOOK_URL (or leave empty, set it from the UI)
docker compose up --build -d  # build the multi-stage image + start
```

Open **http://localhost:3000** (or `http://localhost:$HOST_PORT` if you change the host port).

- SQLite data lives in the named volume **`dragodinde-data`** (mounted at `/data`) and
  survives `docker compose down`. **`docker compose down -v` DELETES the data.**
- Under Docker, `DATABASE_FILE` is fixed to `/data/data.db` and the container always
  listens on `3000`; only **`HOST_PORT`** changes the host-side port. The container runs
  **non-root**, with a **read-only** root filesystem (only `/data` is writable),
  `cap_drop: ALL`, and `no-new-privileges`.
- The image compiles the server to JS (`node dist/main.js`, no tsx) and serves the built
  frontend. Node 20 base (`better-sqlite3`'s native binaries are prebuilt for glibc — stay
  on `bookworm`, not alpine).

Logs / stop:

```bash
docker compose logs -f
docker compose down            # keeps the data
```

> Using a bind mount instead of the named volume? Pre-create the dir owned by `10001:10001`
> (`mkdir -p data && sudo chown 10001:10001 data`) or the non-root app can't write the DB.

## Discord webhook

Discord channel → **Settings → Integrations → Webhooks → New Webhook → Copy URL**,
then paste the URL via the **⚙︎ Discord** button (the "Test" button verifies it).
Or set `DISCORD_WEBHOOK_URL` in the environment (the URL set in the UI takes priority).

## Settings (env)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port (container fixed to 3000 under Docker) |
| `HOST_PORT` | `3000` | Docker only — host-side port mapped to 3000 |
| `DATABASE_FILE` | `data.db` | SQLite file (fixed to `/data/data.db` under Docker) |
| `TICK_MS` | `10000` | Tick interval (set `1000` for fast testing) |
| `DISCORD_WEBHOOK_URL` | — | Default webhook (overridden by the one set in the UI) |
| `APP_VERSION` | `0.2.0` | Docker only — image tag |

## Tests

```bash
npm test               # vitest: simulation logic + in-memory SQLite repo
npm run typecheck      # tsc (backend)
```

## Structure

```
src/                 Effect backend
  domain.ts          pure logic (bands, tick, completion, auto-uncheck) — tested
  Database.ts        SqliteClient layer
  Repo.ts            Effect service: enclosure/dragodinde CRUD + tick + settings (SQLite)
  Discord.ts         Effect service: Discord webhook
  Ticker.ts          background fiber (tick every TICK_MS)
  Http.ts            HTTP routes + static file serving (web/dist)
  main.ts            layer composition + launch
web/                 React + TS frontend (Vite)
  src/App.tsx        state, polling, split panes
  src/components/    enclosure pane (fuel bars + ETAs), dragodinde pane, webhook dialog
test/                vitest
```

## Usage

1. Enter each fuel bar's value (field under the bar) to match your game.
2. If needed, adjust a dragodinde's current stats (click the value, or use the
   quick buttons: 0 / 20k for stats, −1 / +1 for serenity).
3. Check up to 2 bars to focus.
4. Let it run — you get a Discord ping as each dragodinde reaches the focused goals.
