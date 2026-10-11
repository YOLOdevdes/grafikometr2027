import { describe, expect, it } from 'vitest'
import { evaluateCandidate, overloadRanges, rankCandidates, type World } from './availability'
import { buildForecast, recruitAlerts } from './forecast'
import type { Demand, Designer } from './types'

// 2026-11-02 to poniedziałek
const designer = (id: string, cls: Designer['cls'] = 'SENIOR_PD'): Designer => ({ id, name: id, cls, baseFte: 1, createdAt: '2025-01-01T00:00:00Z' })
const demand = (id: string, from: string, to: string, extra: Partial<Demand> = {}): Demand => ({ id, projectId: 'p', cls: 'SENIOR_PD', fte: 1, from, to, ...extra })
const world = (w: Partial<World>): World => ({
  designers: [], absences: [], demands: [],
  projects: [{ id: 'p', name: 'Atlas', phase: 'DELIVERY', from: '2026-01-01', to: '2027-12-31', upcoming: false, color: '#fff', createdAt: '' }],
  ...w,
})

describe('evaluateCandidate', () => {
  const target = demand('t', '2026-11-02', '2026-11-27')

  it('wolny, gdy nic nie koliduje', () => {
    const a = designer('a')
    expect(evaluateCandidate(world({ designers: [a], demands: [target] }), a, target).status).toBe('FREE')
  })

  it('„wolny od”, gdy inny projekt kończy się w trakcie', () => {
    const a = designer('a')
    const other = demand('o', '2026-10-01', '2026-11-11', { designerId: 'a' }) // środa
    const r = evaluateCandidate(world({ designers: [a], demands: [target, other] }), a, target)
    expect(r.status).toBe('FREE_FROM')
    expect(r.freeFrom).toBe('2026-11-12')
    expect(r.conflicts[0]).toMatchObject({ kind: 'PROJECT', from: '2026-11-02', to: '2026-11-11' })
  })

  it('częściowo, gdy urlop wypada w środku', () => {
    const a = designer('a')
    const r = evaluateCandidate(
      world({ designers: [a], demands: [target], absences: [{ id: 'x', designerId: 'a', from: '2026-11-16', to: '2026-11-20', type: 'VACATION' }] }),
      a, target,
    )
    expect(r.status).toBe('PARTIAL')
    expect(r.conflicts).toHaveLength(1)
  })

  it('pół etatu obok pół etatu się mieści', () => {
    const a = designer('a')
    const half = demand('t2', '2026-11-02', '2026-11-27', { fte: 0.5 })
    const other = demand('o', '2026-10-01', '2026-12-31', { designerId: 'a', fte: 0.5 })
    expect(evaluateCandidate(world({ designers: [a], demands: [half, other] }), a, half).status).toBe('FREE')
  })

  it('zajęty przez cały okres', () => {
    const a = designer('a')
    const other = demand('o', '2026-10-01', '2026-12-31', { designerId: 'a' })
    expect(evaluateCandidate(world({ designers: [a], demands: [target, other] }), a, target).status).toBe('BUSY')
  })

  it('ranking: najpierw właściwa klasa i wolni', () => {
    const a = designer('a'), b = designer('b'), m = designer('m', 'MEDIOR_PD')
    const other = demand('o', '2026-10-01', '2026-12-31', { designerId: 'a' })
    const ranked = rankCandidates(world({ designers: [a, b, m], demands: [target, other] }), target)
    expect(ranked.map(r => r.designer.id)).toEqual(['b', 'a', 'm'])
  })
})

describe('overloadRanges', () => {
  it('wykrywa przeciążenie z nadgodzinami', () => {
    const a = designer('a')
    const w = world({ designers: [a], demands: [
      demand('x', '2026-11-02', '2026-11-13', { designerId: 'a' }),
      demand('y', '2026-11-09', '2026-11-20', { designerId: 'a', fte: 0.5 }),
    ] })
    expect(overloadRanges(w, a, '2026-11-01', '2026-11-30')).toEqual([{ from: '2026-11-09', to: '2026-11-13' }])
  })
})

describe('forecast', () => {
  it('liczy lukę i alert rekrutacyjny', () => {
    const a = designer('a')
    const w = world({
      designers: [a],
      demands: [demand('x', '2026-11-02', '2026-12-31', { designerId: 'a' }), demand('y', '2026-11-16', '2026-12-31', { fte: 0.5 })],
    })
    const f = buildForecast(w, '2026-11-02', 8)
    expect(f.SENIOR_PD[0]).toMatchObject({ supply: 1, demandCertain: 1 })
    expect(f.SENIOR_PD[2]).toMatchObject({ supply: 1, demandCertain: 1.5, unfilledCertain: 0.5 })
    const alerts = recruitAlerts(f, 4)
    expect(alerts.find(a => a.scope === 'CERTAIN')).toMatchObject({ cls: 'SENIOR_PD', from: '2026-11-16', peakGap: 0.5 })
  })

  it('projekty nadchodzące liczą się tylko do prognozy „z nadchodzącymi”', () => {
    const a = designer('a')
    const w = world({ designers: [a], demands: [demand('x', '2026-11-02', '2026-11-06', { projectId: 'u' })] })
    w.projects.push({ id: 'u', name: 'Orbit', phase: 'PRESALES', from: '2026-11-02', to: '2026-11-06', upcoming: true, color: '#fff', createdAt: '' })
    const f = buildForecast(w, '2026-11-02', 1)
    expect(f.SENIOR_PD[0]).toMatchObject({ demandCertain: 0, demandAll: 1 })
  })
})
