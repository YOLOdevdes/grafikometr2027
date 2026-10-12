import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Paleta Game Boya (tryb ekranu „Game Boy”, domyślny).
 * Filtr SVG zamienia jasność każdego piksela na rampę 5 zieleni ekranu startowego (gb0…gb4).
 * Nakładany osobno na wszystko poza logo (styles.css: html.gb …), żeby logo zostało kolorowe.
 * Okna (modale, karta, notatnik) idą do #overlay-root — filtr na przodku psułby ich „position: fixed”.
 */

// gb0 #0e2116 · gb1 #1f3d29 · gb2 #4f7a45 · gb3 #b8d98c · gb4 #dff2b8
export function GbFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="gb-palette" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.055 0.122 0.31 0.722 0.875" />
          <feFuncG type="table" tableValues="0.129 0.239 0.478 0.851 0.949" />
          <feFuncB type="table" tableValues="0.086 0.161 0.271 0.549 0.722" />
        </feComponentTransfer>
      </filter>
    </svg>
  )
}

/** Warstwa na okna — poza obszarami z filtrem, ale wewnątrz ekranu (tryby CRT / monitor). */
export function OverlayRoot() {
  return <div id="overlay-root" />
}

export function inOverlay(node: ReactNode) {
  return createPortal(node, document.getElementById('overlay-root') ?? document.body)
}
