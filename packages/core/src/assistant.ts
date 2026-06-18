// Assistant planner: the two-layer plan that drives the agentic Assistant.
//
//   Layer A — Roadmap:   the full cheptel-aware bill-of-materials to reach the target generation
//                        (computePlan), grouped by generation with per-colour owned/need progress.
//   Layer B — Next step: the concrete batch to do RIGHT NOW given live state — raise (ripen a
//                        fertile mount in an enclos), breed (féconde pairs), clone (sterile pairs),
//                        capture (gen-1 still owed). Deterministic; the AI presents/executes it.
//
// Pure. The deterministic source of truth for the Assistant; the AI orchestrates on top of it.

import { COLORS, COLOR_BY_NAME, computePlan, type GenPolicy } from "./colors.js";
import { recommend, type InvMount, type ReproStatus, type BreedAction } from "./recommend.js";

const genOf = (color: string) => COLOR_BY_NAME.get(color)?.gen ?? 0;
const ENCLOS_CAP = 10;

/** A mount with its location, for the live-state-aware planner. */
export interface AssistMount {
  readonly id: number;
  readonly name: string; // the in-game (convention) name — for human-readable labels
  readonly color: string; // "" if unset
  readonly sex: "M" | "F";
  readonly status: ReproStatus;
  readonly keeper: boolean;
  readonly enclosId: number | null; // null = stable
  readonly grandparents: ReadonlyArray<string>;
}

export interface AssistEnclos {
  readonly id: number;
  readonly name: string;
  readonly focus: ReadonlyArray<string>;
  readonly count: number; // current occupants
}

export interface AssistantInput {
  readonly mounts: ReadonlyArray<AssistMount>;
  readonly enclos: ReadonlyArray<AssistEnclos>;
  readonly targetGen: number;
  readonly level: number;
  readonly optimakina: boolean;
  readonly clonage: boolean;
}

// ── Layer A: roadmap ──────────────────────────────────────────────────────
export interface RoadmapRow {
  readonly color: string;
  readonly gen: number;
  readonly owned: number; // total held of this colour (any state)
  readonly need: number; // fresh still to produce (floor demand, minus usable stock)
  readonly recipe: readonly [string, string] | null;
}
export interface RoadmapGenGroup {
  readonly gen: number;
  readonly rows: ReadonlyArray<RoadmapRow>;
}
export interface Roadmap {
  readonly targetGen: number;
  readonly reached: boolean;
  readonly obtainedColors: number;
  readonly totalColors: number;
  readonly baseCaptures: Readonly<Record<string, number>>; // gen-1 still owed
  readonly totalCaptures: number;
  readonly totalCrosses: number;
  readonly gens: ReadonlyArray<RoadmapGenGroup>;
}

// ── Layer B: next step ────────────────────────────────────────────────────
export interface RaiseAction {
  readonly enclosId: number;
  readonly enclosName: string;
  readonly mountIds: ReadonlyArray<number>;
  readonly colors: ReadonlyArray<string>;
  readonly reason: string;
}
export interface CloneAction {
  readonly aId: number;
  readonly bId: number;
  readonly color: string;
  readonly reason: string;
}
export interface CaptureNeed {
  readonly color: string;
  readonly count: number;
}
export interface NextStep {
  readonly raise: ReadonlyArray<RaiseAction>;
  readonly breed: ReadonlyArray<BreedAction>;
  readonly clone: ReadonlyArray<CloneAction>;
  readonly capture: ReadonlyArray<CaptureNeed>;
  readonly done: boolean;
  readonly summary: string;
}

export interface AssistantPlan {
  readonly roadmap: Roadmap;
  readonly nextStep: NextStep;
}

/** Usable breeding stock per colour (non-sterile, non-keeper) — what reduces plan demand. */
const usableStockByColor = (mounts: ReadonlyArray<AssistMount>): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const d of mounts)
    if (d.color && d.status !== "sterile" && !d.keeper) m[d.color] = (m[d.color] ?? 0) + 1;
  return m;
};

const uniformPolicy = (level: number, optimakina: boolean): Record<number, GenPolicy> => {
  const p: Record<number, GenPolicy> = {};
  for (let g = 2; g <= 10; g++) p[g] = { level, optima: optimakina };
  return p;
};

