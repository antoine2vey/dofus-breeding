// Cheptel accounting — the one place that turns your herd + unlocked succès into the stock sets
// and the breeding plan. recommend() and assistantPlan() both used to re-derive these independently
// (and each ran computePlan a second time); now they share one Cheptel, computed once.

import { COLOR_BY_NAME, computePlan, type GenPolicy, MAX_GEN, type Plan } from './colors.js'

/** The minimum a mount must expose for accounting — colour, repro status, keeper flag. Both
 *  InvMount (recommender) and AssistMount (assistant) satisfy it. */
export interface StockMount {
  readonly color: string
  readonly status: 'sterile' | 'fertile' | 'feconde'
  readonly keeper: boolean
}

export interface CheptelInput {
  readonly mounts: ReadonlyArray<StockMount>
  /** Colours whose succès is unlocked — satisfy the "own ≥1" sink, never breeding supply. */
  readonly achievements?: ReadonlyArray<string>
  readonly targetGen: number
  readonly level: number
  readonly optima: boolean
  readonly clonage: boolean
}

export interface Cheptel {
  /** Unlocked succès (∩ known colours). */
  readonly done: ReadonlySet<string>
  /** Colours you OWN (any state) OR have the succès for — the goal/coverage set. */
  readonly obtained: ReadonlySet<string>
  /** Non-sterile, non-keeper count per colour — the breeding supply (covers parent-uses). */
  readonly usableStock: Readonly<Record<string, number>>
  /** Total held per colour, any state (no succès bump) — for "how many do I own" displays. */
  readonly ownedStock: Readonly<Record<string, number>>
  /** ownedStock with each done colour bumped to ≥1 — the "own ≥1" sink fed to the plan. */
  readonly sinkStock: Readonly<Record<string, number>>
  /** The deterministic plan for "own ≥1 of every colour ≤ targetGen", given the stock above. */
  readonly plan: Plan
}

/** Derive the full Cheptel from a herd + succès. Pure; the deterministic source the planners share. */
export function cheptelAccounting(input: CheptelInput): Cheptel {
  const done = new Set((input.achievements ?? []).filter((c) => COLOR_BY_NAME.has(c)))

  const usableStock: Record<string, number> = {}
  const ownedStock: Record<string, number> = {}
  for (const m of input.mounts) {
    if (!m.color) continue
    ownedStock[m.color] = (ownedStock[m.color] ?? 0) + 1
    if (m.status !== 'sterile' && !m.keeper) usableStock[m.color] = (usableStock[m.color] ?? 0) + 1
  }
  // "Obtained" for the GOAL = colours you own OR whose succès is unlocked.
  const obtained = new Set<string>([...Object.keys(ownedStock), ...done])
  // The sink ("own ≥1") is satisfied by an owned copy OR an unlocked succès — but NOT supply.
  const sinkStock: Record<string, number> = { ...ownedStock }
  for (const c of done) sinkStock[c] = Math.max(1, sinkStock[c] ?? 0)

  const policy: Record<number, GenPolicy> = {}
  for (let g = 2; g <= MAX_GEN; g++) policy[g] = { level: input.level, optima: input.optima }
  const plan = computePlan({
    maxGen: input.targetGen,
    policy,
    reproducteur: false,
    inventory: usableStock, // usable stock covers parent-uses
    ownedAny: sinkStock, // owned copy OR unlocked succès satisfies the sink
    clonage: input.clonage,
    gender: true
  })

  return { done, obtained, usableStock, ownedStock, sinkStock, plan }
}
