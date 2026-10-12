import { useEffect, useMemo, useRef, useState } from 'react'
import { exportJSON, importJSON, useWorld, wipe } from './db'
import { PREVIEW_PATH, READ_ONLY } from './mode'
import { api, flush, pull, pullPreview, startAutoSave, startPreviewPolling, stopAutoSave, useSyncStatus, type SyncStatus } from './sync'
import { loadOn } from './domain/availability'
import { addDaysISO, mondayOf, todayISO, workdays } from './domain/dates'
import type { Demand, Designer } from './domain/types'
import { MapScreen } from './screens/MapScreen'
import { TitleScreen, type TitleItem } from './screens/TitleScreen'
import { AssignModal } from './ui/AssignModal'
import { DesignerForm, HeroCard } from './ui/HeroCard'
import { OverflowTip } from './ui/OverflowTip'
import { CrtScreen } from './ui/Crt'
import { SettingsDrawer } from './ui/SettingsDrawer'
import { setCardArt, useCardArt } from './ui/cardArt'
import { Toggle } from './ui/Toggle'
import { isMusicOn, onMusicChange, setMusicOn } from './ui/radio'
import { Logo80 } from './ui/Logo80'
import { VERSION } from './version'
import { Sprite } from './ui/Sprite'

type Crt = 'off' | 'crt' | 'phosphor' | 'monitor'
const CRT_KEY = 'pipolator.crt'
const CRT_NEXT: Record<Crt, Crt> = { off: 'crt', crt: 'phosphor', phosphor: 'monitor', monitor: 'off' }
const CRT_TITLE: Record<Crt, string> = { off: 'MODERN', crt: 'CRT', phosphor: 'PHOSPHOR', monitor: 'MONITOR' }
const SCREEN_LABEL: Record<Crt, string> = { off: 'Wył.', crt: 'CRT', phosphor: 'Fosfor', monitor: 'Monitor' }

function useCrt(): [Crt, () => void, (m: Crt) => void] {
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
  return [mode, () => setMode(m => CRT_NEXT[m]), setMode]
}

const IDLE_MS = 60 * 60 * 1000 // wylogowanie po godzinie bezczynności
const PING_MS = 5 * 60 * 1000 // przy aktywności co 5 min przedłużamy sesję na serwerze

/** checking → (out | in) w trybie edycji; preview / deadLink w podglądzie; error = serwer nie odpowiada. */
type Auth = 'checking' | 'out' | 'in' | 'preview' | 'deadLink' | 'error'

const SYNC_LABEL: Record<SyncStatus, string> = {
  idle: 'Połączono z serwerem', saving: 'Zapisywanie…', saved: 'Zapisano na serwerze', error: 'Błąd zapisu — ponawiam…',
  conflict: 'Wczytano nowszą wersję', expired: 'Sesja wygasła',
}

