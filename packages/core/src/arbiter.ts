// Cross-species arbiter. Enclos are species-agnostic: the 6×10 slot pool is ONE shared resource,
// but breeding pairs are same-species only. So we run the per-species recommender independently,
// then merge its candidate actions into ONE globally-ranked list and greedily allocate the shared
// "raise" slots across species.
//
// Comparability across species: a breed/clone/capture is scored by the SPINE value of the colour
// it produces — spineValue(species,colour)=3^gen — normalized by that species' max attainable value
// (speciesMaxValue(targetGen)=3^targetGen) and scaled by the user's per-species priority. Both are
// herd-INDEPENDENT (pure functions of the static tree), so the ranking reflects priority + how far
// up its own tree an action reaches, not transient herd state.
//
// Slot ledger: a slot = one mount that must be RAISED to féconde. Breeding pairs two already-féconde
// parents (no empty slot needed) but yields one baby to raise (1 slot); a captured base and a clone
// survivor each also need 1 slot. Extraction FREES capacity and is surfaced (per-species) but never
// consumes the budget.

import {
  type BreedAction,
  type CaptureAction,
  type InvMount,
  type Recommendation,
  type RecycleAction,
  recommend
} from './recommend.js'
import {
  SPECIES_LIST,
  type Species,
  type SpeciesConfig,
  speciesMaxValue,
  spineValue
} from './species.js'

export interface ArbiterInput {
  readonly config: SpeciesConfig
  /** Mounts already partitioned by species. */
  readonly mountsBySpecies: Partial<Record<Species, ReadonlyArray<InvMount>>>
  readonly achievementsBySpecies?: Partial<Record<Species, ReadonlyArray<string>>>
  /** Shared empty slots in the 6×10 enclos pool (capacity to raise new mounts). */
  readonly freeSlots: number
}

export interface ArbiterAction {
  readonly species: Species
  readonly kind: 'breed' | 'clone' | 'capture'
  /** The colour this action is FOR (drives the value). */
  readonly driver: string
  readonly score: number // normalized: spineValue(driver)/speciesMaxValue(targetGen) * priority
  readonly rawValue: number // spineValue(driver) (un-normalized)
  readonly slots: number // raise-slots this action wants (capture = count, else 1)
  readonly breed?: BreedAction
  readonly capture?: CaptureAction
  readonly recycle?: RecycleAction
}

export interface ArbiterResult {
  readonly perSpecies: Partial<Record<Species, Recommendation>>
  readonly ranked: ReadonlyArray<ArbiterAction> // all candidates, score desc
  readonly allocated: ReadonlyArray<ArbiterAction> // greedy fill of the shared slots (slots = used)
  readonly usedSlots: number
  readonly freeSlots: number
}

export function arbitrate(input: ArbiterInput): ArbiterResult {
  const perSpecies: Partial<Record<Species, Recommendation>> = {}
  const ranked: ArbiterAction[] = []

  for (const species of SPECIES_LIST) {
    const cfg = input.config[species]
    if (!cfg || !cfg.enabled) continue
    const mounts = input.mountsBySpecies[species] ?? []
    const achievements = input.achievementsBySpecies?.[species]
    const rec = recommend(species, {
      mounts,
      targetGen: cfg.targetGen,
      freeSlots: 999, // uncapped — the arbiter does the cross-species allocation below
      level: cfg.level,
      optimakina: cfg.optimakina,
      achievements
    })
    perSpecies[species] = rec

    const denom = speciesMaxValue(cfg.targetGen) || 1
    const priority = cfg.priority ?? 1
    const norm = (color: string) => {
      const raw = spineValue(species, color)
      return { raw, score: (raw / denom) * priority }
    }

    for (const b of rec.breed) {
      const { raw, score } = norm(b.intended || b.top[0]?.race || '')
      ranked.push({
        species,
        kind: 'breed',
        driver: b.intended,
        score,
        rawValue: raw,
        slots: 1,
        breed: b
      })
    }
    for (const r of rec.recycle) {
      if (r.kind !== 'clone') continue // extraction frees slots — surfaced via perSpecies, not ranked
      const { raw, score } = norm(r.color)
      ranked.push({
        species,
        kind: 'clone',
        driver: r.color,
        score,
        rawValue: raw,
        slots: 1,
        recycle: r
      })
    }
    for (const c of rec.capture) {
      const { raw, score } = norm(c.color)
      ranked.push({
        species,
        kind: 'capture',
        driver: c.color,
        score,
        rawValue: raw,
        slots: c.count,
        capture: c
      })
    }
  }

  ranked.sort((a, b) => b.score - a.score)

  // Greedy fill of the shared slot pool. Captures may claim several slots (one per base captured);
  // each is capped to what remains so the budget is never overrun.
  let remaining = Math.max(0, input.freeSlots)
  const allocated: ArbiterAction[] = []
  for (const a of ranked) {
    if (remaining <= 0) break
    const take = Math.min(a.slots, remaining)
    if (take <= 0) continue
    allocated.push({ ...a, slots: take })
    remaining -= take
  }

  return {
    perSpecies,
    ranked,
    allocated,
    usedSlots: Math.max(0, input.freeSlots) - remaining,
    freeSlots: Math.max(0, input.freeSlots)
  }
}
