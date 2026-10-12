import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { actions, db, type FullWorld } from '../db'
import { loadOn } from '../domain/availability'
import { chronicleOf, isPast } from '../domain/chronicle'
import { addDaysISO, fmt, fmtRange, todayISO } from '../domain/dates'
import type { AbsenceType, Designer, DesignerClass, Look } from '../domain/types'
import { ABSENCE_LABEL, CLASS_META, PHASE_LABEL } from '../domain/types'
import { Modal, designerState, fmtFte } from './common'
import { AbsenceIcon } from './AbsenceIcon'
import { cardArtFor, useCardArt } from './cardArt'
import { lookOf } from './spriteSheets'
import { Sprite } from './Sprite'
import { READ_ONLY } from '../mode'

const UNIT = 0.5 // jednostka planowania: pół etatu

const AWAY_NOW: Record<AbsenceType, string> = { VACATION: 'Na urlopie', SICK: 'Na L4', TRAINING: 'Na szkoleniu', OTHER: 'Nieobecny' }

/** Zajęte FTE w kostkach po 0.5: pełny etat = 2 kostki; nadgodziny jako czerwone kostki ponad etat. */
function FteBlocks({ load, base }: { load: number; base: number }) {
  const baseUnits = Math.max(1, Math.ceil(base / UNIT - 1e-6))
  const used = Math.round(load / UNIT)
  const cells = Math.max(baseUnits, used)
  return (
    <div className="pxc-fte" title={`Zajęte ${fmtFte(load)} z ${fmtFte(base)} FTE (kostka = 0.5 FTE)`}>
      <span className="pxc-fte-cells" role="meter" aria-label="Zajęte FTE" aria-valuemin={0} aria-valuemax={base} aria-valuenow={load}>
        {Array.from({ length: cells }, (_, i) => (
          <i key={i} className={i >= baseUnits ? 'over' : i < used ? 'on' : ''} />
        ))}
      </span>
      <b>{fmtFte(load)} / {fmtFte(base)} FTE</b>
    </div>
  )
}

