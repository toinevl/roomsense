/// <reference types="vite/client" />

/**
 * Central runtime configuration, resolved once from Vite env vars at build
 * time. Mirrors nordicHolidays' config.ts pattern.
 */
export interface AppConfig {
  /** Base URL for the (frozen-contract) API. Default matches SWA-linked-API routing. */
  apiBaseUrl: string
  /** When true, the API client serves everything from an in-browser seed dataset — no network calls. */
  mock: boolean
}

function readMockFlag(): boolean {
  const raw = (import.meta.env.VITE_MOCK ?? '').toString().trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export const config: AppConfig = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '/api').toString().replace(/\/+$/, '') || '/api',
  mock: readMockFlag(),
}
