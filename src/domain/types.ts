import { READ_ONLY } from '../mode'

/** Daty dzienne jako ISO `yyyy-MM-dd`. Zakresy są włącznie po obu stronach. */
export type ISODate = string

export type DesignerClass = 'SENIOR_PD' | 'MEDIOR_PD' | 'UX_RESEARCHER'
export type MercenaryRole = 'QA' | 'BA' | 'DEV' | 'APM' | 'APE'
export type Phase = 'PRESALES' | 'DISCOVERY' | 'DELIVERY' | 'OTHER'
export type AbsenceType = 'VACATION' | 'SICK' | 'TRAINING' | 'OTHER'
/** Kontynent klienta — wyznacza tło paska projektu na harmonogramie. */
export type Region = 'EUROPE' | 'NORTH_AMERICA' | 'SOUTH_AMERICA' | 'MIDDLE_EAST' | 'AFRICA' | 'ASIA' | 'OCEANIA' | 'OTHER'

/** Wygląd postaci w paczce sprite'ów: płeć, odcień skóry (1–3), strój (1–3). */
export interface Look {
  g: 'M' | 'F'
  skin: 1 | 2 | 3
  outfit: 1 | 2 | 3
}

export interface Designer {
  id: string
  name: string
  title?: string // specjalizacja na karcie, np. „Design systemy”
  cls: DesignerClass
  baseFte: number
  illustration?: string // data URL albo ścieżka w /public
  gender?: 'F' | 'M' // z profilu; wyznacza ilustrację karty i płeć ludzika
  look?: Look
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

/** Kraina w tle paska projektu (paczka teł parallax). */
export const LANDS = ['desert', 'forest', 'moon', 'skies'] as const
export type LandId = (typeof LANDS)[number]

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
  land?: LandId
  owner?: string // opiekun projektu po stronie TSH (PM/APM)
  notes?: string
  createdAt: string
  archivedAt?: string
}

/** Slot designerski w projekcie (zapotrzebowanie, obsadzone lub wolne). */
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

/** Pozostała rola (QA, BA, Dev…) — tylko do wizualizacji składu. */
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

/** Zadanie z notatnika osoby. */
export interface Todo {
  id: string
  designerId: string
  text: string
  done: boolean
  createdAt: string
}

export interface Settings {
  id: 'settings'
  alertWeeks: number
}

export const CLASS_META: Record<DesignerClass, { label: string; short: string; color: string; hero: string; rarity: string }> = {
  SENIOR_PD: { label: 'Product Designer', short: 'Senior PD', color: '#f2b53c', hero: 'Senior', rarity: 'Senior' },
  UX_RESEARCHER: { label: 'UX Researcher', short: 'UX Researcher', color: '#a77bff', hero: 'Research', rarity: 'Research' },
  MEDIOR_PD: { label: 'Product Designer', short: 'Medior PD', color: '#4fa3ff', hero: 'Medior', rarity: 'Medior' },
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
  OTHER: 'Inna',
}

export const ABSENCE_LABEL: Record<AbsenceType, string> = {
  VACATION: 'Urlop',
  SICK: 'L4',
  TRAINING: 'Szkolenie',
  OTHER: READ_ONLY ? 'Nieobecność' : 'Inne', // w podglądzie serwer ukrywa typ — wszystko to „Nieobecność”
}

export const CLASSES: DesignerClass[] = ['SENIOR_PD', 'MEDIOR_PD', 'UX_RESEARCHER']
export const MERC_ROLES: MercenaryRole[] = ['QA', 'BA', 'DEV', 'APM', 'APE']
export const PHASES: Phase[] = ['PRESALES', 'DISCOVERY', 'DELIVERY', 'OTHER']

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
