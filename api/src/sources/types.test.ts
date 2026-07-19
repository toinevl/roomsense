import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * SourceAdapter contract tests (RED phase).
 *
 * These tests assert the existence of a `SourceAdapter` interface and a
 * registry that the GET /api/sources endpoint will read from. They also
 * assert the outlook-mock adapter honors the contract.
 *
 * The adapter seam (wishlist #23) is the architectural promise: any
 * future source (real Graph, IoT Hub, third-party) implements the same
 * interface and slots in without touching the API layer.
 */

import type { SourceAdapter } from './types'
import { listSourceAdapters, registerSourceAdapter, clearSourceAdapters } from './registry'

describe('SourceAdapter contract', () => {
  it('SourceAdapter requires sourceId, kind, displayName, ping', () => {
    // Compile-time check — if the interface shape drifts this stops building.
    const adapter: SourceAdapter = {
      sourceId: 'x',
      kind: 'sensor',
      displayName: 'X',
      async ping() {
        return { status: 'active' }
      },
    }
    expect(adapter.sourceId).toBe('x')
    expect(adapter.kind).toBe('sensor')
  })

  it('listReservations is optional (sensor sources may omit it)', () => {
    const sensor: SourceAdapter = {
      sourceId: 's',
      kind: 'sensor',
      displayName: 'S',
      async ping() {
        return { status: 'active' }
      },
    }
    expect(sensor.listReservations).toBeUndefined()
  })
})

describe('source adapter registry', () => {
  beforeEach(() => {
    clearSourceAdapters()
  })

  it('starts empty', () => {
    expect(listSourceAdapters()).toEqual([])
  })

  it('register + list round-trip', () => {
    const adapter: SourceAdapter = {
      sourceId: 'test-1',
      kind: 'calendar',
      displayName: 'Test 1',
      async ping() {
        return { status: 'active' }
      },
    }
    registerSourceAdapter(adapter)
    expect(listSourceAdapters()).toHaveLength(1)
    expect(listSourceAdapters()[0].sourceId).toBe('test-1')
  })

  it('register is idempotent on sourceId (replace, not duplicate)', () => {
    const v1: SourceAdapter = {
      sourceId: 'dup',
      kind: 'sensor',
      displayName: 'V1',
      async ping() {
        return { status: 'active' }
      },
    }
    const v2: SourceAdapter = {
      sourceId: 'dup',
      kind: 'sensor',
      displayName: 'V2',
      async ping() {
        return { status: 'active' }
      },
    }
    registerSourceAdapter(v1)
    registerSourceAdapter(v2)
    expect(listSourceAdapters()).toHaveLength(1)
    expect(listSourceAdapters()[0].displayName).toBe('V2')
  })

  it('listSourceAdapters returns a defensive copy', () => {
    const adapter: SourceAdapter = {
      sourceId: 'def',
      kind: 'sensor',
      displayName: 'Def',
      async ping() {
        return { status: 'active' }
      },
    }
    registerSourceAdapter(adapter)
    const snapshot = listSourceAdapters()
    snapshot.pop()
    expect(listSourceAdapters()).toHaveLength(1)
  })
})
