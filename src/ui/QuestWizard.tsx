import { useMemo, useState } from 'react'
import { actions, type FullWorld } from '../db'
import { COUNTRY_SUGGESTIONS, regionForCountry } from '../domain/countries'
import { addDaysISO, daysBetween, fmtRange, todayISO } from '../domain/dates'
import { PHASE_DAYS, TEAM_TEMPLATES, cloneTeam, type TeamDraft } from '../domain/templates'
import type { DesignerClass, MercenaryRole, Phase, Project, Region } from '../domain/types'
import { CLASSES, CLASS_META, MERC_META, MERC_ROLES, PHASES, PHASE_LABEL, REGIONS, REGION_META } from '../domain/types'
import { ClassBadge, Modal, fmtFte } from './common'

export const QUEST_COLORS = ['#e0a458', '#6cc4a1', '#7aa2f7', '#f78c6c', '#c792ea', '#ffcb6b', '#89ddff', '#f07178', '#c3e88d', '#ff9cac']

type Draft = Pick<Project, 'name' | 'phase' | 'from' | 'to' | 'upcoming' | 'color'> &
  Partial<Pick<Project, 'client' | 'country' | 'region' | 'owner' | 'notes'>>

/** 1 wolny slot trafi · 2–4 wolne sloty trafią · 5+ wolnych slotów trafi */
function slotsWord(n: number) {
  if (n === 1) return 'wolny slot trafi'
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
  return few ? 'wolne sloty trafią' : 'wolnych slotów trafi'
}

const STEPS = ['Projekt', 'Faza', 'Zespół', 'Podsumowanie'] as const

const PHASE_HINT: Record<Phase, string> = {
  PRESALES: 'Oferta, warsztat sprzedażowy, wycena',
  DISCOVERY: 'Badania, warsztaty, koncepcja',
  DELIVERY: 'Projektowanie i dowożenie z zespołem dev',
}

