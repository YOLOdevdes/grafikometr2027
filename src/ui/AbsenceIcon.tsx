import type { AbsenceType } from '../domain/types'
import { ABSENCE_LABEL } from '../domain/types'

/** Pixelowe odpowiedniki emoji nieobecności (12×12 px, rysowane prostokątami). */
type Px = [x: number, y: number, w: number, h: number, fill: string]

const O = '#1c1206'

// 🏝 wyspa: liście palmy, pień, piasek, woda
const ISLAND: Px[] = [
  [3, 1, 6, 1, '#3fae4a'], [5, 2, 2, 1, '#2a7d33'], [1, 2, 4, 1, '#3fae4a'], [7, 2, 4, 1, '#3fae4a'],
  [0, 3, 2, 1, '#2a7d33'], [10, 3, 2, 1, '#2a7d33'], [3, 3, 1, 1, '#2a7d33'], [8, 3, 1, 1, '#2a7d33'],
  [6, 3, 1, 2, '#8a5a2b'], [5, 5, 1, 4, '#8a5a2b'], [6, 5, 1, 1, '#6b4426'],
  [2, 9, 8, 1, '#f0d27a'], [1, 10, 10, 1, '#d9ac55'],
  [0, 10, 1, 1, '#3a8fd9'], [11, 10, 1, 1, '#3a8fd9'], [0, 11, 12, 1, '#3a8fd9'], [3, 11, 2, 1, '#8fd0f0'], [8, 11, 1, 1, '#8fd0f0'],
]

// 🤒 buźka z termometrem
const SICK: Px[] = [
  [3, 1, 6, 10, '#f7c948'], [1, 3, 10, 6, '#f7c948'], [2, 2, 8, 8, '#f7c948'],
  [3, 0, 6, 1, O], [3, 11, 6, 1, O], [0, 3, 1, 6, O], [11, 3, 1, 6, O],
  [2, 1, 1, 1, O], [1, 2, 1, 1, O], [9, 1, 1, 1, O], [10, 2, 1, 1, O], [1, 9, 1, 1, O], [2, 10, 1, 1, O], [10, 9, 1, 1, O], [9, 10, 1, 1, O],
  [3, 4, 2, 1, O], [7, 4, 2, 1, O], [2, 6, 1, 1, '#ff8a7d'], [9, 6, 1, 1, '#ff8a7d'],
  [5, 7, 4, 1, '#ffffff'], [8, 8, 2, 1, '#ffffff'], [10, 8, 2, 2, '#e0493a'], [5, 8, 3, 1, '#d1d5db'],
]

const ICONS: Partial<Record<AbsenceType, Px[]>> = { VACATION: ISLAND, SICK }

export function hasAbsenceIcon(type: AbsenceType) {
  return type in ICONS
}

/** Ikonka nieobecności (urlop / L4); dla innych typów nic nie rysuje. */
export function AbsenceIcon({ type, size = 2, dim = false, title }: { type: AbsenceType; size?: number; dim?: boolean; title?: string }) {
  const px = ICONS[type]
  if (!px) return null
  return (
    <svg
      className={`abs-ico ${dim ? 'dim' : ''}`}
      viewBox="0 0 12 12"
      width={12 * size}
      height={12 * size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? ABSENCE_LABEL[type]}
    >
      <title>{title ?? ABSENCE_LABEL[type]}</title>
      {px.map(([x, y, w, h, f], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={f} />)}
    </svg>
  )
}
