import { TableClient, type TableTransaction } from '@azure/data-tables'
import { hash8, invertedTicks } from '@roomsense/shared'
import { generate } from './generate'

/**
 * Uploads a generated dataset to Azure Table Storage.
 * Target comes from TABLES_CONNECTION_STRING; defaults to local Azurite.
 *
 *   pnpm seed:local                          # Azurite (UseDevelopmentStorage=true)
 *   TABLES_CONNECTION_STRING=... pnpm seed:azure
 */
const CONN = process.env.TABLES_CONNECTION_STRING ?? 'UseDevelopmentStorage=true'
const SEED = Number(process.env.SEED ?? 42)
const DAYS = Number(process.env.DAYS ?? 30)

type Entity = Record<string, unknown> & { partitionKey: string; rowKey: string }

async function upsertAll(tableName: string, entities: Entity[]): Promise<number> {
  const client = TableClient.fromConnectionString(CONN, tableName, {
    allowInsecureConnection: CONN.includes('UseDevelopmentStorage') || CONN.includes('127.0.0.1'),
  })
  await client.createTable()

  const byPartition = new Map<string, Entity[]>()
  for (const e of entities) {
    const list = byPartition.get(e.partitionKey) ?? []
    list.push(e)
    byPartition.set(e.partitionKey, list)
  }

  for (const list of byPartition.values()) {
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100)
      const tx: TableTransaction = { actions: chunk.map((e) => ['upsert', e]) } as TableTransaction
      await client.submitTransaction(tx.actions)
    }
  }
  return entities.length
}

async function main(): Promise<void> {
  console.log(`Generating seed=${SEED} days=${DAYS} → ${CONN.slice(0, 40)}...`)
  const data = generate({ seed: SEED, days: DAYS })

  const rooms: Entity[] = data.rooms.map((r) => ({
    partitionKey: r.building,
    rowKey: r.roomId,
    ...r,
  }))

  const readings: Entity[] = data.readings.map((r) => ({
    partitionKey: r.deviceId,
    rowKey: invertedTicks(Date.parse(r.ts)),
    ...r,
  }))

  const snapshots: Entity[] = data.snapshots.map((s) => ({
    partitionKey: s.roomId,
    rowKey: invertedTicks(Date.parse(s.ts)),
    ...s,
  }))

  // `ghost` is seed-internal ground truth — deliberately NOT uploaded.
  // Ghostness must be derived from data, same as production would.
  const reservations: Entity[] = data.reservations.map(({ ghost: _ghost, ...r }) => ({
    partitionKey: r.roomId,
    rowKey: `${Date.parse(r.startTs)}_${hash8(r.organizer + r.subject)}`,
    ...r,
  }))

  const sources: Entity[] = data.sources.map((s) => ({
    partitionKey: 'source',
    rowKey: s.sourceId,
    ...s,
  }))

  const counts = {
    Rooms: await upsertAll('Rooms', rooms),
    SensorReadings: await upsertAll('SensorReadings', readings),
    OccupancySnapshots: await upsertAll('OccupancySnapshots', snapshots),
    Reservations: await upsertAll('Reservations', reservations),
    Sources: await upsertAll('Sources', sources),
  }
  console.table(counts)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
