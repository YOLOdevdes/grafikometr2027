import { useState, type CSSProperties } from 'react'
import { actions, type FullWorld } from '../db'
import { freeOn, loadOn, nextFreeDay } from '../domain/availability'
import { chronicleOf, isPast } from '../domain/chronicle'
import { addDaysISO, daysBetween, fmt, fmtRange, mondayOf, todayISO, workdays } from '../domain/dates'
import type { Designer, DesignerClass, Look } from '../domain/types'
import { ABSENCE_LABEL, CLASSES, CLASS_META, PHASE_LABEL } from '../domain/types'
import { Modal, STATE_LABEL, designerState, fmtFte } from './common'
import { lookOf } from './spriteSheets'
import { Sprite } from './Sprite'

const ICON: Record<DesignerClass, string> = { SENIOR_PD: '♛', MEDIOR_PD: '⚔', UX_RESEARCHER: '◉' }

function Heart({ value }: { value: string }) {
  return (
    <div className="hc-heart" title="Wolne FTE w tym tygodniu">
      <svg viewBox="0 0 58 52">
        <path d="M29 49 C10 35 3 26 3 16 C3 8 9 3 16 3 C22 3 26 6 29 11 C32 6 36 3 42 3 C49 3 55 8 55 16 C55 26 48 35 29 49Z" fill="#ff4d6d" stroke="#111" strokeWidth="4" />
      </svg>
      <b>{value}</b>
    </div>
  )
}

export function HeroCard({ world, designer, onClose }: { world: FullWorld; designer: Designer; onClose: () => void }) {
  const [flipped, setFlipped] = useState(false)
  const [editing, setEditing] = useState(false)
  const meta = CLASS_META[designer.cls]
  const today = todayISO()
  const chronicle = chronicleOf(world, designer.id)
  const active = world.demands.filter(d => d.designerId === designer.id && d.from <= today && today <= d.to)
  const week = workdays(mondayOf(today), addDaysISO(mondayOf(today), 4))
  const freeWeek = Math.max(0, week.reduce((s, day) => s + freeOn(world, designer, day), 0) / (week.length || 1))
  const nextFree = nextFreeDay(world, designer, today, 0.5)
  const weeksToFree = nextFree ? Math.ceil(daysBetween(today, nextFree) / 7) : '∞'
  const absences = world.absences.filter(a => a.designerId === designer.id && a.to >= today).sort((a, b) => a.from.localeCompare(b.from))
  const index = world.designers.findIndex(d => d.id === designer.id) + 1
  const state = designerState(world, designer)

  if (editing) return <DesignerForm designer={designer} onClose={() => setEditing(false)} />

  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="card-stage">
        <div className={`hero-card ${flipped ? 'flipped' : ''}`} style={{ '--cc': meta.color } as CSSProperties} onClick={() => setFlipped(f => !f)}>
          <div className="hero-face">
            <div className="hc-top">
              <div className="hc-icon">{ICON[designer.cls]}</div>
              <span>Grafikometr2027</span>
              <span className="line" />
              <span>№{String(index).padStart(3, '0')}</span>
            </div>
            <div className="hc-title">{designer.name}</div>
            <div className="hc-sub">{designer.title ? `${designer.title} · ` : ''}{meta.label}</div>
            <div className="hc-art">
              {designer.illustration ? (
                <img src={designer.illustration} alt={`Ilustracja: ${designer.name}`} />
              ) : (
                <div className="placeholder"><Sprite cls={designer.cls} look={lookOf(designer)} state={state} scale={7} /></div>
              )}
              {designer.cls !== 'MEDIOR_PD' && <div className="holo" />}
              <div className="hc-rarity">{meta.rarity.toUpperCase()}</div>
            </div>
            <div className="hc-now">
              {active.length ? (
                active.map(d => {
                  const p = world.projects.find(p => p.id === d.projectId)
                  return <div key={d.id}>⚔ {p?.name} · {p && PHASE_LABEL[p.phase]} · {fmtFte(d.fte + (d.overtimeFte ?? 0))} do {fmt(d.to)}</div>
                })
              ) : (
                <div>☺ {STATE_LABEL[state]}</div>
              )}
            </div>
            <div className="hc-stats">
              <div className="hc-stat" title="Aktywne projekty"><span>⚔</span>{active.length}</div>
              <div className="hc-stat" title="Projekty w historii"><span>📜</span>{chronicle.length}</div>
              <div className="hc-stat" title={nextFree ? `Wolny (≥0.5) od ${fmt(nextFree)}` : 'Brak wolnego terminu w ciągu roku'}><span>⏳</span>{weeksToFree}</div>
              <Heart value={fmtFte(Math.round(freeWeek * 10) / 10)} />
            </div>
          </div>

          <div className="hero-face back">
            <div className="hc-back-h">HISTORIA PROJEKTÓW</div>
            <div className="chron">
              {chronicle.length === 0 && <small>Brak projektów w historii.</small>}
              {chronicle.map(e => (
                <div key={e.demandId + e.from} className="chron-item" style={{ opacity: isPast(e) ? 0.65 : 1 }}>
                  <b>{e.projectName}</b> · {PHASE_LABEL[e.phase]} {e.to >= today && e.from <= today && '· teraz'}
                  <small>{fmtRange(e.from, e.to)} · {fmtFte(e.fte)} FTE{e.client ? ` · ${e.client}` : ''}</small>
                </div>
              ))}
            </div>
            <div className="hc-back-h" style={{ fontSize: 18 }}>NIEOBECNOŚCI</div>
            <div style={{ fontSize: 13, minHeight: 40 }}>
              {absences.length === 0 && <small>Brak zaplanowanych nieobecności.</small>}
              {absences.slice(0, 4).map(a => <div key={a.id}>🏝 {ABSENCE_LABEL[a.type]} {fmtRange(a.from, a.to)}</div>)}
            </div>
            <div className="hc-now">Obciążenie dziś: {fmtFte(loadOn(world, designer.id, today))} / {fmtFte(designer.baseFte)} FTE</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setFlipped(f => !f)}>↻ Odwróć</button>
          <button onClick={() => setEditing(true)}>✎ Edytuj</button>
          <button onClick={onClose}>Zamknij</button>
        </div>
        <p className="hint">kliknij kartę, by ją odwrócić · Esc zamyka</p>
      </div>
    </div>
  )
}

