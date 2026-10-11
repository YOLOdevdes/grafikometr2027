import { minISO, todayISO } from './dates'
import type { FullWorld } from '../db'
import type { DemandSnapshot } from './types'

export interface ChronicleEntry extends DemandSnapshot {
  demandId: string
  live: boolean // nadal przypisany
}

/**
 * Kronika osoby: aktualne przypisania (z projektem „na żywo”) +
 * zakończone wcześniej (z migawki z historii, przycięte do dnia odpięcia).
 */
export function chronicleOf(world: FullWorld, designerId: string): ChronicleEntry[] {
  const out: ChronicleEntry[] = []
  const projects = new Map(world.projects.map(p => [p.id, p]))

  for (const d of world.demands) {
    if (d.designerId !== designerId) continue
    const p = projects.get(d.projectId)
    out.push({
      demandId: d.id,
      live: true,
      projectId: d.projectId,
      projectName: p?.name ?? '?',
      client: p?.client,
      phase: p?.phase ?? 'DELIVERY',
      from: d.from,
      to: d.to,
      fte: d.fte + (d.overtimeFte ?? 0),
    })
  }

  for (const e of world.history) {
    if (e.designerId !== designerId || e.type === 'ASSIGNED') continue
    const endedOn = e.at.slice(0, 10)
    if (e.snapshot.from > endedOn) continue // odpięty zanim zaczął — nie wchodzi do kroniki
    if (out.some(o => o.live && o.demandId === e.demandId)) continue // wrócił do tego samego zlecenia
    const p = projects.get(e.snapshot.projectId)
    out.push({ ...e.snapshot, projectName: p?.name ?? e.snapshot.projectName, demandId: e.demandId, live: false, to: minISO(e.snapshot.to, endedOn) })
  }

  return out.sort((a, b) => b.from.localeCompare(a.from))
}

export const isPast = (e: { to: string }) => e.to < todayISO()
