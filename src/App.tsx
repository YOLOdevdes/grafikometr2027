import { useEffect, useMemo, useRef, useState } from 'react'
import { exportJSON, importJSON, useWorld, wipe } from './db'
import { loadOn } from './domain/availability'
import { addDaysISO, fmt, mondayOf, todayISO, workdays } from './domain/dates'
import { buildForecast, recruitAlerts } from './domain/forecast'
import type { Demand, Designer } from './domain/types'
import { CLASS_META } from './domain/types'
import { BoardScreen } from './screens/BoardScreen'
import { ForgeScreen } from './screens/ForgeScreen'
import { MapScreen } from './screens/MapScreen'
import { PartyScreen } from './screens/PartyScreen'
import { QuestsScreen } from './screens/QuestsScreen'
import { RestScreen } from './screens/RestScreen'
import { TitleScreen, type TitleItem } from './screens/TitleScreen'
import { seedDemo } from './seed'
import { AssignModal } from './ui/AssignModal'
import { HeroCard } from './ui/HeroCard'
import { CrtScreen } from './ui/Crt'
import { isMusicOn, onMusicChange, setMusicOn } from './ui/radio'
import { isMuted, setMuted } from './ui/sfx'
import { Logo80 } from './ui/Logo80'
import { Sprite } from './ui/Sprite'
import { fmtFte } from './ui/common'

type Tab = 'map' | 'board' | 'quests' | 'party' | 'forge' | 'rest'
type Crt = 'off' | 'crt' | 'phosphor' | 'monitor'
const CRT_KEY = 'pipolator.crt'
const CRT_NEXT: Record<Crt, Crt> = { off: 'crt', crt: 'phosphor', phosphor: 'monitor', monitor: 'off' }
const CRT_TITLE: Record<Crt, string> = { off: 'MODERN', crt: 'CRT', phosphor: 'PHOSPHOR', monitor: 'MONITOR' }
const CRT_LABEL: Record<Crt, string> = { off: 'CRT: wył.', crt: 'CRT: wł.', phosphor: 'CRT: fosfor', monitor: 'CRT: monitor' }

function useCrt(): [Crt, () => void] {
  const [mode, setMode] = useState<Crt>(() => {
    try {
      const v = localStorage.getItem(CRT_KEY)
      return v === 'crt' || v === 'phosphor' || v === 'monitor' ? v : 'off'
    } catch {
      return 'off'
    }
  })
  useEffect(() => {
    const el = document.documentElement
    el.classList.toggle('crt', mode !== 'off')
    el.classList.toggle('phosphor', mode === 'phosphor')
    el.classList.toggle('monitor', mode === 'monitor')
    try {
      localStorage.setItem(CRT_KEY, mode)
    } catch {
      /* brak storage */
    }
  }, [mode])
  return [mode, () => setMode(m => CRT_NEXT[m])]
}
const TABS: { id: Tab; label: string }[] = [
  { id: 'map', label: 'Harmonogram' },
  { id: 'board', label: 'Zapotrzebowanie' },
  { id: 'quests', label: 'Projekty' },
  { id: 'party', label: 'Zespół' },
  { id: 'forge', label: 'Rekrutacja' },
  { id: 'rest', label: 'Nieobecności' },
]

