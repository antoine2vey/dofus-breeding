# Multi-Species Mount Feature — Final Implementation Plan

## 1. Overview & Agreed Design

We are generalizing the app from a single-species "Dragodinde" breeder to a **multi-species Mount** breeder supporting `dragodinde`, `muldo`, and `volkorne`. This is an **all-in-one landing**: refactor + both new species' verified color data + UI + cross-species arbiter, shipped together. All breeding mechanics are **reused unchanged** (sex, 3-state repro stérile/fertile/féconde, tick/fuel/focus, keeper, cloning, extraction, odds formula).

Agreed (non-negotiable) decisions:

1. **Core model:** `Dragodinde` → generic `Mount` with `species: 'dragodinde'|'muldo'|'volkorne'`. A single `SPECIES` registry parameterizes everything per-species.
2. **Enclos are species-agnostic:** one pen holds a mix of species; fuel/focus/gauges identical; **breeding pairs are same-species only**. The 6×10 enclos pool is ONE shared slot pool.
3. **Recommendation:** keep `recommend()`, parameterize by species; add a thin **arbiter** that runs `recommend()` per enabled species and greedily allocates the shared free slots into ONE cross-species ranked list.
4. **Settings fully per-species:** `{ enabled, targetGen, level, optimakina, clonage, priority }` per species, stored as JSON in `user_settings.species_config`. Arbiter only considers enabled species.
5. **Arbiter rank:** `score = value(action)/speciesMaxValue[species] * priority[species]`; greedy fill until shared slots exhausted.
6. **UI hybrid:** global species selector drives PER-species reference tabs (Succès, Naming, Roster, Odds, BreedingTree). Herd/Enclos/Assistant stay CROSS-species with a per-card species badge.
7. **Naming:** names do NOT encode species; `buildName/parseName` take a species arg. Import is species-scoped. Existing in-game drago names stay valid (drago letter table unchanged).
8. **Color data:** generate verified `colors.muldo.ts` / `colors.volkorne.ts` + per-species unique letter codes.
9. **Persistence:** safe idempotent migration on a LIVE multi-user DB — `dragodinde` table → `mount` + species column; achievement PK → `(user_id, species, color)`; `species_config` JSON on `user_settings`; enclos unchanged.
10. **Delivery:** single landing, mechanics fully reused.

**KNOWN DATA FACTS:** maxGen 10 for all three. Bases: drago 3 (Amande/Dorée/Rousse), muldo 5 (Ebène/Indigo/Pourpre/Orchidée/Doré @ Bassin des Muldos via "Filet de capture de muldo"), volk 4 (Ebène/Indigo/Pourpre/Orchidée @ Haras de Brakmar). **Color names overlap across species** — this is the central correctness hazard threaded through this whole plan.

---

## Conflict resolutions (decided here — do not relitigate)

The subsystem maps disagreed on several load-bearing contracts. Resolved as follows:

| Conflict | Decision | Rationale |
|---|---|---|
| **API route paths** (`/api/dragodinde*` vs `/api/mount*`, `/api/recommend` vs `/api/arbiter`) | **KEEP all existing paths.** Species rides in the request body. Add a NEW `/api/arbiter` endpoint *alongside* `/api/recommend` (recommend stays for per-species Odds tab). | Single private client; renaming forces lockstep client edits and a deploy window where stale `web/dist` 404s every mutation (`npm run dev` does NOT rebuild web). `api.ts json()` only special-cases 401/500 → 404s are silent. |
| **`Enclos.dragodindes` field name** | **RENAME → `Enclos.mounts`** atomically across ALL consumers, INCLUDING `web/src/util.ts` (lines 35, 52, 116). | Honest name for a mixed pool; cannot be aliased on an interface. The all-in-one landing makes the atomic rename viable. |
| **`util.ts`** | **In scope** — 3 trivial edits (`enclos.dragodindes` → `enclos.mounts`). No species threading. | Reads the renamed field; otherwise unchanged (agnostic gauge layer). |
| **Function arg order** | **species-FIRST** everywhere: `buildName(species, parts)`, `parseName(species, name)`, `crossOdds(species, a, b, sum, optima)`, `colorCode(species, color)`, `genOf(species, color)`, `resolveColor(species, input)`. | Matches the SPECIES-registry mental model and the Repo's stated `buildName(species, parts)`. |
| **`AppState.achievements` shape** | **`Record<Species, string[]>`.** `/api/state` returns per-species map; `App.tsx` passes `achievements[species]` to `SuccesTab`. | Colors overlap across species → a flat set conflates succès. PK is `(user_id, species, color)`. |
| **Letter codes** | **SINGLE lowercase ASCII letters per species** (15 muldo / 19 volk pures both fit in 26). Bicolor = concatenation of two single letters (2 chars total). | The existing `parseName` guard is `/^[a-z]{1,2}$/` (lowercase, max 2) and `colorCode` concatenates with NO separator (naming.ts:46). 2-letter/mixed-case codes are un-parseable. |
| **`optimakina` vs `optima`** | Persisted/DTO field is **`optimakina`**; map it to core's `GenPolicy.optima` explicitly at the boundary with a typed (non-`any`) parse. | A silent index mismatch breaks the settings round-trip with no type error. |
| **Migration starting fixture** | **`data.remote-snapshot.db`** (PRE-multi-user: `achievement(color PRIMARY KEY)`, legacy `settings` table, no `user_id`, no `idx_dragodinde_user`) is the worst case and the canonical test/dry-run fixture — NOT `data.db` (already multi-user). | Verified on disk. The species migration must chain on top of the existing multi-user migration in one boot from this state. |

---

## 2. Architecture changes

