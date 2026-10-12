import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { FullWorld } from '../db'
import { demandLoad } from '../domain/availability'
import { daysBetween, fmtRange } from '../domain/dates'
import type { Project } from '../domain/types'
import { MERC_META, PHASE_LABEL } from '../domain/types'
import { ClassBadge } from './common'
import { READ_ONLY } from '../mode'

const OPEN_DELAY = 250
const CLOSE_DELAY = 200

/** Naraz otwarty jest tylko jeden podgląd — otwarcie nowego zamyka poprzedni. */
let closeCurrent: (() => void) | null = null

/**
 * Podgląd projektu po najechaniu na jego nazwę (albo fokusie / kliknięciu):
 * termin, klient, opiekun, skład i notatki + przycisk edycji.
 */
export function ProjectPeek({ world, project: p, onEdit, children, block = false }: { world: FullWorld; project: Project; onEdit: () => void; children: ReactNode; block?: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    if (closeCurrent !== close) closeCurrent?.()
    closeCurrent = close
    return () => {
      if (closeCurrent === close) closeCurrent = null
    }
  }, [open])
  const timer = useRef<number>()
  const anchor = useRef<HTMLDivElement>(null)
  const later = (next: boolean, ms: number) => {
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(next), ms)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => !anchor.current?.contains(e.target as Node) && setOpen(false) // klik obok zamyka
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const slots = world.demands.filter(d => d.projectId === p.id).sort((a, b) => a.cls.localeCompare(b.cls))
  const mercs = world.mercenaries.filter(m => m.projectId === p.id)
  const weeks = Math.round((daysBetween(p.from, p.to) + 1) / 7)
  const id = `peek-${p.id}`

  return (
    <div ref={anchor} className={`peek-anchor ${block ? 'block' : ''}`} onMouseEnter={() => later(true, OPEN_DELAY)} onMouseLeave={() => later(false, CLOSE_DELAY)}>
      <button
        type="button"
        className="peek-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => { clearTimeout(timer.current); setOpen(true) }}
        onFocus={() => later(true, 0)}
        onBlur={e => !e.currentTarget.parentElement?.contains(e.relatedTarget as Node) && later(false, CLOSE_DELAY)}
      >
        {children}
      </button>

      {open && (
        <div id={id} className="peek win" role="dialog" aria-label={`Podgląd projektu ${p.name}`}>
          <div className="peek-head" style={{ borderLeftColor: p.color }}>
            {p.client && p.client !== p.name && <small>{p.client}</small>}
            <b>{p.name}</b>
            <div className="peek-chips">
              <span className="chip">{PHASE_LABEL[p.phase].toUpperCase()}</span>
              {p.upcoming && <span className="chip upcoming">NADCHODZĄCY</span>}
              {p.archivedAt && <span className="chip">ARCHIWUM</span>}
            </div>
          </div>
          <dl className="peek-dl">
            <dt>Termin</dt>
            <dd>{fmtRange(p.from, p.to)} · {weeks} tyg.</dd>
            {p.owner && <><dt>Opiekun</dt><dd>{p.owner}</dd></>}
            <dt>Designerzy</dt>
            <dd className="peek-slots">
              {slots.length === 0 && <span className="dim">brak slotów</span>}
              {slots.map(d => {
                const who = world.designers.find(x => x.id === d.designerId)
                return (
                  <span key={d.id}>
                    <ClassBadge cls={d.cls} fte={demandLoad(d)} /> {who ? who.name : <span className="warn">wolny slot</span>}
                  </span>
                )
              })}
            </dd>
            {mercs.length > 0 && (
              <>
                <dt>Pozostali</dt>
                <dd>{mercs.map(m => `${MERC_META[m.role].label} ×${m.count}`).join(', ')}</dd>
              </>
            )}
            {p.notes && <><dt>Notatki</dt><dd className="peek-notes">{p.notes}</dd></>}
          </dl>
          {!READ_ONLY && (
            <div className="peek-actions">
              <button className="primary sm" onClick={() => { setOpen(false); onEdit() }}>Edytuj projekt</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
