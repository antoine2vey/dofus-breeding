// AUTO-GENERATED color data (66 reproducible Dragodinde colors, Gen 1–10)
// extracted & verified from dofuspourlesnoobs.com (section V). Recipes are exact.
export interface ColorDef {
  readonly name: string;
  readonly gen: number;
  readonly bonus: ReadonlyArray<string>;
  readonly parents: readonly [string, string] | null;
}

export const COLORS: ReadonlyArray<ColorDef> = [
  { name: "Amande", gen: 1, bonus: ["400 Vitalité", "1700 Initiative"], parents: null },
  { name: "Dorée", gen: 1, bonus: ["400 Vitalité", "2 Invocations"], parents: null },
  { name: "Rousse", gen: 1, bonus: ["400 Vitalité", "60 Soins"], parents: null },
  { name: "Amande et Rousse", gen: 2, bonus: ["400 Vitalité", "60 Soins", "1200 Initiative"], parents: ["Amande", "Rousse"] },
  { name: "Dorée et Rousse", gen: 2, bonus: ["400 Vitalité", "1 Invocation", "45 Soins"], parents: ["Dorée", "Rousse"] },
  { name: "Amande et Dorée", gen: 2, bonus: ["400 Vitalité", "1 Invocation", "1200 Initiative"], parents: ["Amande", "Dorée"] },
  { name: "Ebène", gen: 3, bonus: ["400 Vitalité", "120 Agilité"], parents: ["Amande et Dorée", "Dorée et Rousse"] },
  { name: "Indigo", gen: 3, bonus: ["400 Vitalité", "120 Chance"], parents: ["Amande et Dorée", "Amande et Rousse"] },
  { name: "Indigo et Rousse", gen: 4, bonus: ["400 Vitalité", "90 Chance", "45 Soins"], parents: ["Indigo", "Rousse"] },
  { name: "Ebène et Rousse", gen: 4, bonus: ["400 Vitalité", "90 Agilité", "45 Soins"], parents: ["Ebène", "Rousse"] },
  { name: "Amande et Indigo", gen: 4, bonus: ["400 Vitalité", "90 Chance", "1200 Initiative"], parents: ["Amande", "Indigo"] },
  { name: "Amande et Ebène", gen: 4, bonus: ["400 Vitalité", "120 Agilité", "1200 Initiative"], parents: ["Amande", "Ebène"] },
  { name: "Dorée et Indigo", gen: 4, bonus: ["400 Vitalité", "90 Chance", "1 Invocation"], parents: ["Dorée", "Indigo"] },
  { name: "Dorée et Ebène", gen: 4, bonus: ["400 Vitalité", "90 Agilité", "1 Invocation"], parents: ["Dorée", "Ebène"] },
  { name: "Ebène et Indigo", gen: 4, bonus: ["400 Vitalité", "90 Chance", "90 Agilité"], parents: ["Ebène", "Indigo"] },
  { name: "Pourpre", gen: 5, bonus: ["400 Vitalité", "120 Force"], parents: ["Ebène et Indigo", "Amande et Rousse"] },
  { name: "Orchidée", gen: 5, bonus: ["400 Vitalité", "120 Intelligence"], parents: ["Ebène et Indigo", "Dorée et Rousse"] },
  { name: "Pourpre et Rousse", gen: 6, bonus: ["400 Vitalité", "90 Force", "45 Soins"], parents: ["Pourpre", "Rousse"] },
  { name: "Orchidée et Rousse", gen: 6, bonus: ["400 Vitalité", "90 Intelligence", "45 Soins"], parents: ["Orchidée", "Rousse"] },
  { name: "Amande et Pourpre", gen: 6, bonus: ["400 Vitalité", "90 Force", "1200 Initiative"], parents: ["Amande", "Pourpre"] },
  { name: "Amande et Orchidée", gen: 6, bonus: ["400 Vitalité", "90 Intelligence", "1200 Initiative"], parents: ["Amande", "Orchidée"] },
  { name: "Dorée et Pourpre", gen: 6, bonus: ["400 Vitalité", "90 Force", "1 Invocation"], parents: ["Dorée", "Pourpre"] },
  { name: "Dorée et Orchidée", gen: 6, bonus: ["400 Vitalité", "90 Intelligence", "1 Invocation"], parents: ["Dorée", "Orchidée"] },
  { name: "Indigo et Pourpre", gen: 6, bonus: ["400 Vitalité", "90 Force", "90 Chance"], parents: ["Indigo", "Pourpre"] },
  { name: "Indigo et Orchidée", gen: 6, bonus: ["400 Vitalité", "90 Intelligence", "90 Chance"], parents: ["Indigo", "Orchidée"] },
  { name: "Ebène et Pourpre", gen: 6, bonus: ["400 Vitalité", "90 Force", "90 Agilité"], parents: ["Ebène", "Pourpre"] },
  { name: "Ebène et Orchidée", gen: 6, bonus: ["400 Vitalité", "90 Intelligence", "90 Agilité"], parents: ["Ebène", "Orchidée"] },
  { name: "Orchidée et Pourpre", gen: 6, bonus: ["400 Vitalité", "90 Force", "90 Intelligence"], parents: ["Orchidée", "Pourpre"] },
  { name: "Ivoire", gen: 7, bonus: ["400 Vitalité", "90 Puissance"], parents: ["Orchidée et Pourpre", "Indigo et Pourpre"] },
  { name: "Turquoise", gen: 7, bonus: ["400 Vitalité", "90 Prospection"], parents: ["Orchidée et Pourpre", "Ebène et Orchidée"] },
  { name: "Ivoire et Rousse", gen: 8, bonus: ["400 Vitalité", "70 Puissance", "45 Soins"], parents: ["Ivoire", "Rousse"] },
  { name: "Turquoise et Rousse", gen: 8, bonus: ["400 Vitalité", "45 Soins", "70 Prospection"], parents: ["Turquoise", "Rousse"] },
  { name: "Amande et Ivoire", gen: 8, bonus: ["400 Vitalité", "70 Puissance", "1200 Initiative"], parents: ["Amande", "Ivoire"] },
  { name: "Amande et Turquoise", gen: 8, bonus: ["400 Vitalité", "70 Prospection", "1200 Initiative"], parents: ["Amande", "Turquoise"] },
  { name: "Dorée et Ivoire", gen: 8, bonus: ["400 Vitalité", "70 Puissance", "1 Invocation"], parents: ["Dorée", "Ivoire"] },
  { name: "Dorée et Turquoise", gen: 8, bonus: ["400 Vitalité", "1 Invocation", "70 Prospection"], parents: ["Dorée", "Turquoise"] },
  { name: "Indigo et Ivoire", gen: 8, bonus: ["400 Vitalité", "90 Chance", "70 Puissance"], parents: ["Indigo", "Ivoire"] },
  { name: "Indigo et Turquoise", gen: 8, bonus: ["400 Vitalité", "90 Chance", "70 Prospection"], parents: ["Indigo", "Turquoise"] },
  { name: "Ebène et Ivoire", gen: 8, bonus: ["400 Vitalité", "90 Agilité", "70 Puissance"], parents: ["Ebène", "Ivoire"] },
  { name: "Ebène et Turquoise", gen: 8, bonus: ["400 Vitalité", "90 Agilité", "70 Prospection"], parents: ["Ebène", "Turquoise"] },
  { name: "Ivoire et Pourpre", gen: 8, bonus: ["400 Vitalité", "90 Force", "70 Puissance"], parents: ["Ivoire", "Pourpre"] },
  { name: "Turquoise et Pourpre", gen: 8, bonus: ["400 Vitalité", "90 Force", "70 Prospection"], parents: ["Turquoise", "Pourpre"] },
  { name: "Ivoire et Orchidée", gen: 8, bonus: ["400 Vitalité", "90 Intelligence", "70 Puissance"], parents: ["Ivoire", "Orchidée"] },
  { name: "Turquoise et Orchidée", gen: 8, bonus: ["400 Vitalité", "90 Intelligence", "70 Prospection"], parents: ["Turquoise", "Orchidée"] },
  { name: "Ivoire et Turquoise", gen: 8, bonus: ["400 Vitalité", "70 Puissance", "70 Prospection"], parents: ["Ivoire", "Turquoise"] },
  { name: "Emeraude", gen: 9, bonus: ["400 Vitalité", "14% Critique"], parents: ["Ivoire et Turquoise", "Ivoire et Pourpre"] },
  { name: "Prune", gen: 9, bonus: ["400 Vitalité", "2 Portée"], parents: ["Ivoire et Turquoise", "Turquoise et Orchidée"] },
  { name: "Emeraude et Rousse", gen: 10, bonus: ["400 Vitalité", "10% Critique", "45 Soins"], parents: ["Emeraude", "Rousse"] },
  { name: "Prune et Rousse", gen: 10, bonus: ["400 Vitalité", "1 Portée", "45 Soins"], parents: ["Prune", "Rousse"] },
  { name: "Amande et Emeraude", gen: 10, bonus: ["400 Vitalité", "10% Critique", "1200 Initiative"], parents: ["Amande", "Emeraude"] },
  { name: "Prune et Amande", gen: 10, bonus: ["400 Vitalité", "1 Portée", "1200 Initiative"], parents: ["Prune", "Amande"] },
  { name: "Dorée et Emeraude", gen: 10, bonus: ["400 Vitalité", "10% Critique", "1 Invocation"], parents: ["Dorée", "Emeraude"] },
  { name: "Prune et Dorée", gen: 10, bonus: ["400 Vitalité", "1 Portée", "1 Invocation"], parents: ["Prune", "Dorée"] },
  { name: "Emeraude et Indigo", gen: 10, bonus: ["400 Vitalité", "90 Chance", "10% Critique"], parents: ["Emeraude", "Indigo"] },
  { name: "Prune et Indigo", gen: 10, bonus: ["400 Vitalité", "90 Chance", "1 Portée"], parents: ["Prune", "Indigo"] },
  { name: "Ebène et Emeraude", gen: 10, bonus: ["400 Vitalité", "90 Agilité", "10% Critique"], parents: ["Ebène", "Emeraude"] },
  { name: "Prune et Ebène", gen: 10, bonus: ["400 Vitalité", "90 Agilité", "1 Portée"], parents: ["Prune", "Ebène"] },
  { name: "Emeraude et Pourpre", gen: 10, bonus: ["400 Vitalité", "90 Force", "10% Critique"], parents: ["Emeraude", "Pourpre"] },
  { name: "Prune et Pourpre", gen: 10, bonus: ["400 Vitalité", "90 Force", "1 Portée"], parents: ["Prune", "Pourpre"] },
  { name: "Emeraude et Orchidée", gen: 10, bonus: ["400 Vitalité", "90 Intelligence", "10% Critique"], parents: ["Emeraude", "Orchidée"] },
  { name: "Prune et Orchidée", gen: 10, bonus: ["400 Vitalité", "90 Intelligence", "1 Portée"], parents: ["Prune", "Orchidée"] },
  { name: "Emeraude et Ivoire", gen: 10, bonus: ["400 Vitalité", "70 Puissance", "10% Critique"], parents: ["Emeraude", "Ivoire"] },
  { name: "Prune et Ivoire", gen: 10, bonus: ["400 Vitalité", "70 Puissance", "1 Portée"], parents: ["Prune", "Ivoire"] },
  { name: "Emeraude et Turquoise", gen: 10, bonus: ["400 Vitalité", "10% Critique", "70 Prospection"], parents: ["Emeraude", "Turquoise"] },
  { name: "Prune et Turquoise", gen: 10, bonus: ["400 Vitalité", "1 Portée", "70 Prospection"], parents: ["Prune", "Turquoise"] },
  { name: "Prune et Emeraude", gen: 10, bonus: ["400 Vitalité", "10% Critique", "1 Portée"], parents: ["Prune", "Emeraude"] },
];

