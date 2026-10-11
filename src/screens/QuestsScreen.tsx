import { useState } from 'react'
import { actions, type FullWorld } from '../db'
import { absenceWarnings, demandLoad } from '../domain/availability'
import { addDaysISO, fmtRange, todayISO } from '../domain/dates'
import type { Demand, DesignerClass, Phase, Project, Region } from '../domain/types'
import { ABSENCE_LABEL, CLASSES, CLASS_META, MERC_META, MERC_ROLES, PHASES, PHASE_LABEL, REGIONS, REGION_META } from '../domain/types'
import { ClassBadge, Modal, designerState, fmtFte } from '../ui/common'
import { lookOf } from '../ui/spriteSheets'
import { Sprite } from '../ui/Sprite'

const COLORS = ['#e0a458', '#6cc4a1', '#7aa2f7', '#f78c6c', '#c792ea', '#ffcb6b', '#89ddff', '#f07178', '#c3e88d', '#ff9cac']

type Filter = 'ACTIVE' | 'UPCOMING' | 'ENDED' | 'ARCHIVED'

function inFilter(p: Project, f: Filter, today: string) {
  if (f === 'ARCHIVED') return !!p.archivedAt
  if (p.archivedAt) return false
  if (f === 'ENDED') return p.to < today
  if (f === 'UPCOMING') return p.to >= today && (p.upcoming || p.from > today)
  return p.to >= today && !p.upcoming && p.from <= today
}

