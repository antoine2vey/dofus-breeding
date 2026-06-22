import { COLORS, cheptelAccounting } from '@dd/core'
import { describe, expect, it } from 'vitest'

// The accounting recommend() and assistantPlan() now share. Tested at its own interface so the
// stock-vs-sink-vs-obtained distinctions are pinned in one place.
describe('cheptelAccounting', () => {
  it('splits usable supply from owned/sink, and folds succès into obtained + the sink only', () => {
    const acc = cheptelAccounting('dragodinde', {
      mounts: [
        { color: 'Rousse', status: 'feconde', keeper: false },
        { color: 'Rousse', status: 'sterile', keeper: false }, // owned, not usable
        { color: 'Amande', status: 'fertile', keeper: true } // owned, kept → not usable supply
      ],
      achievements: ['Dorée'], // succès for a colour you DON'T own
      targetGen: 3,
      level: 100,
      optima: true,
      clonage: true
    })
    expect(acc.usableStock.Rousse).toBe(1) // only the féconde one is breeding supply
    expect(acc.ownedStock.Rousse).toBe(2) // both are held
    expect(acc.usableStock.Amande ?? 0).toBe(0) // a keeper isn't usable supply
    expect(acc.ownedStock.Amande).toBe(1)
    expect(acc.obtained.has('Rousse')).toBe(true)
    expect(acc.obtained.has('Dorée')).toBe(true) // succès → obtained even though unowned
    expect(acc.ownedStock.Dorée ?? 0).toBe(0) // ...but not actually owned
    expect(acc.sinkStock.Dorée).toBe(1) // the succès bumps the sink to ≥1
    expect(acc.done.has('Dorée')).toBe(true)
  })

  it("an unlocked succès satisfies a colour's sink, dropping it from plan demand", () => {
    const allUpToGen2 = COLORS.filter((c) => c.gen <= 2).map((c) => c.name)
    const withSucces = cheptelAccounting('dragodinde', {
      mounts: [],
      achievements: allUpToGen2,
      targetGen: 2,
      level: 100,
      optima: true,
      clonage: true
    })
    const without = cheptelAccounting('dragodinde', {
      mounts: [],
      achievements: [],
      targetGen: 2,
      level: 100,
      optima: true,
      clonage: true
    })
    expect(without.plan.totalCaptures).toBeGreaterThan(0) // nothing owned → must build everything
    expect(withSucces.plan.totalCaptures).toBe(0) // every sink ≤ gen 2 already satisfied
  })
})
