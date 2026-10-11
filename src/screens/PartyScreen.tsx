import { useState } from 'react'
import type { FullWorld } from '../db'
import { loadOn } from '../domain/availability'
import { todayISO } from '../domain/dates'
import type { Designer } from '../domain/types'
import { CLASSES, CLASS_META } from '../domain/types'
import { DesignerForm } from '../ui/HeroCard'
import { STATE_LABEL, designerState, fmtFte } from '../ui/common'
import { lookOf } from '../ui/spriteSheets'
import { Sprite } from '../ui/Sprite'

export function PartyScreen({ world, onOpenHero }: { world: FullWorld; onOpenHero: (d: Designer) => void }) {
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const today = todayISO()
  const list = world.designers.filter(d => showArchived || !d.archivedAt)

  return (
    <div>
      <div className="tl-toolbar">
        <h2 style={{ fontSize: 14 }}>DRUŻYNA</h2>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> pokaż zarchiwizowanych
        </label>
        <span className="spacer" />
        <button className="primary" onClick={() => setAdding(true)}>+ Nowy bohater</button>
      </div>

      {CLASSES.map(cls => {
        const heroes = list.filter(d => d.cls === cls)
        if (!heroes.length) return null
        const meta = CLASS_META[cls]
        return (
          <div key={cls} className="quest-group">
            <h3 style={{ color: meta.color }}>{meta.label.toUpperCase()} · {meta.hero} · {heroes.length}</h3>
            <div className="party">
              {heroes.map(h => {
                const st = designerState(world, h)
                return (
                  <div key={h.id} className={`win mini-card ${h.archivedAt ? 'archived' : ''}`} onClick={() => onOpenHero(h)} style={{ borderColor: meta.color }}>
                    <div className="stage"><Sprite cls={h.cls} look={lookOf(h)} state={st} scale={3} /></div>
                    <b>{h.name}</b>
                    <div><small>{h.title ?? meta.hero}</small></div>
                    <div style={{ fontSize: 12, marginTop: 6 }} className={st === 'tired' ? 'no' : st === 'idle' ? 'ok' : st === 'sleep' ? 'dim' : 'wait'}>
                      {STATE_LABEL[st]} · {fmtFte(loadOn(world, h.id, today))}/{fmtFte(h.baseFte)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {adding && <DesignerForm onClose={() => setAdding(false)} />}
    </div>
  )
}
