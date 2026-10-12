import { useEffect, useState, type ReactNode } from 'react'

/** Pixelowa zębatka 16×16: 8 zębów, otwór w środku, światło z lewej-góry. */
const GEAR = [
  '......####......',
  '......####......',
  '..##..####..##..',
  '..############..',
  '...##########...',
  '...##########...',
  '#######..#######',
  '######....######',
  '######....######',
  '#######..#######',
  '...##########...',
  '...##########...',
  '..############..',
  '..##..####..##..',
  '......####......',
  '......####......',
]
const on = (x: number, y: number) => GEAR[y]?.[x] === '#'

function Gear() {
  const px: { x: number; y: number; tone: 'hi' | 'lo' | 'mid' }[] = []
  GEAR.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== '#') return
      // krawędź od strony światła = blik, od strony cienia = cień
      const tone = !on(x, y - 1) || !on(x - 1, y) ? 'hi' : !on(x, y + 1) || !on(x + 1, y) ? 'lo' : 'mid'
      px.push({ x, y, tone })
    }),
  )
  return (
    <svg className="gear" viewBox="0 0 16 16" width="24" height="24" shapeRendering="crispEdges" aria-hidden="true">
      {px.map(({ x, y, tone }) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} className={tone} />)}
    </svg>
  )
}

/** Przycisk z zębatką + wysuwany z prawej panel ustawień. */
export function SettingsDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button className="nav-toggle" aria-haspopup="true" aria-expanded={open} aria-label="Ustawienia" title="Ustawienia" onClick={() => setOpen(o => !o)}>
        <Gear />
      </button>
      <div className={`nav-scrim ${open ? 'open' : ''}`} onMouseDown={() => setOpen(false)} aria-hidden="true" />
      <aside className={`nav-drawer ${open ? 'open' : ''}`} aria-label="Ustawienia" aria-hidden={!open}>
        <div className="nav-head">
          <span>USTAWIENIA</span>
          <button className="sm ghost" onClick={() => setOpen(false)} aria-label="Zamknij ustawienia" tabIndex={open ? 0 : -1}>✕</button>
        </div>
        {open && children}
      </aside>
    </>
  )
}
