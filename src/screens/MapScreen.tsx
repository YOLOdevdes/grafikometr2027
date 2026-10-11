import { addMonths, format, startOfMonth } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import type { FullWorld } from '../db'
import { absenceWarnings, demandLoad, overloadRanges } from '../domain/availability'
import { addDaysISO, daysBetween, fmtRange, fromISO, maxISO, minISO, mondayOf, overlaps, toISO, todayISO } from '../domain/dates'
import type { Demand, Designer, ISODate } from '../domain/types'
import { ABSENCE_LABEL, CLASS_META, PHASE_LABEL } from '../domain/types'
import { ClassBadge, designerState, fmtFte } from '../ui/common'
import { Sprite } from '../ui/Sprite'
import { JourneyRow } from './JourneyRow'

export type Zoom = 'D' | 'T' | 'M' | 'R'
type View = 'quests' | 'heroes'

const VIEW_KEY = 'pipolator.mapView'
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'heroes' ? 'heroes' : 'quests'
  } catch {
    return 'quests'
  }
}
const SPAN: Record<Zoom, number> = { D: 21, T: 84, M: 182, R: 364 }
const ZOOM_LABEL: Record<Zoom, string> = { D: 'Dzień', T: 'Tydzień', M: 'Miesiąc', R: 'Rok' }

interface Col { from: ISODate; label: string; weekend?: boolean }

function columns(zoom: Zoom, start: ISODate, end: ISODate): Col[] {
  const cols: Col[] = []
  if (zoom === 'D') {
    for (let d = start; d < end; d = addDaysISO(d, 1)) {
      const dt = fromISO(d)
      cols.push({ from: d, label: format(dt, 'EEEEEE dd', { locale: pl }), weekend: dt.getDay() % 6 === 0 })
    }
  } else if (zoom === 'T') {
    for (let d = mondayOf(start); d < end; d = addDaysISO(d, 7)) cols.push({ from: maxISO(d, start), label: format(fromISO(d), 'dd.MM') })
  } else {
    for (let m = startOfMonth(fromISO(start)); toISO(m) < end; m = addMonths(m, 1)) {
      cols.push({ from: maxISO(toISO(m), start), label: format(m, zoom === 'R' ? 'LLL yy' : 'LLLL', { locale: pl }) })
    }
  }
  return cols
}

/** Rozkłada przedziały na tory tak, by paski się nie nakładały. */
function packLanes<T extends { from: ISODate; to: ISODate }>(items: T[]): (T & { lane: number })[] {
  const ends: ISODate[] = []
  return [...items]
    .sort((a, b) => a.from.localeCompare(b.from))
    .map(it => {
      let lane = ends.findIndex(e => e < it.from)
      if (lane < 0) lane = ends.length
      ends[lane] = it.to
      return { ...it, lane }
    })
}

interface Props {
  world: FullWorld
  onOpenDemand: (d: Demand) => void
  onOpenHero: (d: Designer) => void
}

