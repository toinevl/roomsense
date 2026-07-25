# ADR-001: Use Azure Table Storage for Telemetry and All Domain Data

Date: 2025-07-23
Status: Accepted

## Context

RoomSense needs to store and serve room-occupancy sensor data (Terabee), room metadata, 
calendar reservations, and social features (user presence, friend links, reviews, privacy 
settings). The data is:

- **Append-heavy**: ~43k sensor readings generated over 30 days at 15-minute resolution
- **Naturally partitioned**: by room, device, or building — never arbitrary joins
- **Flat**: no complex relationships requiring joins or transactions
- **Demo-scale**: 15 rooms, ~1.3k reservations, low query volume

The app must work locally (Azurite) and in Azure with zero code changes.

## Options Considered

### Option A: Azure Table Storage
Semi-structured NoSQL key/value store. Partition key + row key indexing.

- Pros: Zero cost at demo scale; Azurite for local dev is a perfect replica; natural 
  fit for partition/row-key patterns (deviceId-ts, roomId-ts); no schema migrations; 
  connection-string auth works locally and managed identity in cloud
- Cons: No joins (all composition in application code); 100-entity batch limit; no 
  secondary indexes; arrays must be serialized as JSON strings

### Option B: Cosmos DB (Table API)
Managed NoSQL with Table API compatibility.

- Pros: Same SDK as Table Storage; global distribution; change feed; TTL
- Cons: Minimum RU provisioned cost (~$20/mo minimum even unused); overkill for a 
  demo; Azurite doesn't emulate Cosmos-specific features

### Option C: Azure SQL Database
Relational database.

- Pros: Joins, transactions, full SQL query power
- Cons: Schema management overhead; local emulator (LocalDB) doesn't match cloud; 
  connection pooling complexity for serverless Functions; cost even at demo scale

## Decision

We chose **Option A: Azure Table Storage** because the data is append-heavy, 
naturally partitioned, and has no join requirements — the overhead of Cosmos or 
SQL would add cost and complexity without benefit at this scale.

## Consequences

**Positive:**
- Zero storage cost at demo scale (free tier covers it)
- Azurite provides exact local dev parity — no "works on my machine" issues
- Partition/row-key design enables efficient time-range queries (PK=roomId, 
  RK=roomId-ts reverse-prefix)
- Single auth pattern: connection string locally, managed identity in cloud

**Negative / trade-offs accepted:**
- No arrays in entity properties — tags and similar fields are JSON-serialized strings
- All multi-entity composition happens in application code, not the database
- No secondary indexes — query patterns must be designed around partition/row keys

**Risks:**
- If the app scales to thousands of rooms, partition hot-spotting on popular buildings 
  may require repartitioning
- Migration to a relational store later would require rewriting all data access code

## References

- [Azure Table Storage docs](https://learn.microsoft.com/en-us/azure/storage/tables/)
- [Azurite emulator](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite)
- [packages/shared/src/types.ts](../packages/shared/src/types.ts) — zod schemas define entity shapes
- [api/src/lib/tables.ts](../api/src/lib/tables.ts) — table client factory