export function assistantPlan(input: AssistantInput): AssistantPlan {
  const { mounts, enclos, targetGen, level, optimakina, clonage } = input;

  const usable = usableStockByColor(mounts);
  const ownedByColor: Record<string, number> = {};
  for (const d of mounts) if (d.color) ownedByColor[d.color] = (ownedByColor[d.color] ?? 0) + 1;

  // ── Layer A: roadmap from the deterministic plan (cheptel-aware) ──
  const plan = computePlan({
    maxGen: targetGen,
    policy: uniformPolicy(level, optimakina),
    reproducteur: false,
    inventory: usable, // usable stock covers parent-uses
    ownedAny: ownedByColor, // any owned copy (incl. keeper/sterile) satisfies the "own >=1" sink
    clonage,
    gender: true,
  });
  const gens: RoadmapGenGroup[] = plan.groups.map((g) => ({
    gen: g.gen,
    rows: g.rows
      .map((r): RoadmapRow => ({
        color: r.name,
        gen: r.gen,
        owned: ownedByColor[r.name] ?? 0,
        need: r.fresh,
        recipe: r.recipe,
      }))
      .filter((r) => r.need > 0 || r.owned > 0),
  })).filter((g) => g.rows.length > 0);

  const targetColors = COLORS.filter((c) => c.gen <= targetGen);
  const obtainedColors = targetColors.filter((c) => (ownedByColor[c.name] ?? 0) > 0).length;
  const reached = obtainedColors === targetColors.length;

  const roadmap: Roadmap = {
    targetGen,
    reached,
    obtainedColors,
    totalColors: targetColors.length,
    baseCaptures: plan.baseCaptures,
    totalCaptures: plan.totalCaptures,
    totalCrosses: plan.totalCrosses,
    gens,
  };

  // ── Layer B: next step. Breed / clone / capture come straight from `recommend`
  //    (same deterministic source); `raise` is the new live-state piece. ──
  const invMounts: InvMount[] = mounts.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    sex: m.sex,
    status: m.status,
    keeper: m.keeper,
    grandparents: [...m.grandparents],
  }));
  const rec = recommend({
    mounts: invMounts,
    targetGen,
    freeSlots: 999, // we want every productive féconde pair, not a per-round cap
    level,
    optimakina,
    clonage,
  });

  // Colours that are consumed as a parent somewhere in the plan (worth ripening to féconde).
  const usedAsParent = new Set<string>();
  for (const c of COLORS) if (c.gen <= targetGen && c.parents) c.parents.forEach((p) => usedAsParent.add(p));

  // "Ripening" = will be a usable parent soon: féconde anywhere + fertile ALREADY in an enclos.
  // Tracked per (colour, sex) so we raise toward a breedable PAIR (1♂+1♀), never N of one gender,
  // and never re-raise a colour already being ripened in an enclos.
  const ripening: Record<string, { M: number; F: number }> = {};
  const bumpRipe = (c: string, s: "M" | "F") => ((ripening[c] ??= { M: 0, F: 0 })[s]++);
  for (const d of mounts)
    if (d.color && (d.status === "feconde" || (d.status === "fertile" && d.enclosId !== null))) bumpRipe(d.color, d.sex);

  // Raise candidates: STABLE, fertile, non-keeper, a colour the plan breeds with. Bottom-up.
  const raiseCandidates = mounts
    .filter((m) => m.enclosId === null && m.status === "fertile" && !m.keeper && m.color && usedAsParent.has(m.color))
    .sort((a, b) => genOf(a.color) - genOf(b.color));

  // Assign to free enclos slots, but only one of each (colour, sex) — enough for a breedable pair.
  const freeByEnclos = enclos
    .map((e) => ({ id: e.id, name: e.name, free: Math.max(0, ENCLOS_CAP - e.count), ids: [] as number[], colors: [] as string[] }))
    .filter((e) => e.free > 0);
  let ei = 0;
  for (const cand of raiseCandidates) {
    const r = (ripening[cand.color] ??= { M: 0, F: 0 });
    if (r[cand.sex] >= 1) continue; // this (colour, sex) is already covered/ripening
    while (ei < freeByEnclos.length && freeByEnclos[ei].free <= 0) ei++;
    if (ei >= freeByEnclos.length) break; // no free slots left
    const slot = freeByEnclos[ei];
    slot.free--;
    slot.ids.push(cand.id);
    slot.colors.push(cand.color);
    r[cand.sex]++;
  }
  const raise: RaiseAction[] = freeByEnclos
    .filter((e) => e.ids.length > 0)
    .map((e) => ({
      enclosId: e.id,
      enclosName: e.name,
      mountIds: e.ids,
      colors: e.colors,
      reason: `monte ${e.ids.length} monture(s) jusqu'à féconde (endurance/maturité/amour à 20K)`,
    }));

  const clone: CloneAction[] = rec.recycle
    .filter((r) => r.kind === "clone" && r.ids.length >= 2)
    .map((r) => ({ aId: r.ids[0], bId: r.ids[1], color: r.color, reason: r.reason }));

  const summaryParts: string[] = [];
  if (rec.breed.length) summaryParts.push(`${rec.breed.length} croisement(s)`);
  if (raise.length) summaryParts.push(`${raise.reduce((n, r) => n + r.mountIds.length, 0)} à élever`);
  if (clone.length) summaryParts.push(`${clone.length} clonage(s)`);
  const totalCapture = rec.capture.reduce((n, c) => n + c.count, 0);
  if (totalCapture) summaryParts.push(`${totalCapture} à capturer`);

  // Once the objective is met there is no work — don't recommend wasteful breed/clone/capture.
  const nextStep: NextStep = reached
    ? { raise: [], breed: [], clone: [], capture: [], done: true, summary: `Objectif gen ${targetGen} atteint 🎉` }
    : {
        raise,
        breed: rec.breed,
        clone,
        capture: rec.capture,
        done: false,
        summary: summaryParts.join(" · ") || "Rien à faire ce tour — capture des bases pour amorcer.",
      };

  return { roadmap, nextStep };
}
