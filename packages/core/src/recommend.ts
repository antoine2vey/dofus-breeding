// Deterministic "next best actions" recommender. Given the live inventory, free enclos
// slots and a target generation, it ranks: which pairs to breed now, what Gen-1 to capture,
// and what to recycle (clone same-colour steriles / extract dead-weight). Pure — reused by
// the /api/recommend endpoint and exposed as a tool to the AI agent.

import { COLORS, COLOR_BY_NAME, computePlan, type GenPolicy } from "./colors.js";
import { crossOdds } from "./odds.js";

const BASES = ["Amande", "Dorée", "Rousse"] as const;

/** Highest generation a colour can ultimately lead to (spine potential). */
const POTENTIAL: Record<string, number> = (() => {
  const pot: Record<string, number> = {};
  for (const c of COLORS) pot[c.name] = c.gen;
  for (const c of [...COLORS].sort((a, b) => b.gen - a.gen)) {
    if (c.parents) for (const p of c.parents) pot[p] = Math.max(pot[p], pot[c.name]);
  }
  return pot;
})();

const genOf = (color: string) => COLOR_BY_NAME.get(color)?.gen ?? 0;

/** In-game reproduction state: sterile (used up) → fertile (not yet ready) → feconde (ready now). */
export type ReproStatus = "sterile" | "fertile" | "feconde";

export interface InvMount {
  readonly id: number;
  readonly color: string; // "" if unset
  readonly sex: "M" | "F";
  readonly status: ReproStatus;
  readonly keeper: boolean;
  readonly grandparents: readonly string[]; // parent colours, for odds genealogy
}

export interface RecommendInput {
  readonly mounts: ReadonlyArray<InvMount>;
  readonly targetGen: number;
  readonly freeSlots: number; // how many breedings to recommend this round
  readonly level: number; // assumed parent level for odds
  readonly optimakina: boolean;
  readonly clonage: boolean;
}

export interface BreedAction {
  readonly aId: number;
  readonly bId: number;
  readonly aLabel: string;
  readonly bLabel: string;
  readonly targetGen: number;
  readonly top: ReadonlyArray<{ race: string; prob: number; gen: number }>;
  readonly score: number;
  readonly rationale: string;
}
export interface CaptureAction {
  readonly color: string;
  readonly count: number;
  readonly reason: string;
}
export interface RecycleAction {
  readonly kind: "clone" | "extract";
  readonly color: string;
  readonly ids: ReadonlyArray<number>;
  readonly reason: string;
}
export interface Recommendation {
  readonly targetGen: number;
  readonly highestGen: number;
  readonly obtainedColors: number;
  readonly missingToTarget: ReadonlyArray<string>;
  readonly breed: ReadonlyArray<BreedAction>;
  readonly capture: ReadonlyArray<CaptureAction>;
  readonly recycle: ReadonlyArray<RecycleAction>;
}

const label = (m: InvMount) => `${m.color || "?"} ${m.sex === "F" ? "♀" : "♂"} #${m.id}`;

