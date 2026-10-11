import type { FullWorld } from '../db'
import { demandLoad } from '../domain/availability'
import { addDaysISO, fmtRange, maxISO, minISO, overlaps, todayISO } from '../domain/dates'
import type { Demand, ISODate, Project } from '../domain/types'
import { ABSENCE_LABEL, CLASS_META, MERC_META, PHASE_LABEL, REGION_META } from '../domain/types'
import { biomeStyle } from '../ui/biomes'
import { designerState, fmtFte } from '../ui/common'
import { Sprite } from '../ui/Sprite'

const TRACK = 44
const TOP = 14
const BOTTOM = 18

/** Quest jako podróż przez krainę: każdy slot to ścieżka, a bohater stoi tam, gdzie jest dziś. */
export function JourneyRow({ world, project: p, start, end, pos, onOpenDemand }: {
  world: FullWorld; project: Project; start: ISODate; end: ISODate; pos: (d: ISODate) => number; onOpenDemand: (d: Demand) => void
}) {
  const today = todayISO()
  const last = addDaysISO(end, -1)
  const slots = world.demands
    .filter(d => d.projectId === p.id)
    .sort((a, b) => a.cls.localeCompare(b.cls) || a.from.localeCompare(b.from))
  const mercs = world.mercenaries.filter(m => m.projectId === p.id)
  const height = Math.max(118, TOP + Math.max(1, slots.length) * TRACK + BOTTOM)
  const pFrom = pos(p.from)
  const pTo = pos(addDaysISO(p.to, 1))
  const region = REGION_META[p.region ?? 'OTHER']

  return (
    <div className="tl-row" style={{ height }}>
      <div className="tl-who journey-info" style={{ cursor: 'default', alignItems: 'flex-start', flexDirection: 'column', gap: 4, paddingTop: 8 }}>
        <div className="nm">
          {p.client && p.client !== p.name && <small style={{ fontSize: 10 }}>{p.client.toUpperCase()}</small>}
          <b style={{ borderLeft: `4px solid ${p.color}`, paddingLeft: 6 }}>{p.name}</b>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span className="chip">{PHASE_LABEL[p.phase].toUpperCase()}</span>
          {p.upcoming && <span className="chip upcoming">NADCH.</span>}
        </div>
        <small title={region.label}>{region.icon} {region.land}{p.country ? ` · ${p.country}` : ''}</small>
        {mercs.length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {mercs.map(m => (
              <span key={m.id} className="token" title={`${MERC_META[m.role].label} ×${m.count}`} style={{ padding: '0 4px 0 1px', fontSize: 10 }}>
                <span className="dot" style={{ background: MERC_META[m.role].color, width: 14, height: 14, fontSize: 7 }}>{m.role.slice(0, 2)}</span>×{m.count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="tl-lane journey" style={biomeStyle(p.region)}>
        {/* mgła poza czasem trwania questu */}
        <div className="fog" style={{ left: 0, width: `${pFrom}%` }} />
        <div className="fog" style={{ left: `${pTo}%`, right: 0 }} />
        {p.from >= start && p.from <= last && <div className="landmark" style={{ left: `${pFrom}%` }} title={`Start ${fmtRange(p.from, p.to)}`}>⚑</div>}
        {p.to >= start && p.to <= last && <div className="landmark end" style={{ left: `${pTo}%` }} title={`Meta ${fmtRange(p.from, p.to)}`}>♜</div>}

        {slots.length === 0 && <div className="journey-empty">brak zapotrzebowania — dodaj sloty w Questach</div>}

        {slots.map((d, i) => {
          const y = TOP + i * TRACK + TRACK - 8 // linia ścieżki
          const visible = overlaps(d.from, d.to, start, last)
          const who = world.designers.find(x => x.id === d.designerId)
          const at = minISO(maxISO(today, d.from), d.to)
          const atPct = pos(at)
          const flip = atPct > 78
          const state = who ? (today < d.from ? 'idle' : today > d.to ? 'idle' : designerState(world, who)) : 'idle'
          const absences = who ? world.absences.filter(a => a.designerId === who.id && overlaps(a.from, a.to, d.from, d.to)) : []
          const color = CLASS_META[d.cls].color
          return (
            <div key={d.id} className="track" onClick={() => onOpenDemand(d)} title={`${who?.name ?? 'Wolny slot'} · ${CLASS_META[d.cls].short} ${fmtFte(demandLoad(d))} · ${fmtRange(d.from, d.to)}`}>
              {visible && (
                <div className={`path ${who ? '' : 'open'}`} style={{ left: `${pos(d.from)}%`, width: `${pos(addDaysISO(d.to, 1)) - pos(d.from)}%`, top: y, borderColor: color }} />
              )}
              {absences.map(a => (
                <div key={a.id} className="path-rest" style={{ left: `${pos(maxISO(a.from, d.from))}%`, width: `${pos(addDaysISO(minISO(a.to, d.to), 1)) - pos(maxISO(a.from, d.from))}%`, top: y - 7 }} title={`${ABSENCE_LABEL[a.type]} ${fmtRange(a.from, a.to)}`} />
              ))}
              {at >= start && at <= last && (
                <div className="walker" style={{ left: `${atPct}%`, top: y - 38, flexDirection: flip ? 'row-reverse' : 'row', transform: flip ? 'translateX(calc(-100% + 16px))' : 'translateX(-16px)' }}>
                  {who ? (
                    <Sprite cls={who.cls} state={state} scale={2} title={who.name} />
                  ) : (
                    <div className="ghost"><Sprite cls={d.cls} scale={2} /></div>
                  )}
                  <span className={`pill ${who ? '' : 'open'}`} style={{ borderColor: color }}>
                    {who ? who.name : `? ${CLASS_META[d.cls].short}`} · {fmtFte(demandLoad(d))}
                    {state === 'sleep' && ' · 💤'}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
