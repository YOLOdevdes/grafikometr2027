import type { CSSProperties } from 'react'
import type { Region } from '../domain/types'

/**
 * Tło paska podróży — warstwy parallax w widoku z boku.
 * Na razie każdy kontynent wędruje przez ten sam las (ansimuz, „SunnyLand Forest of Illusion”,
 * warstwy z scripts/build-lands.py). Nowa kraina = nowy wpis w LANDS + przypisanie w REGION_LAND.
 */

interface Land {
  back: string
  middle: string
  ground: string
  /** przesunięcie sceny w pionie, tak by linia gruntu wypadła na drodze (ROW_H − 24 = 94 px) */
  sceneY: number
  groundY: number
}

const LANDS: Record<string, Land> = {
  forest: {
    back: '/lands/forest-back.png',
    middle: '/lands/forest-middle.png',
    ground: '/lands/forest-ground.png',
    sceneY: -106,
    groundY: 94,
  },
}

const REGION_LAND: Record<Region, keyof typeof LANDS> = {
  EUROPE: 'forest',
  NORTH_AMERICA: 'forest',
  SOUTH_AMERICA: 'forest',
  MIDDLE_EAST: 'forest',
  AFRICA: 'forest',
  ASIA: 'forest',
  OCEANIA: 'forest',
  OTHER: 'forest',
}

export function biomeStyle(region: Region | undefined): CSSProperties {
  const l = LANDS[REGION_LAND[region ?? 'OTHER'] ?? 'forest']
  return {
    backgroundColor: '#224422',
    backgroundImage: `url(${l.ground}), url(${l.middle}), url(${l.back})`,
    backgroundRepeat: 'repeat-x, repeat-x, repeat-x',
    backgroundPosition: `0 ${l.groundY}px, 0 ${l.sceneY}px, 0 ${l.sceneY}px`,
    imageRendering: 'pixelated',
    // dla animacji parallax (.journey.moving w styles.css)
    '--gy': `${l.groundY}px`,
    '--sy': `${l.sceneY}px`,
  } as CSSProperties
}
