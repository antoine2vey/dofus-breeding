// Species-agnostic breeding PLANNER over the recipe DAG. The colour DATA lives per-species in
// colors.<species>.ts, wired through the SPECIES registry (species.ts); this module keeps only the
// ColorDef shape + the pure planner. The drago-named exports below are back-compat aliases (= the
// dragodinde species) for code not yet threaded with an explicit species.
import { DRAGODINDE_COLORS } from './colors.dragodinde.js'
import {
  baseColorsOf,
  byNameOf,
  colorsOf,
  genColorOf,
  maxGenOf,
  resolveColorOf,
  type Species
} from './species.js'

export interface ColorDef {
  readonly name: string
  readonly gen: number
  readonly bonus: ReadonlyArray<string>
  readonly parents: readonly [string, string] | null
}

// ---------------------------------------------------------------------------
// Dragodinde back-compat aliases (= the dragodinde species via the registry).
// ---------------------------------------------------------------------------
export const COLORS: ReadonlyArray<ColorDef> = DRAGODINDE_COLORS
export const COLOR_BY_NAME: ReadonlyMap<string, ColorDef> = byNameOf('dragodinde')
export const BASE_COLORS: ReadonlyArray<string> = baseColorsOf('dragodinde')
export const MAX_GEN = maxGenOf('dragodinde')

/** Per-generation accent colour for the UI (dragodinde alias; use genColorOf(species) elsewhere). */
export const GEN_COLOR: Readonly<Record<number, string>> = genColorOf('dragodinde')

/** Resolve loose user input (case/accent-insensitive) to a canonical colour name for a species,
 *  or null if unknown. E.g. resolveColor('muldo', 'azur') → 'Azur'. */
export const resolveColor = resolveColorOf

// ---------------------------------------------------------------------------
// Planner — pure solver over the recipe DAG.
//
// Fertility = 1: every cross permanently sterilises BOTH parents, so no bred
// mount can be reused as a parent. Obtaining one fresh instance of a colour
// therefore requires building its entire recipe sub-tree from scratch.
//
// A "sink" colour is never an ingredient of any recipe, so nothing produces it
// as a by-product — every sink must be bred explicitly. The non-sink colours
// are all obtained for free as ancestors of some sink. Hence the minimal plan
// to own >=1 of every colour = build every sink, and `demand[c]` below is the
// exact number of fresh instances of `c` that must be produced.
// ---------------------------------------------------------------------------

/** Per-generation breeding policy: the level BOTH parents are raised to + optimakina. */
export interface GenPolicy {
  readonly level: number // 1..200, assumed for both parents of this cross
  readonly optima: boolean // optimakina (+10%)
}

/**
 * Target-generation success rate for a single cross.
 * Base 30% + 0.15%/level per parent (both at `level` => +0.30%×level) + 10% optimakina,
 * capped at 100%. Source: guide-de-l-eleveur, section "Génération cible".
 */
export function successForLevel(level: number, optima: boolean): number {
  const lvl = Math.min(200, Math.max(1, Math.round(level)))
  const raw = 0.3 + 0.0015 * (2 * lvl) + (optima ? 0.1 : 0)
  return Math.min(1, Math.round(raw * 1e6) / 1e6) // round away float noise (0.3+0.6+0.1 != 1)
}

/**
 * Recommended tiered policy — the time/effort sweet spot.
 *
 * A miss is never "free": the off-target baby you reuse still needs a full fertility raise,
 * so low success multiplies the number of mounts you must raise at EVERY generation.
 * Level 100 + optimakina (≈70%) is the knee of the XP curve and roughly halves the count vs
 * an un-levelled cross; the top generations (8–10) are the most expensive to rebuild on a
 * miss, so they're maxed to level 200 (≈100%) to guarantee them.
 */
export function defaultPolicy(): Record<number, GenPolicy> {
  const pol: Record<number, GenPolicy> = {}
  for (let g = 2; g <= MAX_GEN; g++) {
    if (g <= 7) pol[g] = { level: 100, optima: true }
    else pol[g] = { level: 200, optima: true }
  }
  return pol
}

export interface PlanOptions {
  /** Cap the target generation (2..maxGen). Default maxGen = unlock everything. */
  readonly maxGen: number
  /** Per-generation level/optimakina policy, keyed by the generation being PRODUCED. */
  readonly policy: Readonly<Record<number, GenPolicy>>
  /** Assume the female parent carries the Reproducteur capacity (+1 baby/cross). */
  readonly reproducteur: boolean
  /** USABLE (non-sterile, non-keeper) stock per colour — covers parent-uses. */
  readonly inventory: Readonly<Record<string, number>>
  /** TOTAL owned per colour (any state, incl. keepers/steriles) — satisfies the "own >=1" sink.
   *  Defaults to `inventory` when omitted (back-compat). */
  readonly ownedAny?: Readonly<Record<string, number>>
  /** Recycle pairs of same-colour sterile parents into one fresh fertile via Clonage. */
  readonly clonage: boolean
  /** Model the gender constraint (each cross needs ♂+♀; bred babies are random gender). */
  readonly gender: boolean
}

