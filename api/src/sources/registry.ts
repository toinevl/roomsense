import type { SourceAdapter } from './types'

/**
 * Adapter registry — the single place sources are declared.
 *
 * Adding a source:
 *   1. Implement SourceAdapter in src/sources/<name>.ts.
 *   2. registerSourceAdapter(myAdapter) at module load of registry.ts.
 *
 * The /api/sources endpoint and future ingestion jobs read from here.
 * This is NOT the same as the Sources *table* — that's storage-side
 * metadata seeded for demo display. The registry is runtime truth:
 * only adapters here can serve requests.
 */

import { outlookMockAdapter } from './outlook-mock'

const adapters = new Map<string, SourceAdapter>()

export function registerSourceAdapter(adapter: SourceAdapter): void {
  // Replace-if-exists keeps registry idempotent — re-loading a module
  // during tests doesn't accumulate duplicates.
  adapters.set(adapter.sourceId, adapter)
}

export function listSourceAdapters(): SourceAdapter[] {
  // Defensive copy — callers must not mutate the registry's storage.
  return Array.from(adapters.values())
}

export function getSourceAdapter(sourceId: string): SourceAdapter | undefined {
  return adapters.get(sourceId)
}

export function clearSourceAdapters(): void {
  adapters.clear()
}

// --- Default registrations ----------------------------------------------
// Wishlist #23: the outlook-mock adapter is always registered in production.
// Tests that need an empty registry import the registry fresh or call
// clearSourceAdapters() in beforeEach — the outlook-mock import here only
// runs once per Vitest worker, and tests in outlook-mock.test.ts mock the
// tables layer so the adapter's own tests are unaffected.
registerSourceAdapter(outlookMockAdapter)