### 2.1 The `SPECIES` registry (`packages/core/src/species.ts`)

The single source of truth that parameterizes per-species data. Lives in core, re-exported via `@dd/core`.

```ts
import type { ColorDef } from './colors.js'

export type Species = 'dragodinde' | 'muldo' | 'volkorne'
export const SPECIES_LIST: readonly Species[] = ['dragodinde', 'muldo', 'volkorne']

export interface CaptureDef { readonly label: string; readonly location: string; readonly item: string }

export interface SpeciesDef {
  readonly species: Species
  readonly label: string
  readonly icon: string                 // emoji glyph for badges/Discord
  readonly accent: string               // CSS accent hue
  readonly colors: readonly ColorDef[]
  readonly baseColors: readonly string[]
  readonly maxGen: number               // 10 for all three
  readonly letters: Readonly<Record<string, string>>  // color -> single lowercase code
  readonly loWeightBases: readonly string[]            // drago ['Dorée']; muldo ['Doré']; volk []
  readonly genColor: Readonly<Record<number, string>>  // per-species GEN_COLOR accents
  readonly capture: CaptureDef
}

export const SPECIES: Record<Species, SpeciesDef> = { dragodinde: {...}, muldo: {...}, volkorne: {...} }

// Derived, memoized once per species (NOT recomputed in odds/naming/recommend):
interface SpeciesData extends SpeciesDef {
  readonly byName: ReadonlyMap<string, ColorDef>
  readonly letterToBase: Readonly<Record<string, string>>  // code -> color
  readonly recipe: ReadonlyMap<string, string>             // pairKey -> child
  readonly potential: Readonly<Record<string, number>>     // spine map
}
const SPECIES_DATA: Record<Species, SpeciesData> = /* SPECIES_LIST.map(buildData) */

// Accessors (species-first):
export const colorsOf   = (s: Species) => SPECIES_DATA[s].colors
export const byNameOf   = (s: Species) => SPECIES_DATA[s].byName
export const baseColorsOf = (s: Species) => SPECIES_DATA[s].baseColors
export const maxGenOf   = (s: Species) => SPECIES_DATA[s].maxGen
export const genColorOf = (s: Species) => SPECIES_DATA[s].genColor
export const recipeOf   = (s: Species) => SPECIES_DATA[s].recipe
export const potentialOf = (s: Species) => SPECIES_DATA[s].potential
export const lettersOf  = (s: Species) => SPECIES_DATA[s].letters
export const codeToColorOf = (s: Species) => SPECIES_DATA[s].letterToBase

// Per-species settings (the species_config column):
export interface SpeciesSettings {
  readonly enabled: boolean; readonly targetGen: number; readonly level: number
  readonly optimakina: boolean; readonly clonage: boolean; readonly priority: number
}
export type SpeciesConfig = Record<Species, SpeciesSettings>
export function defaultSpeciesConfig(): SpeciesConfig  // dragodinde enabled:true; muldo/volk enabled:false

// Herd-independent spine value used by the arbiter normalizer:
export const spineValue = (s: Species, color: string) => 3 ** genOf(s, color)
```

The `dragodinde` entry wraps the **existing** `COLORS`/`BASE_COLORS`/`MAX_GEN`/`BASE_LETTER`/`GEN_COLOR` verbatim so drago behavior is byte-identical.

### 2.2 The `Mount` type (`src/domain.ts`)

```ts
export interface Mount {
  readonly id: number
  readonly species: Species   // NEW, right after id
  readonly name: string
  // ...all other fields byte-identical (stats/notified/color/sex/status/keeper/enclosId/parentA/parentB/grandparents)
}
export type Dragodinde = Mount   // temporary alias during landing; remove in follow-up

export interface Enclos {
  // ...name/fuel/focus unchanged
  readonly mounts: readonly Mount[]   // was `dragodindes`
}

export const MAX_MOUNTS = 10
export const makeMount = (id: number, species: Species, name?: string): Mount => ({
  id, species, name: name ?? `${SPECIES[species].label} ${id}`, /* ...same defaults */
})
```

### 2.3 The arbiter (`packages/core/src/arbiter.ts`)

Cross-species allocator. **Critical math corrections** (from the engine review):

- **`speciesMaxValue` must be herd-INDEPENDENT** = `3 ** targetGen` (NOT `max value()` — `value()` closes over live demand and includes `+1e6` for unobtained colors at recommend.ts:120, so it drifts and explodes the normalizer).
- **Numerator uses `spineValue` of the score-driver color, NOT `BreedAction.score`** (which is a sum of `prob*value` over outcomes and is incomparable across species).
- **Slot ledger:** breeding consumes **0** shared slots (it pairs two already-féconde mounts that get sterilised, freeing their slots, and yields one baby). **Raise/capture/clone-survivor placement** consumes 1 slot each. **Extract frees** capacity (0 cost). Do NOT debit the empty-slot pool for breeding.

```ts
export interface ArbiterInput {
  readonly config: SpeciesConfig
  readonly mountsBySpecies: Record<Species, readonly InvMount[]>   // pre-partitioned by species
  readonly achievementsBySpecies: Partial<Record<Species, readonly string[]>>
  readonly freeSlots: number   // shared empty slots in the 6x10 pool
}
export interface ArbiterAction {
  readonly species: Species
  readonly kind: 'breed' | 'clone' | 'capture' | 'extract'
  readonly score: number       // normalized: spineValue(driver)/3^targetGen * priority
  readonly rawValue: number
  readonly breed?: BreedAction; readonly capture?: CaptureAction; readonly recycle?: RecycleAction
}
export interface ArbiterResult {
  readonly perSpecies: Record<Species, Recommendation>
  readonly ranked: readonly ArbiterAction[]      // score desc, cross-species
  readonly allocated: readonly ArbiterAction[]   // greedy fill until slots exhausted
  readonly usedSlots: number; readonly freeSlots: number
}
export function arbitrate(input: ArbiterInput): ArbiterResult
```