async function resizeImage(file: File, max = 900): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const s = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * s)
    c.height = Math.round(img.height * s)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/webp', 0.88)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function DesignerForm({ designer, onClose }: { designer?: Designer; onClose: () => void }) {
  const [d, setD] = useState<Partial<Designer>>(designer ?? { cls: 'MEDIOR_PD', baseFte: 1, name: '' })
  const save = async () => {
    if (!d.name?.trim()) return alert('Podaj imię')
    await actions.saveDesigner({ ...(d as Designer), name: d.name.trim() })
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
          Specjalizacja
          <input value={d.title ?? ''} placeholder="np. Design systemy, Research ilościowy" onChange={e => setD({ ...d, title: e.target.value || undefined })} />
        </label>
        <label className="field">
          Rola
          <select value={d.cls} onChange={e => setD({ ...d, cls: e.target.value as DesignerClass })}>
            {CLASSES.map(c => <option key={c} value={c}>{CLASS_META[c].label}</option>)}
          </select>
        </label>
        <label className="field">
          Dostępność bazowa
          <select value={d.baseFte} onChange={e => setD({ ...d, baseFte: Number(e.target.value) })}>
            {[1, 0.8, 0.6, 0.5].map(v => <option key={v} value={v}>{fmtFte(v)} FTE</option>)}
          </select>
        </label>
        <div className="field full">
          Wygląd postaci
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ background: 'var(--input)', border: '2px solid #5f7a7c', borderRadius: 3, padding: 4 }}>
              <Sprite cls={d.cls} look={lookOf({ id: d.id ?? 'new', look: d.look })} scale={2} state="work" />
            </div>
            {(
              [
                ['g', 'Postać', [['M', 'On'], ['F', 'Ona']]],
                ['skin', 'Skóra', [[1, '1'], [2, '2'], [3, '3']]],
                ['outfit', 'Strój', [[1, '1'], [2, '2'], [3, '3']]],
              ] as const
            ).map(([k, label, opts]) => (
              <label key={k} className="field" style={{ flex: 1 }}>
                {label}
                <select
                  value={String(lookOf({ id: d.id ?? 'new', look: d.look })[k])}
                  onChange={e => {
                    const cur = lookOf({ id: d.id ?? 'new', look: d.look })
                    const v = k === 'g' ? e.target.value : Number(e.target.value)
                    setD({ ...d, look: { ...cur, [k]: v } as Look })
                  }}
                >
                  {opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
        <label className="field full">
          Ilustracja na kartę
          <input
            type="file"
            accept="image/*"
            onChange={async e => {
              const f = e.target.files?.[0]
              if (f) setD({ ...d, illustration: await resizeImage(f) })
            }}
          />
        </label>
        {d.illustration && (
          <div className="full" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img src={d.illustration} alt="" style={{ width: 80, height: 80, objectFit: 'cover', border: '3px solid #000', borderRadius: 6 }} />
            <button className="sm" onClick={() => setD({ ...d, illustration: undefined })}>Usuń ilustrację</button>
          </div>
        )}
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
