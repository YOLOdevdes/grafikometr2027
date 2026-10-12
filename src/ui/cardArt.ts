import { useEffect, useState } from 'react'
import type { Designer } from '../domain/types'
import { lookOf } from './spriteSheets'

/**
 * Eksperyment: ilustracje na kartach osób zamiast animowanej postaci.
 * Przełącznik w Ustawieniach; wyłączony = obecna wersja (ludzik).
 */
const KEY = 'pipolator.cardArt'
const listeners = new Set<(on: boolean) => void>()

let on = (() => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
})()

export function setCardArt(next: boolean) {
  on = next
  try {
    localStorage.setItem(KEY, next ? '1' : '0')
  } catch {
    /* brak storage */
  }
  listeners.forEach(l => l(on))
}

export function useCardArt(): boolean {
  const [v, setV] = useState(on)
  useEffect(() => {
    listeners.add(setV)
    return () => {
      listeners.delete(setV)
    }
  }, [])
  return v
}

/** Ilustracja według roli (Senior i Medior → Product Designer) i płci postaci. */
export function cardArtFor(d: Designer): string {
  const role = d.cls === 'UX_RESEARCHER' ? 'uxresearcher' : 'productdesigner'
  const gender = (d.gender ?? lookOf(d).g) === 'F' ? 'female' : 'male'
  return `/art/cards/${role}-${gender}.webp`
}
