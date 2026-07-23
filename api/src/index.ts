/**
 * Azure Functions v4 entry point.
 *
 * The v4 programming model only registers functions whose module is
 * actually imported here (package.json "main" → dist/src/index.js). A
 * function file in src/functions/ that is not imported below compiles,
 * passes tests, and deploys green while its endpoint 404s in production —
 * this shipped three dead endpoints at once in a sibling project.
 *
 * `src/index.test.ts` guards against this: it asserts every non-test module
 * in src/functions/ is imported below. Add new endpoints by appending an
 * import line, never by editing existing lines.
 */

// Endpoints are imported here as they are added in wishlist #6–#12.
// The registration guard in src/index.test.ts enforces that every non-test
// module in src/functions/ appears below — append-only, never edit existing
// lines (two agents editing the same import block = guaranteed merge conflict).

import './functions/health'
import './functions/rooms'
import './functions/occupancy'
import './functions/readings'
import './functions/reservations'
import './functions/kpis'
import './functions/simulate'
import './functions/sources'
import './functions/presence'
import './functions/friends'
import './functions/reviews'
import './functions/privacy'