export function MapScreen({ world, onOpenDemand, onOpenHero }: Props) {
  const today = todayISO()
  const [zoom, setZoom] = useState<Zoom>('T')
  const [view, setViewState] = useState<View>(readView)
  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* brak storage — trudno */
    }
  }
  const [start, setStart] = useState(() => addDaysISO(mondayOf(today), -7))
  const span = SPAN[zoom]
  const end = addDaysISO(start, span) // wyłącznie
  const pos = (d: ISODate) => (Math.max(0, Math.min(span, daysBetween(start, d))) / span) * 100
  const cols = useMemo(() => columns(zoom, start, end), [zoom, start, end])

  const projects = new Map(world.projects.map(p => [p.id, p]))
  const heroes = world.designers.filter(d => !d.archivedAt)
  const quests = world.projects
    .filter(p => !p.archivedAt && overlaps(p.from, p.to, start, addDaysISO(end, -1)))
    .sort((a, b) => (a.client ?? a.name).localeCompare(b.client ?? b.name) || a.from.localeCompare(b.from))

  const open = world.demands
    .filter(d => !d.designerId && d.to >= today)
    .sort((a, b) => a.from.localeCompare(b.from))
  const warnings = world.demands
    .filter(d => d.designerId && d.to >= today)
    .flatMap(d => absenceWarnings(world, d).filter(a => a.to >= today).map(a => ({ d, a })))
    .sort((x, y) => x.a.from.localeCompare(y.a.from))

  const shift = (dir: number) => setStart(s => addDaysISO(s, dir * Math.round(span / 3)))

  return (
    <div className="split">
      <aside>
        <div className="win">
          <div className="win-title">TABLICA ZLECEŃ</div>
          {open.length === 0 && <small>Wszystkie zlecenia obsadzone. Drużyna w komplecie!</small>}
          {open.map(d => {
            const p = projects.get(d.projectId)
            const startsIn = daysBetween(today, d.from)
            return (
              <div key={d.id} className={`win flat quest-card ${p?.upcoming ? 'upcoming' : ''}`} onClick={() => onOpenDemand(d)}>
                <div className="t">
                  <ClassBadge cls={d.cls} fte={demandLoad(d)} />
                  <span className="chip">{p && PHASE_LABEL[p.phase].toUpperCase()}</span>
                </div>
                <div>
                  <b>{p?.name}</b> {p?.upcoming && <span className="chip upcoming">NADCHODZĄCY</span>}
                </div>
                <small>
                  {fmtRange(d.from, d.to)} ·{' '}
                  {startsIn <= 0 ? <span className="no">trwa — slot pusty!</span> : startsIn <= 14 ? <span className="warn">start za {startsIn} dni</span> : `start za ${startsIn} dni`}
                </small>
              </div>
            )
          })}
        </div>

        {warnings.length > 0 && (
          <div className="win" style={{ marginTop: 22 }}>
            <div className="win-title">UWAGI</div>
            {warnings.slice(0, 8).map(({ d, a }) => {
              const who = world.designers.find(x => x.id === d.designerId)
              const p = projects.get(d.projectId)
              return (
                <div key={d.id + a.id} style={{ fontSize: 13, marginBottom: 8, cursor: 'pointer' }} onClick={() => onOpenDemand(d)}>
                  <span className="warn">⚠</span> <b>{who?.name}</b> — {ABSENCE_LABEL[a.type].toLowerCase()} {fmtRange(maxISO(a.from, d.from), minISO(a.to, d.to))}
                  <br />
                  <small>slot w {p?.name} ({p && PHASE_LABEL[p.phase]}) pusty w tym czasie</small>
                </div>
              )
            })}
          </div>
        )}
      </aside>

      <section>
        <div className="tl-toolbar">
          <h2 style={{ fontSize: 14 }}>MAPA KAMPANII</h2>
          <div className="view-toggle">
            <button className={`sm ${view === 'quests' ? 'on' : ''}`} onClick={() => setView('quests')}>Questy</button>
            <button className={`sm ${view === 'heroes' ? 'on' : ''}`} onClick={() => setView('heroes')}>Bohaterowie</button>
          </div>
          <span className="dim">{fmtRange(start, addDaysISO(end, -1))}</span>
          <span className="spacer" />
          <button className="sm" onClick={() => shift(-1)} aria-label="Wcześniej">◀</button>
          <button className="sm" onClick={() => setStart(addDaysISO(mondayOf(today), zoom === 'D' ? -2 : -7))}>Dziś</button>
          <button className="sm" onClick={() => shift(1)} aria-label="Później">▶</button>
          <span style={{ width: 12 }} />
          {(Object.keys(SPAN) as Zoom[]).map(z => (
            <button key={z} className={`sm ${zoom === z ? 'on' : ''}`} title={ZOOM_LABEL[z]} onClick={() => setZoom(z)}>
              {z}
            </button>
          ))}
        </div>

        <div className="win tl">
          <div className="tl-head">
            <div style={{ padding: '8px 10px', fontSize: 12 }} className="head dim">
              {view === 'quests' ? `QUESTY (${quests.length})` : `DRUŻYNA (${heroes.length})`}
            </div>
            <div className="tl-cols">
              {cols.map(c => (
                <div key={c.from} className={`tl-col ${c.weekend ? 'weekend' : ''}`} style={{ left: `${pos(c.from)}%` }}>
                  {c.label}
                </div>
              ))}
            </div>
          </div>

          {view === 'quests' &&
            quests.map((p, i) => (
              <div key={p.id} className={i > 0 && (quests[i - 1].client ?? quests[i - 1].name) !== (p.client ?? p.name) ? 'client-start' : ''}>
                <JourneyRow world={world} project={p} start={start} end={end} pos={pos} onOpenDemand={onOpenDemand} />
              </div>
            ))}
          {view === 'quests' && quests.length === 0 && <p className="dim" style={{ padding: 16 }}>Brak questów w tym okresie.</p>}

          {view === 'heroes' && heroes.map(h => (
            <HeroRow key={h.id} world={world} hero={h} start={start} end={end} pos={pos} cols={cols} zoom={zoom} onOpenDemand={onOpenDemand} onOpenHero={onOpenHero} />
          ))}

          {today >= start && today < end && (
            <div className="tl-today" style={{ left: `calc(200px + (100% - 200px) * ${pos(today) / 100})` }} />
          )}
        </div>

        <div className="legend">
          {Object.values(CLASS_META).map(m => (
            <span key={m.short}><i style={{ background: m.color }} />{m.short}</span>
          ))}
          <span><i style={{ background: 'repeating-linear-gradient(45deg,#fff5 0 3px,transparent 3px 6px)' }} />Odpoczynek</span>
          <span><i style={{ background: '#ff5a6a55', borderColor: 'var(--red)' }} />Przeciążenie</span>
          {view === 'quests' ? (
            <span>Ścieżka w kolorze roli · czerwona = wolny slot · bohater stoi tam, gdzie jest dziś · mgła = poza questem</span>
          ) : (
            <span>Paski w kolorze projektu · kreskowane = nadchodzący · cienki = 0.5 FTE</span>
          )}
        </div>
      </section>
    </div>
  )
}

