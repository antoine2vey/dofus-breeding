import { COLORS, type InvMount, recommend } from '@dd/core'
import { describe, expect, it } from 'vitest'

const mount = (o: Partial<InvMount> & { id: number }): InvMount => ({
  color: 'Amande',
  sex: 'F',
  status: 'feconde',
  keeper: false,
  grandparents: [],
  ...o
})
const base = { targetGen: 10, freeSlots: 99, level: 60, optimakina: false }

// recommend() drives the breed/capture/recycle suggestions. These hit its own interface (breed
// actions, intended colour, scoring) rather than reaching it through assistantPlan.
describe('recommend', () => {
  it('achievements drop done colours from missingToTarget and cut captures', () => {
    const doneGen4 = COLORS.filter((c) => c.gen <= 4).map((c) => c.name)
    const rec = recommend('dragodinde', {
      ...base,
      mounts: [],
      targetGen: 5,
      freeSlots: 4,
      level: 100,
      optimakina: true,
      achievements: doneGen4
    })
    expect(rec.missingToTarget).not.toContain('Indigo et Rousse') // done → off the goal
    expect(rec.missingToTarget).toContain('Pourpre') // gen 5, not done
    const caps = (r: ReturnType<typeof recommend>) => r.capture.reduce((n, c) => n + c.count, 0)
    const ctl = recommend('dragodinde', {
      ...base,
      mounts: [],
      targetGen: 5,
      freeSlots: 4,
      level: 100,
      optimakina: true
    })
    expect(caps(rec)).toBeLessThan(caps(ctl))
  })

  it('breeds a step-up recipe from cheap bases, never a self/lateral cross', () => {
    const rec = recommend('dragodinde', {
      ...base,
      mounts: [
        mount({ id: 1, color: 'Dorée', sex: 'M' }),
        mount({ id: 2, color: 'Rousse', sex: 'F' }),
        mount({ id: 3, color: 'Dorée et Rousse', sex: 'F' }) // scarce gen-2 — must NOT be cannibalised
      ]
    })
    expect(rec.breed).toHaveLength(1)
    expect([rec.breed[0].aId, rec.breed[0].bId].sort()).toEqual([1, 2])
    expect(rec.breed[0].intended).toBe('Dorée et Rousse')
    for (const b of rec.breed) expect([b.aId, b.bId]).not.toContain(3)
  })

  it('intended names the colour the cross is FOR — the recipe child, not a by-product', () => {
    const rec = recommend('dragodinde', {
      ...base,
      mounts: [
        mount({ id: 1, color: 'Amande', sex: 'M' }),
        mount({ id: 2, color: 'Dorée', sex: 'F' })
      ]
    })
    expect(rec.breed).toHaveLength(1)
    expect(rec.breed[0].intended).toBe('Amande et Dorée')
  })

  it('keeps a cross whose top probability TIES across two wanted colours', () => {
    // Amande et Rousse (g2) × Indigo (g3) splits ~35/35 over two MISSING gen-4 colours
    // (Amande et Indigo / Indigo et Rousse) — a 70% shot at new progress. The old "driver must be
    // the unique strict prob-max" rule threw this out on the tie; it must now survive.
    const rec = recommend('dragodinde', {
      ...base,
      level: 100,
      optimakina: true, // the gen-4 recombination (and thus the 35/35 split) needs optima
      mounts: [
        mount({ id: 1, color: 'Amande et Rousse', sex: 'M', grandparents: ['Amande', 'Rousse'] }),
        mount({ id: 2, color: 'Indigo', sex: 'F', grandparents: ['Rousse', 'Amande et Dorée'] })
      ]
    })
    expect(rec.breed).toHaveLength(1)
    expect(['Amande et Indigo', 'Indigo et Rousse']).toContain(rec.breed[0].intended)
  })

  it('breed actions come back ranked by score (descending)', () => {
    const rec = recommend('dragodinde', {
      ...base,
      mounts: [
        mount({ id: 1, color: 'Dorée', sex: 'M' }),
        mount({ id: 2, color: 'Rousse', sex: 'F' }),
        mount({ id: 3, color: 'Amande', sex: 'M' }),
        mount({ id: 4, color: 'Rousse', sex: 'F' })
      ]
    })
    for (let i = 1; i < rec.breed.length; i++)
      expect(rec.breed[i - 1].score).toBeGreaterThanOrEqual(rec.breed[i].score)
  })
})
