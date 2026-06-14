// Pure domain logic for the Dragodinde simulation — no Effect, no IO, fully testable.

export const STAT_MAX = 20000; // endurance / maturite / amour cap
export const SERENITY_MIN = -5000; // serenity scale / clamp range
export const SERENITY_MAX = 5000;
export const SERENITY_GOAL = 200; // serenity "done" when within [-200, +200]
export const FUEL_MAX = 100000;
export const MAX_ENCLOS = 6;
export const MAX_DRAGODINDES = 10;
export const MAX_FOCUS = 2; // at most 2 focused stats per enclos (rolling)

export type FuelKey = "serenityMinus" | "serenityPlus" | "endurance" | "maturite" | "amour";
export type StatKey = "endurance" | "maturite" | "amour" | "serenity";
// Focus is now keyed by the bar (FuelKey): every bar — serenity included — is checkable.
export type FocusKey = FuelKey;

export interface Bar {
  readonly key: FuelKey;
  readonly label: string;
  readonly target: StatKey;
  readonly sign: 1 | -1;
  readonly color: string;
}

// Shared fuel bars at the enclos level. Each holds fuel 0..100000 and drains
// every tick, pushing `sign * rate` into every dragodinde's `target` stat.
export const BARS: ReadonlyArray<Bar> = [
  { key: "serenityMinus", label: "Serenity -", target: "serenity", sign: -1, color: "#d36bd1" },
  { key: "serenityPlus", label: "Serenity +", target: "serenity", sign: 1, color: "#d36bd1" },
  { key: "endurance", label: "Endurance", target: "endurance", sign: 1, color: "#f5c518" },
  { key: "maturite", label: "Maturity", target: "maturite", sign: 1, color: "#3aa5f0" },
  { key: "amour", label: "Love", target: "amour", sign: 1, color: "#e8607a" },
];

export const FUEL_KEYS: ReadonlyArray<FuelKey> = BARS.map((b) => b.key);
export const FOCUSABLE: ReadonlyArray<FocusKey> = FUEL_KEYS; // every bar can be focused/checked
const BAR_BY_KEY: Record<FuelKey, Bar> = Object.fromEntries(BARS.map((b) => [b.key, b])) as Record<
  FuelKey,
  Bar
>;

export interface Stats {
  readonly endurance: number;
  readonly maturite: number;
  readonly amour: number;
  readonly serenity: number;
}

export interface Dragodinde {
  readonly id: number;
  readonly name: string;
  readonly stats: Stats;
  readonly notified: boolean;
}

export interface Enclos {
  readonly id: number;
  readonly name: string;
  readonly fuel: Readonly<Record<FuelKey, number>>;
  // Focus lives on the enclos and applies to every dragodinde inside it.
  readonly focus: ReadonlyArray<FocusKey>;
  readonly dragodindes: ReadonlyArray<Dragodinde>;
}

/** Fuel value -> units gained/lost this tick (and units the fuel bar drains). */
export const bandRate = (fuel: number): number => {
  if (fuel > 90000) return 40;
  if (fuel > 70000) return 30;
  if (fuel > 40000) return 20;
  if (fuel > 0) return 10;
  return 0;
};

export const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

export const emptyFuel = (): Record<FuelKey, number> => ({
  serenityMinus: 0,
  serenityPlus: 0,
  endurance: 0,
  maturite: 0,
  amour: 0,
});

export const DEFAULT_FOCUS: ReadonlyArray<FocusKey> = ["endurance", "amour"];

export const makeDragodinde = (id: number, name?: string): Dragodinde => ({
  id,
  name: name ?? `Dragodinde ${id}`,
  stats: { endurance: 0, maturite: 0, amour: 0, serenity: 0 },
  notified: false,
});

/** Has this bar driven its target to its goal? Serenity goal = inside the [-100,100] band. */
export const barGoalReached = (bar: Bar, stats: Stats): boolean => {
  if (bar.target === "serenity") return Math.abs(stats.serenity) <= SERENITY_GOAL;
  return stats[bar.target] >= STAT_MAX;
};

/** A dragodinde is done when every checked (focused) bar has reached its goal. */
export const focusAllMaxed = (focus: ReadonlyArray<FocusKey>, stats: Stats): boolean =>
  focus.length > 0 && focus.every((k) => barGoalReached(BAR_BY_KEY[k], stats));

/** Only checked (focused) bars drain and feed — serenity bars included. */
export const barActive = (bar: Bar, focus: ReadonlyArray<FocusKey>): boolean =>
  (focus as ReadonlyArray<string>).includes(bar.key);

const gainStats = (stats: Stats, rates: Record<FuelKey, number>): Stats => {
  const next: Record<StatKey, number> = { ...stats };
  for (const bar of BARS) {
    const r = rates[bar.key];
    if (r <= 0) continue;
    const delta = r * bar.sign;
    if (bar.target === "serenity") {
      next.serenity = clamp(next.serenity + delta, SERENITY_MIN, SERENITY_MAX);
    } else {
      next[bar.target] = Math.min(STAT_MAX, next[bar.target] + delta);
    }
  }
  return next;
};

/**
 * Advance one enclos by a single tick: drain the shared fuel once, and apply the
 * gains to every dragodinde. Returns the new enclos and the dragodindes that
 * *just* completed (rising edge), so the caller can send a grouped notification.
 */
export const tickEnclos = (e: Enclos): { enclos: Enclos; completed: ReadonlyArray<Dragodinde> } => {
  const rates: Record<FuelKey, number> = { ...emptyFuel() };
  const fuel: Record<FuelKey, number> = { ...e.fuel };
  for (const bar of BARS) {
    // A bar ticks only if it's checked AND at least one dragodinde still needs
    // its goal — once every dragodinde has maxed it, the bar stops draining.
    const needed = e.dragodindes.some((d) => !barGoalReached(bar, d.stats));
    const r = barActive(bar, e.focus) && needed ? bandRate(e.fuel[bar.key]) : 0;
    rates[bar.key] = r;
    fuel[bar.key] = Math.max(0, e.fuel[bar.key] - r);
  }

  const completed: Array<Dragodinde> = [];
  const dragodindes = e.dragodindes.map((d) => {
    const stats = gainStats(d.stats, rates);
    const done = focusAllMaxed(e.focus, stats);
    if (done && !d.notified) completed.push({ ...d, stats, notified: true });
    return { ...d, stats, notified: done };
  });

  // Auto-uncheck any focused bar whose goal is now reached by EVERY dragodinde.
  const focus =
    dragodindes.length > 0
      ? e.focus.filter((k) => !dragodindes.every((d) => barGoalReached(BAR_BY_KEY[k], d.stats)))
      : e.focus;

  return { enclos: { ...e, fuel, dragodindes, focus }, completed };
};
