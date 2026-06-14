export type FuelKey = "serenityMinus" | "serenityPlus" | "endurance" | "maturite" | "amour";
export type StatKey = "endurance" | "maturite" | "amour" | "serenity";
// Focus is keyed by the bar now — every bar (serenity included) is checkable.
export type FocusKey = FuelKey;

export interface Bar {
  key: FuelKey;
  label: string;
  target: StatKey;
  sign: 1 | -1;
  color: string;
}

export interface Stats {
  endurance: number;
  maturite: number;
  amour: number;
  serenity: number;
}

export interface Dragodinde {
  id: number;
  name: string;
  stats: Stats;
  notified: boolean;
}

export interface Enclos {
  id: number;
  name: string;
  fuel: Record<FuelKey, number>;
  focus: FocusKey[];
  dragodindes: Dragodinde[];
}

export interface Meta {
  fuelBars: Bar[];
  focusable: FocusKey[];
  maxFocus: number;
  statMax: number;
  serenityMin: number;
  serenityMax: number;
  serenityGoal: number;
  tickMs: number;
  maxEnclos: number;
  maxDragodindes: number;
}

export interface AppState {
  enclos: Enclos[];
  settings: { webhookConfigured: boolean };
  meta: Meta;
}

export interface EnclosPatch {
  name?: string;
  fuel?: Partial<Record<FuelKey, number>>;
  focus?: FocusKey[];
}

export interface DragoPatch {
  name?: string;
  stats?: Partial<Record<StatKey, number>>;
}
