import { arbitrate, defaultSpeciesConfig, type InvMount, type SpeciesConfig } from '@dd/core'
import { describe, expect, it } from 'vitest'

const mount = (o: Partial<InvMount> & { id: number }): InvMount => ({
  color: 'Amande',
  sex: 'F',
  status: 'feconde',
  keeper: false,
  grandparents: [],
  ...o
})

// A féconde opposite-sex pair per species, each one step from a gen-2 colour.
const dragoPair: InvMount[] = [
  mount({ id: 1, color: 'Amande', sex: 'F' }),
  mount({ id: 2, color: 'Dorée', sex: 'M' })
]
const muldoPair: InvMount[] = [
  mount({ id: 3, color: 'Doré', sex: 'M' }),
  mount({ id: 4, color: 'Pourpre', sex: 'F' })
]

const cfg = (
  over: Partial<Record<keyof SpeciesConfig, Partial<SpeciesConfig[keyof SpeciesConfig]>>> = {}
): SpeciesConfig => {
  const c = defaultSpeciesConfig()
  c.dragodinde = { ...c.dragodinde, enabled: true, targetGen: 2, ...(over.dragodinde ?? {}) }
  c.muldo = { ...c.muldo, enabled: true, targetGen: 2, ...(over.muldo ?? {}) }
  c.volkorne = { ...c.volkorne, enabled: false, ...(over.volkorne ?? {}) }
  return c
}

describe('arbitrate (cross-species)', () => {
  it('runs only enabled species and tags every action with its species', () => {
    const r = arbitrate({
      config: cfg(),
      mountsBySpecies: { dragodinde: dragoPair, muldo: muldoPair, volkorne: dragoPair },
      freeSlots: 10
    })
    expect(r.perSpecies.dragodinde).toBeDefined()
    expect(r.perSpecies.muldo).toBeDefined()
    expect(r.perSpecies.volkorne).toBeUndefined() // disabled -> excluded even though mounts passed
    expect(r.ranked.length).toBeGreaterThanOrEqual(2)
    // No cross-species pairing: a breed action's parent ids belong to its own species pool.
    for (const a of r.ranked) {
      if (a.kind !== 'breed' || !a.breed) continue
      const ids = a.species === 'dragodinde' ? [1, 2] : [3, 4]
      expect(ids).toContain(a.breed.aId)
      expect(ids).toContain(a.breed.bId)
    }
  })

  it('greedily fills the shared slot budget and never overruns it', () => {
    const r = arbitrate({
      config: cfg(),
      mountsBySpecies: { dragodinde: dragoPair, muldo: muldoPair },
      freeSlots: 1
    })
    expect(r.allocated.length).toBe(1) // two breed candidates, only one slot
    expect(r.usedSlots).toBe(1)
    expect(r.allocated[0].slots).toBe(1)
  })

  it('per-species priority changes the cross-species ordering', () => {
    const hi = arbitrate({
      config: cfg({ muldo: { priority: 5 } }),
      mountsBySpecies: { dragodinde: dragoPair, muldo: muldoPair },
      freeSlots: 1
    })
    expect(hi.allocated[0].species).toBe('muldo')
    const lo = arbitrate({
      config: cfg({ dragodinde: { priority: 5 } }),
      mountsBySpecies: { dragodinde: dragoPair, muldo: muldoPair },
      freeSlots: 1
    })
    expect(lo.allocated[0].species).toBe('dragodinde')
  })
})