// ---------------------------------------------------------------------------
// Derived lookups
// ---------------------------------------------------------------------------
export const COLOR_BY_NAME: ReadonlyMap<string, ColorDef> = new Map(COLORS.map((c) => [c.name, c]));
export const BASE_COLORS: ReadonlyArray<string> = COLORS.filter((c) => !c.parents).map((c) => c.name);
export const MAX_GEN = 10;

/** Fold to a comparable key: lower-case, accent-stripped (so "amande" ≡ "Amande", "ebene" ≡ "Ebène"). */
const colorKey = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const COLOR_BY_KEY: ReadonlyMap<string, string> = new Map(COLORS.map((c) => [colorKey(c.name), c.name]));

/** Resolve loose user input (case/accent-insensitive) to a canonical colour name, or null if unknown.
 *  E.g. "amande" → "Amande", "ebene et rousse" → "Ebène et Rousse". */
export function resolveColor(input: string): string | null {
  return COLOR_BY_KEY.get(colorKey(input)) ?? null;
}

/** Per-generation accent colour for the UI. */
export const GEN_COLOR: Record<number, string> = {
  1: "#8d9bb5", 2: "#e8607a", 3: "#9b8cff", 4: "#57c4f2", 5: "#c06bff",
  6: "#f2a857", 7: "#f5d04a", 8: "#5fe3c0", 9: "#57f287", 10: "#ffd700",
};

