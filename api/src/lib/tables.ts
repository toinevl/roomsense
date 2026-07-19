import { TableClient } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'

/**
 * Table Storage client factory.
 *
 * Mirrors the dual-mode pattern from nordicHolidays/goGo: connection string
 * for local dev + Azurite, managed identity for Azure. The env var name
 * `TABLES_CONNECTION_STRING` matches `packages/seed/src/upload.ts` so the
 * same local.settings.json / App Setting works for both seeding and serving.
 *
 * Production preference is managed identity (no secret in the connection
 * string). The factory prefers TABLES_ENDPOINT (managed identity) when set,
 * and falls back to TABLES_CONNECTION_STRING. STORAGE_CONNECTION_STRING is
 * accepted as a legacy alias for cross-app consistency.
 */

export const TABLE_NAMES = {
  rooms: 'Rooms',
  readings: 'SensorReadings',
  snapshots: 'OccupancySnapshots',
  reservations: 'Reservations',
  sources: 'Sources',
} as const

let credentialInstance: DefaultAzureCredential | null = null

function getCredential(): DefaultAzureCredential {
  if (!credentialInstance) {
    credentialInstance = new DefaultAzureCredential()
  }
  return credentialInstance
}

export function getTableClient(tableName: string): TableClient {
  const endpoint = process.env.TABLES_ENDPOINT
  const conn =
    process.env.TABLES_CONNECTION_STRING ?? process.env.STORAGE_CONNECTION_STRING

  // Managed identity path — preferred in Azure.
  if (endpoint) {
    return new TableClient(endpoint, tableName, getCredential())
  }

  // Connection string path — local dev (Azurite) or legacy Azure apps.
  if (conn) {
    return TableClient.fromConnectionString(conn, tableName, {
      allowInsecureConnection:
        conn.startsWith('DefaultEndpointsProtocol=http;') ||
        conn.includes('UseDevelopmentStorage') ||
        conn.includes('127.0.0.1'),
    })
  }

  throw new Error(
    'Table Storage auth failed: set TABLES_ENDPOINT (managed identity) or ' +
      'TABLES_CONNECTION_STRING (local dev / legacy) before serving requests.',
  )
}

/**
 * Create the table if it does not yet exist. Safe to call repeatedly —
 * ignores the 409 / TableAlreadyExists response. Used by the simulator
 * write path, which may run before the seeder on a fresh environment.
 */
export async function ensureTable(tableName: string): Promise<TableClient> {
  const client = getTableClient(tableName)
  try {
    await client.createTable()
  } catch (err: unknown) {
    const e = err as { statusCode?: number; code?: string }
    if (e?.statusCode !== 409 && e?.code !== 'TableAlreadyExists') throw err
  }
  return client
}
