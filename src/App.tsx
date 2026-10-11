import { useMemo, useRef, useState } from 'react'
import { exportJSON, importJSON, useWorld, wipe } from './db'
import { loadOn } from './domain/availability'
import { addDaysISO, fmt, mondayOf, todayISO, workdays } from './domain/dates'
import { buildForecast, recruitAlerts } from './domain/forecast'
import type { Demand, Designer } from './domain/types'
import { CLASS_META } from './domain/types'
import { ForgeScreen } from './screens/ForgeScreen'
import { MapScreen } from './screens/MapScreen'
import { PartyScreen } from './screens/PartyScreen'
import { QuestsScreen } from './screens/QuestsScreen'
import { RestScreen } from './screens/RestScreen'
import { seedDemo } from './seed'
import { AssignModal } from './ui/AssignModal'
import { HeroCard } from './ui/HeroCard'
import { Sprite } from './ui/Sprite'
import { fmtFte } from './ui/common'

type Tab = 'map' | 'quests' | 'party' | 'forge' | 'rest'
const TABS: { id: Tab; label: string }[] = [
  { id: 'map', label: 'Mapa' },
  { id: 'quests', label: 'Questy' },
  { id: 'party', label: 'Drużyna' },
  { id: 'forge', label: 'Kuźnia' },
  { id: 'rest', label: 'Odpoczynek' },
]

export default function App() {
  const world = useWorld()
  const [tab, setTab] = useState<Tab>('map')
  const [demandId, setDemandId] = useState<string | null>(null)
  const [heroId, setHeroId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const hud = useMemo(() => {
    if (!world) return null
    const today = todayISO()
    const heroes = world.designers.filter(d => !d.archivedAt)
    const week = workdays(mondayOf(today), addDaysISO(mondayOf(today), 4))
    const cap = heroes.reduce((s, d) => s + d.baseFte, 0) * week.length
    const load = heroes.reduce((s, d) => s + week.reduce((ss, day) => ss + loadOn(world, d.id, day), 0), 0)
    const open = world.demands.filter(d => !d.designerId && d.to >= today).length
    const alerts = recruitAlerts(buildForecast(world, today, 26), world.settings.alertWeeks)
    const top = alerts.find(a => a.scope === 'CERTAIN') ?? alerts[0]
    return { util: cap ? load / cap : 0, open, top, alertCount: alerts.length }
  }, [world])

  if (!world) return null

  if (world.designers.length === 0 && world.projects.length === 0) {
    return (
      <div className="empty-state">
        <div className="logo" style={{ fontSize: 34, marginBottom: 24 }}>PIPOLATOR</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 24 }}>
          <Sprite cls="MEDIOR_PD" scale={5} />
          <Sprite cls="SENIOR_PD" state="work" scale={5} />
          <Sprite cls="UX_RESEARCHER" scale={5} />
        </div>
        <div className="win">
          <p>Twoja drużyna jeszcze się nie zebrała.</p>
          <div className="row-actions" style={{ justifyContent: 'center' }}>
            <button className="primary" onClick={seedDemo}>Wczytaj dane demo</button>
            <button onClick={() => setTab('party')}>Zacznij od zera</button>
            <button onClick={() => fileRef.current?.click()}>Importuj backup</button>
          </div>
        </div>
        {tab === 'party' && (
          <div style={{ marginTop: 24, textAlign: 'left' }}>
            <PartyScreen world={world} onOpenHero={d => setHeroId(d.id)} />
          </div>
        )}
        <ImportInput fileRef={fileRef} />
      </div>
    )
  }

  const demand = world.demands.find(d => d.id === demandId)
  const hero = world.designers.find(d => d.id === heroId)
  const openDemand = (d: Demand) => setDemandId(d.id)
  const openHero = (d: Designer) => setHeroId(d.id)

  const download = async () => {
    const blob = new Blob([await exportJSON()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pipolator-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">PIPOLATOR</div>
        <nav className="tabs">
          {TABS.map(t => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        {hud && (
          <div className="hud">
            <div className="win stat">
              <small>Obłożenie (ten tydz.)</small>
              <b>{Math.round(hud.util * 100)}%</b>
              <div className="meter"><i style={{ width: `${Math.min(100, hud.util * 100)}%`, background: hud.util > 1 ? 'var(--red)' : hud.util > 0.9 ? 'var(--amber)' : 'var(--green)' }} /></div>
            </div>
            <div className="win stat" style={{ cursor: 'pointer' }} onClick={() => setTab('map')}>
              <small>Otwarte zlecenia</small>
              <b className={hud.open ? 'warn' : 'ok'}>{hud.open}</b>
            </div>
            <div className={`win stat ${hud.top?.scope === 'CERTAIN' ? 'alert' : ''}`} onClick={() => setTab('forge')} style={{ cursor: 'pointer' }}>
              <small>Kuźnia</small>
              {hud.top ? (
                <b style={{ fontSize: 14 }}>
                  −{fmtFte(hud.top.peakGap)} {CLASS_META[hud.top.cls].short}
                  <br />
                  <small>od {fmt(hud.top.from)}{hud.top.scope === 'ALL' ? ' (z nadch.)' : ''}</small>
                </b>
              ) : (
                <b className="ok" style={{ fontSize: 14 }}>✓ bez braków</b>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button className="sm" onClick={download} title="Pobierz kopię zapasową (JSON)">⬇ Backup</button>
              <button className="sm" onClick={() => fileRef.current?.click()} title="Wczytaj kopię zapasową">⬆ Import</button>
            </div>
          </div>
        )}
      </header>

      <main className="content">
        {tab === 'map' && <MapScreen world={world} onOpenDemand={openDemand} onOpenHero={openHero} />}
        {tab === 'quests' && <QuestsScreen world={world} onOpenDemand={openDemand} />}
        {tab === 'party' && <PartyScreen world={world} onOpenHero={openHero} />}
        {tab === 'forge' && <ForgeScreen world={world} />}
        {tab === 'rest' && <RestScreen world={world} />}
      </main>

      <footer style={{ padding: '0 22px 16px', fontSize: 12 }} className="dim">
        Dane trzymane lokalnie w tej przeglądarce — rób backup.{' '}
        <button className="ghost sm" onClick={async () => { if (confirm('Wyczyścić WSZYSTKIE dane? Najpierw zrób backup.')) await wipe() }}>Wyczyść dane</button>
      </footer>

      {demand && <AssignModal key={demand.id} world={world} demand={demand} onClose={() => setDemandId(null)} />}
      {hero && <HeroCard key={hero.id} world={world} designer={hero} onClose={() => setHeroId(null)} />}
      <ImportInput fileRef={fileRef} />
    </div>
  )
}

function ImportInput({ fileRef }: { fileRef: React.RefObject<HTMLInputElement> }) {
  return (
    <input
      ref={fileRef}
      type="file"
      accept="application/json"
      hidden
      onChange={async e => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        if (!confirm('Import zastąpi wszystkie obecne dane. Kontynuować?')) return
        try {
          await importJSON(await f.text())
        } catch (err) {
          alert(`Nie udało się wczytać: ${(err as Error).message}`)
        }
      }}
    />
  )
}
