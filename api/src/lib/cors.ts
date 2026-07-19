import type { HttpResponseInit } from '@azure/functions'

/**
 * CORS helper — mirrors the nordicHolidays pattern but trimmed for RoomSense.
 *
 * ALLOWED_ORIGINS is a comma-separated env var. The simulator endpoint
 * additionally allows the `x-sim-key` header; the GET endpoints only ever
 * need Content-Type, so the allow-headers list stays small.
 *
 * Platform CORS for the SWA hostname is set separately via
 * `az functionapp cors add` in the deploy workflow (not expressible in Bicep,
 * not the same as app-level ALLOWED_ORIGINS — standing lesson).
 */
const FALLBACK_ORIGINS = ['http://localhost:5173']

function buildAllowedOrigins(): string[] {
  const fromEnv = process.env.ALLOWED_ORIGINS
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.split(',').map((o) => o.trim()).filter((o) => o.length > 0)
  }
  return FALLBACK_ORIGINS
}

const ALLOWED_ORIGINS = buildAllowedOrigins()

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'",
}

export function withCors(response: HttpResponseInit, origin?: string): HttpResponseInit {
  const headers: Record<string, string> = {
    ...SECURITY_HEADERS,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sim-key',
    ...((response.headers as Record<string, string>) ?? {}),
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  } else {
    delete headers['Access-Control-Allow-Origin']
  }
  return { ...response, headers }
}

export function corsPreflightResponse(origin?: string): HttpResponseInit {
  const headers: Record<string, string> = {
    ...SECURITY_HEADERS,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sim-key',
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return { status: 204, headers }
}
