import type { DesignerClass, MercenaryRole } from '../domain/types'
import { CLASS_META, MERC_META } from '../domain/types'

/**
 * Placeholderowe sprite'y 16×20 px rysowane z map znaków.
 * Docelowo do podmiany na arkusze klatek (PixelLab / pixel artysta) — patrz docs/SPEC.md.
 */
export type SpriteState = 'idle' | 'work' | 'tired' | 'sleep'

const HEADS: Record<'SENIOR_PD' | 'MEDIOR_PD' | 'UX_RESEARCHER' | 'MERC', string[]> = {
  SENIOR_PD: [
    '......PPP.......',
    '.....PPKK.......',
    '....KKHHHHKK....',
    '...KHHHHHHHHK...',
    '...KHhKKKKhHK...',
    '...KHSESSESHK...',
    '...KHSSSSSSHK...',
    '....KKSSSSKK....',
  ],
  MEDIOR_PD: [
    '......KKKK......',
    '.....KHHHHK.....',
    '....KHHHHHHK....',
    '...KHHHHHHHHK...',
    '...KHKKKKKKHK...',
    '...KHSESSESHK...',
    '...KHHSSSSHHK...',
    '....KKHHHHKK....',
  ],
  UX_RESEARCHER: [
    '......KKKK......',
    '....KKHHHHKK....',
    '...KHHHHHHHHK...',
    '..KHHKKKKKKHHK..',
    '..KHKSSSSSSKHK..',
    '..KHKSESSESKHK..',
    '..KHHKSSSSKHHK..',
    '...KKHKKKKHKK...',
  ],
  MERC: [
    '................',
    '.....KKKKKK.....',
    '....KRRRRRRK....',
    '...KRRRRRRRRK...',
    '...KSSSSSSSSK...',
    '...KSSESSESSK...',
    '...KKSSSSSSKK...',
    '....KKSSSSKK....',
  ],
}

const BODY = [
  '...KKBBBBBBKK...',
  '..KBBBLLLLBBBK..',
  '.KSKBBBLLBBBKSK.',
  '.KSKBBBBBBBBKSK.',
  '..K.KbbbbbbK.K..',
  '....KbbKKbbK....',
  '....KGGK.KGGK...',
  '....KGGK.KGGK...',
  '...KFFFK.KFFFK..',
  '...KKKK..KKKK...',
]

const ROBE = [
  '...KKBBBBBBKK...',
  '..KBBBLLLLBBBK..',
  '.KSKBBBLLBBBKSK.',
  '.KSKBBBBBBBBKSK.',
  '..K.KBBLLBBK.K..',
  '....KBBLLBBK....',
  '...KbBBLLBBbK...',
  '...KbBBBBBBbK...',
  '..KbbbbbbbbbbK..',
  '..KKKKKKKKKKKK..',
]

const SWORD = ['.W.', 'KMK', 'KMK', 'KMK', 'KMK', 'KMK', 'HHH', '.K.', '.K.']
const STAFF = ['.O.', 'OOO', '.O.', '.K.', '.F.', '.F.', '.F.', '.F.', '.F.']

interface Pal { H: string; h: string; B: string; b: string; L: string; P?: string; R?: string }

const PALETTES: Record<DesignerClass, Pal> = {
  SENIOR_PD: { H: '#f2b53c', h: '#a8700f', B: '#efe6cf', b: '#b9893a', L: '#f2b53c', P: '#e04b4b' },
  MEDIOR_PD: { H: '#b8c2d6', h: '#69758f', B: '#4fa3ff', b: '#2a5ba6', L: '#c5e2ff' },
  UX_RESEARCHER: { H: '#a77bff', h: '#5e35b8', B: '#a77bff', b: '#4f2c9c', L: '#e6dbff' },
}

const BASE: Record<string, string> = {
  K: '#17121f', S: '#f1c39b', E: '#17121f', G: '#3b3552', F: '#6b4430', M: '#dfe6f2', W: '#ffffff', O: '#7ff3ff',
}

function rects(map: string[], pal: Record<string, string | undefined>, dx = 0, dy = 0) {
  const out: JSX.Element[] = []
  map.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = pal[ch]
      if (fill) out.push(<rect key={`${dx}-${dy}-${x}-${y}`} x={x + dx} y={y + dy} width={1.02} height={1.02} fill={fill} />)
    }),
  )
  return out
}

interface Props {
  cls?: DesignerClass
  merc?: MercenaryRole
  state?: SpriteState
  scale?: number
  title?: string
}

export function Sprite({ cls, merc, state = 'idle', scale = 3, title }: Props) {
  const isMerc = !cls
  const color = cls ? CLASS_META[cls].color : MERC_META[merc ?? 'DEV'].color
  const pal: Record<string, string | undefined> = isMerc
    ? { ...BASE, H: color, h: color, B: color, b: '#2b2b3a', L: '#ffffff80', R: color }
    : { ...BASE, ...PALETTES[cls] }
  if (state === 'sleep') pal.E = pal.S

  const head = HEADS[isMerc ? 'MERC' : cls]
  const body = cls === 'UX_RESEARCHER' ? ROBE : BODY
  const weapon = cls === 'UX_RESEARCHER' ? STAFF : SWORD

  return (
    <svg
      className={`sprite ${state}`}
      width={16 * scale}
      height={20 * scale}
      viewBox="0 -2 16 20"
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <g className="body">
        {rects(head, pal)}
        {rects(body, pal, 0, 8)}
        {!isMerc && <g className="weapon">{rects(weapon, pal, 12, 3)}</g>}
        {state === 'tired' && <rect className="sweat" x={2} y={3} width={1} height={2} fill="#7fd0ff" />}
      </g>
      {state === 'sleep' && (
        <text className="zzz" x={11} y={2}>
          z
        </text>
      )}
    </svg>
  )
}
