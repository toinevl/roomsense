/**
 * RowKey helpers for Azure Table Storage.
 *
 * Inverted ticks make newer rows sort lexicographically first, so
 * "latest N readings" is a plain top-N partition scan.
 */
export const TICKS_MAX = 10_000_000_000_000 // epoch-ms ceiling, safe until year 2286

export function invertedTicks(epochMs: number): string {
  if (!Number.isInteger(epochMs) || epochMs < 0 || epochMs >= TICKS_MAX) {
    throw new RangeError(`epochMs must be an integer in [0, ${TICKS_MAX}), got ${epochMs}`)
  }
  return String(TICKS_MAX - epochMs).padStart(14, '0')
}

export function fromInvertedTicks(rowKey: string): number {
  return TICKS_MAX - Number(rowKey)
}

/** FNV-1a 32-bit, hex encoded — stable short suffix for composite RowKeys. */
export function hash8(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
