/**
 * Social tables seeder for Phase 2 (#37).
 *
 * Uploads friend links, room reviews, presence, and privacy settings to
 * the 4 new Azure Table Storage tables. Follows the same pattern as upload.ts.
 *
 *   TABLES_CONNECTION_STRING=... pnpm seed:social
 *   pnpm seed:social:local   # Azurite
 */

import { TableClient, type TableTransaction } from '@azure/data-tables'
import { generateSocialSeed } from './social-fixtures'

const CONN = process.env.TABLES_CONNECTION_STRING ?? 'UseDevelopmentStorage=true'

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

export type { Entity }

async function main(): Promise<void> {
  console.log(`Seeding social tables → ${CONN.slice(0, 40)}...`)
  const data = generateSocialSeed()

  const counts = {
    UserPresence: await upsertAll('UserPresence', data.presence as Entity[]),
    FriendLinks: await upsertAll('FriendLinks', data.friends as Entity[]),
    RoomReviews: await upsertAll('RoomReviews', data.reviews as Entity[]),
    UserPrivacy: await upsertAll('UserPrivacy', data.privacy as Entity[]),
  }
  console.table(counts)
  console.log('Social seed complete!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
