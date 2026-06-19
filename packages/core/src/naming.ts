// Dragodinde in-game naming convention (colour-first letter codes).
//
// Designed + adversarially verified against all 66 colours: every name is ASCII
// letters/space/hyphen only, no digits, no accents, far under 20 chars; all codes unique.
//
// Format:  <code>-[K-]<sex>[-<gp1>[-<gp2>]]
//   <code>  1 base-letter (pure colour) or 2 base-letters (bicolour, in canonical
//           in-game order: the colour before "et" then the one after).
//   K        literal uppercase K only for KEEPERS (the copy to protect); omitted for stock.
//   <sex>    lowercase f (female) / m (male).
//   <gp>     0..2 grandparent (parent) colour codes, canonical (sorted by code).
// Every field is its own hyphen-delimited segment (e.g. `ad-f-d-a`, not `ad-fa-d-a`) because
// the in-game namer chokes on some multi-letter chunks; single-letter segments name reliably.
// No copy number: two dragodindes with the same colour, sex and grandparents share a name —
// we don't distinguish exact duplicates.
//
// Sort (alphabetical, as the in-game list does): colour → keepers (uppercase K floats
// above lowercase) → females before males. So a colour's whole pool reads as one
// scannable run with its keeper pinned on top.

import { COLORS, COLOR_BY_NAME } from './colors.js'

/** The 11 pure colours → unique single ASCII letter. Bicolours concatenate two of these. */
export const BASE_LETTER: Record<string, string> = {
  Amande: 'a',
  Dorée: 'd',
  Rousse: 'r',
  Ebène: 'e',
  Indigo: 'i',
  Pourpre: 'p',
  Orchidée: 'o',
  Ivoire: 'v', // i taken by Indigo
  Turquoise: 't',
  Emeraude: 'm', // e taken by Ebène
  Prune: 'u' // p taken by Pourpre
}

export const LETTER_TO_BASE: Record<string, string> = Object.fromEntries(
  Object.entries(BASE_LETTER).map(([name, ltr]) => [ltr, name])
)

/** Colour name → short code (1 letter pure, 2 letters bicolour, canonical "X et Y" order). */
export function colorCode(color: string): string {
  if (color.includes(' et ')) {
    const [a, b] = color.split(' et ')
    return (BASE_LETTER[a] ?? '?') + (BASE_LETTER[b] ?? '?')
  }
  return BASE_LETTER[color] ?? '?'
}

/** code → colour name (reverse lookup over all 66). */
export const CODE_TO_COLOR: Record<string, string> = (() => {
  const m: Record<string, string> = {}
  for (const c of COLORS) m[colorCode(c.name)] = c.name
  return m
})()

export type Sex = 'F' | 'M'

export interface NameParts {
  readonly color: string
  readonly sex: Sex
  readonly keeper: boolean
  /** The two grandparent (parent) colour NAMES, 0..2. Canonical (sorted by code) in the name. */
  readonly grandparents?: ReadonlyArray<string>
}

/** Grandparent colour names -> sorted, deduped-to-≤2, valid-only code list (canonical order). */
function grandparentCodes(gps: ReadonlyArray<string> | undefined): string[] {
  return (gps ?? [])
    .map((c) => colorCode(c))
    .filter((code) => code !== '?')
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 2)
}

/** Build a valid in-game name from its parts. Every field is its own hyphen segment and the
 *  grandparent codes are appended when known: `<own>-[K-]<sex>[-<gp1>[-<gp2>]]`,
 *  e.g. `ad-f-d-a` or, for a keeper, `i-K-f-e-ei`. */
export function buildName(p: NameParts): string {
  const head = [colorCode(p.color)]
  if (p.keeper) head.push('K')
  head.push(p.sex === 'F' ? 'f' : 'm')
  return [...head, ...grandparentCodes(p.grandparents)].join('-')
}

/** In-game list order. The in-game namer sorts as if the hyphens weren't there — it compares the
 *  segments concatenated — so "ad-f-d-a" ("adfda") sorts BEFORE "a-m-a-a" ("amaa") because d < m,
 *  even though raw "-" (0x2D) < "d". A plain code-point compare on the hyphen-stripped key also
 *  floats keepers (uppercase K) above lowercase and females (f) before males (m), as in game. */
export const inGameSortKey = (name: string): string => name.replace(/-/g, '')
export const inGameCompare = (a: string, b: string): number => {
  const ka = inGameSortKey(a)
  const kb = inGameSortKey(b)
  return ka < kb ? -1 : ka > kb ? 1 : 0
}

/** Decode a name written in this convention (`<code>-[K-]<sex>[-gp…]`). null if it doesn't match. */
export function parseName(name: string): NameParts | null {
  const parts = name.trim().split('-')
  if (parts.length < 2) return null
  const [ownCode, ...rest] = parts
  if (!/^[a-z]{1,2}$/.test(ownCode)) return null
  const color = CODE_TO_COLOR[ownCode]
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
    const gColor = CODE_TO_COLOR[gc]
    if (!gColor) return null // an unrecognised grandparent code invalidates the whole name
    grandparents.push(gColor)
  }
  return { color, keeper, sex, grandparents }
}

export const genOf = (color: string) => COLOR_BY_NAME.get(color)?.gen ?? 0

// ── In-game rule validation (independent of our convention) ─────────────────
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

/** All 66 colours with their code, ordered by generation then name (for the reference table). */
export const COLOR_CODES = COLORS.map((c) => ({
  name: c.name,
  gen: c.gen,
  code: colorCode(c.name)
}))
