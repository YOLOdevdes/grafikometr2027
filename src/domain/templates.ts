import type { DesignerClass, MercenaryRole, Phase } from './types'

export interface SlotDraft {
  cls: DesignerClass
  fte: number
  count: number
}

export interface TeamDraft {
  slots: SlotDraft[]
  mercs: Partial<Record<MercenaryRole, number>>
}

/** Domyślny skład drużyny per faza — punkt wyjścia w kreatorze, zawsze do poprawienia. */
export const TEAM_TEMPLATES: Record<Phase, TeamDraft> = {
  PRESALES: {
    slots: [{ cls: 'SENIOR_PD', fte: 0.5, count: 1 }],
    mercs: { BA: 1, APM: 1 },
  },
  DISCOVERY: {
    slots: [
      { cls: 'SENIOR_PD', fte: 1, count: 1 },
      { cls: 'UX_RESEARCHER', fte: 0.5, count: 1 },
    ],
    mercs: { BA: 1, APM: 1 },
  },
  OTHER: { slots: [], mercs: {} },
  DELIVERY: {
    slots: [
      { cls: 'SENIOR_PD', fte: 1, count: 1 },
      { cls: 'MEDIOR_PD', fte: 1, count: 1 },
    ],
    mercs: { DEV: 3, QA: 1, APE: 1, APM: 1 },
  },
}

/** Typowa długość fazy w dniach — do podpowiedzi daty końca. */
export const PHASE_DAYS: Record<Phase, number> = { PRESALES: 20, DISCOVERY: 41, DELIVERY: 111, OTHER: 27 }

export const NEXT_PHASE: Record<Phase, Phase> = { PRESALES: 'DISCOVERY', DISCOVERY: 'DELIVERY', DELIVERY: 'DELIVERY', OTHER: 'OTHER' }

export const cloneTeam = (t: TeamDraft): TeamDraft => ({ slots: t.slots.map(s => ({ ...s })), mercs: { ...t.mercs } })
