import { useState } from 'react'
import type { FullWorld } from '../db'
import { absenceWarnings, demandLoad } from '../domain/availability'
import { daysBetween, fmtRange, maxISO, minISO, todayISO } from '../domain/dates'
import type { Demand, DesignerClass } from '../domain/types'
import { ABSENCE_LABEL, CLASSES, CLASS_META, PHASE_LABEL } from '../domain/types'
import { ClassBadge } from '../ui/common'

/** Zapotrzebowanie: nieobsadzone sloty + uwagi o urlopach w trakcie przypisań. */
export function BoardScreen({ world, onOpenDemand }: { world: FullWorld; onOpenDemand: (d: Demand) => void }) {
  const today = todayISO()
  const [cls, setCls] = useState<DesignerClass | 'ALL'>('ALL')
  const projects = new Map(world.projects.map(p => [p.id, p]))

  const allOpen = world.demands.filter(d => !d.designerId && d.to >= today).sort((a, b) => a.from.localeCompare(b.from))
  const open = allOpen.filter(d => cls === 'ALL' || d.cls === cls)
  const warnings = world.demands
    .filter(d => d.designerId && d.to >= today)
    .flatMap(d => absenceWarnings(world, d).filter(a => a.to >= today).map(a => ({ d, a })))
    .sort((x, y) => x.a.from.localeCompare(y.a.from))

  return (
    <div>
      <div className="tl-toolbar">
        <h2 style={{ fontSize: 14 }}>ZAPOTRZEBOWANIE</h2>
        <button className={`sm ${cls === 'ALL' ? 'on' : ''}`} onClick={() => setCls('ALL')}>Wszystkie ({allOpen.length})</button>
        {CLASSES.map(c => (
          <button key={c} className={`sm ${cls === c ? 'on' : ''}`} onClick={() => setCls(c)}>
            {CLASS_META[c].short} ({allOpen.filter(d => d.cls === c).length})
          </button>
        ))}
      </div>

      {open.length === 0 && <div className="win"><span className="ok">✓ Wszystkie sloty są obsadzone.</span></div>}
      <div className="board-grid">
        {open.map(d => {
          const p = projects.get(d.projectId)
          const startsIn = daysBetween(today, d.from)
          return (
            <div key={d.id} className={`win quest-card ${p?.upcoming ? 'upcoming' : ''}`} onClick={() => onOpenDemand(d)}>
              <div className="t">
                <ClassBadge cls={d.cls} fte={demandLoad(d)} />
                <span className="chip">{p && PHASE_LABEL[p.phase].toUpperCase()}</span>
              </div>
              <div>
                <b>{p?.name}</b> {p?.upcoming && <span className="chip upcoming">NADCHODZĄCY</span>}
              </div>
              {p?.client && p.client !== p.name && <small>{p.client}</small>}
              <div>
                <small>
                  {fmtRange(d.from, d.to)} ·{' '}
                  {startsIn <= 0 ? <span className="no">trwa — slot pusty!</span> : startsIn <= 14 ? <span className="warn">start za {startsIn} dni</span> : `start za ${startsIn} dni`}
                </small>
              </div>
            </div>
          )
        })}
      </div>

      {warnings.length > 0 && (
        <div className="win" style={{ marginTop: 24 }}>
          <div className="win-title">UWAGI — URLOPY W TRAKCIE PRZYPISAŃ</div>
          <div className="board-grid" style={{ gap: 10 }}>
            {warnings.map(({ d, a }) => {
              const who = world.designers.find(x => x.id === d.designerId)
              const p = projects.get(d.projectId)
              return (
                <div key={d.id + a.id} className="win flat" style={{ fontSize: 13, cursor: 'pointer', padding: '8px 10px' }} onClick={() => onOpenDemand(d)}>
                  <span className="warn">⚠</span> <b>{who?.name}</b> — {ABSENCE_LABEL[a.type].toLowerCase()} {fmtRange(maxISO(a.from, d.from), minISO(a.to, d.to))}
                  <br />
                  <small>slot w {p?.name} ({p && PHASE_LABEL[p.phase]}) pusty w tym czasie</small>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
