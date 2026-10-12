import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { exportData, replaceAll, type Snapshot } from './db'

/**
 * Serwer jest źródłem prawdy, a baza w przeglądarce (Dexie) — kopią roboczą.
 * Edycja: każda zmiana w bazie po ~1 s leci na serwer (PUT /api/state z numerem rev).
 * Podgląd: co 30 s pobiera stan z serwera i podmienia lokalną kopię.
 */

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'expired'

interface ServerDoc { rev: number; savedAt: string | null; data: Snapshot | null }

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init, headers: { 'content-type': 'application/json', ...init?.headers } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? `Błąd ${res.status}`)
  return body as T
}

// ---------- sesja ----------

export const api = {
  session: () => call<{ authed: boolean }>('/api/session'),
  login: (password: string) => call<{ ok: true }>('/api/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => call<{ ok: true }>('/api/logout', { method: 'POST' }),
}

// ---------- status zapisu (dla wskaźnika w nagłówku) ----------

let status: SyncStatus = 'idle'
const listeners = new Set<(s: SyncStatus) => void>()
function setStatus(s: SyncStatus) {
  status = s
  listeners.forEach(l => l(s))
}
export function useSyncStatus() {
  const [s, setS] = useState(status)
  useEffect(() => {
    listeners.add(setS)
    return () => void listeners.delete(setS)
  }, [])
  return s
}

// ---------- edycja: pobranie i automatyczny zapis ----------

let rev = 0
let lastSynced = '' // JSON ostatnio uzgodnionego stanu — wysyłamy tylko faktyczne zmiany
let stopWatch: (() => void) | null = null
let timer: number | undefined
let onExpired: () => void = () => {}

/** Pobiera stan z serwera. Zwraca, czy serwer jest pusty (jeszcze nikt nic nie zapisał). */
export async function pull(): Promise<{ empty: boolean }> {
  const doc = await call<ServerDoc>('/api/state')
  rev = doc.rev
  if (doc.data) {
    await replaceAll(doc.data)
    lastSynced = JSON.stringify(await exportData())
  }
  return { empty: !doc.data }
}

async function push() {
  const data = await exportData()
  const text = JSON.stringify(data)
  if (text === lastSynced) return
  setStatus('saving')
  try {
    const res = await call<{ rev: number }>('/api/state', { method: 'PUT', body: JSON.stringify({ rev, data }) })
    rev = res.rev
    lastSynced = text
    setStatus('saved')
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      setStatus('expired')
      onExpired()
    } else if (e instanceof ApiError && e.status === 409) {
      setStatus('conflict')
      alert('Dane na serwerze zmieniły się w innym oknie. Wczytuję najnowszą wersję — ostatnia zmiana mogła przepaść.')
      await pull()
      setStatus('saved')
    } else {
      setStatus('error')
      timer = window.setTimeout(push, 10_000) // ponów, gdy sieć wróci
    }
  }
}

/** Włącza automatyczny zapis zmian na serwer (po pull!). */
export function startAutoSave(expired: () => void) {
  stopAutoSave()
  onExpired = expired
  const sub = liveQuery(() => exportData()).subscribe(() => {
    clearTimeout(timer)
    timer = window.setTimeout(push, 1000)
  })
  stopWatch = () => sub.unsubscribe()
  window.addEventListener('beforeunload', warnUnsaved)
}

export function stopAutoSave() {
  clearTimeout(timer)
  stopWatch?.()
  stopWatch = null
  window.removeEventListener('beforeunload', warnUnsaved)
}

function warnUnsaved(e: BeforeUnloadEvent) {
  if (status === 'saving' || status === 'error') e.preventDefault()
}

/** Zapisuje od razu, jeśli coś czeka (np. przed wylogowaniem). */
export async function flush() {
  clearTimeout(timer)
  await push()
}

// ---------- podgląd: odświeżanie z serwera ----------

/** Pobiera stan do podglądu (publiczny, okrojony); false = serwer odmówił. */
export async function pullPreview(): Promise<boolean> {
  try {
    const doc = await call<ServerDoc>('/api/state?view=preview')
    if (doc.rev !== rev || !lastSynced) {
      rev = doc.rev
      await replaceAll(doc.data ?? {})
      lastSynced = String(doc.rev)
    }
    return true
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return false
    throw e
  }
}

export function startPreviewPolling(everyMs = 30_000) {
  const tick = () => document.visibilityState === 'visible' && pullPreview().catch(() => {})
  const id = window.setInterval(tick, everyMs)
  document.addEventListener('visibilitychange', tick)
  return () => {
    clearInterval(id)
    document.removeEventListener('visibilitychange', tick)
  }
}