Algorithm: for each enabled species → `cheptelAccounting(species, …)` once → `recommend(species, {…, accounting})` (uncapped). Normalize each candidate `score = spineValue(species, driverColor) / 3**targetGen * priority`. Merge all species' actions, sort desc → `ranked`. Greedy: walk `ranked`, debit slots only for raise/capture/clone-survivor placements, until `freeSlots` exhausted → `allocated`.

---

## 3. File-by-file change list

### Layer A — core package (`packages/core/src/`)

| File | Changes | Symbols / lines | Risk |
|---|---|---|---|
| `species.ts` **(NEW)** | The registry + `SpeciesData` derived lookups + `SpeciesSettings`/`SpeciesConfig`/`defaultSpeciesConfig` + accessors + `spineValue`. | whole file | med |
| `colors.dragodinde.ts` **(NEW)** | Move existing `COLORS` array verbatim → `export const DRAGODINDE_COLORS`. | extracted from colors.ts:10–392 | low |
| `colors.muldo.ts` **(NEW)** | Generated muldo `MULDO_COLORS` (5 bases, maxGen 10). | new | high |
| `colors.volkorne.ts` **(NEW)** | Generated volkorne `VOLKORNE_COLORS` (4 bases, maxGen 10). | new | high |
| `colors.ts` | Re-import `DRAGODINDE_COLORS` for `export const COLORS = DRAGODINDE_COLORS` (back-compat alias). Keep `ColorDef`/`GenPolicy`/`PlanOptions`/`Plan`/`solve`/`successForLevel`/`genderHedge` UNCHANGED. Parameterize: `resolveColor(species, input)`, `defaultPolicy(species)`, `computePlan(species, opts)` (targets = `colorsOf(species)`, `isBase`/`byName` via registry at line 652). `GEN_COLOR`/`BASE_COLORS`/`MAX_GEN`/`COLOR_BY_NAME` stay as drago-aliases. | 397–413, 416–427, 469–476, 616–715 | med |
| `odds.ts` | `crossOdds(species, a, b, sum, optima)`; `baseWeight(species, name)` — replace hardcoded `name === 'Dorée' ? 2` (line 25) with `SPECIES[species].loWeightBases.includes(name)`. Fetch `recipeOf(species)`/`byNameOf(species)` inside, drop module-level RECIPE (19–21). `genOf(species, race)`. Keep `Mount`/`CrossResult`/`pTargetFor`. | 8, 19–25, 38–39, 66–112 | med |
| `naming.ts` | `colorCode(species, color)`, `codeToColor(species)`, `buildName(species, p)`, `parseName(species, name)`, `genOf(species, color)`, `colorCodesOf(species)`, `baseLetterOf(species)` — all back per-species via `SPECIES_DATA`. Keep `validateInGame`/`MAX_LEN`/`ALLOWED`/`inGameSortKey`/`inGameCompare`/`NameParts`/`Sex` species-agnostic. **Keep `parseName` regex `/^[a-z]{1,2}$/` and concat tokenizer UNCHANGED** — letter codes are single lowercase letters. `BASE_LETTER`/`COLOR_CODES` stay as drago-aliases. | 24–56, 80–85, 99–123, 125, 154–158 | high |
| `cheptel.ts` | `cheptelAccounting(species, input)` — done-filter (42) `byNameOf(species)`, MAX_GEN loop (58) `maxGenOf(species)`, `computePlan(species, …)` (59). `StockMount` stays species-free; caller pre-filters to one species. | 5, 41–69 | low |
| `recommend.ts` | `recommend(species, input)`: `BASES`(10)→`baseColorsOf(species)`; `POTENTIAL`(13)→`potentialOf(species)`; `genOf(species, …)`; capture loop (206) iterates `baseColorsOf(species)`. **Hoist+export `value(species, race, ctx)`** (from closure 116–122). **Export `speciesMaxValue(species, targetGen) = 3**targetGen`** (herd-independent, NO `+1e6`). `crossOdds(species, …)` (140–152). CaptureAction reason carries `SPECIES[species].capture.label`. | 10, 13–20, 22, 92–122, 140–152, 206–231 | high |
| `arbiter.ts` **(NEW)** | `arbitrate(input)` per §2.3. Slot ledger: breed=0, raise/capture/clone-survivor=1, extract=0. | new | high |
| `assistant.ts` | Roadmap PER-species (loop enabled species → `roadmaps: Record<Species,Roadmap>`, each tagged species; `genOf(species)`, `colorsOf(species)`). Next-step CROSS-species via `arbitrate()`. **`want`/`ripening`/`byColor` maps MUST be keyed by `${species}|${color}`** (overlap hazard at 164–178). Tag every action with species. `ENCLOS_CAP=10` unchanged. | 11–15, 101–237, 248–265 | high |
| `sim.ts` | `SimConfig` gains `species`. `genOf(species)`, `BASE`→`baseColorsOf(species)`, `targetColorFor` filters `colorsOf(species)`, `crossOdds(species, …)`, `byNameOf(species)`, `monteCarlo` BASE loop. Mechanics unchanged. | 9, 12, 47, 50–58, 76–81, 114, 188 | med |
| `index.ts` | Add `export * from './species.js'` and `export * from './arbiter.js'`. Keep all existing exports (drago aliases). | barrel | low |

