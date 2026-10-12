import { db, uid } from './db'
import { addDaysISO, mondayOf, todayISO } from './domain/dates'
import type { Absence, Demand, Designer, DesignerClass, Mercenary, Project } from './domain/types'

/** Dane przykładowe, względne do dzisiejszej daty, żeby demo zawsze wyglądało „na żywo”. */
export async function seedDemo() {
  const t0 = mondayOf(todayISO())
  const d = (n: number) => addDaysISO(t0, n)
  const created = new Date(Date.now() - 365 * 864e5).toISOString()

  const mk = (name: string, title: string, cls: DesignerClass, illustration?: string): Designer => ({
    id: uid(), name, title, cls, baseFte: 1, createdAt: created, illustration,
  })
  const kasia = mk('Kasia W.', 'Design systemy', 'SENIOR_PD', '/art/senior-pd-placeholder.png')
  const marek = mk('Marek P.', 'Fintech i bankowość', 'SENIOR_PD')
  const tomek = mk('Tomek R.', 'Biblioteki komponentów', 'SENIOR_PD')
  const ola = mk('Ola S.', 'Aplikacje mobilne', 'MEDIOR_PD')
  const bartek = mk('Bartek L.', 'User flows i prototypy', 'MEDIOR_PD')
  const ania = mk('Ania K.', 'UI i typografia', 'MEDIOR_PD')
  const piotr = mk('Piotr N.', 'Dashboardy i dane', 'MEDIOR_PD')
  const ewa = mk('Ewa M.', 'Wywiady i testy', 'UX_RESEARCHER')
  const jan = mk('Jan Z.', 'Research ilościowy', 'UX_RESEARCHER')
  const zosia = mk('Zosia B.', 'Service design', 'SENIOR_PD')
  const designers = [kasia, marek, tomek, ola, bartek, ania, piotr, ewa, jan, zosia]
  for (const [d, g] of [[kasia, 'F'], [marek, 'M'], [tomek, 'M'], [ola, 'F'], [bartek, 'M'], [ania, 'F'], [piotr, 'M'], [ewa, 'F'], [jan, 'M'], [zosia, 'F']] as const) d.gender = g

  const pj = (name: string, client: string, phase: Project['phase'], from: string, to: string, color: string, upcoming = false, region: Project['region'] = 'EUROPE'): Project => ({
    id: uid(), name, client, phase, from, to, color, upcoming, region, createdAt: created,
  })
  const atlasDisc = pj('Atlas', 'Atlas Logistics', 'DISCOVERY', d(-120), d(-50), '#e0a458')
  const atlasDel = pj('Atlas', 'Atlas Logistics', 'DELIVERY', d(-49), d(110), '#e0a458')
  const helix = pj('Helix Bank', 'Helix', 'DISCOVERY', d(-10), d(32), '#6cc4a1', false, 'MIDDLE_EAST')
  const northPre = pj('Northwind', 'Northwind', 'PRESALES', d(-20), d(5), '#7aa2f7', false, 'NORTH_AMERICA')
  const northDel = pj('Northwind', 'Northwind', 'DELIVERY', d(22), d(130), '#7aa2f7', false, 'NORTH_AMERICA')
  const orbitPre = pj('Orbit Retail', 'Orbit', 'PRESALES', d(28), d(40), '#f78c6c', true, 'MIDDLE_EAST')
  const orbitDisc = pj('Orbit Retail', 'Orbit', 'DISCOVERY', d(43), d(110), '#f78c6c', true, 'MIDDLE_EAST')
  const lumen = pj('Lumen Health', 'Lumen', 'DELIVERY', d(-60), d(75), '#c792ea', false, 'AFRICA')
  const quill = pj('Quill CMS', 'Quill', 'DELIVERY', d(-30), d(60), '#ffcb6b', false, 'ASIA')
  const vega = pj('Vega Insurance', 'Vega', 'DELIVERY', d(14), d(150), '#89ddff', false, 'NORTH_AMERICA')
  const projects = [atlasDisc, atlasDel, helix, northPre, northDel, orbitPre, orbitDisc, lumen, quill, vega]

  const dm = (p: Project, cls: DesignerClass, fte: number, who?: Designer, from = p.from, to = p.to, overtimeFte?: number): Demand => ({
    id: uid(), projectId: p.id, cls, fte, from, to, designerId: who?.id, overtimeFte,
  })
  const demands: Demand[] = [
    dm(atlasDisc, 'SENIOR_PD', 0.5, kasia),
    dm(atlasDel, 'SENIOR_PD', 1, tomek),
    dm(atlasDel, 'MEDIOR_PD', 1, ola, atlasDel.from, d(18)),
    dm(helix, 'SENIOR_PD', 1, kasia),
    dm(helix, 'UX_RESEARCHER', 0.5, ewa),
    dm(helix, 'UX_RESEARCHER', 0.5),
    dm(northPre, 'SENIOR_PD', 0.5, tomek, northPre.from, northPre.to, 0.2),
    dm(northDel, 'SENIOR_PD', 1),
    dm(northDel, 'MEDIOR_PD', 1, bartek),
    dm(orbitPre, 'MEDIOR_PD', 1),
    dm(orbitDisc, 'SENIOR_PD', 0.5),
    dm(orbitDisc, 'UX_RESEARCHER', 1),
    dm(lumen, 'SENIOR_PD', 1, marek, lumen.from, d(12)),
    dm(lumen, 'MEDIOR_PD', 1, ania),
    dm(lumen, 'UX_RESEARCHER', 0.5, jan),
    dm(quill, 'SENIOR_PD', 1, zosia),
    dm(quill, 'MEDIOR_PD', 1, piotr),
    dm(quill, 'MEDIOR_PD', 0.5, bartek, quill.from, d(18)),
    dm(vega, 'SENIOR_PD', 1),
    dm(vega, 'MEDIOR_PD', 1, ola, d(19), vega.to),
  ]

  const ab = (who: Designer, from: string, to: string, type: Absence['type'] = 'VACATION'): Absence => ({ id: uid(), designerId: who.id, from, to, type })
  const absences = [
    ab(marek, d(35), d(46)),
    ab(ola, d(8), d(10), 'SICK'),
    ab(bartek, d(29), d(33)),
    ab(kasia, d(72), d(84)),
    ab(ewa, d(15), d(16), 'TRAINING'),
  ]

  const mc = (p: Project, role: Mercenary['role'], count: number, fte = 1): Mercenary => ({ id: uid(), projectId: p.id, role, count, fte })
  const mercenaries = [
    mc(atlasDel, 'DEV', 4), mc(atlasDel, 'QA', 1), mc(atlasDel, 'APM', 1),
    mc(helix, 'BA', 1), mc(helix, 'APM', 1, 0.5),
    mc(northPre, 'BA', 1, 0.5), mc(northDel, 'DEV', 3), mc(northDel, 'APE', 2), mc(northDel, 'QA', 1),
    mc(lumen, 'DEV', 5), mc(lumen, 'QA', 2), mc(lumen, 'BA', 1),
    mc(quill, 'APE', 3), mc(quill, 'APM', 1),
    mc(vega, 'DEV', 4), mc(vega, 'QA', 1), mc(vega, 'BA', 1),
  ]

  await db.transaction('rw', [db.designers, db.projects, db.demands, db.absences, db.mercenaries], async () => {
    await db.designers.bulkPut(designers)
    await db.projects.bulkPut(projects)
    await db.demands.bulkPut(demands)
    await db.absences.bulkPut(absences)
    await db.mercenaries.bulkPut(mercenaries)
  })
}
