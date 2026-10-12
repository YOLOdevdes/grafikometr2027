/**
 * Radio: strumień audio „Datawave FM” od Nightride FM (bez wideo i bez YouTube).
 * Jeden element <audio> na całą sesję, więc muzyka nie restartuje się przy przejściu
 * z ekranu startowego do aplikacji. Sterowanie: play/stop, głośność, wyłącz.
 */

const STREAM = 'https://stream.nightride.fm/datawave.mp3'
const KEY = 'pipolator.music'
const VOL_KEY = 'pipolator.radioVolume'

type State = 'stopped' | 'connecting' | 'playing'

let on = readOn()
let volume = readVolume()
let state: State = 'stopped'
let audio: HTMLAudioElement | null = null
let dock: HTMLDivElement | null = null
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
    const raw = localStorage.getItem(VOL_KEY)
    const v = Number(raw)
    return raw !== null && v >= 0 && v <= 100 ? v : 30
  } catch {
    return 30
  }
}

function el() {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'none'
    audio.volume = volume / 100
    audio.addEventListener('playing', () => setState('playing'))
    audio.addEventListener('waiting', () => setState('connecting'))
    audio.addEventListener('pause', () => setState('stopped'))
    audio.addEventListener('error', () => setState('stopped'))
  }
  return audio
}

function setState(s: State) {
  state = s
  renderControls()
}

/** Na żywo: przy każdym starcie podpinamy strumień od nowa, żeby grać „teraz”, a nie z bufora. */
async function play() {
  const a = el()
  a.src = `${STREAM}?t=${Date.now()}`
  setState('connecting')
  try {
    await a.play()
  } catch {
    setState('stopped') // przeglądarka czeka na pierwszą interakcję — patrz installRadio()
  }
}

function stop() {
  if (!audio) return
  audio.pause()
  audio.removeAttribute('src') // przestajemy pobierać strumień
  audio.load()
  setState('stopped')
}

function buildDock() {
  dock = document.createElement('div')
  dock.className = 'radio-dock'
  dock.innerHTML = `
    <div class="radio-head">
      <span class="radio-live" aria-hidden="true"></span>
      <span class="radio-name">DATAWAVE FM</span>
      <span class="radio-sub"></span>
    </div>
    <div class="radio-controls">
      <button class="radio-play sm" type="button"></button>
      <label class="radio-vol" title="Głośność">
        <input type="range" min="0" max="100" step="5" aria-label="Głośność radia" />
        <b></b>
      </label>
      <button class="radio-off sm" type="button" title="Wyłącz radio" aria-label="Wyłącz radio">✕</button>
    </div>`
  dock.querySelector('.radio-off')!.addEventListener('click', () => setMusicOn(false))
  dock.querySelector('.radio-play')!.addEventListener('click', () => (state === 'stopped' ? play() : stop()))
  const slider = dock.querySelector<HTMLInputElement>('.radio-vol input')!
  slider.value = String(volume)
  slider.addEventListener('input', () => setVolume(Number(slider.value)))
  document.body.appendChild(dock)
  renderControls()
}

function renderControls() {
  if (!dock) return
  const play = dock.querySelector<HTMLButtonElement>('.radio-play')!
  const live = state !== 'stopped'
  play.textContent = live ? '■ Stop' : '▶ Play'
  play.setAttribute('aria-label', live ? 'Zatrzymaj radio' : 'Odtwórz radio')
  dock.querySelector('.radio-sub')!.textContent = state === 'connecting' ? 'łączenie…' : state === 'playing' ? 'synthwave · na żywo' : 'zatrzymane'
  dock.querySelector('.radio-vol b')!.textContent = `${volume}%`
  dock.classList.toggle('playing', state === 'playing')
  dock.classList.toggle('live', live)
}

function setVolume(v: number) {
  volume = v
  if (audio) audio.volume = volume / 100
  try {
    localStorage.setItem(VOL_KEY, String(volume))
  } catch {
    /* brak storage */
  }
  renderControls()
}

function apply() {
  document.documentElement.classList.toggle('radio-on', on)
  if (on) {
    if (!dock) buildDock()
    if (state === 'stopped') play()
  } else {
    stop()
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
  const kick = (e: Event) => {
    // kliknięcia w samo radio obsługują jego przyciski — inaczej Play od razu by się zatrzymał
    if ((e.target as Element | null)?.closest?.('.radio-dock')) return
    if (on && state === 'stopped') play()
    window.removeEventListener('pointerdown', kick, true)
    window.removeEventListener('keydown', kick, true)
  }
  window.addEventListener('pointerdown', kick, true)
  window.addEventListener('keydown', kick, true)
}
