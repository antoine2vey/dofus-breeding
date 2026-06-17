// Monte Carlo simulator for a "Gen-N rush", built on the VALIDATED crossOdds engine.
//
// It plays a greedy, genealogy-aware breeding strategy: each step it picks the fertile
// ♂×♀ pair whose real outcome distribution most advances the highest generation reached,
// captures Gen-1 when it runs dry, and recycles steriles via Clonage. Running it many
// times gives the EXPECTED captures (by colour), breedings and clonages to reach the goal,
// plus which colours the winning line breeds most (the breeding priorities).

import { COLORS, COLOR_BY_NAME } from "./colors.js";
import { crossOdds, type Mount } from "./odds.js";

const BASE = ["Amande", "Dorée", "Rousse"] as const;
type Sex = 0 | 1;

interface SimMount {
  race: string;
  sex: Sex;
  gp: readonly string[]; // grandparent races (the mount's parents)
  fertile: boolean;
}

export interface SimConfig {
  targetGen: number; // reach any colour of this generation (used if targetColor is unset)
  targetColor?: string; // produce ONE of this exact colour
  level: number; // both parents assumed at this level when crossing
  optimakina: boolean;
  clonage: boolean;
  maxSteps?: number;
}

export interface SimRun {
  reached: boolean;
  captures: Record<string, number>; // by Gen-1 race
  totalCaptures: number;
  breedings: number;
  clonages: number;
  raises: number; // captures + breedings + clonages (everything raised to féconde)
  bred: Record<string, number>; // how many of each colour the line produced
  clonesByRace: Record<string, number>; // how many of each colour were recovered via clonage
  steps: number;
  climbOffers?: number;
}

const genOf = (race: string) => COLOR_BY_NAME.get(race)?.gen ?? 0;

/** Pick a cheap representative target colour of the requested generation to "reach". */
const targetColorFor = (gen: number): string => {
  if (gen <= 1) return "Amande";
  // Prefer an "X et Rousse" form (Rousse is the cheap leaf) when one exists at this gen.
  const cands = COLORS.filter((c) => c.gen === gen);
  return (cands.find((c) => c.parents?.includes("Rousse")) ?? cands[0]).name;
};

export function simulateOnce(cfg: SimConfig, rng: () => number): SimRun {
  const captures: Record<string, number> = { Amande: 0, Dorée: 0, Rousse: 0 };
  const bred: Record<string, number> = {};
  const clonesByRace: Record<string, number> = {};
  let breedings = 0;
  let clonages = 0;

  // Pools of available FERTILE and STERILE mounts, keyed by race (genealogy preserved on
  // the mount). Byproducts of a failed cross land in the fertile pool for later reuse.
  const fertile = new Map<string, SimMount[]>();
  const sterile = new Map<string, SimMount[]>();
  const push = (map: Map<string, SimMount[]>, m: SimMount) =>
    (map.get(m.race) ?? map.set(m.race, []).get(m.race)!).push(m);
  const take = (map: Map<string, SimMount[]>, race: string): SimMount | null =>
    map.get(race)?.pop() ?? null;

  const sample = (m: Mount, f: Mount): string => {
    const r = crossOdds(m, f, 2 * cfg.level, cfg.optimakina);
    let x = rng();
    for (const o of r.outcomes) {
      x -= o.prob;
      if (x <= 0) return o.race;
    }
    return r.outcomes[r.outcomes.length - 1]?.race ?? m.race;
  };

  // Produce one fertile mount of `race`, recursively building its ingredients. Returns it
  // (removed from the pools). Byproducts of failed crosses are kept in the fertile pool.
  const produce = (race: string, depth: number): SimMount => {
    const reuse = take(fertile, race);
    if (reuse) return reuse;

    if (genOf(race) <= 1) {
      captures[race] = (captures[race] ?? 0) + 1;
      return { race, sex: rng() < 0.5 ? 0 : 1, gp: [], fertile: true };
    }

    // Clonage: if two spent steriles of this exact colour are lying around, recycle them
    // (2 → 1 fertile, gauges reset = a fresh raise) instead of rebuilding the whole lineage.
    if (cfg.clonage) {
      const sp = sterile.get(race);
      if (sp && sp.length >= 2) {
        sp.pop();
        const keep = sp.pop()!;
        clonages++;
        clonesByRace[race] = (clonesByRace[race] ?? 0) + 1;
        return { race, sex: rng() < 0.5 ? 0 : 1, gp: keep.gp, fertile: true };
      }
    }

    const recipe = COLOR_BY_NAME.get(race)!.parents!;
    // Safety valve against pathological recursion depth (shouldn't trigger; gen<=10).
    const guard = depth > 40;
    for (let attempt = 0; ; attempt++) {
      const a = produce(recipe[0], depth + 1);
      const b = produce(recipe[1], depth + 1);
      const outcome = sample(a, b);
      breedings++;
      bred[outcome] = (bred[outcome] ?? 0) + 1;
      a.fertile = false;
      b.fertile = false;
      push(sterile, a);
      push(sterile, b);
      const baby: SimMount = { race: outcome, sex: rng() < 0.5 ? 0 : 1, gp: [recipe[0], recipe[1]], fertile: true };
      if (outcome === race || guard) return guard ? { ...baby, race } : baby;
      push(fertile, baby); // useful byproduct -> reuse later
    }
  };

  const target = cfg.targetColor ?? targetColorFor(cfg.targetGen);
  produce(target, 0);

  const totalCaptures = (captures.Amande ?? 0) + (captures.Dorée ?? 0) + (captures.Rousse ?? 0);
  return {
    reached: true,
    captures,
    totalCaptures,
    breedings,
    clonages,
    raises: totalCaptures + breedings + clonages,
    bred,
    clonesByRace,
    steps: breedings,
    climbOffers: 0,
  };
}

