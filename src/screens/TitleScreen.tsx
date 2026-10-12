import { useEffect, useState } from 'react'
import type { Look } from '../domain/types'
import { Logo80 } from '../ui/Logo80'
import { playClick } from '../ui/sfx'
import { Sprite } from '../ui/Sprite'

export interface TitleItem {
  label: string
  action: () => void
}

const PARTY: { cls: 'SENIOR_PD' | 'MEDIOR_PD' | 'UX_RESEARCHER'; look: Look }[] = [
  { cls: 'SENIOR_PD', look: { g: 'F', skin: 2, outfit: 2 } },
  { cls: 'MEDIOR_PD', look: { g: 'M', skin: 1, outfit: 1 } },
  { cls: 'UX_RESEARCHER', look: { g: 'F', skin: 3, outfit: 3 } },
]

/** Ekran tytułowy w stylu gier z Game Boya: logo, menu ze strzałką, ↑ ↓ + Enter. */
export function TitleScreen({ items }: { items: TitleItem[] }) {
  const [sel, setSel] = useState(0)


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 's') setSel(i => (i + 1) % items.length)
      else if (e.key === 'ArrowUp' || e.key === 'w') setSel(i => (i - 1 + items.length) % items.length)
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        playClick()
        items[sel]?.action()
        return
      } else return
      playClick()
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, sel])

  return (
    <div className="title-screen">
      <div className="title-stars" aria-hidden="true" />
      <div className="title-logo">
        <h1 className="title-name">
          <Logo80 />
        </h1>
        <div className="title-sub" lang="ja">デザインチーム計画</div>
        <div className="title-tag">~ Planowanie zespołu designu ~</div>
      </div>

      <nav className="title-menu" aria-label="Menu główne">
        {items.map((it, i) => (
          <button
            key={it.label}
            className={`title-item ${i === sel ? 'sel' : ''}`}
            onMouseEnter={() => setSel(i)}
            onFocus={() => setSel(i)}
            onClick={it.action}
            autoFocus={i === 0}
          >
            <svg className="title-arrow" viewBox="0 0 9 7" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M0 2h5V0h1v1h1v1h1v1h1v1H8v1H7v1H6v1H5V5H0z" fill="currentColor" />
            </svg>
            {it.label}
          </button>
        ))}
      </nav>

      <div className="title-march" aria-hidden="true">
        <div className="title-party">
          {PARTY.map((p, i) => (
            <Sprite key={i} cls={p.cls} look={p.look} state="work" scale={2} badge={false} />
          ))}
        </div>
      </div>

      <div className="title-foot">
        <span>© 1987 TSH DESIGN DEPT.</span>
        <span className="title-press">PRESS ENTER</span>
      </div>
    </div>
  )
}
