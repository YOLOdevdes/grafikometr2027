/** Daty dzienne jako ISO `yyyy-MM-dd`. Zakresy są włącznie po obu stronach. */
export type ISODate = string

export type DesignerClass = 'SENIOR_PD' | 'MEDIOR_PD' | 'UX_RESEARCHER'
export type MercenaryRole = 'QA' | 'BA' | 'DEV' | 'APM' | 'APE'
export type Phase = 'PRESALES' | 'DISCOVERY' | 'DELIVERY'
export type AbsenceType = 'VACATION' | 'SICK' | 'TRAINING' | 'OTHER'
/** Kontynent klienta — wyznacza krainę, przez którą wędruje quest. */
export type Region = 'EUROPE' | 'NORTH_AMERICA' | 'SOUTH_AMERICA' | 'MIDDLE_EAST' | 'AFRICA' | 'ASIA' | 'OCEANIA' | 'OTHER'

export interface Designer {
  id: string
  name: string
  title?: string // pseudonim na karcie, np. „Pikselowa Paladynka”
  cls: DesignerClass
  baseFte: number
  illustration?: string // data URL albo ścieżka w /public
  createdAt: string
  archivedAt?: string
}

export interface Absence {
  id: string
  designerId: string
  from: ISODate
  to: ISODate
  type: AbsenceType
  note?: string
}

export interface Project {
  id: string
  name: string
  client?: string
  phase: Phase
  from: ISODate
  to: ISODate
  upcoming: boolean
  color: string
  region?: Region
  country?: string
  createdAt: string
  archivedAt?: string
}

/** Zlecenie — slot designerski w projekcie. */
export interface Demand {
  id: string
  projectId: string
  cls: DesignerClass
  fte: number // 0.5 | 1
  overtimeFte?: number
  from: ISODate
  to: ISODate
  designerId?: string
}

/** Najemnik — rola symulowana, tylko do wizualizacji składu. */
export interface Mercenary {
  id: string
  projectId: string
  role: MercenaryRole
  count: number
  fte: number
}

export interface DemandSnapshot {
  projectId: string
  projectName: string
  client?: string
  phase: Phase
  from: ISODate
  to: ISODate
  fte: number
}

export type HistoryType = 'ASSIGNED' | 'UNASSIGNED' | 'DEMAND_REMOVED'

export interface HistoryEvent {
  id: string
  at: string // ISO timestamp
  type: HistoryType
  designerId: string
  demandId: string
  snapshot: DemandSnapshot
}

export interface Settings {
  id: 'settings'
  alertWeeks: number
}

export const CLASS_META: Record<DesignerClass, { label: string; short: string; color: string; hero: string; rarity: string }> = {
  SENIOR_PD: { label: 'Senior Product Designer', short: 'Senior PD', color: '#f2b53c', hero: 'Paladyn', rarity: 'Legendarna' },
  UX_RESEARCHER: { label: 'UX Researcher', short: 'UX Researcher', color: '#a77bff', hero: 'Wyrocznia', rarity: 'Legendarna' },
  MEDIOR_PD: { label: 'Medior Product Designer', short: 'Medior PD', color: '#4fa3ff', hero: 'Rycerz', rarity: 'Rzadka' },
}

export const MERC_META: Record<MercenaryRole, { label: string; color: string }> = {
  QA: { label: 'QA', color: '#5fd38a' },
  BA: { label: 'BA', color: '#ff9a3c' },
  DEV: { label: 'Developer', color: '#9aa8bb' },
  APM: { label: 'APM', color: '#35cfc4' },
  APE: { label: 'APE', color: '#ff74c0' },
}

export const PHASE_LABEL: Record<Phase, string> = {
  PRESALES: 'Presales',
  DISCOVERY: 'Discovery',
  DELIVERY: 'Delivery',
}

export const ABSENCE_LABEL: Record<AbsenceType, string> = {
  VACATION: 'Urlop',
  SICK: 'L4',
  TRAINING: 'Szkolenie',
  OTHER: 'Inne',
}

export const CLASSES: DesignerClass[] = ['SENIOR_PD', 'MEDIOR_PD', 'UX_RESEARCHER']
export const MERC_ROLES: MercenaryRole[] = ['QA', 'BA', 'DEV', 'APM', 'APE']
export const PHASES: Phase[] = ['PRESALES', 'DISCOVERY', 'DELIVERY']

export const REGION_META: Record<Region, { label: string; land: string; icon: string }> = {
  EUROPE: { label: 'Europa', land: 'Las', icon: '♣' },
  NORTH_AMERICA: { label: 'Ameryka Północna', land: 'Dziki Zachód', icon: '★' },
  SOUTH_AMERICA: { label: 'Ameryka Południowa', land: 'Dżungla', icon: '❦' },
  MIDDLE_EAST: { label: 'Bliski Wschód', land: 'Pustynia', icon: '☀' },
  AFRICA: { label: 'Afryka', land: 'Sawanna', icon: '◒' },
  ASIA: { label: 'Azja', land: 'Mgliste góry', icon: '▲' },
  OCEANIA: { label: 'Australia i Oceania', land: 'Wybrzeże', icon: '≈' },
  OTHER: { label: 'Inne / globalnie', land: 'Równiny', icon: '◆' },
}
export const REGIONS: Region[] = ['EUROPE', 'NORTH_AMERICA', 'SOUTH_AMERICA', 'MIDDLE_EAST', 'AFRICA', 'ASIA', 'OCEANIA', 'OTHER']
