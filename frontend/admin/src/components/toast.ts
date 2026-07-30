/**
 * Minimal toast + session-scoped audit log for the "Reclaim now" panel.
 * There is no backend mutation endpoint for any reclaim action (api/** is a
 * different lane) — this is the real, honest client-side behavior: local
 * state changes visibly (toast + log line), never implying a real facility
 * system was contacted. Session-scoped only (sessionStorage), cleared on
 * reload — never presented as a persisted server record.
 */

export interface AuditLogEntry {
  ts: string
  action: string
  detail: string
}

const AUDIT_LOG_KEY = 'roomsense.admin.auditLog'

export function readAuditLog(): AuditLogEntry[] {
  try {
    const raw = sessionStorage.getItem(AUDIT_LOG_KEY)
    return raw ? (JSON.parse(raw) as AuditLogEntry[]) : []
  } catch {
    return []
  }
}

export function appendAuditLog(action: string, detail: string, ts: string): AuditLogEntry[] {
  const entries = [...readAuditLog(), { ts, action, detail }]
  sessionStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(entries))
  return entries
}

export function clearAuditLog(): void {
  sessionStorage.removeItem(AUDIT_LOG_KEY)
}

let hideHandle: ReturnType<typeof setTimeout> | null = null

/** Shows (or re-messages) a single toast element inside `container`, auto-hiding after 4s. */
export function showToast(container: HTMLElement, message: string): void {
  let toast = container.querySelector<HTMLDivElement>('.toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'toast'
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    container.appendChild(toast)
  }
  toast.textContent = message
  toast.classList.add('visible')
  if (hideHandle) clearTimeout(hideHandle)
  hideHandle = setTimeout(() => toast?.classList.remove('visible'), 4000)
}

export function renderAuditLog(container: HTMLElement, entries: AuditLogEntry[]): void {
  container.innerHTML = ''
  if (entries.length === 0) return
  const list = document.createElement('ul')
  list.className = 'audit-log'
  // Newest first.
  for (const entry of [...entries].reverse()) {
    const item = document.createElement('li')
    item.className = 'audit-log-entry'
    const time = document.createElement('span')
    time.className = 'mono'
    time.textContent = new Date(entry.ts).toISOString().slice(11, 16)
    const text = document.createElement('span')
    text.textContent = ` · ${entry.action} · ${entry.detail}`
    item.append(time, text)
    list.appendChild(item)
  }
  container.appendChild(list)
}
