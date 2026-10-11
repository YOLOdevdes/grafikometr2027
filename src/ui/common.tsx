import { useEffect, type ReactNode } from 'react'
import { isAbsent, loadOn, type World } from '../domain/availability'
import { todayISO } from '../domain/dates'
import type { Designer, DesignerClass } from '../domain/types'
import { CLASS_META } from '../domain/types'
import type { SpriteState } from './Sprite'

export function Modal({ onClose, children, wide, title }: { onClose: () => void; children: ReactNode; wide?: boolean; title?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`win modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {title && <div className="win-title">{title}</div>}
        {children}
      </div>
    </div>
  )
}

export function ClassBadge({ cls, fte }: { cls: DesignerClass; fte?: number }) {
  return (
    <span className="cls" style={{ background: CLASS_META[cls].color }}>
      {CLASS_META[cls].short.toUpperCase()}
      {fte !== undefined && ` · ${fmtFte(fte)}`}
    </span>
  )
}

export const fmtFte = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(Math.round(n * 100) / 100))

export function designerState(world: World, d: Designer, day = todayISO()): SpriteState {
  if (isAbsent(world, d.id, day)) return 'sleep'
  const load = loadOn(world, d.id, day)
  if (load > d.baseFte + 1e-6) return 'tired'
  if (load > 0) return 'work'
  return 'idle'
}

export const STATE_LABEL: Record<SpriteState, string> = {
  idle: 'Wolny — czeka na quest',
  work: 'W akcji',
  tired: 'Przeciążony!',
  sleep: 'Odpoczywa',
}
