import type { Species, SpeciesConfig } from '@dd/core'

export type { Species, SpeciesConfig }

export type FuelKey = 'serenityMinus' | 'serenityPlus' | 'endurance' | 'maturite' | 'amour'
export type StatKey = 'endurance' | 'maturite' | 'amour' | 'serenity'
// Focus is keyed by the bar now — every bar (serenity included) is checkable.
export type FocusKey = FuelKey

export interface Bar {
  key: FuelKey
  label: string
  target: StatKey
  sign: 1 | -1
  color: string
}

export interface Stats {
  endurance: number
  maturite: number
  amour: number
  serenity: number
}

export type Sex = 'M' | 'F'
export type ReproStatus = 'sterile' | 'fertile' | 'feconde'

export interface Mount {
  id: number
  species: Species
  name: string
  stats: Stats
  notified: boolean
  color: string
  sex: Sex
  status: ReproStatus
  keeper: boolean
  enclosId: number | null // null = in the stable (étable)
  parentA: number | null
  parentB: number | null
  grandparents: string[]
}

/** Back-compat alias — `Mount` is the generic type; existing code may still say `Dragodinde`. */
export type Dragodinde = Mount

export interface Enclos {
  id: number
  name: string
  fuel: Record<FuelKey, number>
  focus: FocusKey[]
  mounts: Mount[]
}

export interface SpeciesMeta {
  species: Species
  label: string
  icon: string
  accent: string
}

export interface Meta {
  fuelBars: Bar[]
  focusable: FocusKey[]
  maxFocus: number
  statMax: number
  serenityMin: number
  serenityMax: number
  serenityGoal: number
  tickMs: number
  maxEnclos: number
  maxMounts: number
  maxDragodindes: number // back-compat alias
  species: SpeciesMeta[]
}

export interface AppState {
  enclos: Enclos[]
  stable: Mount[]
  achievements: Record<Species, string[]>
  settings: {
    webhookConfigured: boolean
    aiConfigured: boolean
    webhookUrl: string
    speciesConfig: SpeciesConfig
  }
  meta: Meta
}

export interface EnclosPatch {
  name?: string
  fuel?: Partial<Record<FuelKey, number>>
  focus?: FocusKey[]
}

export interface DragoPatch {
  name?: string
  stats?: Partial<Record<StatKey, number>>
  color?: string
  sex?: Sex
  status?: ReproStatus
  keeper?: boolean
  grandparents?: string[]
}

export interface ImportRow {
  name?: string
  color: string
  sex: Sex
  status?: ReproStatus
  keeper?: boolean
  grandparents?: string[]
}

export interface SeedInput {
  species?: Species
  color?: string
  sex?: Sex
  status?: ReproStatus
  name?: string
}

export interface CrossInput {
  parentAId: number
  parentBId: number
  color: string
  sex: Sex
  name?: string
}

export interface CloneInput {
  survivorId: number // the mount kept (refreshed to fertile, keeps its sex/colour/lineage)
  consumedId: number // the mount destroyed by the clonage
}
