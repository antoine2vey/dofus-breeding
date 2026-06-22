// SPECIES registry — the single source of truth that parameterizes everything that differs
// between the three breedable mount species (dragodinde, muldo, volkorne). Breeding MECHANICS
// are identical across species (gauges, repro, enclos, odds formula, naming structure); only the
// colour palette, recipes, base colours, letter codes and a couple of cosmetics differ.
//
// Colour NAMES overlap across species (muldo & volkorne both have Ebène/Indigo/…; volkorne reuses
// drago names like Amande/Ivoire/…), so EVERY colour lookup must be scoped to a species. That is
// the whole reason this registry exists: callers pass a Species and get that species' data.

import { DRAGODINDE_COLORS } from './colors.dragodinde.js'
import type { ColorDef } from './colors.js'
import { MULDO_COLORS } from './colors.muldo.js'
import { VOLKORNE_COLORS } from './colors.volkorne.js'

export type Species = 'dragodinde' | 'muldo' | 'volkorne'
export const SPECIES_LIST: readonly Species[] = ['dragodinde', 'muldo', 'volkorne']

export const isSpecies = (s: unknown): s is Species =>
  s === 'dragodinde' || s === 'muldo' || s === 'volkorne'

/** Coerce a possibly-missing/legacy value to a Species (pre-migration rows default to dragodinde). */
export const normalizeSpecies = (s: unknown): Species => (isSpecies(s) ? s : 'dragodinde')

export interface CaptureDef {
  readonly label: string
  readonly location: string
  readonly item: string
}

/** The raw, hand-authored definition of a species (everything that isn't derived). */
export interface SpeciesDef {
  readonly species: Species
  readonly label: string
  readonly icon: string // emoji glyph for badges / Discord
  readonly accent: string // CSS accent colour
  readonly colors: readonly ColorDef[]
  /** Colour name -> single lowercase letter code (pure colours only; bicolours concatenate two). */
  readonly letters: Readonly<Record<string, string>>
  /** Pure base colours whose odds base-weight is the rare "2" instead of the monocolore "9". */
  readonly loWeightBases: readonly string[]
  readonly capture: CaptureDef
}

// Per-generation accent palette for the UI. Shared across species (species are distinguished by
// icon/accent + badge); kept here so colors.ts GEN_COLOR can stay a dragodinde alias.
const GEN_PALETTE: Readonly<Record<number, string>> = {
  1: '#8d9bb5',
  2: '#e8607a',
  3: '#9b8cff',
  4: '#57c4f2',
  5: '#c06bff',
  6: '#f2a857',
  7: '#f5d04a',
  8: '#5fe3c0',
  9: '#57f287',
  10: '#ffd700'
}