export default function App() {
  const world = useWorld()
  const [crt, cycleCrt, setCrt] = useCrt()
  const [addingFirst, setAddingFirst] = useState(false)
  const [demandId, setDemandId] = useState<string | null>(null)
  const [heroId, setHeroId] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [auth, setAuth] = useState<Auth>('checking')
  const sync = useSyncStatus()

  const expire = async () => {
    stopAutoSave()
    await wipe()
    setAuth('out')
    setStarted(false)
    alert('Sesja wygasła — zaloguj się ponownie.')
  }
  const enter = async () => {
    const { empty } = await pull()
    if (empty) await wipe() // pusty serwer = start od zera
    startAutoSave(expire)
    setAuth('in')
  }
  const logout = async () => {
    await flush().catch(() => {})
    stopAutoSave()
    await api.logout().catch(() => {})
    await wipe() // nie zostawiamy danych w przeglądarce po wylogowaniu
    setAuth('out')
    setStarted(false)
  }

  // start: podgląd pobiera dane z linku, edycja sprawdza sesję
  useEffect(() => {
    if (READ_ONLY) {
      pullPreview().then(ok => { setAuth(ok ? 'preview' : 'deadLink'); setStarted(ok) }, () => setAuth('error'))
      return startPreviewPolling()
    }
    api.session().then(
      s => (s.authed ? enter() : setAuth('out')),
      () => setAuth('error'),
    )
    return () => stopAutoSave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // bezczynność: godzina bez ruchu = wylogowanie; aktywność co 5 min przedłuża sesję na serwerze
  useEffect(() => {
    if (auth !== 'in') return
    let lastActive = Date.now()
    let lastPing = Date.now()
    const mark = () => { lastActive = Date.now() }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const
    events.forEach(e => window.addEventListener(e, mark, { passive: true }))
    const id = window.setInterval(async () => {
      const now = Date.now()
      if (now - lastActive > IDLE_MS) return logout()
      if (lastActive > lastPing && now - lastPing > PING_MS) {
        lastPing = now
        const s = await api.session().catch(() => null)
        if (s && !s.authed) expire()
      }
    }, 30_000)
    return () => {
      clearInterval(id)
      events.forEach(e => window.removeEventListener(e, mark))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth])
  const [music, setMusic] = useState(isMusicOn)
  const cardArt = useCardArt()
  useEffect(() => {
    const off = onMusicChange(setMusic)
    return () => {
      off()
    }
  }, [])
  const toggleMusic = () => setMusicOn(!music)
  const fileRef = useRef<HTMLInputElement>(null)

  const hud = useMemo(() => {
    if (!world) return null
    const today = todayISO()
    const heroes = world.designers.filter(d => !d.archivedAt)
    const week = workdays(mondayOf(today), addDaysISO(mondayOf(today), 4))
    const cap = heroes.reduce((s, d) => s + d.baseFte, 0) * week.length
    const load = heroes.reduce((s, d) => s + week.reduce((ss, day) => ss + loadOn(world, d.id, day), 0), 0)
    return { util: cap ? load / cap : 0 }
  }, [world])

  if (!world) return null

  /** Podgląd tylko do odczytu, dostępny bez logowania. Zalogowanym otwiera się w nowej karcie (+ link w schowku). */
  const openPreview = () => {
    const url = `${location.origin}${PREVIEW_PATH}`
    if (auth !== 'in') return location.assign(url)
    window.open(url, '_blank', 'noopener')
    navigator.clipboard.writeText(url).catch(() => {})
  }

  if (!started) {
    const settingsItems: TitleItem[] = [
      { label: `SCREEN: ${CRT_TITLE[crt]}`, action: cycleCrt },
      { label: `MUSIC: ${music ? 'ON' : 'OFF'}`, action: toggleMusic },
    ]
    const login: TitleItem = {
      label: 'LOGIN',
      action: () => {},
      input: {
        label: 'HASŁO',
        onSubmit: async pw => {
          try {
            await api.login(pw)
            await enter()
            setStarted(true)
            return null
          } catch (e) {
            return (e as Error).message.toUpperCase()
          }
        },
      },
    }
    const preview: TitleItem = { label: 'PODGLĄD', action: openPreview }
    const byAuth: Record<Auth, { items: TitleItem[]; message?: string }> = {
      checking: { items: settingsItems, message: 'ŁĄCZENIE…' },
      out: { items: [login, preview, ...settingsItems] },
      in: {
        items: [
          { label: 'START GAME', action: () => setStarted(true) },
          preview,
          ...settingsItems,
          { label: 'LOGOUT', action: logout },
        ],
      },
      preview: { items: [{ label: 'START', action: () => setStarted(true) }, ...settingsItems], message: 'TRYB PODGLĄDU' },
      deadLink: { items: settingsItems, message: 'PODGLĄD JEST NIEDOSTĘPNY' },
      error: { items: settingsItems, message: 'BRAK POŁĄCZENIA Z SERWEREM — ODŚWIEŻ STRONĘ' },
    }
    return (
      <CrtScreen monitor={crt === 'monitor'}>
        <TitleScreen {...byAuth[auth]} />
      </CrtScreen>
    )
  }

  if (world.designers.length === 0 && world.projects.length === 0) {
    return (
      <CrtScreen monitor={crt === 'monitor'}>
      <div className="empty-state">
        <div style={{ marginBottom: 24 }}>
          <button type="button" className="brand-home" onClick={() => (READ_ONLY ? location.assign('/') : setStarted(false))} title="Wróć do menu startowego" aria-label="Wróć do menu startowego">
            <Logo80 />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 24 }}>
          <Sprite cls="MEDIOR_PD" look={{ g: 'M', skin: 2, outfit: 1 }} scale={4} />
          <Sprite cls="SENIOR_PD" look={{ g: 'F', skin: 1, outfit: 2 }} state="work" scale={4} />
          <Sprite cls="UX_RESEARCHER" look={{ g: 'F', skin: 3, outfit: 3 }} scale={4} />
        </div>
        <div className="win">
          {READ_ONLY ? (
            <p>Nie ma jeszcze nic do pokazania — zajrzyj później.</p>
          ) : (
            <>
              <p>Nie ma jeszcze żadnych osób ani projektów.</p>
              <div className="row-actions" style={{ justifyContent: 'center' }}>
                <button className="primary" onClick={() => setAddingFirst(true)}>Dodaj pierwszą osobę</button>
                <button onClick={() => fileRef.current?.click()}>Importuj backup</button>
                <button onClick={logout}>Wyloguj</button>
              </div>
            </>
          )}
        </div>
        {addingFirst && <DesignerForm onClose={() => setAddingFirst(false)} />}
        <ImportInput fileRef={fileRef} />
      </div>
      </CrtScreen>
    )
  }

  const demand = world.demands.find(d => d.id === demandId)
  const hero = world.designers.find(d => d.id === heroId)
  const openDemand = (d: Demand) => !READ_ONLY && setDemandId(d.id)
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
        <div className="brand">
          <button
            type="button"
            className="brand-home"
            onClick={() => (READ_ONLY ? location.assign('/') : setStarted(false))}
            title="Wróć do menu startowego"
            aria-label="Wróć do menu startowego"
          >
            <Logo80 size="sm" />
          </button>
          <small className="ver" title="Wersja aplikacji">ver {VERSION}</small>
          {READ_ONLY ? (
            <span className="mode-chip">PODGLĄD</span>
          ) : (
            <span className={`sync-dot ${sync}`} title={SYNC_LABEL[sync]} role="status" aria-label={SYNC_LABEL[sync]} />
          )}
        </div>
        {hud && (
          <div className="util" title="Obłożenie zespołu w tym tygodniu: suma przypisań / dostępność">
            <span>Obłożenie</span>
            <div className="util-bar" role="meter" aria-label="Obłożenie zespołu" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.util * 100)}>
              <i style={{ width: `${Math.min(100, hud.util * 100)}%`, background: hud.util > 1 ? 'var(--red)' : hud.util > 0.9 ? 'var(--amber)' : 'var(--green)' }} />
            </div>
            <b>{Math.round(hud.util * 100)}%</b>
          </div>
        )}
        <SettingsDrawer>
            <div className="nav-settings">
              {!READ_ONLY && (
                <>
                  <button className="nav-set" onClick={download}>Pobierz kopię zapasową</button>
                  <button className="nav-set" onClick={() => fileRef.current?.click()}>Wczytaj kopię zapasową</button>
                </>
              )}
              <Toggle label="Muzyka" checked={music} onChange={toggleMusic} />
              <Toggle label="Ilustracje na kartach" checked={cardArt} onChange={() => setCardArt(!cardArt)} />
              <div className="nav-set static">
                <span id="screen-mode-label">Ekran</span>
              </div>
              <div className="seg" role="radiogroup" aria-labelledby="screen-mode-label">
                {(['off', 'crt', 'phosphor', 'monitor'] as Crt[]).map(m => (
                  <button key={m} role="radio" aria-checked={crt === m} className={crt === m ? 'on' : ''} onClick={() => setCrt(m)}>
                    {SCREEN_LABEL[m]}
                  </button>
                ))}
              </div>
              {!READ_ONLY && <button className="nav-set" onClick={logout}>Wyloguj</button>}
            </div>
        </SettingsDrawer>
      </header>

      <main className="content">
        <MapScreen world={world} onOpenDemand={openDemand} onOpenHero={openHero} />
      </main>

      <footer style={{ padding: '0 22px 16px', fontSize: 12 }} className="dim">
        {READ_ONLY ? (
          'Podgląd tylko do odczytu — odświeża się sam co 30 s.'
        ) : (
          <>
            {SYNC_LABEL[sync]}.{' '}
            <button className="ghost sm" onClick={async () => { if (confirm('Wyczyścić WSZYSTKIE dane — także na serwerze i w podglądzie? Najpierw zrób backup.')) await wipe() }}>Wyczyść dane</button>
          </>
        )}
        <span style={{ float: 'right' }}>Grafiki: postacie — Mucho Pixels · tła — assetpack-backgrounds · muzyka: Datawave FM — Nightride FM</span>
      </footer>

      {demand && <AssignModal key={demand.id} world={world} demand={demand} onClose={() => setDemandId(null)} />}
      {hero && <HeroCard key={hero.id} world={world} designer={hero} onClose={() => setHeroId(null)} />}
      <ImportInput fileRef={fileRef} />
      <OverflowTip />
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
