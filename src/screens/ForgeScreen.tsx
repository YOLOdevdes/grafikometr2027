import { useMemo, useState } from 'react'
import { actions, type FullWorld } from '../db'
import { fmt, todayISO } from '../domain/dates'
import { buildForecast, recruitAlerts, type WeekPoint } from '../domain/forecast'
import type { DesignerClass } from '../domain/types'
import { CLASSES, CLASS_META } from '../domain/types'
import { fmtFte } from '../ui/common'

// paleta zwalidowana (dataviz validate_palette, dark): podaż / popyt pewny / popyt z nadchodzącymi
const SERIES = [
  { key: 'supply', label: 'Podaż', color: '#3a8fd9', dash: undefined },
  { key: 'demandCertain', label: 'Popyt pewny', color: '#b8800f', dash: undefined },
  { key: 'demandAll', label: 'Popyt z nadchodzącymi', color: '#e2559f', dash: '5 4' },
] as const

const W = 560
const H = 220
const PAD = { l: 34, r: 12, t: 12, b: 26 }

function ForecastChart({ cls, points }: { cls: DesignerClass; points: WeekPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...points.flatMap(p => [p.supply, p.demandAll])) * 1.15
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const x = (i: number) => PAD.l + (i / points.length) * iw
  const y = (v: number) => PAD.t + ih - (v / max) * ih
  const step = (key: keyof WeekPoint) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[key] as number)} L${x(i + 1)},${y(p[key] as number)}`).join(' ')
  const ticks = Array.from({ length: Math.floor(max) + 1 }, (_, i) => i).filter(v => max < 8 || v % 2 === 0)

  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Prognoza podaży i popytu: ${CLASS_META[cls].short}`}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          const i = Math.floor(((px - PAD.l) / iw) * points.length)
          setHover(i >= 0 && i < points.length ? i : null)
        }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#ffffff1a" />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        {points.map((p, i) =>
          i % 4 === 0 ? <text key={p.week} x={x(i)} y={H - 6}>{fmt(p.week)}</text> : null,
        )}
        {/* luka: popyt ponad podaż */}
        {points.map((p, i) =>
          p.demandAll > p.supply + 0.05 ? (
            <rect key={p.week} x={x(i)} width={x(i + 1) - x(i)} y={y(p.demandAll)} height={y(p.supply) - y(p.demandAll)}
              fill={p.demandCertain > p.supply + 0.05 ? '#ff5a6a55' : '#ff5a6a26'} />
          ) : null,
        )}
        {SERIES.map(s => (
          <path key={s.key} d={step(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
        ))}
        {hover !== null && <line x1={x(hover + 0.5)} x2={x(hover + 0.5)} y1={PAD.t} y2={PAD.t + ih} stroke="#ffffff80" />}
      </svg>
      {hover !== null && (
        <div className="win flat" style={{ position: 'absolute', top: 6, left: `${Math.min(70, (hover / points.length) * 100)}%`, padding: '6px 10px', fontSize: 12, pointerEvents: 'none' }}>
          <div className="dim">tydzień {fmt(points[hover].week)}</div>
          {SERIES.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="4"><line x1="0" x2="14" y1="2" y2="2" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash ? '3 2' : undefined} /></svg>
              <b>{fmtFte(Math.round((points[hover][s.key] as number) * 10) / 10)}</b> <span className="dim">{s.label}</span>
            </div>
          ))}
          <div className="dim">nieobsadzone: {fmtFte(Math.round(points[hover].unfilledAll * 10) / 10)}</div>
        </div>
      )}
    </div>
  )
}

