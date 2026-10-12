import { addMonths, format, startOfMonth } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type FullWorld } from '../db'
import { demandLoad, overloadRanges } from '../domain/availability'
import { addDaysISO, daysBetween, fmtRange, fromISO, maxISO, mondayOf, overlaps, toISO, todayISO } from '../domain/dates'
import type { Demand, Designer, ISODate, Project } from '../domain/types'
import { ABSENCE_LABEL, CLASS_META, PHASE_LABEL } from '../domain/types'
import { designerState, fmtFte } from '../ui/common'
import { lookOf } from '../ui/spriteSheets'
import { Sprite } from '../ui/Sprite'
import { DesignerForm } from '../ui/HeroCard'
import { AbsenceIcon } from '../ui/AbsenceIcon'
import { QuestWizard } from '../ui/QuestWizard'
import { NotebookButton, TodoNotebook } from '../ui/TodoNotebook'
import { JourneyRow } from './JourneyRow'
import { READ_ONLY } from '../mode'

export type Zoom = 'T' | 'M' | 'R'
type View = 'quests' | 'heroes'

const VIEW_KEY = 'pipolator.mapView'
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'heroes' ? 'heroes' : 'quests'
  } catch {
    return 'quests'
  }
}
const SPAN: Record<Zoom, number> = { T: 84, M: 182, R: 364 }
const ZOOM_LABEL: Record<Zoom, string> = { T: 'Tydzień', M: 'Miesiąc', R: 'Rok' }

interface Col { from: ISODate; label: string }

function columns(zoom: Zoom, start: ISODate, end: ISODate): Col[] {
  const cols: Col[] = []
  if (zoom === 'T') {
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
  const [wizard, setWizard] = useState(false)
  const [addingPerson, setAddingPerson] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [notebookFor, setNotebookFor] = useState<Designer | null>(null)
  const openTodos = useLiveQuery(async () => {
    const m = new Map<string, number>()
    for (const t of await db.todos.toArray()) if (!t.done) m.set(t.designerId, (m.get(t.designerId) ?? 0) + 1)
    return m
  }, [])
  const [view, setViewState] = useState<View>(readView)
  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* brak storage — trudno */
    }
  }
  const [start, setStart] = useState(() => addDaysISO(mondayOf(today), -21))
  const span = SPAN[zoom]
  const end = addDaysISO(start, span) // wyłącznie
  const pos = (d: ISODate) => (Math.max(0, Math.min(span, daysBetween(start, d))) / span) * 100
  const cols = useMemo(() => columns(zoom, start, end), [zoom, start, end])

  const heroes = world.designers.filter(d => !d.archivedAt)
  const quests = world.projects
    .filter(p => !p.archivedAt && overlaps(p.from, p.to, start, addDaysISO(end, -1)))
    .sort((a, b) => (a.client ?? a.name).localeCompare(b.client ?? b.name) || a.from.localeCompare(b.from))

  const shift = (dir: number) => setStart(s => addDaysISO(s, dir * Math.round(span / 3)))

  return (
    <div>
      <section>
        <div className="tl-toolbar">
          <h2 style={{ fontSize: 14 }}>HARMONOGRAM</h2>
          <div className="view-toggle">
            <button className={`sm ${view === 'quests' ? 'on' : ''}`} onClick={() => setView('quests')}>Projekty</button>
            <button className={`sm ${view === 'heroes' ? 'on' : ''}`} onClick={() => setView('heroes')}>Osoby</button>
          </div>
          <span className="dim">{fmtRange(start, addDaysISO(end, -1))}</span>
          <span className="spacer" />
          {READ_ONLY ? null : view === 'quests' ? (
            <button className="primary sm" onClick={() => setWizard(true)}>+ Nowy projekt</button>
          ) : (
            <button className="primary sm" onClick={() => setAddingPerson(true)}>+ Dodaj osobę</button>
          )}
          <span style={{ width: 12 }} />
          <button className="sm" onClick={() => shift(-1)} aria-label="Wcześniej">◀</button>
          <button className="sm" onClick={() => setStart(addDaysISO(mondayOf(today), -21))}>Dziś</button>
          <button className="sm" onClick={() => shift(1)} aria-label="Później">▶</button>
          <span style={{ width: 12 }} />
          {(Object.keys(SPAN) as Zoom[]).map(z => (
            <button key={z} className={`sm ${zoom === z ? 'on' : ''}`} aria-pressed={zoom === z} onClick={() => setZoom(z)}>
              {ZOOM_LABEL[z]}
            </button>
          ))}
        </div>

        <div className="win tl">
          <div className="tl-head">
            <div style={{ padding: '8px 10px', fontSize: 12 }} className="head dim">
              {view === 'quests' ? `PROJEKTY (${quests.length})` : `ZESPÓŁ (${heroes.length})`}
            </div>
            <div className="tl-cols">
              {cols.map(c => (
                <div key={c.from} className="tl-col" style={{ left: `${pos(c.from)}%` }}>
                  {c.label}
                </div>
              ))}
            </div>
          </div>

          {view === 'quests' &&
            quests.map((p, i) => (
              <div key={p.id} className={i > 0 && (quests[i - 1].client ?? quests[i - 1].name) !== (p.client ?? p.name) ? 'client-start' : ''}>
                <JourneyRow world={world} project={p} start={start} end={end} pos={pos} onOpenDemand={onOpenDemand} onOpenHero={onOpenHero} onEditProject={() => setEditingProject(p)} />
              </div>
            ))}
          {view === 'quests' && quests.length === 0 && <p className="dim" style={{ padding: 16 }}>Brak projektów w tym okresie.</p>}

          {view === 'heroes' && heroes.map(h => (
            <HeroRow key={h.id} world={world} hero={h} start={start} end={end} pos={pos} cols={cols} onOpenDemand={onOpenDemand} onOpenHero={onOpenHero} openTodos={openTodos?.get(h.id) ?? 0} onOpenNotebook={() => setNotebookFor(h)} />
          ))}

          {today >= start && today < end && (
            <div className="tl-today" style={{ left: `calc(200px + (100% - 200px) * ${pos(today) / 100})` }} />
          )}
        </div>

        <div className="legend">
          {Object.values(CLASS_META).map(m => (
            <span key={m.short}><i style={{ background: m.color }} />{m.short}</span>
          ))}
          <span><i style={{ background: 'repeating-linear-gradient(45deg,#fff5 0 3px,transparent 3px 6px)' }} />Nieobecność</span>
          <span><i style={{ background: '#e0493a55', borderColor: 'var(--red)' }} />Przeciążenie</span>
          {view === 'quests' ? (
            <span>Postać = osoba w projekcie, stoi na dzisiejszej dacie · szara z czerwoną etykietą = wolny slot · przyciemnione = poza czasem projektu</span>
          ) : (
            <span>Paski w kolorze projektu · kreskowane = nadchodzący · cienki = 0.5 FTE</span>
          )}
        </div>
      </section>
      {wizard && <QuestWizard world={world} onClose={() => setWizard(false)} />}
      {addingPerson && <DesignerForm onClose={() => setAddingPerson(false)} />}
      {notebookFor && <TodoNotebook designer={notebookFor} onClose={() => setNotebookFor(null)} />}
      {editingProject && <QuestWizard world={world} editing={editingProject} onClose={() => setEditingProject(null)} />}
    </div>
  )
}

