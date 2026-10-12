import Dexie, { type EntityTable } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import type { World } from './domain/availability'
import { todayISO } from './domain/dates'
import type { Absence, Demand, DemandSnapshot, Designer, HistoryEvent, HistoryType, Mercenary, Project, Settings } from './domain/types'

export class PipolatorDB extends Dexie {
  designers!: EntityTable<Designer, 'id'>
  absences!: EntityTable<Absence, 'id'>
  projects!: EntityTable<Project, 'id'>
  demands!: EntityTable<Demand, 'id'>
  mercenaries!: EntityTable<Mercenary, 'id'>
  history!: EntityTable<HistoryEvent, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('pipolator')
    this.version(1).stores({
      designers: 'id, cls',
      absences: 'id, designerId, from',
      projects: 'id, from',
      demands: 'id, projectId, designerId, from',
      mercenaries: 'id, projectId',
      history: 'id, designerId, demandId, at',
      settings: 'id',
    })
    // v2: regiony → kontynenty
    this.version(2).upgrade(tx =>
      tx.table('projects').toCollection().modify((p: { region?: string }) => {
        if (p.region === 'SAUDI') p.region = 'MIDDLE_EAST'
        else if (p.region === 'USA') p.region = 'NORTH_AMERICA'
      }),
    )
    // v3: nazewnictwo projektowe zamiast fantasy — podmiana pseudonimów z danych demo
    this.version(3).upgrade(tx =>
      tx.table('designers').toCollection().modify((d: { title?: string }) => {
        const map: Record<string, string> = {
          'Pikselowa Paladynka': 'Design systemy', 'Strażnik Siatki': 'Fintech i bankowość', 'Kowal Komponentów': 'Biblioteki komponentów',
          'Rycerka Wireframe': 'Aplikacje mobilne', 'Giermek Flow': 'User flows i prototypy', 'Łuczniczka Kerningu': 'UI i typografia',
          'Tropiciel Pikseli': 'Dashboardy i dane', 'Wyrocznia Wywiadów': 'Wywiady i testy', 'Szaman Persony': 'Research ilościowy',
          'Mistrzyni Mapy Empatii': 'Service design',
        }
        if (d.title && map[d.title]) d.title = map[d.title]
      }),
    )
  }
}

export const db = new PipolatorDB()
export const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

export interface FullWorld extends World {
  mercenaries: Mercenary[]
  history: HistoryEvent[]
  settings: Settings
}

const DEFAULT_SETTINGS: Settings = { id: 'settings', alertWeeks: 4 }

export function useWorld(): FullWorld | undefined {
  return useLiveQuery(async () => {
    const [designers, absences, projects, demands, mercenaries, history, settings] = await Promise.all([
      db.designers.toArray(),
      db.absences.toArray(),
      db.projects.toArray(),
      db.demands.toArray(),
      db.mercenaries.toArray(),
      db.history.toArray(),
      db.settings.get('settings'),
    ])
    designers.sort((a, b) => a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name))
    return { designers, absences, projects, demands, mercenaries, history, settings: settings ?? DEFAULT_SETTINGS }
  })
}

// ---------- akcje ----------

async function snapshotOf(demand: Demand): Promise<DemandSnapshot> {
  const p = await db.projects.get(demand.projectId)
  return {
    projectId: demand.projectId,
    projectName: p?.name ?? '?',
    client: p?.client,
    phase: p?.phase ?? 'DELIVERY',
    from: demand.from,
    to: demand.to,
    fte: demand.fte + (demand.overtimeFte ?? 0),
  }
}

async function logEvent(type: HistoryType, designerId: string, demand: Demand) {
  await db.history.add({ id: uid(), at: now(), type, designerId, demandId: demand.id, snapshot: await snapshotOf(demand) })
}

export const actions = {
  async saveDesigner(d: Omit<Designer, 'id' | 'createdAt'> & Partial<Pick<Designer, 'id' | 'createdAt'>>) {
    const rec: Designer = { ...d, id: d.id ?? uid(), createdAt: d.createdAt ?? now() }
    await db.designers.put(rec)
    return rec
  },
  async archiveDesigner(id: string, archived: boolean) {
    await db.designers.update(id, { archivedAt: archived ? now() : undefined })
  },

  async saveAbsence(a: Omit<Absence, 'id'> & { id?: string }) {
    await db.absences.put({ ...a, id: a.id ?? uid() })
  },
  async deleteAbsence(id: string) {
    await db.absences.delete(id)
  },

  async saveProject(p: Omit<Project, 'id' | 'createdAt'> & Partial<Pick<Project, 'id' | 'createdAt'>>) {
    const rec: Project = { ...p, id: p.id ?? uid(), createdAt: p.createdAt ?? now() }
    await db.projects.put(rec)
    return rec
  },
  async archiveProject(id: string, archived: boolean) {
    await db.projects.update(id, { archivedAt: archived ? now() : undefined })
  },

  async saveDemand(d: Omit<Demand, 'id'> & { id?: string }) {
    const rec: Demand = { ...d, id: d.id ?? uid() }
    await db.demands.put(rec)
    return rec
  },
  async deleteDemand(id: string) {
    await db.transaction('rw', db.demands, db.projects, db.history, async () => {
      const d = await db.demands.get(id)
      if (!d) return
      // jeśli ktoś już w tym pracował — kronika ma to zapamiętać
      if (d.designerId && d.from <= todayISO()) await logEvent('DEMAND_REMOVED', d.designerId, d)
      await db.demands.delete(id)
    })
  },
  async assign(demandId: string, designerId: string | undefined) {
    await db.transaction('rw', db.demands, db.projects, db.history, async () => {
      const d = await db.demands.get(demandId)
      if (!d || d.designerId === designerId) return
      if (d.designerId) await logEvent('UNASSIGNED', d.designerId, d)
      await db.demands.update(demandId, { designerId })
      if (designerId) await logEvent('ASSIGNED', designerId, { ...d, designerId })
    })
  },

  async setMercenaries(projectId: string, role: Mercenary['role'], count: number, fte = 1) {
    const existing = (await db.mercenaries.where('projectId').equals(projectId).toArray()).find(m => m.role === role)
    if (count <= 0) {
      if (existing) await db.mercenaries.delete(existing.id)
    } else {
      await db.mercenaries.put({ id: existing?.id ?? uid(), projectId, role, count, fte })
    }
  },

  async saveSettings(s: Partial<Settings>) {
    const cur = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
    await db.settings.put({ ...cur, ...s })
  },
}

// ---------- backup ----------

const TABLES = ['designers', 'absences', 'projects', 'demands', 'mercenaries', 'history', 'settings'] as const

export async function exportJSON(): Promise<string> {
  const data: Record<string, unknown[]> = {}
  for (const t of TABLES) data[t] = await db.table(t).toArray()
  return JSON.stringify({ app: 'pipolator', version: 1, exportedAt: now(), data }, null, 2)
}

export async function importJSON(json: string) {
  const parsed = JSON.parse(json)
  if (parsed?.app !== 'pipolator' || !parsed.data) throw new Error('To nie jest plik zapisu Grafikometru2027')
  await db.transaction('rw', TABLES.map(t => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      await db.table(t).bulkPut(parsed.data[t] ?? [])
    }
  })
}

export async function wipe() {
  await db.transaction('rw', TABLES.map(t => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).clear()
  })
}