// ---------------------------------------------------------------------------
// Planner — pure solver over the recipe DAG.
//
// Fertility = 1: every cross permanently sterilises BOTH parents, so no bred
// dragodinde can be reused as a parent. Obtaining one fresh instance of a
// colour therefore requires building its entire recipe sub-tree from scratch.
//
// A "sink" colour is never an ingredient of any recipe, so nothing produces it
// as a by-product — every sink must be bred explicitly. The non-sink colours
// are all obtained for free as ancestors of some sink. Hence the minimal plan
// to own >=1 of every colour = build every sink, and `demand[c]` below is the
// exact number of fresh instances of `c` that must be produced.
// ---------------------------------------------------------------------------

/** Per-generation breeding policy: the level BOTH parents are raised to + optimakina. */
export interface GenPolicy {
  readonly level: number; // 1..200, assumed for both parents of this cross
  readonly optima: boolean; // optimakina (+10%)
}

/**
 * Target-generation success rate for a single cross.
 * Base 30% + 0.15%/level per parent (both at `level` => +0.30%×level) + 10% optimakina,
 * capped at 100%. Source: guide-de-l-eleveur, section "Génération cible".
 */
export function successForLevel(level: number, optima: boolean): number {
  const lvl = Math.min(200, Math.max(1, Math.round(level)));
  const raw = 0.3 + 0.0015 * (2 * lvl) + (optima ? 0.1 : 0);
  return Math.min(1, Math.round(raw * 1e6) / 1e6); // round away float noise (0.3+0.6+0.1 != 1)
}