function HeroRow({ world, hero, start, end, pos, cols, onOpenDemand, onOpenHero, openTodos, onOpenNotebook }: {
  world: FullWorld; hero: Designer; start: ISODate; end: ISODate; pos: (d: ISODate) => number; cols: Col[]
  onOpenDemand: (d: Demand) => void; onOpenHero: (d: Designer) => void; openTodos: number; onOpenNotebook: () => void
}) {
  const last = addDaysISO(end, -1)
  const bars = packLanes(world.demands.filter(d => d.designerId === hero.id && overlaps(d.from, d.to, start, last)))
  const lanes = Math.max(1, ...bars.map(b => b.lane + 1))
  const leaves = world.absences.filter(a => a.designerId === hero.id && overlaps(a.from, a.to, start, last))
  const over = overloadRanges(world, hero, start, last)
  const height = Math.max(72, lanes * 24 + 14)
  const meta = CLASS_META[hero.cls]

  return (
    <div className="tl-row" style={{ height }}>
      <div className="tl-who" onClick={() => onOpenHero(hero)}>
        <Sprite cls={hero.cls} look={lookOf(hero)} state={designerState(world, hero)} scale={2} badge={false} />
        <div className="nm">
          <b>{hero.name}</b>
          <small style={{ color: meta.color }}>{meta.short}{hero.baseFte < 1 ? ` · ${fmtFte(hero.baseFte)}` : ''}</small>
        </div>
        <NotebookButton designer={hero} open={openTodos} onOpen={onOpenNotebook} />
      </div>
      <div className="tl-lane">
        <div className="tl-grid">
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
            <AbsenceIcon type={a.type} size={1} />
            <span>{ABSENCE_LABEL[a.type]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