export default function App() {
  const world = useWorld()
  const [crt, cycleCrt] = useCrt()
  const [tab, setTab] = useState<Tab>('map')
  const [demandId, setDemandId] = useState<string | null>(null)
  const [heroId, setHeroId] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [muted, setMutedState] = useState(isMuted)
  const [music, setMusic] = useState(isMusicOn)
  useEffect(() => {
    const off = onMusicChange(setMusic)
    return () => {
      off()
    }
  }, [])
  const toggleMusic = () => setMusicOn(!music)
  const toggleMute = () => {
    setMuted(!muted)
    setMutedState(!muted)
  }
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

  if (!started) {
    const empty = world.designers.length === 0 && world.projects.length === 0
    const items: TitleItem[] = [
      ...(empty
        ? [
            { label: 'NEW GAME', action: () => setStarted(true) },
            { label: 'DEMO GAME', action: async () => { await seedDemo(); setStarted(true) } },
          ]
        : [{ label: 'START GAME', action: () => setStarted(true) }]),
      { label: `SCREEN: ${CRT_TITLE[crt]}`, action: cycleCrt },
      { label: `MUSIC: ${music ? 'ON' : 'OFF'}`, action: toggleMusic },
    ]
    return (
      <CrtScreen monitor={crt === 'monitor'}>
        <TitleScreen items={items} />
      </CrtScreen>
    )
  }

  if (world.designers.length === 0 && world.projects.length === 0) {
    return (
      <CrtScreen monitor={crt === 'monitor'}>
      <div className="empty-state">
        <div style={{ marginBottom: 24 }}><Logo80 /></div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 24 }}>
          <Sprite cls="MEDIOR_PD" look={{ g: 'M', skin: 2, outfit: 1 }} scale={4} />
          <Sprite cls="SENIOR_PD" look={{ g: 'F', skin: 1, outfit: 2 }} state="work" scale={4} />
          <Sprite cls="UX_RESEARCHER" look={{ g: 'F', skin: 3, outfit: 3 }} scale={4} />
        </div>
        <div className="win">
          <p>Nie ma jeszcze żadnych osób ani projektów.</p>
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
      </CrtScreen>
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
    a.download = `grafikometr2027-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <CrtScreen monitor={crt === 'monitor'}>
    <div className="app">
      <header className="topbar">
        <Logo80 size="sm" />
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
            <div className="win stat" style={{ cursor: 'pointer' }} onClick={() => setTab('board')}>
              <small>Wolne sloty</small>
              <b className={hud.open ? 'warn' : 'ok'}>{hud.open}</b>
            </div>
            <div className={`win stat ${hud.top?.scope === 'CERTAIN' ? 'alert' : ''}`} onClick={() => setTab('forge')} style={{ cursor: 'pointer' }}>
              <small>Rekrutacja</small>
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
              <button className={`sm ${music ? 'on' : ''}`} onClick={toggleMusic} title={music ? 'Wyłącz radio' : 'Włącz radio Datawave FM'} aria-pressed={music}>
                {music ? '📻 Muzyka: wł.' : '📻 Muzyka: wył.'}
              </button>
              <button className="sm" onClick={toggleMute} title={muted ? 'Włącz dźwięk kliku' : 'Wycisz dźwięk kliku'} aria-pressed={!muted}>
                {muted ? '🔇 Dźwięk: wył.' : '🔊 Dźwięk: wł.'}
              </button>
              <button className={`sm ${crt !== 'off' ? 'on' : ''}`} onClick={cycleCrt} title="Efekt monitora: wył. → CRT → fosfor → monitor">📺 {CRT_LABEL[crt]}</button>
            </div>
          </div>
        )}
      </header>

      <main className="content">
        {tab === 'map' && <MapScreen world={world} onOpenDemand={openDemand} onOpenHero={openHero} />}
        {tab === 'board' && <BoardScreen world={world} onOpenDemand={openDemand} />}
        {tab === 'quests' && <QuestsScreen world={world} onOpenDemand={openDemand} />}
        {tab === 'party' && <PartyScreen world={world} onOpenHero={openHero} />}
        {tab === 'forge' && <ForgeScreen world={world} />}
        {tab === 'rest' && <RestScreen world={world} />}
      </main>

      <footer style={{ padding: '0 22px 16px', fontSize: 12 }} className="dim">
        Dane trzymane lokalnie w tej przeglądarce — rób backup.{' '}
        <button className="ghost sm" onClick={async () => { if (confirm('Wyczyścić WSZYSTKIE dane? Najpierw zrób backup.')) await wipe() }}>Wyczyść dane</button>
        <span style={{ float: 'right' }}>Grafiki: postacie — Mucho Pixels · las — ansimuz (itch.io)</span>
      </footer>

      {demand && <AssignModal key={demand.id} world={world} demand={demand} onClose={() => setDemandId(null)} />}
      {hero && <HeroCard key={hero.id} world={world} designer={hero} onClose={() => setHeroId(null)} />}
      <ImportInput fileRef={fileRef} />
    </div>
    </CrtScreen>
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
