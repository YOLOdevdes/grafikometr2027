/**
 * Dźwięk kliku (Mixkit „Modern click box check”, public/sfx/click.wav — poza repo, licencja Mixkit).
 * Web Audio zamiast <audio>, żeby klik nie miał opóźnienia i mógł się nakładać przy szybkim klikaniu.
 */

const VOLUME = 0.45

let ctx: AudioContext | null = null
let buffer: AudioBuffer | null = null
let loading: Promise<void> | null = null

// klik jest zawsze włączony; usuwamy pozostałość po dawnym przełączniku wyciszenia
try {
  localStorage.removeItem('pipolator.mute')
} catch {
  /* brak storage */
}

function load() {
  if (!ctx) ctx = new AudioContext()
  loading ??= fetch('/sfx/click.wav')
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('brak pliku'))))
    .then(b => ctx!.decodeAudioData(b))
    .then(b => {
      buffer = b
    })
    .catch(() => {
      buffer = null // brak pliku = cisza, aplikacja działa dalej
    })
  return loading
}

export async function playClick() {
  await load()
  if (!ctx || !buffer) return
  if (ctx.state === 'suspended') await ctx.resume()
  const src = ctx.createBufferSource()
  const gain = ctx.createGain()
  gain.gain.value = VOLUME
  src.buffer = buffer
  src.connect(gain).connect(ctx.destination)
  src.start()
}

/** Wszystko, co w aplikacji da się kliknąć. */
const CLICKABLE =
  'button, a[href], select, input[type="checkbox"], [role="button"], .quest-card, .slot, .walker, .tl-who, .tl-bar, .mini-card, .hero-card, .cand, .alert-row'

/** Jeden globalny nasłuch zamiast podpinania dźwięku do każdego komponentu. */
export function installClickSound() {
  document.addEventListener(
    'pointerdown',
    e => {
      if (e.button !== 0) return
      const el = (e.target as Element | null)?.closest(CLICKABLE)
      if (el && !(el as HTMLButtonElement).disabled) playClick()
    },
    { capture: true },
  )
}