### Layer B — backend (`src/`)

| File | Changes | Symbols / lines | Risk |
|---|---|---|---|
| `domain.ts` | `Dragodinde`→`Mount` (56) + `readonly species: Species` after id; `type Dragodinde = Mount` alias. `MAX_DRAGODINDES`(13)→`MAX_MOUNTS` (keep alias). `makeDragodinde`(104)→`makeMount(id, species, name?)`, default name `SPECIES[species].label`. `Enclos.dragodindes`(80)→`mounts`. Thread rename through `tickEnclos`(162–199)/`advanceEnclos`(205–224): `e.dragodindes`→`e.mounts`, `{...e, dragodindes,...}`→`{...e, mounts,...}` (198). Algorithm byte-identical. Line 3 import → mixed `import { SPECIES, type ReproStatus, type Species }`. | 1–5, 13, 56–81, 104–117, 162–224 | high |
| `Repo.ts` | The migration (see §5) + `DragoRow` gains `species: string` (45–63); `dragoFromRow` populates `species: normalizeSpecies(r.species)` (71–89); `InsertOpts.species?` + `insertDrago` uses `buildName(species, …)`, per-species color validation `byNameOf(species).has(...)` (389), achievement insert `(user_id, species, color)`; `CrossInput.species` + **same-species parent guard** in `recordCross` (553); `recordClone` per-species gen lookup via `byNameOf(normalizeSpecies(r.species))` + same-species guard (602); `importMounts(mounts, enclosId, species)`; `getAchievements(species)`/`setAchievements(species, colors)` (species-scoped DELETE!); NEW `getSpeciesConfig`/`setSpeciesConfig`; `claimOrphansIfSeedOwner` retarget `dragodinde`→`mount` (952, 963). | extensive | high |
| `Http.ts` | KEEP all route paths. `toAssistMount` (47–59) adds `species: d.species`. `/api/state` (160–191): add `speciesConfig` (`repo.getSpeciesConfig`), `meta.species` registry projection, `achievements: Record<Species,string[]>` (loop enabled species). NEW `/api/arbiter` → `arbitrate()` with SINGLE shared `freeSlots`. `/api/recommend` keeps per-species scoped path (body `species`). `/api/assistant/plan` body `species` (default drago). `/api/settings` accepts `speciesConfig` partial → `setSpeciesConfig`. `/api/achievements` body `{species, colors}`. `/api/import`/`/api/breed`/POST mount: body `species`; breed validates same-species (400 "cross-espèce interdit"). PATCH ignores species (immutable). AiActions: thread species, `ReplyOpts` per-species. | extensive | high |
| `Ai.ts` | System prompt (49–72) species-aware + "demande l'espèce si ambigu". `speciesEnum = z.enum([...])`. `crossOdds`/`suggestName`/`getPlan`/`simulate`/`addMounts` tools gain required `species`. `ReplyOpts` → `{ speciesConfig: Record<Species,{targetGen;level;optimakina;clonage}>; achievements: Record<Species, readonly string[]> }`. | 13–19, 23–47, 49–72, 80–231 | high |
| `Discord.ts` | `completedEmbed` (70–84) per-line `SPECIES[it.dragodinde.species].icon` prefix; neutral noun "N monture(s) prête(s)" for mixed batches with a safe fallback for missing icon. Import `SPECIES`. Transport unchanged. | 1–4, 70–84 | med |
| `Ticker.ts` | No signature change; `CompletedItem` carries species via the row. Verify `sweep` reads `mount` table via `dragoFromRow`. | — | low |

### Layer C — frontend (`web/src/`)