export interface SimSummary {
  runs: number;
  reachedFrac: number;
  captures: { mean: number; p10: number; p50: number; p90: number; byRace: Record<string, number> };
  breedings: { mean: number; p50: number };
  clonages: { mean: number; p50: number };
  raises: { mean: number; p50: number };
  topBred: Array<{ race: string; gen: number; mean: number }>; // breeding priorities
  perColor: Record<string, number>; // mean number of each colour that came into existence
}

const pct = (arr: number[], q: number) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
};
const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export function monteCarlo(cfg: SimConfig, runs: number, rng: () => number): SimSummary {
  const all: SimRun[] = [];
  for (let i = 0; i < runs; i++) all.push(simulateOnce(cfg, rng));
  const reached = all.filter((r) => r.reached);
  const use = reached.length ? reached : all;

  const caps = use.map((r) => r.totalCaptures);
  const byRace: Record<string, number> = {};
  for (const r of BASE) byRace[r] = mean(use.map((x) => x.captures[r] ?? 0));

  // Mean count of every colour that came into existence per run (bred outcomes + Gen-1 captures).
  const perColor: Record<string, number> = {};
  for (const r of use) {
    for (const [race, n] of Object.entries(r.bred)) perColor[race] = (perColor[race] ?? 0) + n;
    for (const [race, n] of Object.entries(r.captures)) perColor[race] = (perColor[race] ?? 0) + n;
  }
  for (const k of Object.keys(perColor)) perColor[k] /= use.length;

  const topBred = Object.entries(perColor)
    .map(([race, m]) => ({ race, gen: genOf(race), mean: m }))
    .filter((x) => x.gen >= 2)
    .sort((a, b) => b.gen - a.gen || b.mean - a.mean)
    .slice(0, 16);

  return {
    runs,
    reachedFrac: reached.length / all.length,
    captures: {
      mean: mean(caps),
      p10: pct(caps, 0.1),
      p50: pct(caps, 0.5),
      p90: pct(caps, 0.9),
      byRace,
    },
    breedings: { mean: mean(use.map((r) => r.breedings)), p50: pct(use.map((r) => r.breedings), 0.5) },
    clonages: { mean: mean(use.map((r) => r.clonages)), p50: pct(use.map((r) => r.clonages), 0.5) },
    raises: { mean: mean(use.map((r) => r.raises)), p50: pct(use.map((r) => r.raises), 0.5) },
    topBred,
    perColor,
  };
}

/** Tiny deterministic RNG (mulberry32) so runs are reproducible. */
export const makeRng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