/**
 * Recommended tiered policy — the time/effort sweet spot.
 *
 * A miss is never "free": the off-target baby you reuse still needs a full fertility raise,
 * so low success multiplies the number of dragodindes you must raise at EVERY generation.
 * Level 100 + optimakina (≈70%) is the knee of the XP curve and roughly halves the count vs
 * an un-levelled cross; the top generations (8–10) are the most expensive to rebuild on a
 * miss, so they're maxed to level 200 (≈100%) to guarantee them.
 */
export function defaultPolicy(): Record<number, GenPolicy> {
  const pol: Record<number, GenPolicy> = {};
  for (let g = 2; g <= MAX_GEN; g++) {
    if (g <= 7) pol[g] = { level: 100, optima: true };
    else pol[g] = { level: 200, optima: true };
  }
  return pol;
}

export interface PlanOptions {
  /** Cap the target generation (2..10). Default 10 = unlock everything. */
  readonly maxGen: number;
  /** Per-generation level/optimakina policy, keyed by the generation being PRODUCED. */
  readonly policy: Readonly<Record<number, GenPolicy>>;
  /** Assume the female parent carries the Reproducteur capacity (+1 baby/cross). */
  readonly reproducteur: boolean;
  /** USABLE (non-sterile, non-keeper) stock per colour — covers parent-uses. */
  readonly inventory: Readonly<Record<string, number>>;
  /** TOTAL owned per colour (any state, incl. keepers/steriles) — satisfies the "own >=1" sink.
   *  Defaults to `inventory` when omitted (back-compat). */
  readonly ownedAny?: Readonly<Record<string, number>>;
  /** Recycle pairs of same-colour sterile parents into one fresh fertile via Clonage. */
  readonly clonage: boolean;
  /** Model the gender constraint (each cross needs ♂+♀; bred babies are random gender). */
  readonly gender: boolean;
}

