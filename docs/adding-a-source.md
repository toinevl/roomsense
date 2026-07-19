# Adding a source adapter

RoomSense is built around an **adapter seam**: every data source (sensor,
calendar, real third-party API) implements the same `SourceAdapter`
contract. The API layer reads from adapters, never from storage directly.
Adding a source = drop a file in `api/src/sources/` and register it.
No endpoint edits, no frontend changes.

## The contract

`api/src/sources/types.ts`:

```ts
export interface SourceAdapter {
  readonly sourceId: string           // matches Source.sourceId in storage
  readonly kind: 'sensor' | 'calendar'
  readonly displayName: string

  /** Cheap liveness probe — must not throw. */
  ping(): Promise<PingResult>

  /** Calendar sources implement this. Sensor sources omit it. */
  listReservations?(window: ReservationWindow): AsyncIterable<Reservation>
}
```

Two existing examples:

| Adapter | File | Source ID | Kind |
|---|---|---|---|
| Outlook mock (reads `Reservations` table) | `api/src/sources/outlook-mock.ts` | `outlook-mock` | calendar |
| Future: real Microsoft Graph | `api/src/sources/graph.ts` (#27) | `outlook-graph` | calendar |
| Future: real IoT Hub ingestion | `api/src/sources/iothub.ts` (#28) | `terabee-iothub` | sensor |

## Adding a new source — 4 steps

### 1. Implement the adapter

Create `api/src/sources/<your-source>.ts`. At minimum, implement
`sourceId`, `kind`, `displayName`, and `ping()`. If the source produces
reservations, also implement `listReservations(window)`.

`ping()` must never throw — catch storage/network errors and return
`{ status: 'inactive' }`. The `/api/sources` endpoint awaits `ping()` on
every registered adapter per request, and one throwing adapter would 500
the whole endpoint.

`listReservations(window)` is an async generator that yields
`Reservation` objects whose `[startTs, endTs)` overlaps the window
`[from, to)` (half-open). Use the overlap predicate from
`outlook-mock.ts` — don't reinvent it.

### 2. Test it

`api/src/sources/<your-source>.test.ts`. Mock the storage/network
layer (vi.mock). Cover: sourceId/kind/displayName shape, ping success
with lastSyncTs, ping failure returning `inactive`, listReservations
overlap filtering, listReservations stripping storage metadata.

The standing test convention: fixtures must include non-ASCII content
(real names like `Jörgen Månsson`, `Anaïs Dubois`), not ASCII
placeholders.

### 3. Register it

`api/src/sources/registry.ts` — import your adapter and call
`registerSourceAdapter(yourAdapter)` at module load (bottom of file):

```ts
import { yourAdapter } from './your-source'
registerSourceAdapter(yourAdapter)
```

The registry is idempotent on `sourceId` — re-registering the same id
replaces, not duplicates. No other file in the API needs to change.

### 4. Verify

```bash
pnpm --filter @roomsense/api test
pnpm --filter @roomsense/api typecheck
pnpm --filter @roomsense/api build    # bundles with esbuild
```

The registration guard in `api/src/index.test.ts` only enforces function
imports, not adapter imports — the registry is what makes a source live.

Once deployed, `GET /api/sources` will list your new adapter alongside
the others, with a freshly-computed `ping()` result.

## Design notes

- **No storage writes from adapters.** Adapters read; ingestion jobs (not
  built yet) will write. This keeps `ping()` side-effect-free.
- **Source IDs are immutable.** Storage rows reference `sourceId` via
  `Source.sourceId` and every `Reservation.sourceId` /
  `SensorReading.sourceId`. Renaming an adapter's `sourceId` orphans
  those rows — don't.
- **AsyncIterable for listReservations** so large sources can stream
  without buffering. Collect with `for await (...)`, not
  `Array.from(...)`.
- **`/api/sources` sorts by sourceId** for deterministic dashboard
  rendering. Don't rely on registration order in client code.
