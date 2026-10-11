import type { CSSProperties } from 'react'
import type { Region } from '../domain/types'

/**
 * Tymczasowe, proceduralne tła krain (pixel art w SVG, kafelkowane w poziomie).
 * Docelowo do podmiany na paski złożone z tilesetów (np. Epic RPG World) — wystarczy
 * zmienić `layers` na ścieżki do plików PNG w /public/lands.
 */

type R = [x: number, y: number, w: number, h: number, fill: string]

const svg = (w: number, h: number, rects: R[]) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' shape-rendering='crispEdges'>${rects
      .map(([x, y, rw, rh, f]) => `<rect x='${x}' y='${y}' width='${rw}' height='${rh}' fill='${f}'/>`)
      .join('')}</svg>`,
  )}")`

// --- elementy ---
const palm = (x: number, base: number): R[] => [
  [x + 3, base - 14, 2, 14, '#8a5a2b'],
  [x, base - 17, 8, 2, '#3f8f3a'], [x - 2, base - 15, 4, 2, '#3f8f3a'], [x + 6, base - 15, 4, 2, '#3f8f3a'],
  [x + 2, base - 19, 4, 2, '#56a845'],
]
const pine = (x: number, base: number, c = '#2f6b2c', d = '#21511f'): R[] => [
  [x + 3, base - 3, 2, 3, '#5b3a22'],
  [x, base - 7, 8, 4, c], [x + 1, base - 11, 6, 4, c], [x + 2, base - 15, 4, 4, c], [x + 3, base - 17, 2, 2, c],
  [x + 5, base - 7, 3, 4, d], [x + 4, base - 11, 3, 4, d],
]
const cactus = (x: number, base: number): R[] => [
  [x + 2, base - 12, 3, 12, '#3f7d3a'], [x, base - 8, 2, 2, '#3f7d3a'], [x, base - 10, 1, 2, '#3f7d3a'],
  [x + 5, base - 9, 2, 2, '#3f7d3a'], [x + 6, base - 11, 1, 2, '#3f7d3a'], [x + 3, base - 12, 1, 12, '#5fa24f'],
]
const bush = (x: number, base: number, c: string): R[] => [[x, base - 3, 6, 3, c], [x + 1, base - 5, 4, 2, c]]
const acacia = (x: number, base: number): R[] => [
  [x + 6, base - 12, 2, 12, '#5b3a22'], [x + 3, base - 12, 3, 2, '#5b3a22'], [x + 8, base - 13, 3, 2, '#5b3a22'],
  [x, base - 16, 16, 3, '#5f7d2a'], [x + 2, base - 18, 12, 2, '#6f8f33'],
]
const jungleTree = (x: number, base: number): R[] => [
  [x + 4, base - 16, 3, 16, '#4a2f1a'], [x - 1, base - 22, 13, 7, '#1f6b2a'], [x + 1, base - 25, 9, 3, '#2a8a37'],
  [x + 1, base - 15, 1, 8, '#3fa34a'], [x + 9, base - 15, 1, 6, '#3fa34a'], [x - 2, base - 18, 3, 3, '#165a22'],
]
const sakura = (x: number, base: number): R[] => [
  [x + 4, base - 10, 2, 10, '#4a2f2a'], [x, base - 15, 10, 5, '#f4a6c4'], [x + 2, base - 17, 6, 2, '#f8c2d6'], [x + 7, base - 13, 3, 2, '#e88bb0'],
]
const pagoda = (x: number, base: number): R[] => [
  [x + 2, base - 6, 8, 6, '#7a2e2e'], [x, base - 8, 12, 2, '#3a2a3a'], [x + 3, base - 12, 6, 4, '#7a2e2e'], [x + 1, base - 14, 10, 2, '#3a2a3a'], [x + 5, base - 17, 2, 3, '#3a2a3a'],
]

interface Biome {
  sky: string
  ground: string
  far: string
  near: string
  ink: string
}