/** Kreator projektu: jedna faza na raz; skład startuje z szablonu fazy i można go poprawić. */
export function QuestWizard({ world, prefill, onClose }: { world: FullWorld; prefill?: Partial<Draft>; onClose: () => void }) {
  const today = todayISO()
  const startPhase = prefill?.phase ?? 'DISCOVERY'
  const startFrom = prefill?.from ?? today
  const [step, setStep] = useState(0)
  const [d, setD] = useState<Draft>({
    name: '',
    phase: startPhase,
    from: startFrom,
    to: addDaysISO(startFrom, PHASE_DAYS[startPhase]),
    upcoming: false,
    color: QUEST_COLORS[world.projects.length % QUEST_COLORS.length],
    region: 'EUROPE',
    ...prefill,
  })
  const [regionTouched, setRegionTouched] = useState(!!prefill?.region)
  const [team, setTeam] = useState<TeamDraft>(() => cloneTeam(TEAM_TEMPLATES[startPhase]))
  const [teamTouched, setTeamTouched] = useState(false)
  const [error, setError] = useState('')

  const clients = useMemo(() => [...new Set(world.projects.map(p => p.client).filter(Boolean))] as string[], [world.projects])
  const owners = useMemo(() => [...new Set(world.projects.map(p => p.owner).filter(Boolean))] as string[], [world.projects])

  const set = (patch: Partial<Draft>) => setD(cur => ({ ...cur, ...patch }))

  const setCountry = (country: string) => {
    const r = regionForCountry(country)
    set({ country: country || undefined, ...(r && !regionTouched ? { region: r } : {}) })
  }

  // wybór znanego klienta podpowiada kraj, kontynent, kolor i opiekuna z jego poprzedniego projektu
  const setClient = (client: string) => {
    const prev = [...world.projects].reverse().find(p => p.client === client)
    set({
      client: client || undefined,
      ...(prev && {
        country: d.country ?? prev.country,
        region: regionTouched ? d.region : prev.region ?? d.region,
        color: prev.color,
        owner: d.owner ?? prev.owner,
      }),
    })
  }

  const setPhase = (phase: Phase) => {
    set({ phase, to: addDaysISO(d.from, PHASE_DAYS[phase]) })
    if (!teamTouched) setTeam(cloneTeam(TEAM_TEMPLATES[phase]))
  }

  const editTeam = (fn: (t: TeamDraft) => TeamDraft) => {
    setTeamTouched(true)
    setTeam(t => fn(cloneTeam(t)))
  }

  const validate = (s: number) => {
    if (s === 0 && !d.name.trim()) return 'Podaj nazwę projektu.'
    if (s === 1 && (!d.from || !d.to || d.from > d.to)) return 'Data końca musi być taka sama jak startu albo późniejsza.'
    return ''
  }
  const next = () => {
    const e = validate(step)
    setError(e)
    if (!e) setStep(s => s + 1)
  }

  const create = async () => {
    const project = await actions.saveProject({ ...d, name: d.name.trim(), client: d.client?.trim() || undefined })
    for (const s of team.slots) {
      for (let i = 0; i < s.count; i++) await actions.saveDemand({ projectId: project.id, cls: s.cls, fte: s.fte, from: project.from, to: project.to })
    }
    for (const role of MERC_ROLES) {
      const n = team.mercs[role] ?? 0
      if (n > 0) await actions.setMercenaries(project.id, role, n)
    }
    onClose()
  }

  const slotCount = team.slots.reduce((n, s) => n + s.count, 0)
  const weeks = Math.round((daysBetween(d.from, d.to) + 1) / 7)

  return (
    <Modal onClose={onClose} title={prefill?.client ? `NASTĘPNA FAZA · ${prefill.client.toUpperCase()}` : 'NOWY PROJEKT'}>
      <ol className="wiz-steps" aria-label="Kroki kreatora">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'now' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="form-grid">
          <label className="field full">
            Nazwa projektu
            <input autoFocus value={d.name} placeholder="np. Aplikacja mobilna dla Helix Bank" onChange={e => set({ name: e.target.value })} />
          </label>
          <label className="field">
            Klient
            <input list="wiz-clients" value={d.client ?? ''} onChange={e => setClient(e.target.value)} />
            <datalist id="wiz-clients">{clients.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="field">
            Opiekun projektu
            <input list="wiz-owners" value={d.owner ?? ''} placeholder="PM / APM po stronie TSH" onChange={e => set({ owner: e.target.value || undefined })} />
            <datalist id="wiz-owners">{owners.map(o => <option key={o} value={o} />)}</datalist>
          </label>
          <label className="field">
            Kraj
            <input list="wiz-countries" value={d.country ?? ''} placeholder="np. Arabia Saudyjska" onChange={e => setCountry(e.target.value)} />
            <datalist id="wiz-countries">{COUNTRY_SUGGESTIONS.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="field">
            Kontynent
            <select value={d.region} onChange={e => { setRegionTouched(true); set({ region: e.target.value as Region }) }}>
              {REGIONS.map(r => <option key={r} value={r}>{REGION_META[r].label}</option>)}
            </select>
            {d.country && regionForCountry(d.country) && !regionTouched && <small>dobrany automatycznie z kraju</small>}
          </label>
          <div className="field full">
            Kolor
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUEST_COLORS.map(c => (
                <button key={c} type="button" aria-label={`Kolor ${c}`} aria-pressed={d.color === c} onClick={() => set({ color: c })}
                  style={{ background: c, width: 28, height: 28, padding: 0, outline: d.color === c ? '3px solid var(--ink)' : 'none', outlineOffset: 2 }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="form-grid">
          <div className="field full">
            Faza
            <div className="wiz-phases">
              {PHASES.map(ph => (
                <button key={ph} type="button" className={`wiz-phase ${d.phase === ph ? 'on' : ''}`} aria-pressed={d.phase === ph} onClick={() => setPhase(ph)}>
                  <b>{PHASE_LABEL[ph]}</b>
                  <small>{PHASE_HINT[ph]}</small>
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            Start
            <input type="date" value={d.from} onChange={e => set({ from: e.target.value, to: d.to < e.target.value ? addDaysISO(e.target.value, PHASE_DAYS[d.phase]) : d.to })} />
          </label>
          <label className="field">
            Koniec
            <input type="date" value={d.to} onChange={e => set({ to: e.target.value })} />
            {d.from <= d.to && <small>ok. {weeks} tyg.</small>}
          </label>
          <label className="full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={d.upcoming} onChange={e => set({ upcoming: e.target.checked })} />
            Nadchodzący: projekt jeszcze niepotwierdzony, liczy się tylko do prognozy „z nadchodzącymi”
          </label>
          <label className="field full">
            Notatki
            <textarea rows={3} value={d.notes ?? ''} placeholder="Kontekst, ryzyka, ustalenia z klientem" onChange={e => set({ notes: e.target.value || undefined })} />
          </label>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="wiz-team-head">
            <span>Sloty designerów — powstaną jako wolne sloty na cały czas fazy.</span>
            <button className="sm ghost" onClick={() => { setTeamTouched(false); setTeam(cloneTeam(TEAM_TEMPLATES[d.phase])) }}>
              Przywróć szablon {PHASE_LABEL[d.phase]}
            </button>
          </div>
          {team.slots.length === 0 && <p className="dim">Brak slotów designerskich — dodaj przynajmniej jeden albo zostaw pusty skład.</p>}
          {team.slots.map((s, i) => (
            <div key={i} className="wiz-slot">
              <select aria-label="Rola" value={s.cls} onChange={e => editTeam(t => { t.slots[i].cls = e.target.value as DesignerClass; return t })}>
                {CLASSES.map(c => <option key={c} value={c}>{CLASS_META[c].label}</option>)}
              </select>
              <select aria-label="FTE" value={s.fte} onChange={e => editTeam(t => { t.slots[i].fte = Number(e.target.value); return t })}>
                <option value={0.5}>0.5 FTE</option>
                <option value={1}>1.0 FTE</option>
              </select>
              <div className="stepper" aria-label="Liczba osób">
                <button className="sm" aria-label="Mniej" disabled={s.count <= 1} onClick={() => editTeam(t => { t.slots[i].count--; return t })}>−</button>
                <b>×{s.count}</b>
                <button className="sm" aria-label="Więcej" onClick={() => editTeam(t => { t.slots[i].count++; return t })}>+</button>
              </div>
              <button className="sm ghost" aria-label="Usuń slot" onClick={() => editTeam(t => { t.slots.splice(i, 1); return t })}>✕</button>
            </div>
          ))}
          <button className="sm" style={{ marginTop: 8 }} onClick={() => editTeam(t => { t.slots.push({ cls: 'MEDIOR_PD', fte: 1, count: 1 }); return t })}>
            + Slot designera
          </button>

          <div className="wiz-team-head" style={{ marginTop: 18 }}>
            <span>Pozostałe role (tylko do pokazania składu)</span>
          </div>
          <div className="wiz-mercs">
            {MERC_ROLES.map(role => {
              const n = team.mercs[role] ?? 0
              return (
                <div key={role} className="wiz-merc" style={{ opacity: n ? 1 : 0.55 }}>
                  <span className="dot" style={{ background: MERC_META[role].color }}>{role.slice(0, 2)}</span>
                  <span>{MERC_META[role].label}</span>
                  <div className="stepper">
                    <button className="sm" aria-label={`Mniej: ${role}`} disabled={!n} onClick={() => editTeam(t => { t.mercs[role as MercenaryRole] = n - 1; return t })}>−</button>
                    <b>{n}</b>
                    <button className="sm" aria-label={`Więcej: ${role}`} onClick={() => editTeam(t => { t.mercs[role as MercenaryRole] = n + 1; return t })}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wiz-summary">
          <div className="wiz-sum-head" style={{ borderLeftColor: d.color }}>
            {d.client && d.client !== d.name && <small>{d.client}</small>}
            <h3>{d.name}</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <span className="chip">{PHASE_LABEL[d.phase].toUpperCase()}</span>
              {d.upcoming && <span className="chip upcoming">NADCHODZĄCY</span>}
            </div>
          </div>
          <dl className="wiz-dl">
            <dt>Termin</dt><dd>{fmtRange(d.from, d.to)} · ok. {weeks} tyg.</dd>
            <dt>Region</dt><dd>{REGION_META[d.region ?? 'OTHER'].icon} {REGION_META[d.region ?? 'OTHER'].label}{d.country ? ` · ${d.country}` : ''}</dd>
            {d.owner && <><dt>Opiekun</dt><dd>{d.owner}</dd></>}
            <dt>Designerzy</dt>
            <dd style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {slotCount === 0 ? <span className="dim">brak</span> : team.slots.map((s, i) => (
                <span key={i}><ClassBadge cls={s.cls} fte={s.fte} />{s.count > 1 && ` ×${s.count}`}</span>
              ))}
            </dd>
            <dt>Pozostali</dt>
            <dd>
              {MERC_ROLES.filter(r => team.mercs[r]).map(r => `${MERC_META[r].label} ×${team.mercs[r]}`).join(', ') || <span className="dim">brak</span>}
            </dd>
            {d.notes && <><dt>Notatki</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{d.notes}</dd></>}
          </dl>
          <p className="hint" style={{ textAlign: 'left' }}>
            {slotCount > 0 ? `${slotCount} ${slotsWord(slotCount)} do zakładki Zapotrzebowanie — obsadzisz je tam z podglądem dostępności.` : 'Projekt bez slotów designerskich nie pojawi się w zakładce Zapotrzebowanie.'}
            {' '}Łączne zapotrzebowanie: {fmtFte(team.slots.reduce((n, s) => n + s.fte * s.count, 0))} FTE.
          </p>
        </div>
      )}

      {error && <p className="no" role="alert" style={{ margin: '12px 0 0' }}>{error}</p>}

      <div className="row-actions">
        <button onClick={onClose}>Anuluj</button>
        <span style={{ flex: 1 }} />
        {step > 0 && <button onClick={() => { setError(''); setStep(s => s - 1) }}>Wstecz</button>}
        {step < STEPS.length - 1 ? (
          <button className="primary" onClick={next}>Dalej</button>
        ) : (
          <button className="primary" onClick={create}>Utwórz projekt</button>
        )}
      </div>
    </Modal>
  )
}