| File | Changes | Risk |
|---|---|---|
| `types.ts` | Add `Species`; `Dragodinde`→`Mount` (+ alias) + `species`; `Enclos.dragodindes`→`mounts`; `SpeciesConfig`; `AppState.settings.speciesConfig`; `AppState.achievements: Record<Species,string[]>`; `ImportRow`/`SeedInput` gain species; `meta.maxDragodindes`→`maxMounts`; `meta.species` registry; `ArbiterResult`/`ArbiterAction`. | high |
| `api.ts` | KEEP route paths/method names. Add `species` to `addDragodinde`/`importMounts` bodies. `setAchievements(species, colors)`. NEW `arbiter(body)` → `/api/arbiter`. NEW `setSpeciesConfig(cfg)` → `/api/settings`. `assistantPlan(species)`. Import `Mount`/`Species`/`ArbiterResult`. | med |
| `App.tsx` | `const [species, setSpecies] = useState<Species>(() => localStorage.getItem('dd-species') ?? 'dragodinde')` + persist effect. Header species selector (gated on `speciesConfig.enabled`, drago always available). Thread `species` into Succès/Naming/Odds/BreedingTree/OnboardingWizard ONLY. Pass `achievements[species]` to SuccesTab. NOT into Herd/Enclos/Assistant. De-hardcode `🐉 Dragodinde Notif` title (lines 20, 137). | med |
| `util.ts` | `enclos.dragodindes` → `enclos.mounts` (lines 35, 52, 116). No species. | low |
| `HerdTab.tsx` | Cross-species. Per-row `SPECIES[m.species ?? 'dragodinde']` for color/gen options + accent. Species badge column + species filter. Count copy "montures". ImportByName gets a local species picker. | high |
| `EnclosWorkspace.tsx` | Import `DragodindePane`→`MountPane`. Drag chip species badge. | low |
| `EnclosPane.tsx` | De-hardcode `🐉` glyph (line 200) + copy. Mechanics unchanged. | low |
| `StablePanel.tsx` | Per-row `genOf(m.species, m.color)` / `genColorOf`. Species badge on chip. | med |
| `DragodindePane.tsx` → **`MountPane.tsx`** | File + component rename. Per-row species badge. De-hardcode "Dragodindes" copy. **Preserve `.drago-row`/`.drago-list` CSS classes** (or rename JSX + `index.css` together). | med |
| `AssistantTab.tsx` | Next-step CROSS-species from arbiter (per-action species badge, `SPECIES[a.species].colors` for selects). Roadmap PER-species (loop). `applyCapture` rows include `species: need.species`. Per-species controls move to settings. | high |
| `ImportByName.tsx` | `species` prop; `parseName(species, line)`; rows carry species; per-species placeholder/copy. | med |
| `SuccesTab.tsx` | `species` prop; `colorsOf(species)`; `genColorOf(species)`; `setAchievements(species, …)`; reset `done`/`sig` on species change (add `species` to dep array line 25). | med |
| `NamingTab.tsx` | `species` prop; `colorCodesOf`/`baseLetterOf`/`genColorOf`/`genOf`/`parseName`/`validateInGame` species-scoped; dynamic count (not "66"); heading `SPECIES[species].label`; pass species to RosterBuilder. | med |
| `RosterBuilder.tsx` | `species` prop; `buildName(species, …)`; `colorCodesOf(species)`; `newRow(species)` default = `baseColorsOf(species)[0]`; reset rows on species change. | med |
| `OddsCalculator.tsx` | `species` prop; race options `colorsOf(species)`; `crossOdds(species, …)`; default mounts from `baseColorsOf(species)[0]`; reset a/b on species change. | med |
| `BreedingTree.tsx` | `species` prop; filter `mounts` to species; `colorsOf`/`colorByName`/`genColorOf`/`crossOdds`/`monteCarlo` species-scoped; **captures card iterate `baseColorsOf(species)`** (hardcoded Amande/Dorée/Rousse at 277–284 breaks); per-species default target; reset on species change. | high |
| `OnboardingWizard.tsx` | `species` prop (default drago, local to wizard) + in-wizard picker; `AI_PROMPT(species)`; forward to ImportByName/RosterBuilder. | med |
| `SettingsDialog.tsx` | New section `'species'`; per-species rows (enabled/targetGen/level/optimakina/clonage/priority); `api.setSpeciesConfig`. Widen `section` union; update App trigger. | med |

### Layer D — tests & tooling

| File | Changes | Risk |
|---|---|---|
| `package.json` | Fold core build into test: `"test": "npm run core:build && vitest run"`. | med |
| `scripts/sync-db.sh` | Line 71 `count(*) FROM dragodinde` → `mount`. (Container/volume names lines 6/8/34/80/83 stay — deploy infra.) | med |
| `test/domain.test.ts` | `Dragodinde`/`makeDragodinde` → `Mount`/`makeMount`. `resolveColor`/`buildName` → species-scoped + overlapping-name cases. Tick tests unchanged. | med |
| `test/repo.test.ts` | Species in fixtures; round-trip muldo; per-species `getAchievements('dragodinde')`; same-species breeding guard; cross-species import. | high |
| `test/migration.test.ts` **(NEW)** | From `data.remote-snapshot.db` schema (PRE-multi-user) AND from data.db state; assert chained migration + idempotency. | high |
| `test/arbiter.test.ts` **(NEW)** | Normalization, greedy shared-slot fill, no mixed-species pairs, disabled species excluded, priority changes ordering. | high |
| `test/assistant.test.ts` | Thread species; per-species COLORS; cross-species arbiter coverage. | high |
| `test/cheptel.test.ts` | Species arg; independence across overlapping names. | high |
| `test/naming.test.ts` | Per-species round-trip (every color); per-species injective-letter adversarial test; `validateInGame` on every generated name. | high |
| `test/odds.test.ts` | Species arg; per-species low-weight base; known muldo/volk recipe. | med |
| `test/recommend.test.ts` | Species arg; species-scoped COLORS; recommend-per-species stays single-species. | med |
| `test/sim.test.ts` | `SimConfig.species`; per-species sanity run. | low |

---

## 4. New files

### `packages/core/src/species.ts`
Registry + derived lookups + settings — see §2.1.

### `packages/core/src/colors.dragodinde.ts`
```ts
import type { ColorDef } from './colors.js'
export const DRAGODINDE_COLORS: readonly ColorDef[] = [ /* current 66 verbatim, moved from colors.ts:10-392 */ ]
```

### `packages/core/src/colors.muldo.ts` / `colors.volkorne.ts`
```ts
import type { ColorDef } from './colors.js'
export const MULDO_COLORS: readonly ColorDef[] = [
  { name: 'Ebène', gen: 1, bonus: ['1 PM','18% Résistance Air'], parents: null },
  // ...gen2..10 with EXACT [a,b] recipes; one canonical recipe per special color
]
export const VOLKORNE_COLORS: readonly ColorDef[] = [ /* 4 bases, gen2..10 */ ]
```
**Precondition:** generated per §6, must pass the DAG adversarial test before being written/committed.

### `packages/core/src/arbiter.ts`
`arbitrate(input)` — see §2.3.

### `web/src/components/MountPane.tsx`
Renamed from `DragodindePane.tsx`; per-row species badge; "Montures" copy; preserves `.drago-row`/`.drago-list` classes.

### `test/migration.test.ts` / `test/arbiter.test.ts`
See §9.

---

## 5. Database migration (`src/Repo.ts` construction block, ~185+)