export function ForgeScreen({ world }: { world: FullWorld }) {
  const [weeks, setWeeks] = useState(26)
  const [table, setTable] = useState(false)
  const forecast = useMemo(() => buildForecast(world, todayISO(), weeks), [world, weeks])
  const alerts = recruitAlerts(forecast, world.settings.alertWeeks)

  return (
    <div>
      <div className="tl-toolbar">
        <h2 style={{ fontSize: 14 }}>KUŹNIA REKRUTACJI</h2>
        <span className="spacer" />
        <span className="dim">horyzont</span>
        {[12, 26, 52].map(w => (
          <button key={w} className={`sm ${weeks === w ? 'on' : ''}`} onClick={() => setWeeks(w)}>{w} tyg.</button>
        ))}
        <span className="dim" style={{ marginLeft: 12 }}>alert po</span>
        <select style={{ width: 80 }} value={world.settings.alertWeeks} onChange={e => actions.saveSettings({ alertWeeks: Number(e.target.value) })}>
          {[2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n} tyg.</option>)}
        </select>
        <button className="sm" onClick={() => setTable(t => !t)}>{table ? 'Wykresy' : 'Tabela'}</button>
      </div>

      <div className="win" style={{ marginBottom: 22 }}>
        <div className="win-title">WYROCZNIA MÓWI</div>
        {alerts.length === 0 && <div className="ok">✓ Podaż pokrywa popyt w całym horyzoncie. Spokojny sen dla head of design.</div>}
        {CLASSES.flatMap(cls => {
          const certain = alerts.find(a => a.cls === cls && a.scope === 'CERTAIN')
          const all = alerts.find(a => a.cls === cls && a.scope === 'ALL')
          if (!certain && !all) return []
          return [
            <div key={cls} className={`alert-row ${certain ? '' : 'soft'}`}>
              <span style={{ fontSize: 20 }}>{certain ? '⚠' : '◔'}</span>
              <div>
                <b>Brakuje {fmtFte((certain ?? all)!.peakGap)} FTE · {CLASS_META[cls].short}</b>
                <br />
                <small>
                  {certain && `pewne: od ${fmt(certain.from)} przez ${certain.weeks} tyg.`}
                  {certain && all && ' · '}
                  {all && `z nadchodzącymi: od ${fmt(all.from)} (szczyt ${fmtFte(all.peakGap)})`}
                </small>
              </div>
            </div>,
          ]
        })}
        <p className="hint" style={{ textAlign: 'left', marginBottom: 0 }}>
          Podaż = suma dostępności osób danej klasy minus nieobecności. Popyt = suma zleceń tej klasy (obsadzonych i pustych). Alert, gdy popyt przewyższa podaż przez ≥ {world.settings.alertWeeks} tyg. z rzędu.
        </p>
      </div>

      {!table ? (
        <>
          <div className="legend" style={{ marginTop: 0, marginBottom: 12 }}>
            {SERIES.map(s => (
              <span key={s.key}>
                <svg width="18" height="6" style={{ marginRight: 6 }}><line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash ? '4 3' : undefined} /></svg>
                {s.label}
              </span>
            ))}
            <span><i style={{ background: '#ff5a6a55' }} />Luka (ciemniej = pewna)</span>
          </div>
          <div className="forge-grid">
            {CLASSES.map(cls => (
              <div key={cls} className="win">
                <div className="win-title" style={{ color: CLASS_META[cls].color }}>{CLASS_META[cls].short.toUpperCase()}</div>
                <ForecastChart cls={cls} points={forecast[cls]} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="win" style={{ overflow: 'auto' }}>
          <table className="list">
            <thead>
              <tr>
                <th>Tydzień</th>
                {CLASSES.map(c => <th key={c} colSpan={3}>{CLASS_META[c].short} (podaż / pewny / wszystkie)</th>)}
              </tr>
            </thead>
            <tbody>
              {forecast.SENIOR_PD.map((_, i) => (
                <tr key={i}>
                  <td>{fmt(forecast.SENIOR_PD[i].week)}</td>
                  {CLASSES.flatMap(c => {
                    const p = forecast[c][i]
                    const r = (v: number) => fmtFte(Math.round(v * 10) / 10)
                    return [
                      <td key={c + 's'}>{r(p.supply)}</td>,
                      <td key={c + 'c'} className={p.demandCertain > p.supply + 0.05 ? 'no' : ''}>{r(p.demandCertain)}</td>,
                      <td key={c + 'a'} className={p.demandAll > p.supply + 0.05 ? 'warn' : ''}>{r(p.demandAll)}</td>,
                    ]
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