export interface PlanRow {
  readonly name: string
  readonly gen: number
  readonly count: number // fresh instances to breed/capture from scratch (= `fresh`)
  readonly fresh: number // bred/captured from scratch
  readonly cloned: number // recovered via Clonage (2 sterile -> 1 fertile)
  readonly cumulative: number // running fresh total within this generation list
  readonly recipe: readonly [string, string] | null
}

export interface GenGroup {
  readonly gen: number
  readonly rows: ReadonlyArray<PlanRow>
  readonly total: number // fresh produced this gen
  readonly cumulativeTotal: number // cumulative fresh across all gens up to & incl. this one
}

export interface Plan {
  readonly groups: ReadonlyArray<GenGroup>
  readonly demand: Readonly<Record<string, number>> // fresh per colour (floor)
  readonly consumed: Readonly<Record<string, number>> // times each colour is used as a parent (floor)
  readonly baseCaptures: Readonly<Record<string, number>>
  readonly totalCaptures: number
  readonly totalCrosses: number
  readonly totalInstances: number // mounts that come into existence (captures + crosses + clones)
  readonly totalRaises: number // of those, how many must be raised to féconde (= used as a parent)
  readonly totalClones: number
  readonly totalGenderBuffer: number // extra bred to guarantee both genders
  readonly colorsCount: number
  // Expected counts under the per-generation policy (with retries; Clonage absorbs steriles).
  readonly expectedCaptures: number
  readonly expectedCrosses: number
  readonly expectedInstances: number
  readonly expectedClones: number
  // Effective per-generation success rate derived from the policy (for display).
  readonly genSuccess: Readonly<Record<number, number>>
}

const babiesPerCross = (reproducteur: boolean) => (reproducteur ? 2 : 1)

interface SolveResult {
  readonly fresh: Record<string, number> // bred/captured from scratch (incl. gender buffer)
  readonly cloned: Record<string, number> // recovered via Clonage of a same-colour sterile pair
  readonly genderBuffer: Record<string, number> // extra bred to guarantee both genders
  readonly consumed: Record<string, number> // times this colour is used as a parent across the plan
}

/**
 * Gender buffer for a colour that is bred (not captured) and reused as a parent.
 *
 * Every recipe has two DISTINCT parent colours and a cross only needs an opposite-gender
 * pair, so roles are assignable per-cross: across a colour's many uses you assign ~half ♂ /
 * half ♀, and 50/50 production meets that with ZERO expected overhead at high counts. The
 * cost is purely at LOW counts — if you only breed 1–2 of a reused colour you may hold a
 * single gender, so you breed one spare to make both genders likely. At higher counts the
 * 50/50 split already guarantees both, so no buffer (otherwise it would falsely cascade).
 */
const genderHedge = (fr: number): number => (fr > 0 && fr <= 2 ? 1 : 0)

/**
 * Single propagation pass over the DAG (high gen -> low gen, so a colour's full
 * consumption is known before we expand its parents).
 *
 * `pForGen(g)` = success rate for a cross producing generation g (1 for the floor).
 *
 * Clonage: feed two STERILE mounts of the same GENERATION into the cloner and get back a
 * random one of the two (its colour AND gender), fertile but with gauges reset to 0. We
 * always pair two steriles of the SAME COLOUR, so the output colour is deterministic (random
 * pick between A and A is A) and only the gender is random (handled by the gender model). A
 * colour's own parent-uses produce its steriles, so roughly half of its consumption can be
 * supplied by Clonage instead of fresh production — and that saving cascades down the tree.
 */
