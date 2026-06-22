// Extraction — the surplus of "done" colours you can sacrifice in-game for a reward.
//
// A colour is extractable when its succès is unlocked, it's gen >= 2, and the plan is FINISHED with
// it. "Finished" means two things:
//   1. No remaining demand — the plan isn't still breeding more of this colour (plan.demand == 0).
//      A colour you're still short on is never offered, even its sterile copies: with clonage those
//      are clone fodder, and without it you'd only be deleting a colour you still have to produce.
//   2. Of the copies you DO hold, we reserve the ones the plan still uses as a parent
//      (plan.consumed) and offer only the excess.
// So a needed colour (Indigo/Ebène on the way to gen 10) shows nothing; a done, fully-bred colour
// you over-hold shows its spare copies. Reward per mount = its generation, in the species' item.

import type { Cheptel, StockMount } from './cheptel.js'
import { genOf, type Species } from './species.js'

export interface ExtractionCandidate {
  readonly species: Species
  readonly color: string
  readonly gen: number
  /** Non-keeper copies held of this colour (all repro states). */
  readonly owned: number
  /** How many of those are surplus to the plan and thus extractable. */
  readonly surplus: number
  /** Reward granted per extracted mount = gen. */
  readonly rewardEach: number
}

/** The colours with extractable surplus, given the shared cheptel accounting. Pure.
 *  `mounts` must already be scoped to `species` (same contract as assistantPlan). */
export function extractionCandidates(
  species: Species,
  mounts: ReadonlyArray<StockMount>,
  acc: Cheptel
): ExtractionCandidate[] {
  const ownedNonKeeper: Record<string, number> = {}
  for (const m of mounts)
    if (m.color && !m.keeper) ownedNonKeeper[m.color] = (ownedNonKeeper[m.color] ?? 0) + 1

  const out: ExtractionCandidate[] = []
  for (const [color, owned] of Object.entries(ownedNonKeeper)) {
    if (!acc.done.has(color)) continue // succès not unlocked — still chasing this colour
    const gen = genOf(species, color)
    if (gen < 2) continue // gen-1 bases are never extractable
    if ((acc.plan.demand[color] ?? 0) > 0) continue // still being produced — never offer it
    // Keep the copies the plan still uses as a parent; offer the genuine excess.
    const reserved = Math.round(acc.plan.consumed[color] ?? 0)
    const surplus = owned - reserved
    if (surplus < 1) continue
    out.push({ species, color, gen, owned, surplus, rewardEach: gen })
  }
  // Highest reward first, then alphabetical for a stable display order.
  out.sort((a, b) => b.gen - a.gen || a.color.localeCompare(b.color))
  return out
}
