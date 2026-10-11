import { useMemo, useState } from 'react'
import { actions, type FullWorld } from '../db'
import { absenceWarnings, rankCandidates, type CandidateEval } from '../domain/availability'
import { fmt, fmtRange } from '../domain/dates'
import type { Demand, DesignerClass } from '../domain/types'
import { ABSENCE_LABEL, CLASSES, CLASS_META, PHASE_LABEL } from '../domain/types'
import { ClassBadge, Modal, designerState, fmtFte } from './common'
import { lookOf } from './spriteSheets'
import { Sprite } from './Sprite'

function StatusText({ ev }: { ev: CandidateEval }) {
  const conflicts = ev.conflicts.map(c => `${c.label} ${fmtRange(c.from, c.to)}`).join(' · ')
  switch (ev.status) {
    case 'FREE':
      return <div className="st ok">✓ Wolny{ev.classMismatch && <small className="warn">inna klasa niż zlecenie</small>}</div>
    case 'FREE_FROM':
      return <div className="st wait">⏳ Wolny od {fmt(ev.freeFrom!)}<small>{conflicts}</small></div>
    case 'PARTIAL':
      return (
        <div className="st warn">
          ⚠ Częściowo ({ev.freeDays}/{ev.totalDays} dni)
          {ev.freeFrom && ` · ciągle wolny od ${fmt(ev.freeFrom)}`}
          <small>{conflicts}</small>
        </div>
      )
    case 'BUSY':
      return <div className="st no">✕ Niedostępny<small>{conflicts}</small></div>
  }
}

export function AssignModal({ world, demand, onClose }: { world: FullWorld; demand: Demand; onClose: () => void }) {
  const project = world.projects.find(p => p.id === demand.projectId)
  const [draft, setDraft] = useState(demand)
  const [showAll, setShowAll] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(demand)

  // walidacja liczy się na roboczej wersji, żeby zmiana dat od razu przeliczała kandydatów
  const ranked = useMemo(() => {
    const w = { ...world, demands: world.demands.map(d => (d.id === draft.id ? draft : d)) }
    return rankCandidates(w, draft)
  }, [world, draft])
  const visible = showAll ? ranked : ranked.filter(r => !r.classMismatch || r.status === 'FREE')
  const warnings = absenceWarnings(world, draft)
  const assignee = world.designers.find(d => d.id === demand.designerId)

  const save = async () => {
    if (draft.from > draft.to) return alert('Data końca przed datą startu')
    await actions.saveDemand(draft)
  }
  const assign = async (designerId: string | undefined) => {
    if (dirty) await save()
    await actions.assign(demand.id, designerId)
    onClose()
  }
  const remove = async () => {
    if (confirm('Usunąć to zlecenie? Jeśli ktoś już w nim pracował, zostanie to w jego kronice.')) {
      await actions.deleteDemand(demand.id)
      onClose()
    }
  }

  return (
    <Modal onClose={onClose} wide title="OBSADŹ ZLECENIE">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <ClassBadge cls={draft.cls} fte={draft.fte + (draft.overtimeFte ?? 0)} />
        <b>{project?.name}</b>
        <span className="chip">{project && PHASE_LABEL[project.phase]}</span>
        {project?.upcoming && <span className="chip upcoming">NADCHODZĄCY</span>}
        <span className="dim">{fmtRange(draft.from, draft.to)}</span>
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
        <label className="field">
          Klasa
          <select value={draft.cls} onChange={e => setDraft({ ...draft, cls: e.target.value as DesignerClass })}>
            {CLASSES.map(c => <option key={c} value={c}>{CLASS_META[c].short}</option>)}
          </select>
        </label>
        <label className="field">
          FTE
          <select value={draft.fte} onChange={e => setDraft({ ...draft, fte: Number(e.target.value) })}>
            <option value={0.5}>0.5</option>
            <option value={1}>1.0</option>
          </select>
        </label>
        <label className="field">
          Nadgodziny
          <select value={draft.overtimeFte ?? 0} onChange={e => setDraft({ ...draft, overtimeFte: Number(e.target.value) || undefined })}>
            {[0, 0.1, 0.2, 0.3, 0.5].map(v => <option key={v} value={v}>{v ? `+${v}` : 'brak'}</option>)}
          </select>
        </label>
        <label className="field">
          Od
          <input type="date" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} />
        </label>
        <label className="field">
          Do
          <input type="date" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} />
        </label>
      </div>
      {dirty && (
        <div className="row-actions" style={{ marginTop: 8 }}>
          <button className="ghost" onClick={() => setDraft(demand)}>Cofnij zmiany</button>
          <button className="primary" onClick={save}>Zapisz zlecenie</button>
        </div>
      )}

      {assignee && (
        <div className="cand current">
          <Sprite cls={assignee.cls} look={lookOf(assignee)} state={designerState(world, assignee)} scale={2} />
          <div>
            <b>{assignee.name}</b> <small>— obecnie przypisany</small>
            {warnings.map(a => (
              <div key={a.id} className="warn" style={{ fontSize: 13 }}>⚠ {ABSENCE_LABEL[a.type]} {fmtRange(a.from, a.to)} — slot pusty w tym czasie</div>
            ))}
          </div>
          <div className="st"><button className="danger sm" onClick={() => assign(undefined)}>Odepnij</button></div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
        <div className="head" style={{ fontSize: 12, color: 'var(--accent)' }}>KANDYDACI</div>
        <label style={{ marginLeft: 'auto', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> pokaż wszystkie klasy
        </label>
      </div>
      {visible
        .filter(r => r.designer.id !== demand.designerId)
        .map(r => (
          <div key={r.designer.id} className={`cand ${r.status === 'BUSY' ? 'busy' : ''}`}>
            <Sprite cls={r.designer.cls} look={lookOf(r.designer)} state={designerState(world, r.designer)} scale={2} />
            <div>
              <b>{r.designer.name}</b>
              <br />
              <small style={{ color: CLASS_META[r.designer.cls].color }}>{CLASS_META[r.designer.cls].short}</small>
              <small> · {fmtFte(r.designer.baseFte)} FTE</small>
            </div>
            <StatusText ev={r} />
            <button
              className={r.status === 'FREE' && !r.classMismatch ? 'primary sm' : 'sm'}
              onClick={() => {
                if (r.status !== 'FREE' && !confirm(`${r.designer.name} ma konflikty w tym okresie. Przypisać mimo to?`)) return
                assign(r.designer.id)
              }}
            >
              Przypisz
            </button>
          </div>
        ))}
      {ranked.every(r => r.status !== 'FREE' || r.classMismatch) && (
        <p className="hint">Brak w pełni wolnej osoby tej klasy — niepokryte zlecenie zasila prognozę w Kuźni.</p>
      )}

      <div className="row-actions">
        <button className="danger" onClick={remove}>Usuń zlecenie</button>
        <span style={{ flex: 1 }} />
        <button onClick={onClose}>Zamknij</button>
      </div>
    </Modal>
  )
}
