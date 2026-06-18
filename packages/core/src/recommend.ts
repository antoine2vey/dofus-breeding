// Deterministic "next best actions" recommender. Given the live inventory, free enclos
// slots and a target generation, it ranks: which pairs to breed now, what Gen-1 to capture,
// and what to recycle (clone same-colour steriles / extract dead-weight). Pure — reused by
// the /api/recommend endpoint and exposed as a tool to the AI agent.

import { COLORS, COLOR_BY_NAME } from "./colors.js";
import { cheptelAccounting, type Cheptel } from "./cheptel.js";
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
  readonly name?: string; // the in-game (convention) name — used for human-readable labels
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
  /** Colours whose achievement is already unlocked (succès). They satisfy the GOAL (sink/
   *  coverage) even if no mount is owned — but NOT breeding supply, so a done colour that's a
   *  parent of the target is still produced. */
  readonly achievements?: ReadonlyArray<string>;
  /** Pre-built cheptel accounting (stock sets + plan). When omitted, recommend builds its own from
   *  mounts + achievements; assistantPlan passes the one it already computed so the plan isn't
   *  derived twice. */
  readonly accounting?: Cheptel;
}

export interface BreedAction {
  readonly aId: number;
  readonly bId: number;
  readonly aLabel: string;
  readonly bLabel: string;
  readonly targetGen: number;
  readonly top: ReadonlyArray<{ race: string; prob: number; gen: number }>;
  /** The colour the cross is actually FOR — the score-driver (max prob × value), which may not
   *  be the most probable outcome. The UI defaults the "couleur obtenue" picker to this. */
  readonly intended: string;
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

// Prefer the in-game (convention) name so the user can actually find the mount in the game;
// fall back to colour/sex/id only when a name isn't recorded.
const label = (m: InvMount) => m.name || `${m.color || "?"} ${m.sex === "F" ? "♀" : "♂"} #${m.id}`;

export function recommend(input: RecommendInput): Recommendation {
  const { mounts, targetGen, freeSlots, level, optimakina } = input;
  // The stock sets + plan come from one cheptel accounting (built here when called standalone, or
  // reused from assistantPlan). `obtained` = own OR succès; `plan.demand` = what's still needed.
  const { obtained, plan } =
    input.accounting ??
    cheptelAccounting({
      mounts,
      achievements: input.achievements,
      targetGen,
      level,
      optima: optimakina,
      clonage: input.clonage,
    });
  const highestGen = Math.max(0, ...mounts.map((m) => genOf(m.color)));

  // Colours <= targetGen we don't yet own.
  const missingToTarget = COLORS.filter((c) => c.gen <= targetGen && !obtained.has(c.name)).map(
    (c) => c.name,
  );

  // Value of producing a colour: spine progress ONLY if the plan still needs it (so a "done" or
  // already-covered colour with zero demand scores ~0 and isn't bred), plus a coverage bonus for a
  // goal colour we still lack (done colours are `obtained` → excluded from coverage).
  const value = (race: string) => {
    const pot = POTENTIAL[race] ?? genOf(race);
    const needed = (plan.demand[race] ?? 0) > 0;
    let v = pot >= targetGen && needed ? Math.pow(3, genOf(race)) : 0.001;
    if (!obtained.has(race)) v += 1e6;
    return v;
  };

  // The outcome a cross is really FOR: the one contributing the most to its score (prob × value),
  // not necessarily the most probable. Reused for the self-cross filter and the rationale/label.
  const driverOf = (outcomes: ReturnType<typeof crossOdds>["outcomes"]) =>
    outcomes.filter((o) => o.prob > 0.02).sort((a, b) => b.prob * value(b.race) - a.prob * value(a.race))[0];

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
      let maxOutVal = 0; // value of the best (most valuable) meaningfully-probable outcome
      for (const o of r.outcomes) {
        const v = value(o.race);
        score += o.prob * v;
        if (o.prob > 0.02 && v > maxOutVal) maxOutVal = v;
      }
      if (score <= 0.01) continue;
      // A cross must step UP: produce — at meaningful odds — a colour strictly more valuable than
      // its priciest parent. With fertility = 1 both parents are sterilised by the cross, so a pair
      // whose best outcome is no better than a parent it consumes only destroys net supply: a
      // self-cross (Dorée et Rousse × Dorée → Dorée et Rousse) or a lateral (Amande × Dorée et
      // Rousse → Amande et Rousse, burning a scarce gen-2 to make another gen-2). Every real recipe
      // yields a child of strictly higher generation — hence higher value — than BOTH parents, so
      // this never drops legitimate progress; it just stops the planner cannibalising a scarce
      // colour to remake an equal/cheaper one (the cheap recipe, e.g. Dorée × Rousse, is preferred).
      if (maxOutVal <= Math.max(value(m.color), value(f.color))) continue;
      scored.push({ m, f, score, r });
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
    // The outcome list stays sorted by probability (honest odds). But the RATIONALE must name
    // the outcome that actually EARNED the cross its score (max prob × value), not the most
    // likely one: a lineage-tainted parent (e.g. a gen-6 grandparent) can make an already-
    // owned, demand-0 by-product the most probable outcome even though a lower-gen outcome is
    // the real reason the pair was picked. (A shown cross has score > 0.01, so its driver
    // always has value > 0.001 — the rationale never names pure dead-weight.)
    const top = s.r.outcomes
      .filter((o) => o.prob > 0.02)
      .slice(0, 4)
      .map((o) => ({ race: o.race, prob: o.prob, gen: o.gen }));
    const driver = driverOf(s.r.outcomes);
    const isNew = driver && !obtained.has(driver.race);
    breed.push({
      aId: s.m.id,
      bId: s.f.id,
      aLabel: label(s.m),
      bLabel: label(s.f),
      targetGen: s.r.targetGen,
      top,
      intended: driver?.race ?? top[0]?.race ?? "",
      score: s.score,
      rationale: isNew
        ? `obtient « ${driver.race} » (couleur manquante, gen ${driver.gen})`
        : driver
          ? `pousse vers gen ${driver.gen} (${driver.race})`
          : "avance la lignée",
    });
  }

  // ── Capture: only Amande/Dorée/Rousse are wild-capturable; counts come from the plan above. ──
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
        reason: `2 stériles → 1 survivante fertile (mène à gen ${POTENTIAL[color] ?? genOf(color)})`,
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
    obtainedColors: [...obtained].filter((c) => genOf(c) <= targetGen).length,
    missingToTarget,
    breed,
    capture,
    recycle: recycle.slice(0, 12),
  };
}