export function HeroCard({ world, designer, onClose }: { world: FullWorld; designer: Designer; onClose: () => void }) {
  const [flipped, setFlipped] = useState(false)
  const [editing, setEditing] = useState(false)
  const [leave, setLeave] = useState<{ from: string; to: string; type: AbsenceType } | null>(null)
  const [leaveError, setLeaveError] = useState('')
  const meta = CLASS_META[designer.cls]
  const today = todayISO()
  const chronicle = chronicleOf(world, designer.id)
  const projectOf = (id: string) => world.projects.find(p => p.id === id)
  const current = world.demands.filter(d => d.designerId === designer.id && d.from <= today && today <= d.to)
  const upcoming = current.length
    ? []
    : world.demands.filter(d => d.designerId === designer.id && d.from > today).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 1)
  const load = loadOn(world, designer.id, today)
  const absences = world.absences.filter(a => a.designerId === designer.id && a.to >= today).sort((a, b) => a.from.localeCompare(b.from))
  const onLeave = absences.find(a => a.from <= today)
  const soon = !onLeave ? absences.find(a => a.from <= addDaysISO(today, 30)) : undefined
  const state = designerState(world, designer)
  // eksperyment z ilustracjami: własna wgrana grafika ma pierwszeństwo, potem ilustracja roli i płci
  const cardArtOn = useCardArt()
  const uploaded = designer.illustration?.startsWith('data:') ? designer.illustration : undefined
  const art = cardArtOn ? uploaded ?? cardArtFor(designer) : designer.illustration

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !editing && (leave ? setLeave(null) : onClose())
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing, leave])

  const saveLeave = async () => {
    if (!leave?.from || !leave.to) return setLeaveError('Wybierz daty urlopu.')
    if (leave.from > leave.to) return setLeaveError('Koniec urlopu musi być taki sam jak początek albo późniejszy.')
    await actions.saveAbsence({ designerId: designer.id, ...leave })
    setLeave(null)
    setLeaveError('')
  }

  if (editing) return <DesignerForm designer={designer} onClose={() => setEditing(false)} />

  const projectRow = (d: (typeof current)[number], prefix = '') => {
    const p = projectOf(d.projectId)
    return (
      <div key={d.id} className="pxc-proj" style={{ borderLeftColor: p?.color }}>
        <span>
          <b>{prefix}{p?.name ?? '?'}</b>
          <small>{p ? `${PHASE_LABEL[p.phase]} · ${fmtRange(p.from, p.to)}` : ''}</small>
        </span>
        <em>{fmtFte(d.fte + (d.overtimeFte ?? 0))} FTE</em>
      </div>
    )
  }

  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="card-stage">
        <div className={`pxcard role-${designer.cls} ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)} role="group" aria-label={`Karta: ${designer.name}`}>
          <div className="pxc-face">
            <div className="pxc-inner">
              <div className="pxc-top">
                <span className="pxc-title">
                  <span className="pxc-name">{designer.name}</span>
                  {onLeave && <AbsenceIcon type={onLeave.type} size={2} title={`${ABSENCE_LABEL[onLeave.type]} do ${fmt(onLeave.to)}`} />}
                </span>
              </div>
              <span className="pxc-role-chip">{meta.label}</span>
              <div className={`pxc-art ${art ? 'with-art' : ''}`}>
                <span className={`pxc-leave ${onLeave ? 'on' : soon ? 'soon' : ''}`}>
                  {onLeave ? `${AWAY_NOW[onLeave.type]} · do ${fmt(onLeave.to)}` : soon ? `${ABSENCE_LABEL[soon.type]} od ${fmt(soon.from)}` : 'Nie na urlopie'}
                </span>
                {art ? (
                  <img className="pxc-illu" src={art} alt={`Ilustracja: ${designer.name}`} />
                ) : (
                  <Sprite cls={designer.cls} look={lookOf(designer)} state={state} scale={5} badge={false} />
                )}
              </div>
              <FteBlocks load={load} base={designer.baseFte} />
              <div className="pxc-projects">
                {current.map(d => projectRow(d))}
                {upcoming.map(d => projectRow(d, 'Od ' + fmt(d.from) + ': '))}
                {current.length === 0 && upcoming.length === 0 && <p className="pxc-empty">Brak projektu.</p>}
              </div>
            </div>
          </div>

          <div className="pxc-face back">
            <div className="pxc-inner">
              <div className="pxc-top">
                <span className="pxc-title">Historia</span>
              </div>
              <div className="pxc-list">
                {chronicle.length === 0 && <p className="pxc-empty">Brak projektów w historii.</p>}
                {chronicle.map(e => (
                  <div key={e.demandId + e.from} className={`pxc-entry ${isPast(e) ? 'past' : ''}`}>
                    <b>{e.projectName}</b>
                    <small>{PHASE_LABEL[e.phase]} · {fmtRange(e.from, e.to)} · {fmtFte(e.fte)} FTE{e.to >= today && e.from <= today ? ' · teraz' : ''}</small>
                  </div>
                ))}
              </div>
              <div className="pxc-sub">Nieobecności</div>
              <div className="pxc-list short">
                {absences.length === 0 && <p className="pxc-empty">Brak zaplanowanych nieobecności.</p>}
                {absences.map(a => (
                  <div key={a.id} className={`pxc-entry ${READ_ONLY ? '' : 'with-action'}`}>
                    <span><b>{ABSENCE_LABEL[a.type]}</b><small>{fmtRange(a.from, a.to)}</small></span>
                    {!READ_ONLY && <button
                      className="sm ghost"
                      aria-label={`Usuń: ${ABSENCE_LABEL[a.type]} ${fmtRange(a.from, a.to)}`}
                      title="Usuń nieobecność"
                      onClick={async e => {
                        e.stopPropagation() // nie odwracaj karty
                        if (confirm(`Usunąć: ${ABSENCE_LABEL[a.type]} ${fmtRange(a.from, a.to)}?`)) await actions.deleteAbsence(a.id)
                      }}
                    >
                      ✕
                    </button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {leave ? (
          <div className="win pxc-leave-form" role="group" aria-label="Dodaj urlop">
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <label className="field">
                Od
                <input type="date" autoFocus value={leave.from} onChange={e => setLeave({ ...leave, from: e.target.value })} />
              </label>
              <label className="field">
                Do
                <input type="date" min={leave.from || undefined} value={leave.to} onChange={e => setLeave({ ...leave, to: e.target.value })} />
              </label>
              <label className="field">
                Typ
                <select value={leave.type} onChange={e => setLeave({ ...leave, type: e.target.value as AbsenceType })}>
                  {(Object.keys(ABSENCE_LABEL) as AbsenceType[]).map(t => <option key={t} value={t}>{ABSENCE_LABEL[t]}</option>)}
                </select>
              </label>
            </div>
            {leaveError && <p className="no" role="alert" style={{ margin: '8px 0 0', fontSize: 13 }}>{leaveError}</p>}
            <div className="row-actions" style={{ marginTop: 10 }}>
              <button onClick={() => { setLeave(null); setLeaveError('') }}>Anuluj</button>
              <button className="primary" onClick={saveLeave}>Zapisz urlop</button>
            </div>
          </div>
        ) : READ_ONLY ? null : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="primary" onClick={() => setLeave({ from: '', to: '', type: 'VACATION' })}>Dodaj urlop</button>
            <button onClick={() => setEditing(true)}>Edytuj</button>
          </div>
        )}
        <p className="hint">kliknij kartę, by ją odwrócić · kliknij obok albo Esc, by zamknąć</p>
      </div>
    </div>
  )
}

type Gender = NonNullable<Designer['gender']>

/**
 * Losuje skórę i strój tak, żeby zestaw (płeć + skóra + strój) się nie powtarzał.
 * Gdy wszystkie 9 zestawów danej płci jest zajętych, wybiera spośród najrzadziej używanych.
 */
function pickLook(gender: Gender, others: Designer[], avoid?: Look): Look {
  const count = new Map<string, number>()
  for (const o of others) {
    const l = lookOf(o)
    if (l.g === gender) count.set(`${l.skin}${l.outfit}`, (count.get(`${l.skin}${l.outfit}`) ?? 0) + 1)
  }
  const all: Look[] = []
  for (const skin of [1, 2, 3] as const) for (const outfit of [1, 2, 3] as const) all.push({ g: gender, skin, outfit })
  const min = Math.min(...all.map(l => count.get(`${l.skin}${l.outfit}`) ?? 0))
  let pool = all.filter(l => (count.get(`${l.skin}${l.outfit}`) ?? 0) === min)
  if (avoid && pool.length > 1) pool = pool.filter(l => l.skin !== avoid.skin || l.outfit !== avoid.outfit)
  return pool[Math.floor(Math.random() * pool.length)]
}

export function DesignerForm({ designer, onClose }: { designer?: Designer; onClose: () => void }) {
  const [d, setD] = useState<Partial<Designer>>(designer ?? { cls: 'SENIOR_PD', baseFte: 1, name: '' })
  const everyone = useLiveQuery(() => db.designers.toArray(), []) ?? []
  const others = everyone.filter(o => o.id !== designer?.id && !o.archivedAt)
  // Medior nie jest już wybierany przy dodawaniu; zostaje tylko w edycji osoby, która go ma
  const roles = (['SENIOR_PD', 'UX_RESEARCHER'] as DesignerClass[]).concat(designer?.cls === 'MEDIOR_PD' ? ['MEDIOR_PD'] : [])
  const roleLabel = (c: DesignerClass) => (c === 'MEDIOR_PD' ? 'Product Designer (Medior)' : CLASS_META[c].label)

  const setGender = (g: Gender | undefined) =>
    setD(cur => ({ ...cur, gender: g, look: g && (!designer || !cur.look || cur.look.g !== g) ? pickLook(g, others) : cur.look }))
  const reroll = () => d.gender && setD(cur => ({ ...cur, look: pickLook(d.gender!, others, cur.look) }))

  const save = async () => {
    if (!d.name?.trim()) return alert('Podaj imię')
    if (!d.gender) return alert('Wybierz płeć')
    const look = d.look ?? pickLook(d.gender, others)
    await actions.saveDesigner({ ...(d as Designer), look, name: d.name.trim() })
    onClose()
  }
  return (
    <Modal onClose={onClose} title={designer ? 'EDYTUJ OSOBĘ' : 'NOWA OSOBA'}>
      <div className="form-grid">
        <label className="field">
          Imię
          <input autoFocus value={d.name ?? ''} onChange={e => setD({ ...d, name: e.target.value })} />
        </label>
        <label className="field">
          Rola
          <select value={d.cls} onChange={e => setD({ ...d, cls: e.target.value as DesignerClass })}>
            {roles.map(c => <option key={c} value={c}>{roleLabel(c)}</option>)}
          </select>
        </label>
        <label className="field">
          Płeć
          <select required value={d.gender ?? ''} onChange={e => setGender((e.target.value || undefined) as Gender | undefined)}>
            <option value="" disabled>— wybierz —</option>
            <option value="F">Kobieta</option>
            <option value="M">Mężczyzna</option>
          </select>
        </label>
        <label className="field">
          Dostępność bazowa
          <select value={d.baseFte} onChange={e => setD({ ...d, baseFte: Number(e.target.value) })}>
            {[1, 0.8, 0.6, 0.5].map(v => <option key={v} value={v}>{fmtFte(v)} FTE</option>)}
          </select>
        </label>
        <div className="field full">
          Wygląd ludzika
          {d.gender ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ background: 'var(--input)', border: '2px solid #5f7a7c', borderRadius: 3, padding: 4 }}>
                <Sprite cls={d.cls} look={lookOf({ id: d.id ?? 'new', look: d.look, gender: d.gender })} scale={2} state="work" />
              </div>
              <span className="dim" style={{ fontSize: 13, flex: 1 }}>Skóra i strój są losowane tak, żeby nie powtarzały się w zespole.</span>
              <button className="sm" type="button" onClick={reroll}>Losuj inny</button>
            </div>
          ) : (
            <span className="dim" style={{ fontSize: 13 }}>Wybierz płeć — wygląd dobierze się automatycznie.</span>
          )}
        </div>
      </div>
      <div className="row-actions">
        {designer && (
          <button className="danger" onClick={async () => { await actions.archiveDesigner(designer.id, !designer.archivedAt); onClose() }}>
            {designer.archivedAt ? 'Przywróć do zespołu' : 'Archiwizuj'}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={onClose}>Anuluj</button>
        <button className="primary" onClick={save}>Zapisz</button>
      </div>
    </Modal>
  )
}
