import { baseWeight, crossOdds, pTargetFor } from '@dd/core'
import { describe, expect, it } from 'vitest'

// crossOdds was previously exercised only THROUGH assistantPlan. These assert the génération-cible
// probability model at its own interface, so a regression shows up here rather than as a mysterious
// shift in a downstream breed recommendation.
describe('crossOdds', () => {
  it('base weights: monocolore 9, Dorée 2 (the exception), bicolore 2', () => {
    expect(baseWeight('dragodinde', 'Amande')).toBe(9)
    expect(baseWeight('dragodinde', 'Dorée')).toBe(2)
    expect(baseWeight('dragodinde', 'Amande et Rousse')).toBe(2)
  })

  it('base weights are per-species (muldo Doré is the rare base; volkorne has none)', () => {
    expect(baseWeight('muldo', 'Doré')).toBe(2)
    expect(baseWeight('muldo', 'Ebène')).toBe(9)
    expect(baseWeight('volkorne', 'Doré')).toBe(9) // Doré is a gen-7 pure for volkorne, not a rare base
  })

  it('pTargetFor = 0.3 + 0.0015·ΣparentLevels + 0.1·optima, capped at 1', () => {
    expect(pTargetFor(120, false)).toBeCloseTo(0.48, 6)
    expect(pTargetFor(120, true)).toBeCloseTo(0.58, 6)
    expect(pTargetFor(10000, true)).toBe(1)
  })

  it('the recipe child is the target gen and takes all of p (Dorée × Rousse → Dorée et Rousse)', () => {
    const r = crossOdds('dragodinde', { race: 'Dorée' }, { race: 'Rousse' }, 120, false)
    expect(r.targetGen).toBe(2)
    const dr = r.outcomes.find((o) => o.race === 'Dorée et Rousse')!
    expect(dr.isTarget).toBe(true)
    expect(dr.prob).toBeCloseTo(0.48, 5) // sole gen-2 outcome → all of p
  })

  it('a muldo recipe resolves in the muldo tree (Doré × Pourpre → Doré et Pourpre)', () => {
    const r = crossOdds('muldo', { race: 'Doré' }, { race: 'Pourpre' }, 120, false)
    expect(r.targetGen).toBe(2)
    expect(r.outcomes.find((o) => o.race === 'Doré et Pourpre')?.isTarget).toBe(true)
  })

  it('outcome probabilities sum to 1 when target and non-target outcomes both exist', () => {
    const r = crossOdds(
      'dragodinde',
      { race: 'Ebène', grandparents: ['Amande et Dorée', 'Dorée et Rousse'] },
      { race: 'Rousse' },
      100,
      true
    )
    expect(r.outcomes.reduce((s, o) => s + o.prob, 0)).toBeCloseTo(1, 6)
  })

  it('a high-gen grandparent hijacks the target generation', () => {
    // The male carries Orchidée et Rousse (gen 6) in its lineage → it becomes the cross's target.
    const r = crossOdds(
      'dragodinde',
      { race: 'Ebène', grandparents: ['Ebène', 'Orchidée et Rousse'] },
      { race: 'Ebène', grandparents: ['Amande et Dorée', 'Dorée et Rousse'] },
      120,
      false
    )
    expect(r.targetGen).toBe(6)
    const or = r.outcomes.find((o) => o.race === 'Orchidée et Rousse')!
    expect(or.isTarget).toBe(true)
    expect(or.prob).toBeCloseTo(0.48, 4) // sole gen-6 outcome → all of p
    const eb = r.outcomes.find((o) => o.race === 'Ebène')!
    expect(eb.isTarget).toBe(false)
    expect(eb.prob).toBeGreaterThan(0.45) // bulk of the (1-p) mass, but NOT the target slice
  })
})
