import { addDaysISO, covers, mondayOf, workdays } from './dates'
import type { World } from './availability'
import { demandLoad } from './availability'
import type { DesignerClass, ISODate } from './types'
import { CLASSES } from './types'

export interface WeekPoint {
  week: ISODate // poniedziałek
  supply: number
  demandCertain: number
  demandAll: number
  unfilledCertain: number
  unfilledAll: number
}

export type Forecast = Record<DesignerClass, WeekPoint[]>

/**
 * Per klasa, per tydzień (średnia z dni roboczych):
 * podaż = Σ baseFte osób danej klasy minus nieobecności,
 * popyt = Σ zleceń danej klasy (pewne = projekty bez flagi „nadchodzący”).
 */
export function buildForecast(world: World, fromDay: ISODate, weeks: number): Forecast {
  const start = mondayOf(fromDay)
  const projectUpcoming = new Map(world.projects.map(p => [p.id, p.upcoming]))
  const result = Object.fromEntries(CLASSES.map(c => [c, [] as WeekPoint[]])) as Forecast

  for (let w = 0; w < weeks; w++) {
    const week = addDaysISO(start, w * 7)
    const days = workdays(week, addDaysISO(week, 4))
    for (const cls of CLASSES) {
      let supply = 0
      let demandCertain = 0
      let demandAll = 0
      let unfilledCertain = 0
      let unfilledAll = 0
      for (const day of days) {
        for (const d of world.designers) {
          if (d.cls !== cls || d.archivedAt || d.createdAt.slice(0, 10) > day) continue
          const absent = world.absences.some(a => a.designerId === d.id && covers(a.from, a.to, day))
          if (!absent) supply += d.baseFte
        }
        for (const dm of world.demands) {
          if (dm.cls !== cls || !covers(dm.from, dm.to, day)) continue
          const load = demandLoad(dm)
          const upcoming = projectUpcoming.get(dm.projectId) ?? false
          demandAll += load
          if (!dm.designerId) unfilledAll += load
          if (!upcoming) {
            demandCertain += load
            if (!dm.designerId) unfilledCertain += load
          }
        }
      }
      const n = days.length || 1
      result[cls].push({
        week,
        supply: supply / n,
        demandCertain: demandCertain / n,
        demandAll: demandAll / n,
        unfilledCertain: unfilledCertain / n,
        unfilledAll: unfilledAll / n,
      })
    }
  }
  return result
}

export interface RecruitAlert {
  cls: DesignerClass
  scope: 'CERTAIN' | 'ALL'
  from: ISODate
  weeks: number
  peakGap: number
}

/** Alert, gdy popyt > podaż przez ≥ minWeeks kolejnych tygodni. Zwraca pierwsze takie okno per klasa i zakres. */
export function recruitAlerts(forecast: Forecast, minWeeks: number): RecruitAlert[] {
  const out: RecruitAlert[] = []
  for (const cls of CLASSES) {
    for (const scope of ['CERTAIN', 'ALL'] as const) {
      const pts = forecast[cls]
      let runStart = -1
      let peak = 0
      for (let i = 0; i <= pts.length; i++) {
        const gap = i < pts.length ? (scope === 'CERTAIN' ? pts[i].demandCertain : pts[i].demandAll) - pts[i].supply : 0
        if (gap > 0.05) {
          if (runStart < 0) {
            runStart = i
            peak = 0
          }
          peak = Math.max(peak, gap)
        } else if (runStart >= 0) {
          if (i - runStart >= minWeeks) {
            out.push({ cls, scope, from: pts[runStart].week, weeks: i - runStart, peakGap: Math.round(peak * 10) / 10 })
            break
          }
          runStart = -1
        }
      }
    }
  }
  return out
}
