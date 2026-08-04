/**
 * Deterministic feature flag (#38, Phase 3b) — NOT Math.random(), so a given
 * browser session sees a stable on/off experience across reloads instead of
 * flickering between variants. 30% enabled / 70% control, matching the
 * spec's illustrative A/B split (see growth.ts for the — also illustrative,
 * not real — measurement panel this feeds).
 */

const SESSION_ID_KEY = 'roomsense.flagSessionId'
const ENABLED_RATIO = 0.3

function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_ID_KEY)
    if (existing) return existing
    const id = `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
    localStorage.setItem(SESSION_ID_KEY, id)
    return id
  } catch {
    // Storage blocked (private browsing, embedded iframe, etc.) — fall back to a
    // non-persisted id so the flag decision is still made, just not stable across reloads.
    return `s-fallback-${Math.random().toString(36).slice(2)}`
  }
}

/** Simple deterministic string hash (djb2) → [0, 1). */
function hashToUnitInterval(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0) / 0xffffffff
}

export function isFeatureEnabled(flagName: string): boolean {
  const sessionId = getOrCreateSessionId()
  return hashToUnitInterval(`${sessionId}:${flagName}`) < ENABLED_RATIO
}