export interface PlanRow {
  readonly name: string;
  readonly gen: number;
  readonly count: number; // fresh instances to breed/capture from scratch (= `fresh`)
  readonly fresh: number; // bred/captured from scratch
  readonly cloned: number; // recovered via Clonage (2 sterile -> 1 fertile)
  readonly cumulative: number; // running fresh total within this generation list
  readonly recipe: readonly [string, string] | null;
}

export interface GenGroup {
  readonly gen: number;
  readonly rows: ReadonlyArray<PlanRow>;
  readonly total: number; // fresh produced this gen
  readonly cumulativeTotal: number; // cumulative fresh across all gens up to & incl. this one
}

export interface Plan {
  readonly groups: ReadonlyArray<GenGroup>;
  readonly demand: Readonly<Record<string, number>>; // fresh per colour (floor)
  readonly consumed: Readonly<Record<string, number>>; // times each colour is used as a parent (floor)
  readonly baseCaptures: Readonly<Record<string, number>>;
  readonly totalCaptures: number;
  readonly totalCrosses: number;
  readonly totalInstances: number; // dragodindes that come into existence (captures + crosses + clones)
  readonly totalRaises: number; // of those, how many must be raised to féconde (= used as a parent)
  readonly totalClones: number;
  readonly totalGenderBuffer: number; // extra bred to guarantee both genders
  readonly colorsCount: number;
  // Expected counts under the per-generation policy (with retries; Clonage absorbs steriles).
  readonly expectedCaptures: number;
  readonly expectedCrosses: number;
  readonly expectedInstances: number;
  readonly expectedClones: number;
  // Effective per-generation success rate derived from the policy (for display).
  readonly genSuccess: Readonly<Record<number, number>>;
}

const babiesPerCross = (reproducteur: boolean) => (reproducteur ? 2 : 1);

interface SolveResult {
  readonly fresh: Record<string, number>; // bred/captured from scratch (incl. gender buffer)
  readonly cloned: Record<string, number>; // recovered via Clonage of a same-colour sterile pair
  readonly genderBuffer: Record<string, number>; // extra bred to guarantee both genders
  readonly consumed: Record<string, number>; // times this colour is used as a parent across the plan
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
const genderHedge = (fr: number): number => (fr > 0 && fr <= 2 ? 1 : 0);

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
  ownedAny: Readonly<Record<string, number>>,
): SolveResult {
  const consumed: Record<string, number> = {};
  const fresh: Record<string, number> = {};
  const cloned: Record<string, number> = {};
  const genderBuffer: Record<string, number> = {};
  for (const c of targets) consumed[c.name] = 0;

  for (const c of [...targets].sort((a, b) => b.gen - a.gen)) {
    const n = c.name;
    const sink = used.has(n) ? 0 : 1;
    // The SINK term ("own >=1 of this colour") is satisfied by ANY owned copy — including a
    // keeper or a sterile (a colour you hold counts as obtained). Parent-uses (consumed) can
    // only be covered by USABLE (non-sterile, non-keeper) stock. sink and consumed are mutually
    // exclusive (a sink is never a parent), so picking the right inventory per role is exact.
    const owned = sink > 0 ? (ownedAny[n] ?? 0) : (inventory[n] ?? 0);
    const need = Math.max(0, consumed[n] + sink - owned);
    // Clonage recycles a colour's own steriles (from its parent-uses) in pairs. You can't
    // clone until 2 steriles exist and the final leftover sterile is always stranded, so
    // `f` fresh yield only 2f-1 uses => usable clones = floor((consumed-1)/2), not floor/2.
    const clUsed = clonage && consumed[n] >= 2 ? Math.floor((consumed[n] - 1) / 2) : 0;
    let fr = Math.max(0, need - clUsed);
    // Gender hedge: only for BRED colours that are reused as a parent (base colours are
    // captured at the gender you want, sinks are kept regardless of gender).
    const buf =
      gender && c.parents && consumed[n] > 0 && fr > 0 ? genderHedge(fr) : 0;
    fr += buf;
    fresh[n] = fr;
    cloned[n] = clUsed;
    genderBuffer[n] = buf;
    if (c.parents && fr > 0) {
      const p = Math.max(0.05, pForGen(c.gen));
      const attempts = Math.ceil(fr / babies) / p; // crosses incl. retries; each eats 1 of each parent
      consumed[c.parents[0]] += attempts;
      consumed[c.parents[1]] += attempts;
    }
  }
  return { fresh, cloned, genderBuffer, consumed };
}