Runs every boot inside the `Effect.Service` constructor, **before any method is callable**. Every step is **detect-then-act idempotent** via `sqlite_master`/`pragma_table_info`. **The species work CHAINS on top of the existing multi-user migration in one boot** — verified against `data.remote-snapshot.db` which is PRE-multi-user (`achievement(color PRIMARY KEY)`, legacy `settings` table, no `user_id`, no `idx_dragodinde_user`).

> **Wrap each destructive unit in `sql.withTransaction`** so a crash rolls the whole unit back (SQLite supports transactional DDL).

### Ordered steps

**STEP 0 — Enclos table UNCHANGED.** Keep `CREATE TABLE IF NOT EXISTS enclos` + its user_id/ticked_at ensure-blocks verbatim.

**STEP 1 — Rename `dragodinde` → `mount` FIRST (before any pragma snapshot):**
```sql
-- detect
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('dragodinde','mount');
```
- only `dragodinde` present → `ALTER TABLE dragodinde RENAME TO mount` (preserves rows, ids, sqlite_sequence).
- neither present (fresh) → `CREATE TABLE mount (...FULL schema incl. all later-added columns: enclos_id nullable ON DELETE SET NULL, name, 4 stats, notified, color, sex, fertile, keeper, parent_a_id, parent_b_id, grand_a, grand_b, status, user_id, species TEXT NOT NULL DEFAULT 'dragodinde')`.
- both present AND `dragodinde` has rows → **ABORT loudly** (half-migrated; do not silently pick).
- `mount` already present → skip.

> **Then recompute ALL pragma snapshots from `pragma_table_info('mount')`.** Every subsequent `ALTER TABLE`/`UPDATE`/index in the existing migration block (the enclos_id-nullable rebuild → `mount_new`; grandparent backfill subqueries; `ADD COLUMN user_id`; the index) must target `mount`. This is the highest-fanout point — the existing multi-user steps must run against `mount`, not the gone `dragodinde`.

**STEP 2 — Index rename:**
```sql
DROP INDEX IF EXISTS idx_dragodinde_user;
CREATE INDEX IF NOT EXISTS idx_mount_user ON mount(user_id);
```

**STEP 3 — Add species column + backfill:**
```sql
-- guarded by haveCol on 'mount'
ALTER TABLE mount ADD COLUMN species TEXT NOT NULL DEFAULT 'dragodinde';
```
The `NOT NULL DEFAULT 'dragodinde'` backfills all existing rows atomically. (Already inlined into the fresh CREATE and the `mount_new` rebuild schema + its INSERT column list.)

**STEP 4 — Achievement PK rebuild, CHAINED (both rebuilds may fire in one boot):**
```sql
-- detect current shape
SELECT name FROM pragma_table_info('achievement');
```
- **4a** — lacks `user_id` (prod path) → existing single→composite rebuild to `(user_id, color)`, user_id NULL:
  `ALTER TABLE achievement RENAME TO achievement_old; CREATE TABLE achievement(user_id TEXT, color TEXT NOT NULL, PRIMARY KEY(user_id,color)); INSERT INTO achievement(user_id,color) SELECT NULL, color FROM achievement_old; DROP TABLE achievement_old;`
- **4b** — (unconditional, after 4a) lacks `species` → rebuild to `(user_id, species, color)`:
  `ALTER TABLE achievement RENAME TO achievement_old2; CREATE TABLE achievement(user_id TEXT, species TEXT NOT NULL DEFAULT 'dragodinde', color TEXT NOT NULL, PRIMARY KEY(user_id,species,color)); INSERT INTO achievement(user_id,species,color) SELECT user_id,'dragodinde',color FROM achievement_old2; DROP TABLE achievement_old2;`
- Fresh CREATE uses the 3-col composite-PK shape directly.

> Note: `user_id` stays NULL for orphan rows until `claimOrphansIfSeedOwner` sets it by id; species is already `'dragodinde'`. NULL composite-PK rows are permitted (NULL ≠ NULL) — fine because the 25 prod rows have distinct colors.

**STEP 5 — `user_settings.species_config`:** keep `CREATE TABLE IF NOT EXISTS user_settings (... species_config TEXT NOT NULL DEFAULT '{}')` (covers prod, where user_settings is created fresh). For existing data.db: guarded `ALTER TABLE user_settings ADD COLUMN species_config TEXT NOT NULL DEFAULT '{}'`.

**STEP 6 — `claimOrphansIfSeedOwner`:** retarget `dragodinde`→`mount` (952, 963). Achievement claim (964) unchanged.

### Verification checklist (both fixtures)
- **Fresh** (`:memory:` / deleted db): `mount` + 3-col `achievement` + `user_settings.species_config` clean; second boot idempotent.
- **Prod** (`data.remote-snapshot.db` copy): rename preserves rows/ids; `SELECT DISTINCT species FROM mount` == `dragodinde`; `.schema achievement` PK `(user_id,species,color)`, 25 rows `species='dragodinde'`; `user_settings` created WITH `species_config`; enclos unchanged; sqlite_sequence preserved; **second boot no error**.
- **data.db**: only STEP 4b + STEP 5 ALTER fire; exactly ONE user index on `mount`.

---

## 6. Color-data extraction sub-plan

**Feasibility: YES** — both species' gen2..10 recipe sets are scrapeable EXACTLY from dofuspourlesnoobs muldo/volkorne pages. A single broad WebFetch truncates ("and other combinations"); the proven fix is **one narrow WebFetch per generation**, splitting the 50-color gen10 blocks by first-parent.