// ── Letter codes (single lowercase letters; injective per species; verified by naming round-trip).
// Dragodinde keeps its existing curated table verbatim so in-game names already set stay valid.
const DRAGODINDE_LETTERS: Record<string, string> = {
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
const MULDO_LETTERS: Record<string, string> = {
  Ebène: 'e',
  Indigo: 'i',
  Pourpre: 'p',
  Orchidée: 'o',
  Doré: 'd',
  Roux: 'r',
  Amande: 'a',
  Ivoire: 'v',
  Turquoise: 't',
  Prune: 'u',
  Emeraude: 'm',
  Ambre: 'b',
  Corail: 'c',
  Azur: 'z',
  'Aigue-marine': 'g'
}
const VOLKORNE_LETTERS: Record<string, string> = {
  Ebène: 'e',
  Indigo: 'i',
  Pourpre: 'p',
  Orchidée: 'o',
  Roux: 'r',
  Amande: 'a',
  Ivoire: 'v',
  Turquoise: 't',
  Prune: 'u',
  Emeraude: 'm',
  Doré: 'd',
  Jade: 'j',
  Rubis: 'b',
  Saphir: 's',
  Améthyste: 'h'
}

const DEFS: Record<Species, SpeciesDef> = {
  dragodinde: {
    species: 'dragodinde',
    label: 'Dragodinde',
    icon: '🐉',
    accent: '#ffd700',
    colors: DRAGODINDE_COLORS,
    letters: DRAGODINDE_LETTERS,
    loWeightBases: ['Dorée'],
    capture: {
      label: 'Capture sauvage',
      location: 'zones de dragodindes sauvages',
      item: 'Filet de capture de dragodinde'
    }
  },
  muldo: {
    species: 'muldo',
    label: 'Muldo',
    icon: '🐦',
    accent: '#57c4f2',
    colors: MULDO_COLORS,
    letters: MULDO_LETTERS,
    loWeightBases: ['Doré'],
    capture: {
      label: 'Capture sauvage',
      location: 'Bassin des Muldos (Baie de Sufokia)',
      item: 'Filet de capture de muldo'
    }
  },
  volkorne: {
    species: 'volkorne',
    label: 'Volkorne',
    icon: '🦅',
    accent: '#e8607a',
    colors: VOLKORNE_COLORS,
    letters: VOLKORNE_LETTERS,
    loWeightBases: [],
    capture: {
      label: 'Capture sauvage',
      location: 'Haras de Brâkmar',
      item: 'Filet de capture de volkorne'
    }
  }
}

/** Public view of the raw definitions. */
export const SPECIES: Record<Species, SpeciesDef> = DEFS

// ── Derived, memoized once per species ──────────────────────────────────────
const colorKey = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

interface SpeciesData extends SpeciesDef {
  readonly byName: ReadonlyMap<string, ColorDef>
  readonly byKey: ReadonlyMap<string, string> // folded key -> canonical name
  readonly baseColors: readonly string[]
  readonly maxGen: number
  readonly letterToBase: Readonly<Record<string, string>> // code -> colour name
  readonly recipe: ReadonlyMap<string, string> // pairKey(parentA,parentB) -> child
  readonly potential: Readonly<Record<string, number>> // spine: highest gen a colour can lead to
  readonly genColor: Readonly<Record<number, string>>
}

function buildData(def: SpeciesDef): SpeciesData {
  const byName = new Map(def.colors.map((c) => [c.name, c]))
  const byKey = new Map(def.colors.map((c) => [colorKey(c.name), c.name]))
  const baseColors = def.colors.filter((c) => !c.parents).map((c) => c.name)
  const maxGen = def.colors.reduce((m, c) => Math.max(m, c.gen), 0)
  const letterToBase: Record<string, string> = {}
  for (const [name, code] of Object.entries(def.letters)) letterToBase[code] = name
  const recipe = new Map<string, string>()
  for (const c of def.colors) if (c.parents) recipe.set(pairKey(c.parents[0], c.parents[1]), c.name)
  // Spine potential: the highest generation a colour can ultimately lead to.
  const potential: Record<string, number> = {}
  for (const c of def.colors) potential[c.name] = c.gen
  for (const c of [...def.colors].sort((a, b) => b.gen - a.gen))
    if (c.parents)
      for (const p of c.parents) potential[p] = Math.max(potential[p] ?? 0, potential[c.name])
  return {
    ...def,
    byName,
    byKey,
    baseColors,
    maxGen,
    letterToBase,
    recipe,
    potential,
    genColor: GEN_PALETTE
  }
}

const SPECIES_DATA: Record<Species, SpeciesData> = {
  dragodinde: buildData(DEFS.dragodinde),
  muldo: buildData(DEFS.muldo),
  volkorne: buildData(DEFS.volkorne)
}

// ── Accessors (species-first). All per-species lookups go through these. ─────
export const speciesDef = (s: Species): SpeciesDef => DEFS[s]
export const colorsOf = (s: Species): readonly ColorDef[] => SPECIES_DATA[s].colors
export const byNameOf = (s: Species): ReadonlyMap<string, ColorDef> => SPECIES_DATA[s].byName
export const baseColorsOf = (s: Species): readonly string[] => SPECIES_DATA[s].baseColors
export const maxGenOf = (s: Species): number => SPECIES_DATA[s].maxGen
export const genColorOf = (s: Species): Readonly<Record<number, string>> => SPECIES_DATA[s].genColor
export const recipeOf = (s: Species): ReadonlyMap<string, string> => SPECIES_DATA[s].recipe
export const potentialOf = (s: Species): Readonly<Record<string, number>> =>
  SPECIES_DATA[s].potential
export const lettersOf = (s: Species): Readonly<Record<string, string>> => SPECIES_DATA[s].letters
export const codeToColorOf = (s: Species): Readonly<Record<string, string>> =>
  SPECIES_DATA[s].letterToBase

export const genOf = (s: Species, color: string): number =>
  SPECIES_DATA[s].byName.get(color)?.gen ?? 0

/** Resolve loose user input (case/accent-insensitive) to a canonical colour, or null if unknown. */
export const resolveColorOf = (s: Species, input: string): string | null =>
  SPECIES_DATA[s].byKey.get(colorKey(input)) ?? null

// ── Arbiter value primitives (herd-INDEPENDENT — see arbiter.ts) ────────────
/** Spine value of owning a colour: 3^gen. Pure function of the static tree, never of the herd. */
export const spineValue = (s: Species, color: string): number => 3 ** genOf(s, color)
/** Max attainable spine value for a target generation: 3^targetGen. Normalizer denominator. */
export const speciesMaxValue = (targetGen: number): number => 3 ** targetGen

// ── Per-species settings (persisted as the user_settings.species_config JSON blob) ──
export interface SpeciesSettings {
  readonly enabled: boolean
  readonly targetGen: number
  readonly level: number
  readonly optimakina: boolean
  readonly clonage: boolean
  readonly priority: number // arbiter weight; default 1
}
export type SpeciesConfig = Record<Species, SpeciesSettings>

export function defaultSpeciesSettings(s: Species): SpeciesSettings {
  return {
    enabled: s === 'dragodinde', // dragodinde on by default; others opt-in
    targetGen: maxGenOf(s),
    level: 100,
    optimakina: true,
    clonage: false,
    priority: 1
  }
}

export function defaultSpeciesConfig(): SpeciesConfig {
  return {
    dragodinde: defaultSpeciesSettings('dragodinde'),
    muldo: defaultSpeciesSettings('muldo'),
    volkorne: defaultSpeciesSettings('volkorne')
  }
}

/** Merge a partial/persisted config over defaults so missing species/fields are always populated. */
export function mergeSpeciesConfig(partial: unknown): SpeciesConfig {
  const base = defaultSpeciesConfig()
  if (partial && typeof partial === 'object') {
    for (const s of SPECIES_LIST) {
      const p = (partial as Record<string, unknown>)[s]
      if (p && typeof p === 'object') base[s] = { ...base[s], ...(p as Partial<SpeciesSettings>) }
    }
  }
  return base
}