export function recommend(input: RecommendInput): Recommendation {
  const { mounts, targetGen, freeSlots, level, optimakina } = input;
  const obtained = new Set(mounts.map((m) => m.color).filter(Boolean));
  const highestGen = Math.max(0, ...mounts.map((m) => genOf(m.color)));

  // Colours <= targetGen we don't yet own.
  const missingToTarget = COLORS.filter((c) => c.gen <= targetGen && !obtained.has(c.name)).map(
    (c) => c.name,
  );

  // Value of producing a colour: spine progress, big bonus if it's a colour we still lack.
  const value = (race: string) => {
    const pot = POTENTIAL[race] ?? genOf(race);
    let v = pot >= targetGen ? Math.pow(3, genOf(race)) : 0.001;
    if (!obtained.has(race)) v += 1e6; // coverage: prioritise new colours
    return v;
  };

  // ── Breed: only FÉCONDE mounts can pair now. Score every opposite-sex pair, greedily
  //    pick non-overlapping best. (Merely-fertile mounts are future capacity, not pairable.) ──
  const feconde = mounts.filter((m) => m.status === "feconde" && m.color && !m.keeper);
  const males = feconde.filter((m) => m.sex === "M");
  const females = feconde.filter((m) => m.sex === "F");
  type Scored = { m: InvMount; f: InvMount; score: number; r: ReturnType<typeof crossOdds> };
  const scored: Scored[] = [];
  for (const m of males) {
    for (const f of females) {
      const r = crossOdds(
        { race: m.color, grandparents: m.grandparents },
        { race: f.color, grandparents: f.grandparents },
        2 * level,
        optimakina,
      );
      let score = 0;
      for (const o of r.outcomes) score += o.prob * value(o.race);
      if (score > 0.01) scored.push({ m, f, score, r });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const used = new Set<number>();
  const breed: BreedAction[] = [];
  for (const s of scored) {
    if (breed.length >= Math.max(1, freeSlots)) break;
    if (used.has(s.m.id) || used.has(s.f.id)) continue;
    used.add(s.m.id);
    used.add(s.f.id);
    const top = s.r.outcomes
      .filter((o) => o.prob > 0.02)
      .slice(0, 4)
      .map((o) => ({ race: o.race, prob: o.prob, gen: o.gen }));
    const best = top[0];
    const isNew = best && !obtained.has(best.race);
    breed.push({
      aId: s.m.id,
      bId: s.f.id,
      aLabel: label(s.m),
      bLabel: label(s.f),
      targetGen: s.r.targetGen,
      top,
      score: s.score,
      rationale: isNew
        ? `obtient « ${best.race} » (couleur manquante, gen ${best.gen})`
        : best
          ? `pousse vers gen ${best.gen} (${best.race})`
          : "avance la lignée",
    });
  }

  // ── Capture: only Amande/Dorée/Rousse are wild-capturable. How many of each depends on the
  //    target generation and what usable stock you already hold — ask the deterministic planner. ──
  const usableStock: Record<string, number> = {};
  const ownedStock: Record<string, number> = {};
  for (const m of mounts) {
    if (!m.color) continue;
    ownedStock[m.color] = (ownedStock[m.color] ?? 0) + 1; // any state — satisfies the "own >=1" sink
    if (m.status !== "sterile" && !m.keeper) usableStock[m.color] = (usableStock[m.color] ?? 0) + 1;
  }
  const policy: Record<number, GenPolicy> = {};
  for (let g = 2; g <= 10; g++) policy[g] = { level, optima: optimakina };
  const plan = computePlan({
    maxGen: targetGen,
    policy,
    reproducteur: false,
    inventory: usableStock,
    ownedAny: ownedStock,
    clonage: input.clonage,
    gender: true,
  });
  const capture: CaptureAction[] = [];
  for (const c of BASES) {
    const n = Math.round(plan.baseCaptures[c] ?? 0);
    if (n > 0)
      capture.push({ color: c, count: n, reason: `captures nécessaires pour la gen ${targetGen}` });
  }

  // ── Recycle: clone same-colour sterile pairs; extract dead-weight steriles ──
  const sterile = mounts.filter((m) => m.status === "sterile" && m.color && !m.keeper);
  const byColor = new Map<string, InvMount[]>();
  for (const m of sterile) (byColor.get(m.color) ?? byColor.set(m.color, []).get(m.color)!).push(m);
  const recycle: RecycleAction[] = [];
  if (input.clonage) {
    const cloneGroups = [...byColor.entries()]
      .filter(([, g]) => g.length >= 2)
      .sort((a, b) => (POTENTIAL[b[0]] ?? 0) - (POTENTIAL[a[0]] ?? 0));
    for (const [color, g] of cloneGroups.slice(0, 5)) {
      recycle.push({
        kind: "clone",
        color,
        ids: g.slice(0, 2).map((m) => m.id),
        reason: `2 stériles → 1 féconde (mène à gen ${POTENTIAL[color] ?? genOf(color)})`,
      });
    }
  }
  for (const [color, g] of byColor) {
    const pot = POTENTIAL[color] ?? genOf(color);
    if (pot < targetGen && g.length < 2) {
      recycle.push({
        kind: "extract",
        color,
        ids: g.map((m) => m.id),
        reason: `cul-de-sac (gen max ${pot}) — extraire pour des ressources`,
      });
    }
  }

  return {
    targetGen,
    highestGen,
    obtainedColors: obtained.size,
    missingToTarget,
    breed,
    capture,
    recycle: recycle.slice(0, 12),
  };
}
