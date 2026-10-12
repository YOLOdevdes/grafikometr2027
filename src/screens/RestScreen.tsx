import { useState } from 'react'
import { actions, type FullWorld } from '../db'
import { addDaysISO, fmtRange, overlaps, todayISO, workdays } from '../domain/dates'
import type { Absence, AbsenceType } from '../domain/types'
import { ABSENCE_LABEL, CLASS_META, PHASE_LABEL } from '../domain/types'
import { Modal } from '../ui/common'
import { lookOf } from '../ui/spriteSheets'
import { Sprite } from '../ui/Sprite'

export function RestScreen({ world }: { world: FullWorld }) {
  const today = todayISO()
  const [editing, setEditing] = useState<Partial<Absence> | null>(null)
  const [showPast, setShowPast] = useState(false)
  const name = (id: string) => world.designers.find(d => d.id === id)
  const list = world.absences
    .filter(a => showPast || a.to >= today)
    .sort((a, b) => a.from.localeCompare(b.from))

  return (
    <div>
      <div className="tl-toolbar">
        <h2 style={{ fontSize: 14 }}>NIEOBECNOŚCI</h2>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)} /> pokaż przeszłe
        </label>
        <span className="spacer" />
        <button className="primary" onClick={() => setEditing({ type: 'VACATION', from: today, to: addDaysISO(today, 4) })}>+ Nieobecność</button>
      </div>

      <div className="win">
        <table className="list">
          <thead>
            <tr><th>Osoba</th><th>Typ</th><th>Termin</th><th>Dni rob.</th><th>Wpływ na projekty</th><th /></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={6} className="dim">Brak zaplanowanych nieobecności.</td></tr>}
            {list.map(a => {
              const d = name(a.designerId)
              const hit = world.demands.filter(dm => dm.designerId === a.designerId && overlaps(dm.from, dm.to, a.from, a.to))
              return (
                <tr key={a.id} className={a.to < today ? 'past' : ''}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {d && <Sprite cls={d.cls} look={lookOf(d)} state="sleep" scale={2} />}
                      <div><b>{d?.name ?? '?'}</b><br /><small style={{ color: d ? CLASS_META[d.cls].color : undefined }}>{d && CLASS_META[d.cls].short}</small></div>
                    </div>
                  </td>
                  <td>{ABSENCE_LABEL[a.type]}{a.note && <><br /><small>{a.note}</small></>}</td>
                  <td>{fmtRange(a.from, a.to)}</td>
                  <td>{workdays(a.from, a.to).length}</td>
                  <td>
                    {hit.length === 0 ? <small>—</small> : hit.map(dm => {
                      const p = world.projects.find(p => p.id === dm.projectId)
                      return <div key={dm.id} className="warn" style={{ fontSize: 13 }}>⚠ {p?.name} · {p && PHASE_LABEL[p.phase]}</div>
                    })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="sm ghost" onClick={() => setEditing(a)}>✎</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editing && <AbsenceForm world={world} absence={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function AbsenceForm({ world, absence, onClose }: { world: FullWorld; absence: Partial<Absence>; onClose: () => void }) {
  const [a, setA] = useState(absence)
  const heroes = world.designers.filter(d => !d.archivedAt)
  const save = async () => {
    if (!a.designerId) return alert('Wybierz osobę')
    if (!a.from || !a.to || a.from > a.to) return alert('Sprawdź daty')
    await actions.saveAbsence(a as Absence)
    onClose()
  }
  return (
    <Modal onClose={onClose} title={absence.id ? 'EDYTUJ NIEOBECNOŚĆ' : 'NOWA NIEOBECNOŚĆ'}>
      <div className="form-grid">
        <label className="field">
          Osoba
          <select autoFocus value={a.designerId ?? ''} onChange={e => setA({ ...a, designerId: e.target.value })}>
            <option value="" disabled>— wybierz —</option>
            {heroes.map(d => <option key={d.id} value={d.id}>{d.name} · {CLASS_META[d.cls].short}</option>)}
          </select>
        </label>
        <label className="field">
          Typ
          <select value={a.type} onChange={e => setA({ ...a, type: e.target.value as AbsenceType })}>
            {(Object.keys(ABSENCE_LABEL) as AbsenceType[]).map(t => <option key={t} value={t}>{ABSENCE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="field">
          Od
          <input type="date" value={a.from} onChange={e => setA({ ...a, from: e.target.value, to: a.to && a.to < e.target.value ? e.target.value : a.to })} />
        </label>
        <label className="field">
          Do
          <input type="date" value={a.to} onChange={e => setA({ ...a, to: e.target.value })} />
        </label>
        <label className="field full">
          Notatka
          <input value={a.note ?? ''} onChange={e => setA({ ...a, note: e.target.value || undefined })} />
        </label>
      </div>
      <div className="row-actions">
        {absence.id && <button className="danger" onClick={async () => { await actions.deleteAbsence(absence.id!); onClose() }}>Usuń</button>}
        <span style={{ flex: 1 }} />
        <button onClick={onClose}>Anuluj</button>
        <button className="primary" onClick={save}>Zapisz</button>
      </div>
    </Modal>
  )
}
