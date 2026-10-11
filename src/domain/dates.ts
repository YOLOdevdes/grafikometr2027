import { addDays, differenceInCalendarDays, format, isWeekend, parseISO, startOfWeek } from 'date-fns'
import type { ISODate } from './types'

export const toISO = (d: Date): ISODate => format(d, 'yyyy-MM-dd')
export const fromISO = (s: ISODate): Date => parseISO(s)
export const todayISO = (): ISODate => toISO(new Date())

export const addDaysISO = (s: ISODate, n: number): ISODate => toISO(addDays(fromISO(s), n))
export const daysBetween = (a: ISODate, b: ISODate): number => differenceInCalendarDays(fromISO(b), fromISO(a))
export const mondayOf = (s: ISODate): ISODate => toISO(startOfWeek(fromISO(s), { weekStartsOn: 1 }))

export const overlaps = (aFrom: ISODate, aTo: ISODate, bFrom: ISODate, bTo: ISODate) => aFrom <= bTo && bFrom <= aTo
export const covers = (from: ISODate, to: ISODate, day: ISODate) => from <= day && day <= to
export const maxISO = (a: ISODate, b: ISODate) => (a > b ? a : b)
export const minISO = (a: ISODate, b: ISODate) => (a < b ? a : b)

/** Dni robocze (pon–pt) w zakresie włącznie. */
export function workdays(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  let d = fromISO(from)
  const end = fromISO(to)
  while (d <= end) {
    if (!isWeekend(d)) out.push(toISO(d))
    d = addDays(d, 1)
  }
  return out
}

/** 03.11 albo 03.11.2027, gdy rok inny niż bieżący. */
export function fmt(s: ISODate, withYear = false): string {
  const d = fromISO(s)
  return withYear || d.getFullYear() !== new Date().getFullYear() ? format(d, 'dd.MM.yyyy') : format(d, 'dd.MM')
}

export const fmtRange = (from: ISODate, to: ISODate) => `${fmt(from)} → ${fmt(to)}`
