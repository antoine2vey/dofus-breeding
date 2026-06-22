import {
  buildName,
  colorCodesOf,
  inGameCompare,
  parseName,
  SPECIES_LIST,
  validateInGame
} from '@dd/core'
import { describe, expect, it } from 'vitest'

describe('inGameCompare (in-game list order)', () => {
  it('sorts as the in-game namer does — comparing segments with hyphens ignored', () => {
    // Reference order copied verbatim from the game's mount list.
    const ref = [
      'ad-f-d-a',
      'a-f',
      'a-f-a-d',
      'a-f-ad-ar',
      'a-f-a-r',
      'a-f-ei-ar',
      'a-m-a-a',
      'a-m-a-d'
    ]
    const shuffled = [
      'a-m-a-d',
      'a-f-a-r',
      'ad-f-d-a',
      'a-f',
      'a-f-ei-ar',
      'a-m-a-a',
      'a-f-ad-ar',
      'a-f-a-d'
    ]
    expect([...shuffled].sort(inGameCompare)).toEqual(ref)
  })

  it('ignores the hyphen: ad-f-d-a precedes a-m-a-a (d < m), unlike a raw string sort', () => {
    expect(inGameCompare('ad-f-d-a', 'a-m-a-a')).toBeLessThan(0) // game order
    expect('ad-f-d-a'.localeCompare('a-m-a-a')).toBeGreaterThan(0) // the wrong (raw) order we had
  })
})

describe('naming round-trips + is injective per species', () => {
  for (const species of SPECIES_LIST) {
    it(`${species}: every colour code is unique, in-game-valid, and round-trips`, () => {
      const seen = new Map<string, string>()
      for (const { name, code } of colorCodesOf(species)) {
        expect(code).toMatch(/^[a-z]{1,2}$/) // single/double lowercase only (parseName guard)
        expect(seen.has(code)).toBe(false) // no collision across the whole species
        seen.set(code, name)
        const built = buildName(species, { color: name, sex: 'F', keeper: false })
        expect(validateInGame(built).valid).toBe(true)
        const parsed = parseName(species, built)
        expect(parsed?.color).toBe(name)
        expect(parsed?.sex).toBe('F')
      }
    })
  }

  it('the same code decodes to DIFFERENT colours across species (species-scoped import)', () => {
    // muldo "b" = Ambre, volkorne "b" = Rubis — only safe because parseName takes a species.
    expect(parseName('muldo', 'b-f')?.color).toBe('Ambre')
    expect(parseName('volkorne', 'b-f')?.color).toBe('Rubis')
  })
})
