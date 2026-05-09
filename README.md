# Strait of Hormuz fleet command (Code Rush baseline)

End-to-end demo: **15 ships** simulated on the server (**≥4 Hz** ticks by default), synchronized to browsers over **WebSockets** (no polling). Two UIs — **Command** (zones, directives, fleet view) and **Captain** (scoped ship, ACCEPT / ESCALATE_DISTRESS) — plus **playback** of a ring buffer of snapshots (~**30 s** cadence, **~1 hour** window).

## Run the whole system (Docker)

Requirements: **Docker** with Compose v2.

1. Copy environment template and fill in values (see [Environment variables](#environment-variables)):

   ```bash
   cp .env.example .env
   # Edit .env — at minimum set Supabase keys if you use auth/persistence
   ```

2. Apply the database schema (optional but recommended): Supabase SQL Editor → paste `server/supabase-schema.sql` → run.

3. Start **simulator** + **web**:

   ```bash
   docker compose up --build
   ```

4. Open **UI**: [http://localhost:3000](http://localhost:3000)  
   **Simulator health**: [http://localhost:8080/health](http://localhost:8080/health)  
   The browser connects to the simulator at **`ws://localhost:8080`** (see `NEXT_PUBLIC_WS_URL`). Port **8080** must match your Compose port mapping.

**Assumption (Docker):** You run the stack on one machine; the SPA uses `localhost` for both the Next app (3000) and the WebSocket server (8080). If you deploy behind another hostname, set `NEXT_PUBLIC_WS_URL` (and rebuild the `web` image) to match.

---

## Requirements coverage (assumptions documented)

| Requirement | How it is met |
|---------------|----------------|
| 15 ships | `fleet.json` |
| ≥1 Hz updates, push to clients | Default `TICK_SECONDS=0.25` (4 Hz); client interpolates between samples |
| ≤500 ms propagation (typical on LAN) | Small JSON state per tick; tune load if needed |
| Geofence alerts ~1 s | Segment / point-in-polygon checks every tick |
| Proximity &lt; **2 km** | Pairwise Haversine each tick |
| **+30%** fuel in adverse weather | Server applies multiplier when Open-Meteo current wind crosses thresholds (see below) |
| ≥5 viewers | In-memory fan-out; horizontal scale not in scope for the laptop demo |
| Smooth motion | Client caps step by reported speed (no arbitrary jumps; large server corrections snap) |
| Routing in navigable polygon, avoid runtime zones | Grid **A\*** on a coarse degree grid with weather-biased edge cost |
| Roles | `auth` message: `command` vs `captain` + `shipId` |
| Distress NLP | Heuristic parser by default; **`OPENAI_API_KEY`** enables `gpt-4o-mini` JSON extraction |
| Weather source | **Open-Meteo** (no API key) — see thresholds below |
| Playback | `playback.request` → last snapshots; UI at `/playback` |
| Supabase backend | Optional persistence for ships/history/alerts/directives/zones/distress logs |
| `docker compose up` | Root `docker-compose.yml` + `Dockerfile` + `server/Dockerfile` |

### Grading proof map (where to demo each metric)

- `Exactly 15 active ships`: `fleet.json` has 15 ship seeds and server health returns live count (`/health` -> `ships`).
- `>=1 Hz updates`: `server/src/index.ts` runs tick broadcast at `TICK_SECONDS` (`0.25` default = 4 Hz); `/health` exposes `metrics.tickHz`.
- `State fan-out within 500ms (p95 target)`: `/health` exposes `metrics.stateFanoutLagP95Ms` and `metrics.fanoutSendP95Ms` from rolling broadcast samples.
- `Geofence breach <=1s`: `server/src/sim.ts` checks zone containment/crossing every tick and raises `geofence_breach`.
- `Proximity warnings at 2 km`: `server/src/sim.ts` pairwise distance check uses `d < 2`.
- `Weather fuel penalty +30%`: `server/src/sim.ts` applies `factor = 1.3` when `weatherAdverse` is true.
- `At least 5 watchers in sync`: `server/src/index.ts` broadcasts a shared authoritative state to all connected WebSocket clients; `/health` exposes `metrics.connectedClients`.
- `Smooth movement without teleporting`: `lib/useFleetWs.ts` interpolates movement with speed-clamped `moveToward` and only snaps on large correction.
- `Routing in navigable water and avoid zones`: `server/src/routing.ts` A* over navigable polygon with zone exclusion.
- `Reroute on new zone intersecting route`: `server/src/sim.ts` (`addZone` + `pathCrossesZone` + `assignRouteFromPosition`).
- `Directive ACCEPT reroute on next tick`: `server/src/sim.ts` (`respondDirective`) applies destination/waypoint and recomputes route.
- `No-path -> stranded alert`: `server/src/sim.ts` (`assignRouteFromPosition`) marks `stranded` and raises alert.
- `Ship already inside new zone`: `server/src/sim.ts` (`addZone`) raises geofence alert immediately and reroutes.
- `Insufficient fuel projection`: `server/src/sim.ts` (`updateFuelProjection`) sets `insufficient_fuel` and raises alert.
- `Playback last hour (~30s resolution)`: `server/src/sim.ts` ring buffer + persistence (`ship_history`), consumed by `/playback`.

### Assumptions (judges: documented = honored)

- **Adverse weather**: sustained **wind ≥ 12 m/s** or **gust ≥ 18 m/s** at ship position (Open-Meteo `current` fields), per ~0.02° cache tile.
- **“Within 1 s” geofence**: satisfied at 4 Hz ticks; sub-tick crossing is not interpolated (could micro-step for stricter grading).
- **Playback**: ring buffer stores ~**120** samples (~30 s apart) — not arbitrary full-state replay.
- **Captain / Command trust**: no login; `auth` is role selection for the demo.
- **Arrived**: implicit when within **~0.85 km** of destination port coordinates (config / tuning point).

## Quick start (development, no Docker)

1. **Simulator** (terminal A), from repo root:

   ```bash
   cd server
   npm install
   npm run dev
   ```

   Loads `../fleet.json` unless `FLEET_CONFIG` is set.

2. **Web UI** (terminal B):

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

   Browser WebSocket defaults to **`ws://<host>:8080`**. Override with:

   ```bash
   set NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8080   # PowerShell/cmd example
   ```

   Or use `npm run dev:all` from the root to run both processes.

## Environment variables

Docker Compose reads a **`.env`** file in the project root for variable substitution (standard Compose behavior). Copy **`.env.example`** → **`.env`** and edit.

### Simulator (`server` container)

| Variable | Required | Meaning |
|----------|----------|---------|
| `PORT` | No | HTTP + WS listen port; default **8080** (mapped in `docker-compose.yml`) |
| `FLEET_CONFIG` | No | Path inside the container to `fleet.json`; Compose sets **`/data/fleet.json`** with a volume mount |
| `TICK_SECONDS` | No | Simulation step in seconds; default **0.25** (4 Hz). Compose passes `${TICK_SECONDS:-0.25}` |
| `OPENAI_API_KEY` | No | Enables OpenAI-based distress parsing (`server/src/nlp.ts`); heuristic works without it |
| `SUPABASE_URL` | No* | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | No* | Preferred server key for upserts |
| `SUPABASE_ANON_KEY` | No* | Fallback if service role not set |
| `SUPABASE_PUBLISHABLE_KEY` | No* | Another fallback accepted by the server client |

\*Optional for a minimal WS-only demo; **required** for persistence and features that write to Supabase.

### Web / Next.js (`web` container)

| Variable | Required | Where used |
|----------|----------|------------|
| `NEXT_PUBLIC_WS_URL` | Recommended | Browser WebSocket URL to the simulator; default **`ws://localhost:8080`** in Compose (baked at **build** time) |
| `NEXT_PUBLIC_WS_PORT` | No | Fallback port in `lib/useFleetWs.ts` if URL not set (**8080**) |
| `NEXT_PUBLIC_SUPABASE_URL` | No* | Client-side Supabase (login, REST) — **build** time |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No* | Publishable/anon key for browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No* | Optional extra fallback in `app/lib/supabaseBrowser.ts` |
| `SUPABASE_URL` | No* | **Runtime** — API routes / server Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | No* | **Runtime** — API routes (prefer service role for server) |
| `SUPABASE_ANON_KEY` | No* | **Runtime** fallback |
| `SUPABASE_PUBLISHABLE_KEY` | No* | **Runtime** fallback |

\*Omit for a read-only map demo; set for auth, chat history API, and server routes that call Supabase.

### API keys not in `.env`

- **Open-Meteo** (weather grid): no key; public API.
- **Map basemap** (OpenFreeMap / MapLibre): no app key in this baseline.
- **Hugging Face** (Seung AI chat on the home page): token and model are loaded from Supabase table **`api_integrations`** (`provider = 'huggingface'`) when configured, not from flat env vars.

Tip for judges: open `http://localhost:8080/health` while the stack runs to show live tick rate, fan-out latency, and connected WebSocket clients.

## Supabase setup (recommended for judging / persistence)

1. Create a project and run **`server/supabase-schema.sql`** in the SQL Editor.
2. Set `.env` as in the table above.
3. `docker compose up --build` (or local `npm run dev` for each service).

When Supabase is configured, the simulator can persist: live `ships`, `ship_history`, `alerts`, `directives`, `zones`, `distress_logs` (see server code).

Example login seeds (after you load users in Supabase per your schema):

- Command: `command@fleet.local` / `command123`
- Captain: `captain@fleet.local` / `captain123`

## Project layout

- `fleet.json` — bbox, navigable polygon, ports, **15** ship seeds.
- `server/` — Node + **`ws`** tick loop, routing, alerts, NLP, playback buffer.
- `docker-compose.yml` — simulator + web; `fleet.json` mounted read-only into the simulator.
- `app/` — Next.js App Router pages: `/command`, `/captain`, `/playback`.
- `components/FleetMap.tsx` — MapLibre + OpenFreeMap style.
- `lib/useFleetWs.ts` — WebSocket client + motion smoothing.

## License

MIT (or your org default) — adjust as needed.
