// Assistant planner: the two-layer plan that drives the agentic Assistant.
//
//   Layer A — Roadmap:   the full cheptel-aware bill-of-materials to reach the target generation
//                        (computePlan), grouped by generation with per-colour owned/need progress.
//   Layer B — Next step: the concrete batch to do RIGHT NOW given live state — raise (ripen a
//                        fertile mount in an enclos), breed (féconde pairs), clone (sterile pairs),
//                        capture (gen-1 still owed). Deterministic; the AI presents/executes it.
//
// Pure. The deterministic source of truth for the Assistant; the AI orchestrates on top of it.

import { cheptelAccounting } from './cheptel.js'
import { COLOR_BY_NAME, COLORS } from './colors.js'
import { type BreedAction, type InvMount, type ReproStatus, recommend } from './recommend.js'

const genOf = (color: string) => COLOR_BY_NAME.get(color)?.gen ?? 0
const ENCLOS_CAP = 10

/** A mount with its location, for the live-state-aware planner. A superset of the recommender's
 *  InvMount (adds enclosId, requires a name), so an AssistMount can be handed straight to
 *  recommend() without re-projecting it. */
export interface AssistMount extends InvMount {
  readonly name: string // required here (InvMount's is optional — the assistant always has it)
  readonly enclosId: number | null // null = stable
}

export interface AssistEnclos {
  readonly id: number
  readonly name: string
  readonly focus: ReadonlyArray<string>
  readonly count: number // current occupants
}

export interface AssistantInput {
  readonly mounts: ReadonlyArray<AssistMount>
  readonly enclos: ReadonlyArray<AssistEnclos>
  readonly targetGen: number
  readonly level: number
  readonly optimakina: boolean
  readonly clonage: boolean
  /** Colours whose achievement (succès) is already unlocked — satisfy the goal even if not owned,
   *  but never breeding supply (a done colour that's a parent of the target is still produced). */
  readonly achievements?: ReadonlyArray<string>
}

// ── Layer A: roadmap ──────────────────────────────────────────────────────
export interface RoadmapRow {
  readonly color: string
  readonly gen: number
  readonly owned: number // total held of this colour (any state)
  readonly done: boolean // achievement (succès) already unlocked
  readonly need: number // fresh still to produce (floor demand, minus usable stock)
  readonly recipe: readonly [string, string] | null
}
export interface RoadmapGenGroup {
  readonly gen: number
  readonly rows: ReadonlyArray<RoadmapRow>
}
export interface Roadmap {
  readonly targetGen: number
  readonly reached: boolean
  readonly obtainedColors: number
  readonly totalColors: number
  readonly baseCaptures: Readonly<Record<string, number>> // gen-1 still owed
  readonly totalCaptures: number
  readonly totalCrosses: number
  readonly gens: ReadonlyArray<RoadmapGenGroup>
}

// ── Layer B: next step ────────────────────────────────────────────────────
export interface RaiseAction {
  readonly enclosId: number
  readonly enclosName: string
  readonly mountIds: ReadonlyArray<number>
  readonly colors: ReadonlyArray<string>
  readonly reason: string
}
export interface CloneAction {
  readonly aId: number
  readonly bId: number
  readonly color: string
  readonly reason: string
}
export interface CaptureNeed {
  readonly color: string
  readonly count: number
}
export interface NextStep {
  readonly raise: ReadonlyArray<RaiseAction>
  readonly breed: ReadonlyArray<BreedAction>
  readonly clone: ReadonlyArray<CloneAction>
  readonly capture: ReadonlyArray<CaptureNeed>
  readonly done: boolean
  readonly summary: string
}

export interface AssistantPlan {
  readonly roadmap: Roadmap
  readonly nextStep: NextStep
}

