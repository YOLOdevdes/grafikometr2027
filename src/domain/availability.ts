import { covers, maxISO, minISO, overlaps, workdays } from './dates'
import type { Absence, Demand, Designer, ISODate, Project } from './types'
import { ABSENCE_LABEL, PHASE_LABEL } from './types'

export interface World {
  designers: Designer[]
  absences: Absence[]
  projects: Project[]
  demands: Demand[]
}

export const demandLoad = (d: Demand) => d.fte + (d.overtimeFte ?? 0)

export function isAbsent(world: World, designerId: string, day: ISODate): Absence | undefined {
  return world.absences.find(a => a.designerId === designerId && covers(a.from, a.to, day))
}

/** Suma FTE z przypisanych zleceń w danym dniu (opcjonalnie z pominięciem jednego zlecenia). */
export function loadOn(world: World, designerId: string, day: ISODate, excludeDemandId?: string): number {
  let sum = 0
  for (const d of world.demands) {
    if (d.designerId === designerId && d.id !== excludeDemandId && covers(d.from, d.to, day)) sum += demandLoad(d)
  }
  return sum
}

export function freeOn(world: World, designer: Designer, day: ISODate, excludeDemandId?: string): number {
  if (isAbsent(world, designer.id, day)) return 0
  return designer.baseFte - loadOn(world, designer.id, day, excludeDemandId)
}

export type CandidateStatus = 'FREE' | 'FREE_FROM' | 'PARTIAL' | 'BUSY'

export interface Conflict {
  kind: 'ABSENCE' | 'PROJECT'
  label: string
  from: ISODate
  to: ISODate
}

export interface CandidateEval {
  designer: Designer
  status: CandidateStatus
  freeFrom?: ISODate
  freeDays: number
  totalDays: number
  conflicts: Conflict[]
  classMismatch: boolean
}

const EPS = 1e-6

/** Serce walidacji: czy osoba udźwignie zlecenie, a jeśli nie — od kiedy i co przeszkadza. */
export function evaluateCandidate(world: World, designer: Designer, demand: Demand): CandidateEval {
  const days = workdays(demand.from, demand.to)
  const need = demandLoad(demand)
  const ok = days.map(day => freeOn(world, designer, day, demand.id) + EPS >= need)

  const freeDays = ok.filter(Boolean).length
  let status: CandidateStatus
  let freeFrom: ISODate | undefined
  if (days.length === 0 || freeDays === days.length) {
    status = 'FREE'
  } else if (freeDays === 0) {
    status = 'BUSY'
  } else {
    // najwcześniejszy dzień, od którego osoba jest wolna nieprzerwanie do końca zlecenia
    let i = days.length
    while (i > 0 && ok[i - 1]) i--
    if (i < days.length) freeFrom = days[i]
    // „wolny od” tylko gdy blokada jest wyłącznie na początku; dziura w środku to „częściowo”
    status = freeFrom && ok.slice(0, i).every(x => !x) ? 'FREE_FROM' : 'PARTIAL'
  }

  const conflicts: Conflict[] = []
  for (const a of world.absences) {
    if (a.designerId === designer.id && overlaps(a.from, a.to, demand.from, demand.to)) {
      conflicts.push({ kind: 'ABSENCE', label: ABSENCE_LABEL[a.type], from: maxISO(a.from, demand.from), to: minISO(a.to, demand.to) })
    }
  }
  for (const d of world.demands) {
    if (d.id !== demand.id && d.designerId === designer.id && overlaps(d.from, d.to, demand.from, demand.to)) {
      const p = world.projects.find(p => p.id === d.projectId)
      conflicts.push({
        kind: 'PROJECT',
        label: `${p?.name ?? '?'} ${p ? PHASE_LABEL[p.phase] : ''} ${demandLoad(d)}`.trim(),
        from: maxISO(d.from, demand.from),
        to: minISO(d.to, demand.to),
      })
    }
  }
  conflicts.sort((a, b) => a.from.localeCompare(b.from))

  return { designer, status, freeFrom, freeDays, totalDays: days.length, conflicts, classMismatch: designer.cls !== demand.cls }
}

const STATUS_ORDER: Record<CandidateStatus, number> = { FREE: 0, FREE_FROM: 1, PARTIAL: 2, BUSY: 3 }

export function rankCandidates(world: World, demand: Demand): CandidateEval[] {
  return world.designers
    .filter(d => !d.archivedAt)
    .map(d => evaluateCandidate(world, d, demand))
    .sort(
      (a, b) =>
        Number(a.classMismatch) - Number(b.classMismatch) ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.freeFrom ?? '').localeCompare(b.freeFrom ?? '') ||
        b.freeDays - a.freeDays ||
        a.designer.name.localeCompare(b.designer.name),
    )
}

/** Najbliższy dzień roboczy od `from`, w którym osoba ma wolne ≥ `need` FTE (szuka do roku w przód). */
export function nextFreeDay(world: World, designer: Designer, from: ISODate, need = 0.5): ISODate | undefined {
  const horizon = workdays(from, `${Number(from.slice(0, 4)) + 1}${from.slice(4)}`)
  return horizon.find(day => freeOn(world, designer, day) + EPS >= need)
}

/** Zakresy dni, w których osoba jest przeciążona (load > baseFte, nie licząc nieobecności). */
export function overloadRanges(world: World, designer: Designer, from: ISODate, to: ISODate): { from: ISODate; to: ISODate }[] {
  const out: { from: ISODate; to: ISODate }[] = []
  let cur: { from: ISODate; to: ISODate } | null = null
  for (const day of workdays(from, to)) {
    const over = loadOn(world, designer.id, day) > designer.baseFte + EPS
    if (over) {
      if (cur) cur.to = day
      else cur = { from: day, to: day }
    } else if (cur) {
      out.push(cur)
      cur = null
    }
  }
  if (cur) out.push(cur)
  return out
}

/** Absencje przypisanego designera, które wypadają w czasie zlecenia. */
export function absenceWarnings(world: World, demand: Demand): Absence[] {
  if (!demand.designerId) return []
  return world.absences.filter(a => a.designerId === demand.designerId && overlaps(a.from, a.to, demand.from, demand.to))
}
