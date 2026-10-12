/**
 * Radio: stream YouTube „Datawave FM” (Nightride FM) przez oficjalne IFrame API.
 * Odtwarzacz żyje poza drzewem Reacta (jeden na całą sesję), więc nie restartuje się
 * przy przejściu z ekranu startowego do aplikacji. Regulamin YouTube wymaga widocznego
 * odtwarzacza (min. 200 px), dlatego radio to małe okienko w rogu, a nie ukryte audio.
 */

const VIDEO_ID = 'Y9q6RYg2Pdg'
const KEY = 'pipolator.music'
const VOL_KEY = 'pipolator.radioVolume'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

let on = readOn()
let volume = readVolume()
let playing = false
let player: any = null
let dock: HTMLDivElement | null = null
let apiLoading: Promise<void> | null = null
const listeners = new Set<(on: boolean) => void>()

function readOn() {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

function readVolume() {
  try {
    const v = Number(localStorage.getItem(VOL_KEY))
    return localStorage.getItem(VOL_KEY) !== null && v >= 0 && v <= 100 ? v : 30
  } catch {
    return 30
  }
}

function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  apiLoading ??= new Promise(resolve => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  })
  return apiLoading
}

function buildDock() {
  dock = document.createElement('div')
  dock.className = 'radio-dock'
  dock.innerHTML = `
    <div class="radio-head">
      <span class="radio-live" aria-hidden="true"></span>
      <span class="radio-name">DATAWAVE FM</span>
      <span class="radio-sub">synthwave · live</span>
    </div>
    <div class="radio-screen"><div id="radio-player"></div></div>
    <div class="radio-controls">
      <button class="radio-play sm" type="button"></button>
      <label class="radio-vol" title="Głośność">
        <span aria-hidden="true">🔉</span>
        <input type="range" min="0" max="100" step="5" aria-label="Głośność radia" />
        <b></b>
      </label>
      <button class="radio-off sm" type="button" title="Wyłącz radio" aria-label="Wyłącz radio">✕</button>
    </div>`
  dock.querySelector('.radio-off')!.addEventListener('click', () => setMusicOn(false))
  dock.querySelector('.radio-play')!.addEventListener('click', () => {
    if (playing) player?.stopVideo?.()
    else player?.playVideo?.()
  })
  const slider = dock.querySelector<HTMLInputElement>('.radio-vol input')!
  slider.value = String(volume)
  slider.addEventListener('input', () => setVolume(Number(slider.value)))
  document.body.appendChild(dock)
  renderControls()
}

function renderControls() {
  if (!dock) return
  const play = dock.querySelector<HTMLButtonElement>('.radio-play')!
  play.textContent = playing ? '■ Stop' : '▶ Play'
  play.setAttribute('aria-label', playing ? 'Zatrzymaj radio' : 'Odtwórz radio')
  dock.querySelector('.radio-vol b')!.textContent = `${volume}%`
  dock.classList.toggle('playing', playing)
}

function setVolume(v: number) {
  volume = v
  player?.setVolume?.(volume)
  try {
    localStorage.setItem(VOL_KEY, String(volume))
  } catch {
    /* brak storage */
  }
  renderControls()
}

async function ensurePlayer() {
  if (!dock) buildDock()
  if (player) return
  await loadApi()
  await new Promise<void>(resolve => {
    player = new window.YT.Player('radio-player', {
      videoId: VIDEO_ID,
      width: 356,
      height: 200,
      // bez interfejsu YouTube: sterowanie jest w naszym pasku pod obrazem
      playerVars: { autoplay: 1, playsinline: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, rel: 0, modestbranding: 1 },
      events: {
        onReady: (e: any) => {
          e.target.setVolume(volume)
          if (on) e.target.playVideo()
          resolve()
        },
        onStateChange: (e: any) => {
          playing = e.data === 1 || e.data === 3 // PLAYING albo BUFFERING
          renderControls()
        },
      },
    })
  })
}

function apply() {
  document.documentElement.classList.toggle('radio-on', on)
  if (on) {
    ensurePlayer().then(() => {
      player?.setVolume?.(volume)
      player?.playVideo?.()
    })
  } else {
    player?.pauseVideo?.()
  }
}

export const isMusicOn = () => on

export function setMusicOn(next: boolean) {
  on = next
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* brak storage */
  }
  apply()
  listeners.forEach(l => l(on))
}

export function onMusicChange(l: (on: boolean) => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Start przy załadowaniu; przeglądarka i tak puści dźwięk dopiero po pierwszej interakcji. */
export function installRadio() {
  apply()
  const kick = () => {
    if (on) player?.playVideo?.()
    window.removeEventListener('pointerdown', kick, true)
    window.removeEventListener('keydown', kick, true)
  }
  window.addEventListener('pointerdown', kick, true)
  window.addEventListener('keydown', kick, true)
}
