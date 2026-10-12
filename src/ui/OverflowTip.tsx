import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** Szuka pod kursorem tekstu uciętego wielokropkiem (najbliższy przodek do 4 poziomów w górę). */
function clippedAt(target: EventTarget | null): HTMLElement | null {
  let el = target instanceof HTMLElement ? target : null
  for (let i = 0; el && i < 4; i++, el = el.parentElement) {
    if (el.hasAttribute('title')) return null // element ma już własny opis
    if (el === document.activeElement) return null // nie przeszkadzamy w edycji
    if (getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) return el
  }
  return null
}

/**
 * Jeden globalny dymek: po najechaniu na uciętą nazwę (projektu, osoby…) pokazuje pełny tekst.
 * Działa dla każdego elementu z `text-overflow: ellipsis`, który faktycznie się nie mieści.
 */
export function OverflowTip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null)

  useEffect(() => {
    let current: HTMLElement | null = null
    const over = (e: PointerEvent) => {
      const el = clippedAt(e.target)
      if (el === current) return
      current = el
      if (!el) return setTip(null)
      const r = el.getBoundingClientRect()
      const below = r.top < 44
      setTip({ text: (el instanceof HTMLInputElement ? el.value : el.textContent)?.trim() ?? '', x: Math.min(Math.max(r.left, 8), window.innerWidth - 8), y: below ? r.bottom + 6 : r.top - 6, below })
    }
    const hide = () => { current = null; setTip(null) }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerdown', hide)
    window.addEventListener('scroll', hide, true)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerdown', hide)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])

  if (!tip?.text) return null
  return createPortal(
    <div className={`otip ${tip.below ? 'below' : ''}`} role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>,
    document.body,
  )
}