function solve(
  targets: ReadonlyArray<ColorDef>,
  used: ReadonlySet<string>,
  babies: number,
  clonage: boolean,
  gender: boolean,
  pForGen: (gen: number) => number,
  inventory: Readonly<Record<string, number>>,
  ownedAny: Readonly<Record<string, number>>
): SolveResult {
  const consumed: Record<string, number> = {}
  const fresh: Record<string, number> = {}
  const cloned: Record<string, number> = {}
  const genderBuffer: Record<string, number> = {}
  for (const c of targets) consumed[c.name] = 0

  for (const c of [...targets].sort((a, b) => b.gen - a.gen)) {
    const n = c.name
    const sink = used.has(n) ? 0 : 1
    // The SINK term ("own >=1 of this colour") is satisfied by ANY owned copy — including a
    // keeper or a sterile (a colour you hold counts as obtained). Parent-uses (consumed) can
    // only be covered by USABLE (non-sterile, non-keeper) stock. sink and consumed are mutually
    // exclusive (a sink is never a parent), so picking the right inventory per role is exact.
    const owned = sink > 0 ? (ownedAny[n] ?? 0) : (inventory[n] ?? 0)
    const need = Math.max(0, consumed[n] + sink - owned)
    // Clonage recycles a colour's own steriles (from its parent-uses) in pairs. You can't
    // clone until 2 steriles exist and the final leftover sterile is always stranded, so
    // `f` fresh yield only 2f-1 uses => usable clones = floor((consumed-1)/2), not floor/2.
    const clUsed = clonage && consumed[n] >= 2 ? Math.floor((consumed[n] - 1) / 2) : 0
    let fr = Math.max(0, need - clUsed)
    // Gender hedge: only for BRED colours that are reused as a parent (base colours are
    // captured at the gender you want, sinks are kept regardless of gender).
    const buf = gender && c.parents && consumed[n] > 0 && fr > 0 ? genderHedge(fr) : 0
    fr += buf
    fresh[n] = fr
    cloned[n] = clUsed
    genderBuffer[n] = buf
    if (c.parents && fr > 0) {
      const p = Math.max(0.05, pForGen(c.gen))
      const attempts = Math.ceil(fr / babies) / p // crosses incl. retries; each eats 1 of each parent
      consumed[c.parents[0]] += attempts
      consumed[c.parents[1]] += attempts
    }
  }
  return { fresh, cloned, genderBuffer, consumed }
}

/** Compute the cumulative breeding plan for "own >=1 of every colour <= maxGen" for a species. */
export function computePlan(species: Species, opts: PlanOptions): Plan {
  const byName = byNameOf(species)
  const targets = colorsOf(species).filter((c) => c.gen <= opts.maxGen)
  const used = new Set<string>()
  for (const c of targets) if (c.parents) used.add(c.parents[0]), used.add(c.parents[1])
  const babies = babiesPerCross(opts.reproducteur)

  const genSuccess: Record<number, number> = {}
  for (let g = 2; g <= opts.maxGen; g++) {
    const pol = opts.policy[g] ?? { level: 200, optima: true }
    genSuccess[g] = successForLevel(pol.level, pol.optima)
  }

  // Floor: success = 100% everywhere. Expected: per-generation policy success.
  const ownedAny = opts.ownedAny ?? opts.inventory
  const floor = solve(
    targets,
    used,
    babies,
    opts.clonage,
    opts.gender,
    () => 1,
    opts.inventory,
    ownedAny
  )
  const exp = solve(
    targets,
    used,
    babies,
    opts.clonage,
    opts.gender,
    (g) => genSuccess[g] ?? 1,
    opts.inventory,
    ownedAny
  )

  const req = floor.fresh
  const isBase = (n: string) => byName.get(n)?.parents == null

  // Group floor demand by generation, cumulative (by fresh production).
  const groups: GenGroup[] = []
  let runningAll = 0
  for (let g = 1; g <= opts.maxGen; g++) {
    const rows: PlanRow[] = []
    let cum = 0
    for (const c of targets.filter((c) => c.gen === g).sort((a, b) => req[b.name] - req[a.name])) {
      const count = req[c.name] ?? 0
      cum += count
      rows.push({
        name: c.name,
        gen: g,
        count,
        fresh: count,
        cloned: floor.cloned[c.name] ?? 0,
        cumulative: cum,
        recipe: c.parents
      })
    }
    if (rows.length === 0) continue
    runningAll += cum
    groups.push({ gen: g, rows, total: cum, cumulativeTotal: runningAll })
  }

  const sum = (o: Record<string, number>, pred?: (n: string) => boolean) =>
    Object.entries(o).reduce((a, [n, v]) => a + (pred && !pred(n) ? 0 : v), 0)

  const baseCaptures: Record<string, number> = {}
  for (const b of baseColorsOf(species)) if (b in req) baseCaptures[b] = req[b]

  const totalCaptures = Math.round(sum(floor.fresh, isBase))
  const totalCrosses = Math.round(sum(floor.fresh, (n) => !isBase(n)))
  const totalClones = Math.round(sum(floor.cloned))
  const totalGenderBuffer = Math.round(sum(floor.genderBuffer))
  const totalInstances = totalCaptures + totalCrosses + totalClones
  // Every cross consumes 2 raised (féconde) parents; the final kept sink copies are NOT raised.
  const totalRaises = 2 * totalCrosses

  const expectedCaptures = Math.ceil(sum(exp.fresh, isBase))
  const expectedCrosses = Math.ceil(sum(exp.fresh, (n) => !isBase(n)))
  const expectedClones = Math.ceil(sum(exp.cloned))
  const expectedInstances = expectedCaptures + expectedCrosses + expectedClones

  return {
    groups,
    demand: req,
    consumed: floor.consumed,
    baseCaptures,
    totalCaptures,
    totalCrosses,
    totalInstances,
    totalRaises,
    totalClones,
    totalGenderBuffer,
    colorsCount: targets.length,
    expectedCaptures,
    expectedCrosses,
    expectedInstances,
    expectedClones,
    genSuccess
  }
}
