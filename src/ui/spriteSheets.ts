import type { Designer, Look } from '../domain/types'

/** Manifest pasków animacji generowany przez scripts/build-sprites.py (brak = placeholdery). */
export interface SpriteManifest {
  frame: { w: number; h: number }
  frames: Record<string, number>
  looks: string[]
}

let manifest: SpriteManifest | null = null

export async function loadSpriteManifest() {
  try {
    const r = await fetch('/sprites/manifest.json')
    if (r.ok) manifest = await r.json()
  } catch {
    manifest = null
  }
}

export const spriteManifest = () => manifest

export const lookKey = (l: Look) => `${l.g}${l.skin}${l.outfit}`

/** Domyślny wygląd wyliczony z id, żeby każdy bohater wyglądał inaczej bez konfiguracji. */
export function lookOf(d: Pick<Designer, 'id' | 'look' | 'gender'>): Look {
  let base: Look
  if (d.look) base = d.look
  else {
    let h = 0
    for (const ch of d.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    base = { g: h % 2 ? 'F' : 'M', skin: ((h >>> 1) % 3) + 1, outfit: ((h >>> 3) % 3) + 1 } as Look
  }
  // płeć z profilu ma pierwszeństwo przed zapisanym wyglądem postaci
  return d.gender ? { ...base, g: d.gender } : base
}