export function assistantPlan(input: AssistantInput): AssistantPlan {
  const { mounts, enclos, targetGen, level, optimakina, clonage } = input

  // ── Layer A: roadmap from the shared cheptel accounting (stock sets + deterministic plan) ──
  const acc = cheptelAccounting({
    mounts,
    achievements: input.achievements,
    targetGen,
    level,
    optima: optimakina,
    clonage
  })
  const { done, obtained, ownedStock, plan } = acc
  const gens: RoadmapGenGroup[] = plan.groups
    .map((g) => ({
      gen: g.gen,
      rows: g.rows
        .map(
          (r): RoadmapRow => ({
            color: r.name,
            gen: r.gen,
            owned: ownedStock[r.name] ?? 0,
            done: done.has(r.name),
            need: r.fresh,
            recipe: r.recipe
          })
        )
        .filter((r) => r.need > 0 || r.owned > 0 || r.done)
    }))
    .filter((g) => g.rows.length > 0)

  const targetColors = COLORS.filter((c) => c.gen <= targetGen)
  const obtainedColors = targetColors.filter((c) => obtained.has(c.name)).length
  const reached = obtainedColors === targetColors.length

  const roadmap: Roadmap = {
    targetGen,
    reached,
    obtainedColors,
    totalColors: targetColors.length,
    baseCaptures: plan.baseCaptures,
    totalCaptures: plan.totalCaptures,
    totalCrosses: plan.totalCrosses,
    gens
  }

  // ── Layer B: next step. Breed / clone / capture come straight from `recommend` (same
  //    deterministic source — an AssistMount IS an InvMount); `raise` is the live-state piece. ──
  const rec = recommend({
    mounts,
    targetGen,
    freeSlots: 999, // we want every productive féconde pair, not a per-round cap
    level,
    optimakina,
    clonage,
    achievements: input.achievements,
    accounting: acc // reuse the accounting already built — don't derive the plan a second time
  })

  // How many usable (féconde) parents each colour still wants = how many times the plan breeds it
  // away (computePlan.consumed). With fertility = 1 every cross sterilises its parents, so a big
  // backlog (e.g. 170 crosses to gen 10) needs many parents ripening in PARALLEL — not one pair at
  // a time. We therefore fill all the spare enclos capacity, not just a single breedable pair.
  const want = (c: string) => Math.round(plan.consumed[c] ?? 0)

  // "Ripening / on hand" = féconde anywhere + fertile ALREADY in an enclos (usable parent soon).
  const ripening: Record<string, { M: number; F: number }> = {}
  const bumpRipe = (c: string, s: 'M' | 'F') => (ripening[c] ??= { M: 0, F: 0 })[s]++
  for (const d of mounts)
    if (d.color && (d.status === 'feconde' || (d.status === 'fertile' && d.enclosId !== null)))
      bumpRipe(d.color, d.sex)

  // Raise candidates: STABLE, fertile, non-keeper, of a colour the plan still consumes as a parent.
  // Grouped by colour so we can fill capacity round-robin (a spread of colours), bottom-up.
  const byColor = new Map<string, AssistMount[]>()
  for (const m of mounts)
    if (m.enclosId === null && m.status === 'fertile' && !m.keeper && m.color && want(m.color) > 0)
      (byColor.get(m.color) ?? byColor.set(m.color, []).get(m.color)!).push(m)
  const colorsByGen = [...byColor.keys()].sort((a, b) => genOf(a) - genOf(b))

  const freeByEnclos = enclos
    .map((e) => ({
      id: e.id,
      name: e.name,
      free: Math.max(0, ENCLOS_CAP - e.count),
      ids: [] as number[],
      colors: [] as string[]
    }))
    .filter((e) => e.free > 0)
  let totalFree = freeByEnclos.reduce((n, e) => n + e.free, 0)

  // Round-robin passes: each pass gives every still-short colour one more mount (the under-
  // represented sex first, so we ripen toward a breedable pair), bottom-up, until capacity or
  // candidates run out. Pass 1 reproduces the old "a pair of each colour" coverage; later passes
  // deepen the bottleneck colours to put spare slots to work instead of leaving them idle.
  const picks: AssistMount[] = []
  for (let progress = true; progress && totalFree > 0; ) {
    progress = false
    for (const color of colorsByGen) {
      if (totalFree <= 0) break
      const list = byColor.get(color)!
      if (!list.length) continue
      const r = (ripening[color] ??= { M: 0, F: 0 })
      if (r.M + r.F >= want(color)) continue // enough of this colour already ripening/on hand
      let idx = list.findIndex((mt) => (r.M <= r.F ? mt.sex === 'M' : mt.sex === 'F'))
      if (idx < 0) idx = 0 // only one sex left — take it
      const cand = list.splice(idx, 1)[0]
      r[cand.sex]++
      picks.push(cand)
      totalFree--
      progress = true
    }
  }

  // Place the picks into free enclos slots in order (fill enclos 1, then 2, …).
  let ei = 0
  for (const cand of picks) {
    while (ei < freeByEnclos.length && freeByEnclos[ei].free <= 0) ei++
    if (ei >= freeByEnclos.length) break
    const slot = freeByEnclos[ei]
    slot.free--
    slot.ids.push(cand.id)
    slot.colors.push(cand.color)
  }
  const raise: RaiseAction[] = freeByEnclos
    .filter((e) => e.ids.length > 0)
    .map((e) => ({
      enclosId: e.id,
      enclosName: e.name,
      mountIds: e.ids,
      colors: e.colors,
      reason: `monte ${e.ids.length} monture(s) jusqu'à féconde (endurance/maturité/amour à 20K)`
    }))

  const clone: CloneAction[] = rec.recycle
    .filter((r) => r.kind === 'clone' && r.ids.length >= 2)
    .map((r) => ({ aId: r.ids[0], bId: r.ids[1], color: r.color, reason: r.reason }))

  const summaryParts: string[] = []
  if (rec.breed.length) summaryParts.push(`${rec.breed.length} croisement(s)`)
  if (raise.length)
    summaryParts.push(`${raise.reduce((n, r) => n + r.mountIds.length, 0)} à élever`)
  if (clone.length) summaryParts.push(`${clone.length} clonage(s)`)
  const totalCapture = rec.capture.reduce((n, c) => n + c.count, 0)
  if (totalCapture) summaryParts.push(`${totalCapture} à capturer`)

  // Once the objective is met there is no work — don't recommend wasteful breed/clone/capture.
  const nextStep: NextStep = reached
    ? {
        raise: [],
        breed: [],
        clone: [],
        capture: [],
        done: true,
        summary: `Objectif gen ${targetGen} atteint 🎉`
      }
    : {
        raise,
        breed: rec.breed,
        clone,
        capture: rec.capture,
        done: false,
        summary:
          summaryParts.join(' · ') || 'Rien à faire ce tour — capture des bases pour amorcer.'
      }

  return { roadmap, nextStep }
}