### Procedure
1. Re-fetch each generation with narrow per-gen prompts (split gen10 by first-parent).
2. For each SPECIAL pure color (gen3/5/7/9, multiple OR-recipes) run a **dedicated single-color fetch**, then **pin ONE canonical recipe** (lowest-gen, lexicographically-first parent pair; both parents must be defined same-species colors). Do NOT trust the fast-model OR-lists verbatim (muldo Azur returned a dup).
3. Fill the two captured PLACEHOLDER-verify bonus strings (muldo gen6 "Turquoise et Emeraude"; volk gen6 "Emeraude et Doré").
4. **Resolve the muldo Emeraude/Prune generation ordering** — captured data places "Turquoise et Emeraude" at gen6 but Emeraude at gen7 (parent gen > child gen = non-DAG). Re-verify the gen index before writing. **This is a hard DAG blocker.**
5. Canonicalize accents per color (`Doré` one-e for muldo/volk vs drago `Dorée`; pick ONE spelling — recipes are exact-match keyed by `COLOR_BY_NAME`).
6. Write `colors.muldo.ts`/`colors.volkorne.ts` mirroring `ColorDef`; reuse the generic planner.
7. **Adversarial DAG test** (write as a test): every non-base has exactly 2 parents that exist with gen < child; gen1 == baseColors with `parents: null`; per-gen counts match catalog (muldo 5/10/2/11/2/16/2/19/4/50; volk 4/6/4/22/2/18/1/10/4/50); no duplicate names; letter map injective; `buildName/parseName` round-trip every color; re-fetch 3–5 random colors/gen and assert byte-for-byte. Only then set `extractionComplete=true`.

### Letter-code allocation (single lowercase letters — REQUIRED by `parseName` `/^[a-z]{1,2}$/` + no-separator concat)

**Muldo pures (15):** Ebène `e`, Indigo `i`, Pourpre `p`, Orchidée `o`, Doré `d`, Roux `r`, Amande `a`, Ivoire `v`, Turquoise `t`, Prune `u`, Emeraude `m`, Ambre `b`, Corail `c`, Azur `z`, Aigue-marine `g`.

**Volkorne pures (19):** Ebène `e`, Indigo `i`, Pourpre `p`, Orchidée `o`, Roux `r`, Amande `a`, Ivoire `v`, Turquoise `t`, Prune `u`, Emeraude `m`, Doré `d`, Jade `j`, Rubis `b`, Saphir `s`, Améthyste `y`, + 4 spare (`f,k,l,n,...`).

Letters are PER-species (overlap across species is fine). Bicolor codes = concatenation of the two single pure codes (canonical "X et Y" order, same as drago). Drago's existing `BASE_LETTER` table is **unchanged** so existing in-game drago names stay valid. Adversarial check before commit: assert each species' map is injective and `buildName/parseName` round-trip every pure code (injectivity of pures ⇒ injectivity of all bicolor names).

---

## 7. Recommended execution order

> Run `npm ci` first (verify node_modules populated). Tests resolve `@dd/core` from `dist`, so **`npm run core:build` must precede `vitest`** (fold into `npm test`). After core/web edits, **`npm run web:build`** (dev does NOT rebuild web).

1. **Color data** — extract + verify `colors.muldo.ts`/`colors.volkorne.ts` (§6); DAG test green. *(Blocking precondition.)*
2. **Letter codes** — single-lowercase per-species tables; injectivity + round-trip green.
3. **`species.ts`** + `colors.dragodinde.ts` extraction + `index.ts` barrel. `core:build`.
4. **`colors.ts`** — parameterize, keep drago aliases. `core:build`.
5. **`odds.ts`** — `crossOdds(species,…)`, `baseWeight(species,…)`.
6. **`naming.ts`** — species-scoped (regex/tokenizer unchanged).
7. **`cheptel.ts`** — `cheptelAccounting(species,…)`.
8. **`recommend.ts`** — `recommend(species,…)`, hoist `value()`, `speciesMaxValue = 3**targetGen`.
9. **`arbiter.ts`** — `arbitrate()`.
10. **`assistant.ts`** (species-qualified maps) + **`sim.ts`**. `core:build` + core tests.
11. **`domain.ts`** — Mount/Enclos.mounts/makeMount rename.
12. **`Repo.ts`** — migration + species-aware methods. Migration test green.
13. **`Http.ts`** + **`Ai.ts`** + **`Discord.ts`**.
14. **Frontend** — `types.ts` → `api.ts` → `App.tsx` → util.ts → rename `MountPane` → cross-species components (badges, guard `m.species ?? 'dragodinde'`) → per-species reference tabs → `SettingsDialog` → `OnboardingWizard`.
15. **`scripts/sync-db.sh`** line 71.
16. **Verify:** `npm run core:build && npm test && npm run typecheck && npm run web:build`, then `npm run format`.
17. **Live migration:** `./scripts/sync-db.sh --dry-run` → boot on snapshot copy → schema asserts → boot twice → row counts → `--push`.

Aliases (`COLORS`/`COLOR_BY_NAME`/`GEN_COLOR`/`BASE_LETTER`/`type Dragodinde`/`MAX_DRAGODINDES`) stay until step 16; final grep confirms zero consumers of bare non-species symbols before any alias removal (deferred to follow-up).

---

