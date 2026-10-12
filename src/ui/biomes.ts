import type { CSSProperties } from 'react'
import type { LandId, Project } from '../domain/types'
import { LANDS as LAND_IDS } from '../domain/types'
import LANDS from './lands.gen.json'

/**
 * Tło paska projektu — trzy warstwy parallax (daleko → blisko) z paczki „assetpack-backgrounds”,
 * pocięte przez scripts/build-backgrounds.py. Każdy projekt ma swoją krainę (Project.land);
 * starsze projekty bez niej dostają krainę wyliczoną z id, żeby się nie zmieniała.
 */

export function landOf(p: Pick<Project, 'id' | 'land'>): LandId {
  if (p.land && p.land in LANDS) return p.land
  let h = 0
  for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return LAND_IDS[h % LAND_IDS.length]
}

/** Losowa kraina dla nowego projektu — spośród najrzadziej używanych w aktywnych projektach. */
export function pickLand(projects: Project[]): LandId {
  const count = new Map<LandId, number>(LAND_IDS.map(l => [l, 0]))
  for (const p of projects) if (!p.archivedAt) count.set(landOf(p), (count.get(landOf(p)) ?? 0) + 1)
  const min = Math.min(...count.values())
  const pool = LAND_IDS.filter(l => count.get(l) === min)
  return pool[Math.floor(Math.random() * pool.length)]
}

export function biomeStyle(p: Pick<Project, 'id' | 'land'>): CSSProperties {
  const l = LANDS[landOf(p)]
  const [back, mid, front] = l.layers
  return {
    backgroundColor: l.bg,
    backgroundImage: `url(${front.src}), url(${mid.src}), url(${back.src})`,
    backgroundRepeat: 'repeat-x',
    backgroundSize: 'auto 100%',
    backgroundPosition: '0 0',
    // dystanse pętli dla animacji parallax (.journey.moving w styles.css)
    '--dx-front': `-${front.dx}px`,
    '--dx-mid': `-${mid.dx}px`,
    '--dx-back': `-${back.dx}px`,
  } as CSSProperties
}
