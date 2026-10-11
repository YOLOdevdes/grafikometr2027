import type { FullWorld } from '../db'
import { demandLoad } from '../domain/availability'
import { addDaysISO, fmtRange, maxISO, minISO, overlaps, todayISO } from '../domain/dates'
import type { Demand, DesignerClass, ISODate, Project } from '../domain/types'
import { ABSENCE_LABEL, CLASS_META, MERC_META, PHASE_LABEL, REGION_META } from '../domain/types'
import { biomeStyle } from '../ui/biomes'
import { designerState, fmtFte } from '../ui/common'
import { lookOf } from '../ui/spriteSheets'
import { Sprite } from '../ui/Sprite'

const ROW_H = 118
const SPACING = 50
const CLASS_ORDER: Record<DesignerClass, number> = { SENIOR_PD: 0, MEDIOR_PD: 1, UX_RESEARCHER: 2 }
const GHOST_LOOK = { g: 'M', skin: 1, outfit: 1 } as const

/** Quest jako podróż przez krainę: drużyna idzie gęsiego wspólną drogą i stoi tam, gdzie jest dziś. */
export function JourneyRow({ world, project: p, start, end, pos, onOpenDemand }: {
  world: FullWorld; project: Project; start: ISODate; end: ISODate; pos: (d: ISODate) => number; onOpenDemand: (d: Demand) => void
}) {
  const today = todayISO()
  const last = addDaysISO(end, -1)
  const slots = world.demands
    .filter(d => d.projectId === p.id)
    .sort((a, b) => a.cls.localeCompare(b.cls) || a.from.localeCompare(b.from))
  const mercs = world.mercenaries.filter(m => m.projectId === p.id)
  const height = ROW_H
  const ROAD_Y = ROW_H - 24

  // drużyna idzie gęsiego: kto jest w tym samym miejscu na osi, ten w jednym szyku
  const members = slots
    .map(d => {
      const who = world.designers.find(x => x.id === d.designerId)
      const at = minISO(maxISO(today, d.from), d.to)
      const state = who && today >= d.from && today <= d.to ? designerState(world, who) : 'idle'
      const absences = who ? world.absences.filter(a => a.designerId === who.id && a.to >= today && overlaps(a.from, a.to, d.from, d.to)) : []
      return { d, who, at, state, absences }
    })
    .filter(m => m.at >= start && m.at <= last)
    .sort((a, b) => Number(!a.who) - Number(!b.who) || CLASS_ORDER[a.d.cls] - CLASS_ORDER[b.d.cls] || a.d.from.localeCompare(b.d.from))
  const parties: { at: ISODate; pct: number; members: typeof members }[] = []
  for (const m of members) {
    const p0 = parties.find(x => x.at === m.at)
    if (p0) p0.members.push(m)
    else parties.push({ at: m.at, pct: pos(m.at), members: [m] })
  }
  const pFrom = pos(p.from)
  const pTo = pos(addDaysISO(p.to, 1))
  const region = REGION_META[p.region ?? 'OTHER'] ?? REGION_META.OTHER

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
        <small title={region.land}>{region.icon} {region.label}{p.country ? ` · ${p.country}` : ''}</small>
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

      <div className={`tl-lane journey ${p.from <= today && today <= p.to ? 'moving' : ''}`} style={biomeStyle(p.region)}>
        {/* mgła poza czasem trwania questu */}
        <div className="fog" style={{ left: 0, width: `${pFrom}%` }} />
        <div className="fog" style={{ left: `${pTo}%`, right: 0 }} />
        {p.from >= start && p.from <= last && <div className="landmark" style={{ left: `${pFrom}%` }} title={`Start ${fmtRange(p.from, p.to)}`}>⚑</div>}
        {p.to >= start && p.to <= last && <div className="landmark end" style={{ left: `${pTo}%` }} title={`Meta ${fmtRange(p.from, p.to)}`}>♜</div>}

        {slots.length === 0 && <div className="journey-empty">brak zapotrzebowania — dodaj sloty w Questach</div>}
        <div className="road" style={{ left: `${pFrom}%`, width: `${pTo - pFrom}%`, top: ROAD_Y }} />

        {parties.map(party =>
          party.members.map((m, i) => {
            const { d, who, state } = m
            const color = CLASS_META[d.cls].color
            const tip = [
              `${who?.name ?? 'Wolny slot'} · ${CLASS_META[d.cls].short} ${fmtFte(demandLoad(d))}`,
              fmtRange(d.from, d.to),
              ...m.absences.map(a => `${ABSENCE_LABEL[a.type]} ${fmtRange(a.from, a.to)}`),
            ].join('\n')
            return (
              <div
                key={d.id}
                className="walker"
                title={tip}
                onClick={() => onOpenDemand(d)}
                style={{ left: `calc(max(${party.pct}cqw - ${i * SPACING}px, ${(party.members.length - 1 - i) * 20}px) - 36px)`, top: ROAD_Y + 4, zIndex: 10 - i }}
              >
                {who ? (
                  <Sprite cls={who.cls} look={lookOf(who)} state={state} scale={2} />
                ) : (
                  <div className="ghost"><Sprite cls={d.cls} look={GHOST_LOOK} scale={2} badge={false} /></div>
                )}
                <span className={`tag ${who ? '' : 'open'}`} style={{ borderColor: color, top: i % 2 ? -26 : -12 }}>
                  {who ? who.name : `? ${CLASS_META[d.cls].short}`}
                  {fmtFte(demandLoad(d)) !== '1.0' && ` · ${fmtFte(demandLoad(d))}`}
                  {m.absences.length > 0 && ' 🏝'}
                </span>
              </div>
            )
          }),
        )}
      </div>
    </div>
  )
}
