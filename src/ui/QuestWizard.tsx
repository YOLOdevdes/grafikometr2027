import { useMemo, useState, type DragEvent } from 'react'
import { actions, type FullWorld } from '../db'
import { evaluateCandidate } from '../domain/availability'
import { daysBetween, fmtRange } from '../domain/dates'
import { TEAM_TEMPLATES } from '../domain/templates'
import type { Demand, Designer, DesignerClass, MercenaryRole, Phase, Project } from '../domain/types'
import { CLASSES, CLASS_META, MERC_META, MERC_ROLES, PHASES, PHASE_LABEL } from '../domain/types'
import { ClassBadge, Modal, fmtFte } from './common'
import { lookOf } from './spriteSheets'
import { Sprite } from './Sprite'
import { pickLand } from './biomes'

export const QUEST_COLORS = ['#e0a458', '#6cc4a1', '#7aa2f7', '#f78c6c', '#c792ea', '#ffcb6b', '#89ddff', '#f07178', '#c3e88d', '#ff9cac']

const STEPS = ['Projekt', 'Zespół', 'Podsumowanie'] as const
const MAX_DESIGNERS = 8

interface SlotDraft {
  id?: string // istniejący slot (edycja projektu)
  designerId?: string
  cls: DesignerClass // rola slotu; po wrzuceniu osoby — jej rola
  planned?: DesignerClass // rola sprzed wrzucenia osoby, przywracana po zdjęciu
  fte: number
}

/** Sloty startowe: role z szablonu fazy, dopełnione Mediorami do zadanej liczby. */
function slotsFor(phase: Phase, count: number, keep: SlotDraft[] = []): SlotDraft[] {
  const tpl = TEAM_TEMPLATES[phase].slots.flatMap(s => Array.from({ length: s.count }, () => ({ cls: s.cls, fte: s.fte })))
  return Array.from({ length: count }, (_, i) => keep[i] ?? tpl[i] ?? { cls: 'MEDIOR_PD' as DesignerClass, fte: 1 })
}

const mercsFor = (phase: Phase): Partial<Record<MercenaryRole, number>> => ({ ...TEAM_TEMPLATES[phase].mercs })

const release = (s: SlotDraft): SlotDraft => ({ id: s.id, cls: s.planned ?? s.cls, fte: s.fte })

/** 1 wolny slot · 2–4 wolne sloty · 5+ wolnych slotów */
function freeSlotsWord(n: number) {
  if (n === 1) return 'wolny slot'
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
  return few ? 'wolne sloty' : 'wolnych slotów'
}

/**
 * Kreator projektu w trzech krokach: projekt (termin, nazwa, liczba designerów, faza) →
 * zespół (tylko osoby wolne w terminie, przeciągane do slotów + pozostałe role) → podsumowanie.
 * Między krokami można skakać klikając w pasek kroków; do przodu tylko po poprawnym wypełnieniu.
 */