function HeroRow({ world, hero, start, end, pos, cols, zoom, onOpenDemand, onOpenHero }: {
  world: FullWorld; hero: Designer; start: ISODate; end: ISODate; pos: (d: ISODate) => number; cols: Col[]; zoom: Zoom
  onOpenDemand: (d: Demand) => void; onOpenHero: (d: Designer) => void
}) {
  const last = addDaysISO(end, -1)
  const bars = packLanes(world.demands.filter(d => d.designerId === hero.id && overlaps(d.from, d.to, start, last)))
  const lanes = Math.max(1, ...bars.map(b => b.lane + 1))
  const leaves = world.absences.filter(a => a.designerId === hero.id && overlaps(a.from, a.to, start, last))
  const over = overloadRanges(world, hero, start, last)
  const height = Math.max(58, lanes * 24 + 14)
  const meta = CLASS_META[hero.cls]

  return (
    <div className="tl-row" style={{ height }}>
      <div className="tl-who" onClick={() => onOpenHero(hero)} title="Otwórz kartę bohatera">
        <Sprite cls={hero.cls} state={designerState(world, hero)} scale={2} />
        <div className="nm">
          <b>{hero.name}</b>
          <small style={{ color: meta.color }}>{meta.short}{hero.baseFte < 1 ? ` · ${fmtFte(hero.baseFte)}` : ''}</small>
        </div>
      </div>
      <div className="tl-lane">
        <div className="tl-grid">
          {zoom === 'D' && cols.filter(c => c.weekend).map(c => (
            <div key={c.from} className="tl-col weekend" style={{ left: `${pos(c.from)}%`, width: `${100 / cols.length}%`, border: 0 }} />
          ))}
          {cols.map(c => <div key={c.from} className="tl-col" style={{ left: `${pos(c.from)}%`, padding: 0 }} />)}
        </div>
        {over.map(o => (
          <div key={o.from} className="tl-over" style={{ left: `${pos(o.from)}%`, width: `${pos(addDaysISO(o.to, 1)) - pos(o.from)}%` }} title={`Przeciążenie ${fmtRange(o.from, o.to)}`} />
        ))}
        {bars.map(b => {
          const p = world.projects.find(p => p.id === b.projectId)
          const load = demandLoad(b)
          const h = load >= 1 ? 20 : 14
          return (
            <div
              key={b.id}
              className={`tl-bar ${p?.upcoming ? 'upcoming' : ''}`}
              style={{
                left: `${pos(b.from)}%`,
                width: `${pos(addDaysISO(b.to, 1)) - pos(b.from)}%`,
                top: 8 + b.lane * 24 + (20 - h) / 2,
                height: h,
                background: p?.color ?? meta.color,
                fontSize: h < 20 ? 10 : 12,
              }}
              title={`${p?.name} · ${p && PHASE_LABEL[p.phase]} · ${fmtFte(load)} FTE · ${fmtRange(b.from, b.to)}`}
              onClick={() => onOpenDemand(b)}
            >
              {p?.name} · {p && PHASE_LABEL[p.phase]} · {fmtFte(load)}
            </div>
          )
        })}
        {leaves.map(a => (
          <div key={a.id} className="tl-leave" style={{ left: `${pos(a.from)}%`, width: `${pos(addDaysISO(a.to, 1)) - pos(a.from)}%` }} title={`${ABSENCE_LABEL[a.type]} ${fmtRange(a.from, a.to)}`}>
            {ABSENCE_LABEL[a.type]}
          </div>
        ))}
      </div>
    </div>
  )
}
