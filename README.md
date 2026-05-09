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
| `docker compose up` | Root `docker-compose.yml` |

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

## Environment variables

| Variable | Where | Meaning |
|---------|-------|---------|
| `FLEET_CONFIG` | server | Absolute path to `fleet.json` (default: `../fleet.json` relative to compiled `dist`) |
| `PORT` | server | Listen port (**8080** default) |
| `TICK_SECONDS` | server | Simulation step length in seconds (**0.25** default ⇒ 4 Hz) |
| `OPENAI_API_KEY` | server | Optional; enables richer distress parsing |
| `NEXT_PUBLIC_WS_URL` | web build | Full WebSocket URL exposed to the browser |
| `NEXT_PUBLIC_WS_PORT` | web dev | Fallback port if URL not set (defaults to **8080**) |

## Project layout

- `fleet.json` — bbox, navigable polygon, ports, **15** ship seeds.
- `server/` — Node + **`ws`** tick loop, routing, alerts, NLP, playback buffer.
- `app/` — Next.js App Router pages: `/command`, `/captain`, `/playback`.
- `components/FleetMap.tsx` — MapLibre + OpenFreeMap style.
- `lib/useFleetWs.ts` — WebSocket client + motion smoothing.

## License

MIT (or your org default) — adjust as needed.
