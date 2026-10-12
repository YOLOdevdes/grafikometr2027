import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

/** Grubość obudowy wokół kineskopu (px) i proporcje ekranu (4:3, jak w starych monitorach). */
const BEZEL = { top: 34, side: 52, bottom: 118 }
const ASPECT = 4 / 3
const MARGIN = 16

/** Monitor wpisany w okno z zachowaniem proporcji ekranu, wyśrodkowany. */
function monitorGeometry(vw: number, vh: number) {
  const maxW = vw - MARGIN * 2 - BEZEL.side * 2
  const maxH = vh - MARGIN * 2 - BEZEL.top - BEZEL.bottom
  const sw = Math.max(240, Math.floor(Math.min(maxW, maxH * ASPECT)))
  const sh = Math.floor(sw / ASPECT)
  const cw = sw + BEZEL.side * 2
  const ch = sh + BEZEL.top + BEZEL.bottom
  const cx = Math.round((vw - cw) / 2)
  const cy = Math.round((vh - ch) / 2)
  return { sw, sh, cw, ch, cx, cy, sx: cx + BEZEL.side, sy: cy + BEZEL.top }
}

/**
 * Mapa przemieszczeń dla wygięcia beczkowego: R/G = przesunięcie próbki w osi X/Y
 * (128 = brak). Próbka bierze piksel dalej od środka proporcjonalnie do r², więc
 * obraz „wybrzusza się” jak na wypukłym kineskopie.
 */
function barrelMap(w: number, h: number): string {
  // mapa w rozdzielczości ekranu — przy rozciąganiu małej mapy krawędzie tekstu „falują”
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / (w - 1)) * 2 - 1
      const ny = (y / (h - 1)) * 2 - 1
      const r2 = nx * nx + ny * ny
      const i = (y * w + x) * 4
      img.data[i] = 128 + Math.round(((nx * r2) / 2) * 127)
      img.data[i + 1] = 128 + Math.round(((ny * r2) / 2) * 127)
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    // mapa liczy się per piksel, więc przeliczamy dopiero po zakończeniu zmiany rozmiaru
    let t: number | undefined
    const on = () => {
      clearTimeout(t)
      t = window.setTimeout(() => setVp({ w: window.innerWidth, h: window.innerHeight }), 150)
    }
    window.addEventListener('resize', on)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', on)
    }
  }, [])
  return vp
}

function WarpFilter({ w, h }: { w: number; h: number }) {
  const map = useMemo(() => barrelMap(w, h), [w, h])
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="crt-warp" x="0" y="0" width={w} height={h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feImage href={map} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={Math.round(Math.min(w, h) * 0.06)} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}

/**
 * Ekran kineskopu. Tryby (klasy na <html>): `crt` — linie, szum, pas, winieta na płasko;
 * `crt monitor` — dodatkowo obudowa starego monitora i wygięty obraz.
 */
export function CrtScreen({ children, monitor }: { children: ReactNode; monitor: boolean }) {
  const { w, h } = useViewport()
  const g = monitorGeometry(w, h)
  const { sw, sh } = g
  const px = (n: number) => `${n}px`
  const vars = {
    '--case-x': px(g.cx), '--case-y': px(g.cy), '--case-w': px(g.cw), '--case-h': px(g.ch),
    '--scr-x': px(g.sx), '--scr-y': px(g.sy), '--scr-w': px(sw), '--scr-h': px(sh),
    '--bz-top': px(BEZEL.top), '--bz-side': px(BEZEL.side), '--bz-bottom': px(BEZEL.bottom),
  } as CSSProperties

  return (
    <div className="crt-root" style={vars}>
      {monitor && <WarpFilter w={sw} h={sh} />}
      {monitor && (
        <div className="monitor-case" aria-hidden="true">
          <div className="monitor-vents" />
          <div className="monitor-chin">
            <div className="monitor-badge">
              <span className="monitor-brand">GRAFIKOMETR<span className="logo-year">2027</span></span>
              <span className="monitor-model">TSH-1987 · 14″ COLOR DISPLAY</span>
            </div>
            <div className="monitor-knobs">
              <i title="Jasność" />
              <i title="Kontrast" />
            </div>
            <div className="monitor-power">
              <span className="monitor-led" />
              <span className="monitor-switch" />
            </div>
          </div>
        </div>
      )}
      <div className="screen">{children}</div>
      <div className="crt-overlay" aria-hidden="true">
        <div className="crt-noise" />
        <div className="crt-roll" />
      </div>
    </div>
  )
}
