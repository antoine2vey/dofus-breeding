// In-game naming convention (colour-first letter codes), per species.
//
// Designed + adversarially verified per species: every name is ASCII letters/space/hyphen only,
// no digits, no accents, far under 20 chars; all codes unique within a species. Letter codes are
// PER-SPECIES (species.ts) and may reuse letters across species — names are decoded with an
// explicit species, and import is species-scoped, so there is no cross-species ambiguity.
//
// Format:  <code>-[K-]<sex>[-<gp1>[-<gp2>]]
//   <code>  1 base-letter (pure colour) or 2 base-letters (bicolour, in canonical in-game order:
//           the colour before "et" then the one after).
//   K        literal uppercase K only for KEEPERS (the copy to protect); omitted for stock.
//   <sex>    lowercase f (female) / m (male).
//   <gp>     0..2 grandparent (parent) colour codes, canonical (sorted by code).
// Every field is its own hyphen-delimited segment (e.g. `ad-f-d-a`) because the in-game namer
// chokes on some multi-letter chunks; single-letter segments name reliably.

import { codeToColorOf, colorsOf, lettersOf, type Species } from './species.js'

export type Sex = 'F' | 'M'

export interface NameParts {
  readonly color: string
  readonly sex: Sex
  readonly keeper: boolean
  /** The two grandparent (parent) colour NAMES, 0..2. Canonical (sorted by code) in the name. */
  readonly grandparents?: ReadonlyArray<string>
}

/** Colour name → short code for a species (1 letter pure, 2 letters bicolour "X et Y" order). */
export function colorCode(species: Species, color: string): string {
  const letters = lettersOf(species)
  if (color.includes(' et ')) {
    const [a, b] = color.split(' et ')
    return (letters[a] ?? '?') + (letters[b] ?? '?')
  }
  return letters[color] ?? '?'
}

// Full code → colour map per species (every colour, incl. bicolours), memoized.
const fullCodeMapCache = new Map<Species, Map<string, string>>()
function fullCodeMap(species: Species): Map<string, string> {
  let m = fullCodeMapCache.get(species)
  if (!m) {
    m = new Map()
    for (const c of colorsOf(species)) m.set(colorCode(species, c.name), c.name)
    fullCodeMapCache.set(species, m)
  }
  return m
}

/** code → colour name for a species (reverse lookup over all of that species' colours). */
export const codeToColor = (species: Species, code: string): string | undefined =>
  fullCodeMap(species).get(code)

/** Grandparent colour names -> sorted, deduped-to-≤2, valid-only code list (canonical order). */
function grandparentCodes(species: Species, gps: ReadonlyArray<string> | undefined): string[] {
  return (gps ?? [])
    .map((c) => colorCode(species, c))
    .filter((code) => code !== '?')
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 2)
}

/** Build a valid in-game name from its parts for a species: `<own>-[K-]<sex>[-<gp1>[-<gp2>]]`. */
export function buildName(species: Species, p: NameParts): string {
  const head = [colorCode(species, p.color)]
  if (p.keeper) head.push('K')
  head.push(p.sex === 'F' ? 'f' : 'm')
  return [...head, ...grandparentCodes(species, p.grandparents)].join('-')
}

/** In-game list order — compares the name as if the hyphens weren't there. */
export const inGameSortKey = (name: string): string => name.replace(/-/g, '')
export const inGameCompare = (a: string, b: string): number => {
  const ka = inGameSortKey(a)
  const kb = inGameSortKey(b)
  return ka < kb ? -1 : ka > kb ? 1 : 0
}

/** Decode a name in this convention for a species. null if it doesn't match. */
export function parseName(species: Species, name: string): NameParts | null {
  const parts = name.trim().split('-')
  if (parts.length < 2) return null
  const [ownCode, ...rest] = parts
  if (!/^[a-z]{1,2}$/.test(ownCode)) return null
  const color = codeToColor(species, ownCode)
  if (!color) return null

  let i = 0
  const keeper = rest[i] === 'K'
  if (keeper) i++
  if (rest[i] !== 'f' && rest[i] !== 'm') return null
  const sex: Sex = rest[i] === 'f' ? 'F' : 'M'
  i++

  const gpCodes = rest.slice(i)
  if (gpCodes.length > 2) return null
  const grandparents: string[] = []
  for (const gc of gpCodes) {
    const gColor = codeToColor(species, gc)
    if (!gColor) return null // an unrecognised grandparent code invalidates the whole name
    grandparents.push(gColor)
  }
  return { color, keeper, sex, grandparents }
}

// ── In-game rule validation (independent of our convention & species) ───────
export const MAX_LEN = 20
const ALLOWED = /^[A-Za-z \-]*$/ // Latin letters, space, hyphen only

export interface Validation {
  readonly valid: boolean
  readonly length: number
  readonly errors: ReadonlyArray<string>
}

/** Validate any string against the in-game rules (≤20, letters/space/hyphen, no digit/accent). */
export function validateInGame(name: string): Validation {
  const errors: string[] = []
  if (name.length > MAX_LEN) errors.push(`Trop long : ${name.length}/${MAX_LEN} caractères.`)
  if (!ALLOWED.test(name)) {
    const bad = [...new Set([...name].filter((ch) => !/[A-Za-z \-]/.test(ch)))]
    const digits = bad.some((c) => /[0-9]/.test(c))
    const accents = bad.some((c) => /[^\x00-\x7F]/.test(c))
    let msg = `Caractères interdits : ${bad.map((c) => `« ${c} »`).join('  ')}`
    if (digits) msg += ' — chiffres interdits'
    if (accents) msg += ' — accents interdits'
    errors.push(msg + '.')
  }
  return { valid: errors.length === 0, length: name.length, errors }
}

/** All colours of a species with their code, ordered by generation then list order. */
export const colorCodesOf = (species: Species) =>
  colorsOf(species).map((c) => ({ name: c.name, gen: c.gen, code: colorCode(species, c.name) }))

// ── Dragodinde back-compat aliases ──────────────────────────────────────────
export const BASE_LETTER: Readonly<Record<string, string>> = lettersOf('dragodinde')
export const LETTER_TO_BASE: Readonly<Record<string, string>> = codeToColorOf('dragodinde')
export const CODE_TO_COLOR: Readonly<Record<string, string>> = Object.fromEntries(
  fullCodeMap('dragodinde')
)
export const COLOR_CODES = colorCodesOf('dragodinde')
