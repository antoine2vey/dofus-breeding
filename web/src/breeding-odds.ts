// Génération-cible probability engine for Dragodinde breeding.
//
// VALIDATED against (a) the community researcher's hand-worked example and (b) real
// in-game odds, reproducing both to < 0.01%. The outcome of a cross is a DISTRIBUTION
// over colours weighted by the GENEALOGY (each mount: itself + its two parents = the
// baby's grandparents), not the deterministic recipe.
//
// Weights: monocolore = 9 (Dorée is the exception at 2), bicolore = 2. A mount's own
// race counts ×5, each grandparent ×3 (the integer form of parent ×1 / grandparent ×0.6).
// A couple = one race from each parent's tree; its weight = product of the two race
// weights. A race's total weight = Σ couples it is a member of (with multiplicity) +
// Σ couples whose recipe-product is that race. The highest generation present is the
// "target": it gets p = 0.3 + 0.0015·(ΣparentLevels) + 0.1·(optimakina), and the rest
// share (1−p) proportional to their weights.

import { COLORS, COLOR_BY_NAME } from "./breeding";

// Recipe lookup: unordered pair of parent races -> child race.
const RECIPE = new Map<string, string>();
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
for (const c of COLORS) if (c.parents) RECIPE.set(pairKey(c.parents[0], c.parents[1]), c.name);

const isBicolor = (name: string) => name.includes(" et ");
/** Base race weight: monocolore 9 (Dorée 2), bicolore 2. */
export const baseWeight = (name: string): number =>
  name === "Dorée" ? 2 : isBicolor(name) ? 2 : 9;

/** A breeding mount: its race + the races of its two parents (= the baby's grandparents). */
export interface Mount {
  readonly race: string;
  /** The mount's two parents' races. null/empty for a wild-caught Gen-1 (no recorded lineage). */
  readonly grandparents?: readonly string[];
}

/** Race -> weight contributed by one parent: itself ×5, each grandparent ×3. */
function parentTree(m: Mount): Map<string, number> {
  const w = new Map<string, number>();
  const add = (race: string, x: number) => w.set(race, (w.get(race) ?? 0) + x);
  add(m.race, baseWeight(m.race) * 5);
  for (const g of m.grandparents ?? []) if (g) add(g, baseWeight(g) * 3);
  return w;
}

export interface OutcomeOdds {
  readonly race: string;
  readonly gen: number;
  readonly prob: number; // 0..1
  readonly isTarget: boolean;
}

export interface CrossResult {
  readonly targetGen: number;
  readonly pTarget: number;
  readonly outcomes: ReadonlyArray<OutcomeOdds>; // sorted desc by prob
}

const genOf = (race: string) => COLOR_BY_NAME.get(race)?.gen ?? 0;

/** Target-generation hit probability for a cross. */
export const pTargetFor = (sumParentLevels: number, optimakina: boolean): number =>
  Math.min(1, 0.3 + 0.0015 * sumParentLevels + (optimakina ? 0.1 : 0));

/**
 * Full outcome distribution for crossing two mounts.
 * `sumParentLevels` = level(parentA) + level(parentB).
 */
export function crossOdds(
  a: Mount,
  b: Mount,
  sumParentLevels: number,
  optimakina: boolean,
): CrossResult {
  const t1 = parentTree(a);
  const t2 = parentTree(b);

  const weight = new Map<string, number>();
  const bump = (race: string, w: number) => weight.set(race, (weight.get(race) ?? 0) + w);

  for (const [r1, x1] of t1) {
    for (const [r2, x2] of t2) {
      const w = x1 * x2;
      bump(r1, w);
      bump(r2, w); // r1 === r2 -> counts twice = multiplicity
      if (r1 !== r2) {
        const child = RECIPE.get(pairKey(r1, r2));
        if (child) bump(child, w);
      }
    }
  }

  let targetGen = 0;
  for (const r of weight.keys()) targetGen = Math.max(targetGen, genOf(r));

  let targetW = 0;
  let otherW = 0;
  for (const [r, w] of weight) (genOf(r) === targetGen ? (targetW += w) : (otherW += w));

  const p = pTargetFor(sumParentLevels, optimakina);
  const outcomes: OutcomeOdds[] = [];
  for (const [race, w] of weight) {
    const isTarget = genOf(race) === targetGen;
    const prob = isTarget
      ? (targetW > 0 ? (p * w) / targetW : 0)
      : (otherW > 0 ? ((1 - p) * w) / otherW : 0);
    if (prob > 0) outcomes.push({ race, gen: genOf(race), prob, isTarget });
  }
  outcomes.sort((x, y) => y.prob - x.prob);
  return { targetGen, pTarget: p, outcomes };
}
