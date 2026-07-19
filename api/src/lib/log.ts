import type { InvocationContext } from '@azure/functions'

/**
 * Safely log an error via the invocation context.
 *
 * Azure Functions v4 runtime: context.error() is the error logger.
 * context.log.error() does NOT exist at runtime — calling it throws, which
 * turns every error path into a 500 (standing lesson from nordicHolidays).
 */
export function logError(ctx: InvocationContext | undefined, message: string, err?: unknown): void {
  if (!ctx) return
  const anyCtx = ctx as unknown as {
    error?: (...args: unknown[]) => void
    log?: ((...args: unknown[]) => void) & { error?: (...args: unknown[]) => void }
  }
  if (typeof anyCtx.error === 'function') {
    anyCtx.error(message, err)
  } else if (typeof anyCtx.log?.error === 'function') {
    anyCtx.log.error(message, err)
  } else if (typeof anyCtx.log === 'function') {
    anyCtx.log(message, err)
  }
}
