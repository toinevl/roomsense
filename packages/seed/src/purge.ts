import { TableClient } from '@azure/data-tables'

const CONN = process.env.TABLES_CONNECTION_STRING
if (!CONN) {
  console.error('TABLES_CONNECTION_STRING must be set')
  process.exit(1)
}

const OLD_ROOMS = [
  'atlas-2-210', 'atlas-2-215', 'atlas-4-410', 'atlas-4-420', 'atlas-5-501',
  'flux-1-101', 'flux-1-105', 'flux-2-201', 'flux-2-207', 'flux-3-301',
  'neuron-1-110', 'neuron-1-115', 'neuron-2-220', 'neuron-3-330', 'neuron-3-333',
]

const OLD_DEVICES = [
  'TB-PCL-0001', 'TB-PCL-0002', 'TB-PCL-0003', 'TB-PCL-0004', 'TB-PCL-0005',
  'TB-PCL-0006', 'TB-PCL-0007', 'TB-PCL-0008', 'TB-PCL-0009', 'TB-PCL-0010',
  'TB-PCL-0011', 'TB-PCL-0012', 'TB-PCL-0013', 'TB-PCL-0014', 'TB-PCL-0015',
]

async function purgeByPartition(tableName: string, partitions: string[]): Promise<number> {
  const client = TableClient.fromConnectionString(CONN!, tableName, {
    allowInsecureConnection: CONN!.includes('127.0.0.1') || CONN!.includes('UseDevelopmentStorage'),
  })
  let deleted = 0
  for (const pk of partitions) {
    try {
      const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${pk}'` } })
      for await (const e of iter) {
        await client.deleteEntity(e.partitionKey as string, e.rowKey as string)
        deleted++
      }
    } catch {
      // ignore partition-not-found
    }
  }
  return deleted
}

async function purgeRooms(): Promise<number> {
  const client = TableClient.fromConnectionString(CONN!, 'Rooms', {
    allowInsecureConnection: CONN!.includes('127.0.0.1') || CONN!.includes('UseDevelopmentStorage'),
  })
  let deleted = 0
  for (const roomId of OLD_ROOMS) {
    try {
      // Rooms partitions by building; find the entity by RowKey filter then delete.
      const iter = client.listEntities({ queryOptions: { filter: `RowKey eq '${roomId}'` } })
      for await (const e of iter) {
        await client.deleteEntity(e.partitionKey as string, e.rowKey as string)
        deleted++
      }
    } catch {
      // ignore
    }
  }
  return deleted
}

async function main(): Promise<void> {
  const rooms = await purgeRooms()
  console.log(`Rooms deleted: ${rooms}`)
  const reservations = await purgeByPartition('Reservations', OLD_ROOMS)
  console.log(`Reservations deleted: ${reservations}`)
  const snapshots = await purgeByPartition('OccupancySnapshots', OLD_ROOMS)
  console.log(`OccupancySnapshots deleted: ${snapshots}`)
  const readings = await purgeByPartition('SensorReadings', OLD_DEVICES)
  console.log(`SensorReadings deleted: ${readings}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