/** Compute the cumulative breeding plan for "own >=1 of every colour <= maxGen". */
export function computePlan(opts: PlanOptions): Plan {
  const targets = COLORS.filter((c) => c.gen <= opts.maxGen);
  const used = new Set<string>();
  for (const c of targets) if (c.parents) used.add(c.parents[0]), used.add(c.parents[1]);
  const babies = babiesPerCross(opts.reproducteur);

  const genSuccess: Record<number, number> = {};
  for (let g = 2; g <= opts.maxGen; g++) {
    const pol = opts.policy[g] ?? { level: 200, optima: true };
    genSuccess[g] = successForLevel(pol.level, pol.optima);
  }

  // Floor: success = 100% everywhere. Expected: per-generation policy success.
  const ownedAny = opts.ownedAny ?? opts.inventory;
  const floor = solve(targets, used, babies, opts.clonage, opts.gender, () => 1, opts.inventory, ownedAny);
  const exp = solve(
    targets, used, babies, opts.clonage, opts.gender, (g) => genSuccess[g] ?? 1, opts.inventory, ownedAny,
  );

  const req = floor.fresh;
  const isBase = (n: string) => COLOR_BY_NAME.get(n)?.parents == null;

  // Group floor demand by generation, cumulative (by fresh production).
  const groups: GenGroup[] = [];
  let runningAll = 0;
  for (let g = 1; g <= opts.maxGen; g++) {
    const rows: PlanRow[] = [];
    let cum = 0;
    for (const c of targets.filter((c) => c.gen === g).sort((a, b) => req[b.name] - req[a.name])) {
      const count = req[c.name] ?? 0;
      cum += count;
      rows.push({
        name: c.name,
        gen: g,
        count,
        fresh: count,
        cloned: floor.cloned[c.name] ?? 0,
        cumulative: cum,
        recipe: c.parents,
      });
    }
    if (rows.length === 0) continue;
    runningAll += cum;
    groups.push({ gen: g, rows, total: cum, cumulativeTotal: runningAll });
  }

  const sum = (o: Record<string, number>, pred?: (n: string) => boolean) =>
    Object.entries(o).reduce((a, [n, v]) => a + (pred && !pred(n) ? 0 : v), 0);

  const baseCaptures: Record<string, number> = {};
  for (const b of BASE_COLORS) if (b in req) baseCaptures[b] = req[b];

  const totalCaptures = Math.round(sum(floor.fresh, isBase));
  const totalCrosses = Math.round(sum(floor.fresh, (n) => !isBase(n)));
  const totalClones = Math.round(sum(floor.cloned));
  const totalGenderBuffer = Math.round(sum(floor.genderBuffer));
  const totalInstances = totalCaptures + totalCrosses + totalClones;
  // Every cross consumes 2 raised (féconde) parents; the final kept sink copies are NOT raised.
  const totalRaises = 2 * totalCrosses;

  const expectedCaptures = Math.ceil(sum(exp.fresh, isBase));
  const expectedCrosses = Math.ceil(sum(exp.fresh, (n) => !isBase(n)));
  const expectedClones = Math.ceil(sum(exp.cloned));
  const expectedInstances = expectedCaptures + expectedCrosses + expectedClones;

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
    genSuccess,
  };
}