export function QuestWizard({ world, prefill, editing, onClose }: { world: FullWorld; prefill?: Partial<Project>; editing?: Project; onClose: () => void }) {
  const base = editing ?? prefill
  const startPhase = base?.phase ?? 'DISCOVERY'
  const startCount = TEAM_TEMPLATES[startPhase].slots.reduce((n, s) => n + s.count, 0) || 1

  const [step, setStep] = useState(0)
  const [from, setFrom] = useState(base?.from ?? '')
  const [to, setTo] = useState(base?.to ?? '')
  const [name, setName] = useState(base?.name ?? '')
  const [phase, setPhaseState] = useState<Phase>(startPhase)
  const [slots, setSlots] = useState<SlotDraft[]>(() =>
    editing
      ? world.demands
          .filter(d => d.projectId === editing.id)
          .sort((a, b) => a.cls.localeCompare(b.cls))
          .map(d => ({ id: d.id, designerId: d.designerId, cls: d.cls, planned: d.cls, fte: d.fte }))
      : slotsFor(startPhase, startCount),
  )
  const [mercs, setMercs] = useState<Partial<Record<MercenaryRole, number>>>(() =>
    editing
      ? Object.fromEntries(world.mercenaries.filter(m => m.projectId === editing.id).map(m => [m.role, m.count]))
      : mercsFor(startPhase),
  )
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [error, setError] = useState('')

  const heroes = useMemo(() => world.designers.filter(d => !d.archivedAt), [world.designers])
  const placed = new Set(slots.map(s => s.designerId).filter(Boolean))
  const datesOk = !!from && !!to && from <= to

  const setPhase = (p: Phase) => {
    setPhaseState(p)
    if (editing) return // w edycji zmiana fazy nie nadpisuje istniejącego składu szablonem
    setMercs(mercsFor(p))
    // role wolnych slotów idą za szablonem nowej fazy; obsadzonych nie ruszamy
    setSlots(cur => {
      const tpl = slotsFor(p, cur.length)
      return cur.map((s, i) => (s.designerId ? s : tpl[i]))
    })
  }

  const setCount = (n: number) => setSlots(cur => slotsFor(phase, Math.max(1, Math.min(MAX_DESIGNERS, n)), cur))

  /** Ile FTE osoba ma wolne przez CAŁY termin: 1, 0.5 albo 0 (nie pokazujemy jej). */
  const freeFte = useMemo(() => {
    const map = new Map<string, number>()
    if (!datesOk) return map
    // w edycji pomijamy sloty tego projektu, inaczej jego własny zespół wyglądałby na zajęty
    const w = editing ? { ...world, demands: world.demands.filter(d => d.projectId !== editing.id) } : world
    for (const h of heroes) {
      const probe = (fte: number): Demand => ({ id: 'draft', projectId: 'draft', cls: h.cls, fte, from, to })
      const fte = evaluateCandidate(w, h, probe(1)).status === 'FREE' ? 1 : evaluateCandidate(w, h, probe(0.5)).status === 'FREE' ? 0.5 : 0
      map.set(h.id, Math.min(fte, h.baseFte))
    }
    return map
  }, [world, heroes, from, to, datesOk, editing])

  const roster = heroes.filter(h => (freeFte.get(h.id) ?? 0) > 0 || placed.has(h.id))

  const put = (slotIndex: number, designer: Designer) => {
    const max = freeFte.get(designer.id) ?? 1
    setSlots(cur =>
      cur.map((s, i) => {
        if (i === slotIndex) return { ...s, designerId: designer.id, cls: designer.cls, planned: s.planned ?? s.cls, fte: Math.min(s.fte, max) }
        return s.designerId === designer.id ? release(s) : s // przeniesienie z innego slotu
      }),
    )
  }
  const putFirstFree = (designer: Designer) => {
    const i = slots.findIndex(s => !s.designerId)
    if (i >= 0) put(i, designer)
    else if (slots.length < MAX_DESIGNERS) setSlots(cur => [...cur, { cls: designer.cls, fte: freeFte.get(designer.id) ?? 1, designerId: designer.id }])
  }
  const clear = (i: number) => setSlots(cur => cur.map((s, j) => (j === i ? release(s) : s)))
  const patchSlot = (i: number, patch: Partial<SlotDraft>) => setSlots(cur => cur.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  const onDrop = (i: number) => (e: DragEvent) => {
    e.preventDefault()
    setDragOver(null)
    const d = roster.find(h => h.id === e.dataTransfer.getData('text/plain'))
    if (d) put(i, d)
  }

  /** Błąd kroku albo pusty tekst, gdy krok jest kompletny. */
  const problem = (s: number) => {
    if (s === 0) {
      if (!from || !to) return 'Wybierz datę startu i zakończenia.'
      if (from > to) return 'Data zakończenia musi być taka sama jak startu albo późniejsza.'
      if (!name.trim()) return 'Podaj nazwę projektu.'
      if (slots.length < 1) return 'Projekt musi mieć przynajmniej jednego designera.'
    }
    return ''
  }

  /** Wstecz zawsze; do przodu tylko przez kompletne kroki. */
  const goTo = (target: number) => {
    for (let s = step; s < target; s++) {
      const p = problem(s)
      if (p) {
        setStep(s)
        return setError(p)
      }
    }
    setError('')
    setStep(target)
  }

  /** Edycja: projekt + synchronizacja slotów (zmiany przypisań przez assign → historia projektów). */
  const saveEdit = async (orig: Project) => {
    const project = await actions.saveProject({ ...orig, name: name.trim(), phase, from, to })
    const old = world.demands.filter(d => d.projectId === orig.id)
    const kept = new Set(slots.map(s => s.id).filter(Boolean))
    for (const d of old) if (!kept.has(d.id)) await actions.deleteDemand(d.id)
    for (const s of slots) {
      const prev = old.find(d => d.id === s.id)
      // slot na cały projekt idzie za nowym terminem; slot z własnymi datami zostaje, przycięty do projektu
      const full = !prev || (prev.from === orig.from && prev.to === orig.to)
      const range = full ? { from, to } : { from: prev.from < from ? from : prev.from, to: prev.to > to ? to : prev.to }
      const saved = await actions.saveDemand({ ...(prev ?? { projectId: project.id }), cls: s.cls, fte: s.fte, ...range, designerId: prev?.designerId })
      if (saved.designerId !== s.designerId) await actions.assign(saved.id, s.designerId)
    }
    for (const role of MERC_ROLES) await actions.setMercenaries(project.id, role, mercs[role] ?? 0)
    onClose()
  }

  const create = async () => {
    const p = problem(0)
    if (p) return goTo(0)
    if (editing) return saveEdit(editing)
    const project = await actions.saveProject({
      color: QUEST_COLORS[world.projects.length % QUEST_COLORS.length],
      region: 'EUROPE',
      land: pickLand(world.projects),
      upcoming: false,
      ...prefill,
      name: name.trim(),
      phase,
      from,
      to,
    })
    for (const s of slots) {
      const d = await actions.saveDemand({ projectId: project.id, cls: s.cls, fte: s.fte, from, to })
      if (s.designerId) await actions.assign(d.id, s.designerId) // przez assign, żeby trafiło do historii projektów
    }
    for (const role of MERC_ROLES) {
      const n = mercs[role] ?? 0
      if (n > 0) await actions.setMercenaries(project.id, role, n)
    }
    onClose()
  }

  const filled = slots.filter(s => s.designerId).length
  const open = slots.length - filled
  const weeks = datesOk ? Math.round((daysBetween(from, to) + 1) / 7) : 0

  return (
    <Modal onClose={onClose} wide title={editing ? 'EDYTUJ PROJEKT' : prefill?.client ? `NASTĘPNA FAZA · ${prefill.client.toUpperCase()}` : 'NOWY PROJEKT'}>
      <ol className="wiz-steps" aria-label="Kroki kreatora">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'now' : i < step ? 'done' : ''}>
            <button type="button" aria-current={i === step ? 'step' : undefined} onClick={() => goTo(i)}>
              <span>{i + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="form-grid">
          <label className="field">
            Start *
            <input type="date" autoFocus required value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="field">
            Zakończenie *
            <input type="date" required min={from || undefined} value={to} onChange={e => setTo(e.target.value)} />
            {datesOk && <small>ok. {weeks} tyg.</small>}
          </label>
          <label className="field full">
            Nazwa projektu *
            <input required value={name} placeholder="np. Aplikacja mobilna Helix Bank" onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && goTo(1)} />
          </label>
          <div className="field">
            Ilu designerów *
            <div className="stepper big">
              <button className="sm" aria-label="Mniej designerów" disabled={slots.length <= 1} onClick={() => setCount(slots.length - 1)}>−</button>
              <b aria-live="polite">{slots.length}</b>
              <button className="sm" aria-label="Więcej designerów" disabled={slots.length >= MAX_DESIGNERS} onClick={() => setCount(slots.length + 1)}>+</button>
            </div>
          </div>
          <div className="field full">
            Faza *
            <div className="wiz-phases" role="radiogroup" aria-label="Faza">
              {PHASES.map(ph => (
                <button key={ph} type="button" role="radio" aria-checked={phase === ph} className={`wiz-phase ${phase === ph ? 'on' : ''}`} onClick={() => setPhase(ph)}>
                  <b>{PHASE_LABEL[ph]}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wiz-team">
          <section>
            <div className="wiz-team-head">
              <span>Sloty ({filled}/{slots.length}) — przeciągnij tu kartę osoby</span>
              <button className="sm" disabled={slots.length >= MAX_DESIGNERS} onClick={() => setCount(slots.length + 1)}>+ Slot</button>
            </div>
            <div className="wiz-slots">
              {slots.map((s, i) => {
                const who = heroes.find(h => h.id === s.designerId)
                const halfOnly = who && (freeFte.get(who.id) ?? 1) < 1
                return (
                  <div
                    key={i}
                    className={`wiz-drop ${who ? 'filled' : ''} ${dragOver === i ? 'over' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(i) }}
                    onDragLeave={() => setDragOver(cur => (cur === i ? null : cur))}
                    onDrop={onDrop(i)}
                  >
                    {who ? (
                      <div className="wiz-drop-who" draggable onDragStart={e => e.dataTransfer.setData('text/plain', who.id)}>
                        <Sprite cls={who.cls} look={lookOf(who)} scale={2} badge={false} />
                        <div>
                          <b>{who.name}</b>
                          <small style={{ color: CLASS_META[who.cls].color }}>{CLASS_META[who.cls].short}</small>
                        </div>
                      </div>
                    ) : (
                      <div className="wiz-drop-empty">
                        <span>Wolny slot</span>
                        <select aria-label={`Rola slotu ${i + 1}`} value={s.cls} onChange={e => patchSlot(i, { cls: e.target.value as DesignerClass })}>
                          {CLASSES.map(c => <option key={c} value={c}>{CLASS_META[c].short}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="wiz-drop-actions">
                      <select aria-label={`FTE slotu ${i + 1}`} value={s.fte} onChange={e => patchSlot(i, { fte: Number(e.target.value) })}>
                        <option value={0.5}>0.5 FTE</option>
                        <option value={1} disabled={halfOnly}>1.0 FTE{halfOnly ? ' (zajęty)' : ''}</option>
                      </select>
                      {who ? (
                        <button className="sm ghost" aria-label={`Zdejmij ${who.name} ze slotu`} onClick={() => clear(i)}>✕</button>
                      ) : (
                        <button className="sm ghost" aria-label={`Usuń slot ${i + 1}`} disabled={slots.length <= 1} onClick={() => setSlots(cur => cur.filter((_, j) => j !== i))}>🗑</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="wiz-team-head" style={{ marginTop: 18 }}>
              <span>Pozostałe role</span>
            </div>
            <div className="wiz-checks">
              {MERC_ROLES.map(role => {
                const n = mercs[role] ?? 0
                return (
                  <label key={role} className={`wiz-check ${n ? 'on' : ''}`}>
                    <input type="checkbox" checked={n > 0} onChange={e => setMercs(m => ({ ...m, [role]: e.target.checked ? TEAM_TEMPLATES[phase].mercs[role] ?? 1 : 0 }))} />
                    <span className="dot" style={{ background: MERC_META[role].color }}>{role.slice(0, 2)}</span>
                    {MERC_META[role].label}
                    {n > 1 && <small>×{n}</small>}
                  </label>
                )
              })}
            </div>
          </section>

          <aside>
            <div className="wiz-team-head"><span>Dostępni {fmtRange(from, to)}</span></div>
            <div className="wiz-roster">
              {roster.length === 0 && (
                <p className="dim" style={{ fontSize: 13 }}>Nikt nie jest wolny w tym terminie. Sloty zostaną wolne i trafią do zakładki Zapotrzebowanie.</p>
              )}
              {roster.map(h => {
                const isPlaced = placed.has(h.id)
                const fte = freeFte.get(h.id) ?? 0
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`wiz-card ${isPlaced ? 'placed' : ''}`}
                    draggable={!isPlaced}
                    onDragStart={e => { e.dataTransfer.setData('text/plain', h.id); e.dataTransfer.effectAllowed = 'move' }}
                    onClick={() => !isPlaced && putFirstFree(h)}
                    title={isPlaced ? 'Już w zespole' : 'Przeciągnij do slotu albo kliknij, aby dodać do pierwszego wolnego'}
                    disabled={isPlaced}
                  >
                    <Sprite cls={h.cls} look={lookOf(h)} scale={2} badge={false} />
                    <span className="wiz-card-txt">
                      <b>{h.name}</b>
                      <small style={{ color: CLASS_META[h.cls].color }}>{CLASS_META[h.cls].short}</small>
                      <small className={isPlaced ? 'dim' : fte >= 1 ? 'ok' : 'warn'}>{isPlaced ? 'w zespole' : `wolny ${fmtFte(fte)} FTE`}</small>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>
        </div>
      )}

      {step === 2 && (
        <div className="wiz-summary">
          <div className="wiz-sum-head" style={{ borderLeftColor: prefill?.color ?? 'var(--accent)' }}>
            {prefill?.client && <small>{prefill.client}</small>}
            <h3>{name}</h3>
            <span className="chip">{PHASE_LABEL[phase].toUpperCase()}</span>
          </div>
          <dl className="wiz-dl">
            <dt>Termin</dt>
            <dd>{fmtRange(from, to)} · ok. {weeks} tyg.</dd>
            <dt>Designerzy</dt>
            <dd className="wiz-sum-slots">
              {slots.map((s, i) => {
                const who = heroes.find(h => h.id === s.designerId)
                return (
                  <span key={i} className="wiz-sum-slot">
                    <ClassBadge cls={s.cls} fte={s.fte} /> {who ? who.name : <span className="warn">wolny slot</span>}
                  </span>
                )
              })}
            </dd>
            <dt>Pozostałe role</dt>
            <dd>{MERC_ROLES.filter(r => mercs[r]).map(r => `${MERC_META[r].label}${(mercs[r] ?? 0) > 1 ? ` ×${mercs[r]}` : ''}`).join(', ') || <span className="dim">brak</span>}</dd>
          </dl>
          <p className="hint" style={{ textAlign: 'left' }}>
            {open > 0 ? `${open} ${freeSlotsWord(open)} trafi do zakładki Zapotrzebowanie. ` : ''}
            Łącznie {fmtFte(slots.reduce((n, s) => n + s.fte, 0))} FTE designu.
          </p>
        </div>
      )}

      {error && <p className="no" role="alert" style={{ margin: '12px 0 0' }}>{error}</p>}

      <div className="row-actions">
        {editing && (
          <button className="danger" onClick={async () => { await actions.archiveProject(editing.id, !editing.archivedAt); onClose() }}>
            {editing.archivedAt ? 'Przywróć z archiwum' : 'Archiwizuj'}
          </button>
        )}
        <button onClick={onClose}>Anuluj</button>
        <span style={{ flex: 1 }} />
        {step > 0 && <button onClick={() => goTo(step - 1)}>Wstecz</button>}
        {step < STEPS.length - 1 ? (
          <button className="primary" onClick={() => goTo(step + 1)}>Dalej</button>
        ) : (
          <button className="primary" onClick={create}>{editing ? 'Zapisz zmiany' : 'Utwórz projekt'}</button>
        )}
      </div>
    </Modal>
  )
}