const BIOMES: Record<Region, Biome> = {
  MIDDLE_EAST: {
    sky: 'linear-gradient(180deg,#f7dc9c 0%,#f0c27a 55%,#e3ae5e 100%)',
    ground: '#d9a55a',
    far: svg(96, 24, [[0, 16, 30, 8, '#e8b867'], [8, 12, 14, 4, '#e8b867'], [40, 14, 40, 10, '#dba258'], [50, 10, 18, 4, '#dba258'], [84, 18, 12, 6, '#e8b867']]),
    near: svg(120, 30, [...palm(14, 30), ...palm(26, 30), ...bush(70, 30, '#a88a3c'), [100, 27, 6, 3, '#b98d4c']]),
    ink: '#3a2408',
  },
  EUROPE: {
    sky: 'linear-gradient(180deg,#a9dcef 0%,#cdebd8 60%,#9fcf86 100%)',
    ground: '#4f8f3a',
    far: svg(80, 24, [[0, 12, 80, 12, '#7fb36a'], [10, 6, 20, 6, '#7fb36a'], [46, 8, 26, 4, '#7fb36a']]),
    near: svg(72, 30, [...pine(4, 30), ...pine(14, 30, '#3a7d33', '#2a5e26'), ...pine(40, 30), ...bush(58, 30, '#3f7d32')]),
    ink: '#13300f',
  },
  NORTH_AMERICA: {
    sky: 'linear-gradient(180deg,#f7b267 0%,#f4845f 60%,#c96a3a 100%)',
    ground: '#b5552d',
    far: svg(140, 28, [[6, 8, 30, 20, '#8a3b22'], [10, 4, 22, 4, '#8a3b22'], [70, 14, 40, 14, '#9b4528'], [76, 10, 26, 4, '#9b4528'], [120, 18, 20, 10, '#8a3b22']]),
    near: svg(110, 30, [...cactus(12, 30), ...cactus(62, 30), ...bush(36, 30, '#7a6a3a'), [90, 26, 8, 4, '#7d4a2a']]),
    ink: '#2c0f05',
  },
  SOUTH_AMERICA: {
    sky: 'linear-gradient(180deg,#7fc8a9 0%,#a8dcb0 50%,#4f9a4a 100%)',
    ground: '#2f6b2a',
    far: svg(90, 28, [[0, 10, 90, 18, '#3d8a45'], [12, 4, 24, 6, '#3d8a45'], [52, 6, 30, 4, '#3d8a45']]),
    near: svg(84, 30, [...jungleTree(6, 30), ...jungleTree(34, 30), ...bush(56, 30, '#1f6b2a'), ...bush(66, 30, '#2a8a37'), [24, 22, 2, 8, '#3fa34a']]),
    ink: '#0d2a10',
  },
  AFRICA: {
    sky: 'linear-gradient(180deg,#ffd27f 0%,#f9a95b 55%,#d9a54a 100%)',
    ground: '#b8923a',
    far: svg(120, 20, [[0, 14, 120, 6, '#d6ae5a'], [70, 10, 30, 4, '#c99d4a'], [78, 6, 14, 4, '#c99d4a']]),
    near: svg(130, 30, [...acacia(10, 30), ...acacia(74, 30), [40, 26, 1, 4, '#8f7a2a'], [44, 25, 1, 5, '#8f7a2a'], [100, 26, 1, 4, '#8f7a2a'], [103, 27, 1, 3, '#8f7a2a']]),
    ink: '#3a2408',
  },
  ASIA: {
    sky: 'linear-gradient(180deg,#d9e4f2 0%,#f2dfe8 55%,#b9cfa6 100%)',
    ground: '#6f9a55',
    far: svg(120, 30, [[10, 14, 30, 16, '#9fb0c8'], [16, 8, 18, 6, '#9fb0c8'], [22, 4, 6, 4, '#eef2f8'], [60, 18, 40, 12, '#b3c1d4'], [70, 12, 20, 6, '#b3c1d4']]),
    near: svg(110, 30, [...sakura(6, 30), ...pagoda(40, 30), ...sakura(74, 30), ...bush(94, 30, '#4f7d3a')]),
    ink: '#1d2a3a',
  },
  OCEANIA: {
    sky: 'linear-gradient(180deg,#8fd3f4 0%,#c8ecf7 55%,#f2e2b0 100%)',
    ground: '#e9cf8a',
    far: svg(60, 20, [[0, 8, 60, 12, '#3aa6c9'], [0, 8, 60, 2, '#7fd0e8'], [20, 12, 8, 1, '#e8f8ff'], [44, 15, 6, 1, '#e8f8ff']]),
    near: svg(120, 30, [...palm(20, 30), [60, 27, 4, 3, '#f4a6a6'], [80, 28, 3, 2, '#fff2d0'], ...bush(96, 30, '#5a9a3c')]),
    ink: '#0d2a3a',
  },
  OTHER: {
    sky: 'linear-gradient(180deg,#b6e1f2 0%,#d6f0dc 60%,#a8d48a 100%)',
    ground: '#7cb85a',
    far: svg(100, 20, [[0, 12, 100, 8, '#a2cf7f'], [20, 8, 30, 4, '#a2cf7f']]),
    near: svg(90, 30, [...bush(8, 30, '#5a9a3c'), ...bush(40, 30, '#4f8a33'), [66, 27, 5, 3, '#8f8f8f'], [70, 28, 3, 2, '#a8a8a8']]),
    ink: '#1d3a12',
  },
}

/** Style tła paska podróży: niebo + daleki plan + bliski plan + grunt. */
export function biomeStyle(region: Region | undefined): CSSProperties & { '--land-ink': string } {
  const b = BIOMES[region ?? 'OTHER'] ?? BIOMES.OTHER
  return {
    backgroundImage: `${b.near}, ${b.far}, linear-gradient(transparent calc(100% - 14px), ${b.ground} calc(100% - 14px)), ${b.sky}`,
    backgroundRepeat: 'repeat-x, repeat-x, no-repeat, no-repeat',
    backgroundSize: '240px 60px, 280px 70px, 100% 100%, 100% 100%',
    backgroundPosition: 'left calc(100% - 10px), left calc(100% - 14px), 0 0, 0 0',
    imageRendering: 'pixelated',
    '--land-ink': b.ink,
  }
}
