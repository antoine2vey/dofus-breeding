import { type Cheptel, cheptelAccounting, extractionCandidates } from '@dd/core'
import { describe, expect, it } from 'vitest'

// Extraction surplus: done colours (succès unlocked), gen >= 2, not keepers, that the plan is
// FINISHED with — no remaining demand, and we reserve the copies still used as a parent. Reward per
// mount = its generation.
describe('extractionCandidates', () => {
  const acc = (mounts: Parameters<typeof cheptelAccounting>[1]['mounts'], targetGen: number) =>
    cheptelAccounting('dragodinde', {
      mounts,
      achievements: ['Amande et Dorée', 'Amande'],
      targetGen,
      level: 100,
      optima: true,
      clonage: false
    })

  it('offers every non-keeper copy of a terminal done colour, excludes gen 1 and keepers', () => {
    const mounts = [
      { color: 'Amande et Dorée', status: 'fertile' as const, keeper: false },
      { color: 'Amande et Dorée', status: 'fertile' as const, keeper: false },
      { color: 'Amande et Dorée', status: 'sterile' as const, keeper: false },
      { color: 'Amande et Dorée', status: 'fertile' as const, keeper: true }, // keeper → excluded
      { color: 'Amande', status: 'fertile' as const, keeper: false } // gen 1 → excluded
    ]
    // targetGen 2: "Amande et Dorée" is terminal — no demand, consumed nowhere, so all are surplus.
    const cands = extractionCandidates('dragodinde', mounts, acc(mounts, 2))
    expect(cands).toHaveLength(1)
    const c = cands[0]
    expect(c.color).toBe('Amande et Dorée')
    expect(c.gen).toBe(2)
    expect(c.owned).toBe(3) // 2 fertile + 1 sterile; keeper not counted
    expect(c.surplus).toBe(3) // nothing reserved → all extractable
    expect(c.rewardEach).toBe(2) // reward = gen
  })

  it('never offers a colour the plan is still producing — even its sterile copies', () => {
    // The Indigo/Ebène regression: succès unlocked, but at gen 10 the plan still breeds hundreds of
    // them as parents. Holding only a few (incl. steriles) must NOT mark any as extractable.
    const mounts = [
      { color: 'Indigo', status: 'feconde' as const, keeper: false },
      { color: 'Indigo', status: 'fertile' as const, keeper: false },
      { color: 'Indigo', status: 'sterile' as const, keeper: false },
      { color: 'Ebène', status: 'sterile' as const, keeper: false },
      { color: 'Ebène', status: 'sterile' as const, keeper: false }
    ]
    const a = cheptelAccounting('dragodinde', {
      mounts,
      achievements: ['Indigo', 'Ebène'],
      targetGen: 10,
      level: 100,
      optima: true,
      clonage: false
    })
    expect(a.plan.demand.Indigo).toBeGreaterThan(0) // still being produced
    const cands = extractionCandidates('dragodinde', mounts, a)
    expect(cands.find((c) => c.color === 'Indigo')).toBeUndefined()
    expect(cands.find((c) => c.color === 'Ebène')).toBeUndefined()
  })

  it('reserves copies still used as a parent, offering only the excess (no remaining demand)', () => {
    // Synthetic accounting: a done colour you over-hold (owned 5), the plan still uses it as a parent
    // twice (consumed 2) but isn't breeding more of it (demand 0) → 2 reserved, 3 offered.
    const mounts = Array.from({ length: 5 }, () => ({
      color: 'Amande et Dorée',
      status: 'fertile' as const,
      keeper: false
    }))
    const synth = (demand: number, consumed: number): Cheptel =>
      ({
        done: new Set(['Amande et Dorée']),
        obtained: new Set(['Amande et Dorée']),
        usableStock: { 'Amande et Dorée': 5 },
        ownedStock: { 'Amande et Dorée': 5 },
        sinkStock: { 'Amande et Dorée': 5 },
        plan: {
          demand: { 'Amande et Dorée': demand },
          consumed: { 'Amande et Dorée': consumed }
        }
      }) as unknown as Cheptel

    const offered = extractionCandidates('dragodinde', mounts, synth(0, 2))
    expect(offered).toHaveLength(1)
    expect(offered[0].surplus).toBe(3) // 5 owned − 2 reserved as parents

    // Same holding but still in demand → nothing offered.
    expect(extractionCandidates('dragodinde', mounts, synth(1, 2))).toHaveLength(0)
  })

  it('does not offer a colour whose succès is unlocked but is not owned', () => {
    const mounts = [{ color: 'Amande et Rousse', status: 'fertile' as const, keeper: false }]
    // "Amande et Dorée" has the succès but zero owned copies → nothing to extract.
    const cands = extractionCandidates('dragodinde', mounts, acc(mounts, 2))
    expect(cands.find((c) => c.color === 'Amande et Dorée')).toBeUndefined()
    // "Amande et Rousse" is owned but has NO succès → still being chased, not extractable.
    expect(cands.find((c) => c.color === 'Amande et Rousse')).toBeUndefined()
  })
})