## 8. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Migration written against wrong DB picture (prod is PRE-multi-user `achievement(color)` + legacy `settings`) | Blocker | Test/dry-run against `data.remote-snapshot.db`; chain 4a→4b in one boot; rename FIRST then recompute pragmas. |
| Rename vs CREATE-IF-NOT-EXISTS collision | Blocker | Detect via `sqlite_master`; no unconditional `CREATE mount` alongside RENAME; abort if both tables exist with rows. |
| `speciesMaxValue`/numerator wrong (herd-dependent + `+1e6`) | Blocker | `speciesMaxValue = 3**targetGen`; numerator = `spineValue(driverColor)`; never feed `BreedAction.score` cross-species. |
| Slot ledger conflates capacity with breed-count | Blocker | breed=0 slots; raise/capture/clone-survivor=1; extract frees. |
| 2-letter/mixed-case codes incompatible with `parseName` | Blocker | Single lowercase letters; regex/tokenizer unchanged. |
| Color-name overlap silently mis-resolves | Blocker | Every lookup species-scoped via `SPECIES_DATA`; assistant maps keyed `${species}\|${color}`; achievement PK `(species,color)`. |
| muldo Emeraude/Prune gen ordering (non-DAG) + placeholders | Blocker | DAG test gates writing the color modules. |
| `Enclos.dragodindes`→`mounts` highest fanout (incl. util.ts) | Blocker | Atomic rename across all consumers; util.ts in scope; `tsc -b` catches misses. |
| Route mismatch → silent 404s | Major | KEEP all paths; species in body; add `/api/arbiter` alongside. |
| `setAchievements` global DELETE wipes other species | Major | Species-scoped `DELETE ... AND species = ?`. |
| `recordClone`/`insertDrago` use global `COLOR_BY_NAME` | Major | Per-row `byNameOf(normalizeSpecies(r.species))`. |
| Non-atomic DDL crash mid-rebuild | Major | `sql.withTransaction` per destructive unit; back up before deploy. |
| Stale `@dd/core` dist → green tests lie | Major | `"test": "npm run core:build && vitest run"`. |
| Stale `web/dist` after landing | Major | `npm run web:build` as last gate. |
| Per-row `SPECIES[m.species]` throws on pre-migration/optimistic rows | Major | `m.species ?? 'dragodinde'` guard everywhere. |
| Hardcoded drago literals (BreedingTree captures/target, OddsCalculator defaults, RosterBuilder newRow) | Major | Derive from `baseColorsOf(species)`; reset state on species change. |
| `optimakina` vs `optima` silent mismatch | Major | One name in DTO/JSON; typed parse maps to `GenPolicy.optima`. |
| `sync-db.sh` line 71 breaks deploy sanity | Minor | Update to `mount` same commit. |
| Legacy prod `settings.webhook_url` continuity | Minor | Out of species scope; confirm shipped multi-user migration handles it before deploy. |

---

## 9. Test plan

**Changed unit tests** (all thread species, default `'dragodinde'` to preserve existing assertions): `domain` (Mount/makeMount + species-scoped resolveColor incl. overlapping name), `cheptel` (independence across overlapping names), `naming` (per-species round-trip every color + injective-letter adversarial + validateInGame), `odds` (per-species low-weight base + known muldo/volk recipe), `recommend` (single-species only), `sim` (per-species sanity).

**New tests:**
- **`test/arbiter.test.ts`** — two enabled species + small shared `freeSlots`; assert merged ranked order, slot-exhaustion cutoff, breed costs 0 / raise costs 1, no mixed-species pairs, disabled species contributes nothing, priority/`speciesMaxValue` change ordering.
- **`test/migration.test.ts`** — from `data.remote-snapshot.db` schema (PRE-multi-user; seed 25 user_id-less achievements + dragodinde rows): boot once → `mount` with species backfilled, achievement PK `(user_id,species,color)` 25 rows `species='dragodinde'` (user_id NULL), `user_settings` WITH `species_config`, enclos unchanged, sqlite_sequence preserved, post-migration insert id > prev max; boot twice → idempotent. Separate case from data.db (already-2-col) → only 4b + STEP 5 fire, exactly one user index.
- **`test/repo.test.ts`** additions — explicit muldo insert round-trips as `'muldo'` (not defaulted); per-species `getAchievements`; same-species breeding guard (drago × muldo refused); cross-species import under `species='muldo'`.
- **DAG test** (core) — muldo/volk DAG validity + per-gen counts + no duplicates (gates color modules).

**Manual live-migration check (deploy runbook):**
1. `./scripts/sync-db.sh --dry-run` → pull fresh prod snapshot.
2. Copy aside, point `DATABASE_FILE` at copy, boot once → no startup error.
3. `sqlite3` asserts: `.schema mount` has species; `SELECT DISTINCT species FROM mount` == `dragodinde`; `.schema achievement` PK `(user_id,species,color)` all `species='dragodinde'`; `user_settings` has `species_config`; enclos unchanged; row counts preserved (25 achievements).
4. Boot a SECOND time on same copy → idempotent.
5. Verify existing drago in-game names still `parseName('dragodinde', …)` cleanly.
6. Only then `--push`; keep auto `.bak.<stamp>` as rollback.

**Build/verify commands:**
```
npm ci
npm run core:build && npm test
npm run typecheck
npm run web:build
npm run format
./scripts/sync-db.sh --dry-run   # then manual live-migration check before --push
```

---

Relevant absolute paths for execution: `/Users/antoine2vey/projects/dragodinde-notif/packages/core/src/{species,arbiter,colors.dragodinde,colors.muldo,colors.volkorne}.ts`, `/Users/antoine2vey/projects/dragodinde-notif/src/{domain,Repo,Http,Ai,Discord}.ts`, `/Users/antoine2vey/projects/dragodinde-notif/web/src/{App,api,types,util}.ts`, `/Users/antoine2vey/projects/dragodinde-notif/web/src/components/MountPane.tsx`, `/Users/antoine2vey/projects/dragodinde-notif/test/{migration,arbiter}.test.ts`, `/Users/antoine2vey/projects/dragodinde-notif/scripts/sync-db.sh`. Migration fixture: `/Users/antoine2vey/projects/dragodinde-notif/data.remote-snapshot.db`.