export function QuestsScreen({ world, onOpenDemand }: { world: FullWorld; onOpenDemand: (d: Demand) => void }) {
  const today = todayISO()
  const [filter, setFilter] = useState<Filter>('ACTIVE')
  const [editing, setEditing] = useState<Project | 'new' | null>(null)
  const [addingTo, setAddingTo] = useState<Project | null>(null)

  const match = (p: Project) => inFilter(p, filter, today)
  const list = world.projects.filter(match).sort((a, b) => (a.client ?? a.name).localeCompare(b.client ?? b.name) || a.from.localeCompare(b.from))

  const count = (f: Filter) => world.projects.filter(p => inFilter(p, f, today)).length

  return (
    <div>
      <div className="tl-toolbar">
        <h2 style={{ fontSize: 14 }}>QUESTY</h2>
        {(['ACTIVE', 'UPCOMING', 'ENDED', 'ARCHIVED'] as Filter[]).map(f => (
          <button key={f} className={`sm ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {{ ACTIVE: 'Trwające', UPCOMING: 'Nadchodzące', ENDED: 'Zakończone', ARCHIVED: 'Archiwum' }[f]} ({count(f)})
          </button>
        ))}
        <span className="spacer" />
        <button className="primary" onClick={() => setEditing('new')}>+ Nowy quest</button>
      </div>

      {list.length === 0 && <p className="dim">Pusto. Dodaj quest przyciskiem „+ Nowy quest”.</p>}

      <div className="quest-grid">
        {list.map(p => (
          <QuestCard key={p.id} world={world} project={p} onEdit={() => setEditing(p)} onAddDemand={() => setAddingTo(p)} onOpenDemand={onOpenDemand} />
        ))}
      </div>

      {editing && <ProjectForm world={world} project={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {addingTo && <NewDemandForm project={addingTo} onClose={() => setAddingTo(null)} />}
    </div>
  )
}

function QuestCard({ world, project: p, onEdit, onAddDemand, onOpenDemand }: {
  world: FullWorld; project: Project; onEdit: () => void; onAddDemand: () => void; onOpenDemand: (d: Demand) => void
}) {
  const demands = world.demands.filter(d => d.projectId === p.id).sort((a, b) => a.cls.localeCompare(b.cls) || a.from.localeCompare(b.from))
  const mercs = world.mercenaries.filter(m => m.projectId === p.id)
  const empty = demands.filter(d => !d.designerId).length

  return (
    <div className="win quest" style={p.upcoming ? { borderStyle: 'dashed' } : undefined}>
      <div className="band" style={{ background: p.color }} />
      <header>
        <div>
          {p.client && p.client !== p.name && <small style={{ fontSize: 11 }}>{p.client.toUpperCase()}</small>}
          <h3>{p.name}</h3>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span className="chip">{PHASE_LABEL[p.phase].toUpperCase()}</span>
            {p.upcoming && <span className="chip upcoming">NADCHODZĄCY</span>}
            {empty > 0 && <span className="chip" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{empty} wolne sloty</span>}
          </div>
          <small>{fmtRange(p.from, p.to)}</small>
        </div>
        <button className="sm ghost" onClick={onEdit} title="Edytuj quest">✎</button>
      </header>

      <div style={{ paddingLeft: 6 }}>
        {demands.map(d => {
          const who = world.designers.find(x => x.id === d.designerId)
          const warn = absenceWarnings(world, d).filter(a => a.to >= todayISO())
          return (
            <div key={d.id} className={`slot ${who ? '' : 'empty'}`} onClick={() => onOpenDemand(d)}>
              {who ? <Sprite cls={who.cls} look={lookOf(who)} state={designerState(world, who)} scale={2} /> : <div style={{ width: 32, height: 40, display: 'grid', placeItems: 'center', fontSize: 22, color: 'var(--red)' }}>?</div>}
              <div style={{ minWidth: 0 }}>
                <b>{who?.name ?? 'Wolny slot'}</b>
                <br />
                <ClassBadge cls={d.cls} fte={demandLoad(d)} />
                {warn.map(a => (
                  <div key={a.id} className="warn" style={{ fontSize: 12 }}>⚠ {ABSENCE_LABEL[a.type]} {fmtRange(a.from, a.to)}</div>
                ))}
              </div>
              <div className="meta dim">{d.from !== p.from || d.to !== p.to ? fmtRange(d.from, d.to) : 'cały quest'}</div>
            </div>
          )
        })}
        <button className="sm" style={{ marginTop: 10 }} onClick={onAddDemand}>+ Zapotrzebowanie</button>

        <div className="mercs">
          {MERC_ROLES.map(role => {
            const m = mercs.find(x => x.role === role)
            const n = m?.count ?? 0
            return (
              <span key={role} className="token" style={{ opacity: n ? 1 : 0.4 }} title={`${MERC_META[role].label}${m ? ` · ${fmtFte(m.fte)} FTE` : ''}`}>
                <span className="dot" style={{ background: MERC_META[role].color }}>{role.slice(0, 2)}</span>
                <span>{MERC_META[role].label} ×{n}</span>
                <button className="ghost sm" style={{ padding: '0 4px' }} onClick={() => actions.setMercenaries(p.id, role, n - 1, m?.fte)} disabled={!n} aria-label={`Usuń ${role}`}>−</button>
                <button className="ghost sm" style={{ padding: '0 4px' }} onClick={() => actions.setMercenaries(p.id, role, n + 1, m?.fte)} aria-label={`Dodaj ${role}`}>+</button>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ProjectForm({ world, project, onClose }: { world: FullWorld; project?: Project; onClose: () => void }) {
  const today = todayISO()
  const [p, setP] = useState<Partial<Project>>(
    project ?? { name: '', phase: 'DISCOVERY', from: today, to: addDaysISO(today, 60), upcoming: false, region: 'EUROPE', color: COLORS[world.projects.length % COLORS.length] },
  )
  const clients = [...new Set(world.projects.map(x => x.client).filter(Boolean))] as string[]

  const save = async () => {
    if (!p.name?.trim()) return alert('Podaj nazwę')
    if (!p.from || !p.to || p.from > p.to) return alert('Sprawdź daty')
    const saved = await actions.saveProject({ ...(p as Project), name: p.name.trim() })
    // przesunięcie dat questu przesuwa zlecenia, które pokrywały cały quest
    if (project && (project.from !== saved.from || project.to !== saved.to)) {
      for (const d of world.demands.filter(d => d.projectId === project.id)) {
        const next = { ...d, from: d.from === project.from ? saved.from : d.from, to: d.to === project.to ? saved.to : d.to }
        if (next.from !== d.from || next.to !== d.to) await actions.saveDemand(next)
      }
    }
    onClose()
  }

  return (
    <Modal onClose={onClose} title={project ? 'EDYTUJ QUEST' : 'NOWY QUEST'}>
      <div className="form-grid">
        <label className="field">
          Nazwa
          <input autoFocus value={p.name ?? ''} onChange={e => setP({ ...p, name: e.target.value })} />
        </label>
        <label className="field">
          Klient (grupuje fazy)
          <input list="clients" value={p.client ?? ''} onChange={e => setP({ ...p, client: e.target.value || undefined })} />
          <datalist id="clients">{clients.map(c => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="field">
          Faza
          <select value={p.phase} onChange={e => setP({ ...p, phase: e.target.value as Phase })}>
            {PHASES.map(ph => <option key={ph} value={ph}>{PHASE_LABEL[ph]}</option>)}
          </select>
        </label>
        <label className="field">
          Kraj
          <input value={p.country ?? ''} placeholder="np. Arabia Saudyjska" onChange={e => setP({ ...p, country: e.target.value || undefined })} />
        </label>
        <label className="field">
          Kontynent → kraina
          <select value={p.region ?? 'OTHER'} onChange={e => setP({ ...p, region: e.target.value as Region })}>
            {REGIONS.map(r => <option key={r} value={r}>{REGION_META[r].label} · {REGION_META[r].land}</option>)}
          </select>
        </label>
        <label className="field">
          Kolor
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} type="button" aria-label={c} onClick={() => setP({ ...p, color: c })}
                style={{ background: c, width: 26, height: 26, padding: 0, outline: p.color === c ? '3px solid #fff' : 'none' }} />
            ))}
          </div>
        </label>
        <label className="field">
          Start
          <input type="date" value={p.from} onChange={e => setP({ ...p, from: e.target.value })} />
        </label>
        <label className="field">
          Koniec
          <input type="date" value={p.to} onChange={e => setP({ ...p, to: e.target.value })} />
        </label>
        <label className="full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={!!p.upcoming} onChange={e => setP({ ...p, upcoming: e.target.checked })} />
          Nadchodzący — projekt jeszcze niepotwierdzony / dopiero ruszy (liczy się tylko do prognozy „z nadchodzącymi”)
        </label>
      </div>
      <div className="row-actions">
        {project && (
          <button className="danger" onClick={async () => { await actions.archiveProject(project.id, !project.archivedAt); onClose() }}>
            {project.archivedAt ? 'Przywróć z archiwum' : 'Archiwizuj'}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={onClose}>Anuluj</button>
        <button className="primary" onClick={save}>Zapisz</button>
      </div>
    </Modal>
  )
}

function NewDemandForm({ project, onClose }: { project: Project; onClose: () => void }) {
  const [cls, setCls] = useState<DesignerClass>('SENIOR_PD')
  const [fte, setFte] = useState(1)
  const [count, setCount] = useState(1)
  const [from, setFrom] = useState(project.from)
  const [to, setTo] = useState(project.to)

  const save = async () => {
    if (from > to) return alert('Sprawdź daty')
    for (let i = 0; i < count; i++) await actions.saveDemand({ projectId: project.id, cls, fte, from, to })
    onClose()
  }

  return (
    <Modal onClose={onClose} title={`ZAPOTRZEBOWANIE · ${project.name}`}>
      <div className="form-grid">
        <label className="field">
          Klasa
          <select value={cls} onChange={e => setCls(e.target.value as DesignerClass)}>
            {CLASSES.map(c => <option key={c} value={c}>{CLASS_META[c].label}</option>)}
          </select>
        </label>
        <label className="field">
          FTE
          <select value={fte} onChange={e => setFte(Number(e.target.value))}>
            <option value={0.5}>0.5</option>
            <option value={1}>1.0</option>
          </select>
        </label>
        <label className="field">
          Od
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="field">
          Do
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <label className="field">
          Ile slotów
          <input type="number" min={1} max={10} value={count} onChange={e => setCount(Math.max(1, Number(e.target.value)))} />
        </label>
      </div>
      <p className="hint" style={{ textAlign: 'left' }}>Sloty pojawią się na Tablicy zleceń — obsadzisz je z walidacją dostępności.</p>
      <div className="row-actions">
        <button onClick={onClose}>Anuluj</button>
        <button className="primary" onClick={save}>Dodaj</button>
      </div>
    </Modal>
  )
}
