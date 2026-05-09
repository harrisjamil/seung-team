# Strait of Hormuz fleet command (Code Rush baseline)

End-to-end demo: **15 ships** simulated on the server (**≥4 Hz** ticks by default), synchronized to browsers over **WebSockets** (no polling). Two UIs — **Command** (zones, directives, fleet view) and **Captain** (scoped ship, ACCEPT / ESCALATE_DISTRESS) — plus **playback** of a ring buffer of snapshots (~**30 s** cadence, **~1 hour** window).

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
| `docker compose up` | Root `docker-compose.yml` |

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

## Quick start (development)

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

## Docker

From this directory (`seung/` where `docker-compose.yml` lives):

```bash
docker compose up --build
```

- UI: [http://localhost:3000](http://localhost:3000)
- Simulator HTTP health: [http://localhost:8080/health](http://localhost:8080/health)

The Compose file sets **`NEXT_PUBLIC_WS_URL=ws://localhost:8080`** for browsers on the host.

### Supabase setup (recommended for judging / persistence)

1. Open Supabase SQL Editor and run `server/supabase-schema.sql`.
2. Copy `.env.example` to `.env` and set values:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
# Optional fallbacks if service key unavailable:
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

3. Start stack:

```bash
docker compose up --build
```

When Supabase env vars are configured, simulator persists:
- live `ships` state (upsert each tick),
- `ship_history` snapshots (~30s),
- `alerts`,
- `directives`,
- `zones`,
- `distress_logs`.

Login seeds (main page autofill buttons):
- Command: `command@fleet.local` / `command123`
- Captain: `captain@fleet.local` / `captain123`

## Environment variables

| Variable | Where | Meaning |
|---------|-------|---------|
| `FLEET_CONFIG` | server | Absolute path to `fleet.json` (default: `../fleet.json` relative to compiled `dist`) |
| `PORT` | server | Listen port (**8080** default) |
| `TICK_SECONDS` | server | Simulation step length in seconds (**0.25** default ⇒ 4 Hz) |
| `OPENAI_API_KEY` | server | Optional; enables richer distress parsing |
| `SUPABASE_URL` | server | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Preferred key for backend writes |
| `SUPABASE_ANON_KEY` | server | Optional fallback key |
| `SUPABASE_PUBLISHABLE_KEY` | server | Optional fallback key |
| `NEXT_PUBLIC_WS_URL` | web build | Full WebSocket URL exposed to the browser |
| `NEXT_PUBLIC_WS_PORT` | web dev | Fallback port if URL not set (defaults to **8080**) |

Tip for judges: open `http://localhost:8080/health` during the run to show live tick/fan-out metrics and connected client count.

## Project layout

- `fleet.json` — bbox, navigable polygon, ports, **15** ship seeds.
- `server/` — Node + **`ws`** tick loop, routing, alerts, NLP, playback buffer.
- `app/` — Next.js App Router pages: `/command`, `/captain`, `/playback`.
- `components/FleetMap.tsx` — MapLibre + OpenFreeMap style.
- `lib/useFleetWs.ts` — WebSocket client + motion smoothing.

## License

MIT (or your org default) — adjust as needed.
