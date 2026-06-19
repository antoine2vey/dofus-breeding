import { SqlClient } from '@effect/sql'
import { COLOR_BY_NAME, buildName, parseName } from '@dd/core'
import { Effect, FiberRef, Option } from 'effect'
import { currentUserId, requireUserId } from './tenant.js'
import { decryptSecret, encryptSecret } from './crypto.js'
import {
  type Dragodinde,
  type Enclos,
  type FocusKey,
  type FuelKey,
  type ReproStatus,
  type Sex,
  type StatKey,
  DEFAULT_FOCUS,
  FOCUSABLE,
  FUEL_KEYS,
  FUEL_MAX,
  MAX_DRAGODINDES,
  MAX_ENCLOS,
  MAX_FOCUS,
  MAX_STABLE,
  SERENITY_MAX,
  SERENITY_MIN,
  STAT_MAX,
  clamp,
  emptyFuel,
  focusAllMaxed,
  reproStatus,
  advanceEnclos
} from './domain.js'

interface EnclosRow {
  readonly id: number
  readonly name: string
  readonly fuel_serenityMinus: number
  readonly fuel_serenityPlus: number
  readonly fuel_endurance: number
  readonly fuel_maturite: number
  readonly fuel_amour: number
  readonly focus: string
  readonly ticked_at: number // wall-clock ms of the last persisted tick (elapsed-time model)
  readonly user_id: string | null
}

interface DragoRow {
  readonly id: number
  readonly enclos_id: number | null
  readonly name: string
  readonly stat_endurance: number
  readonly stat_maturite: number
  readonly stat_amour: number
  readonly stat_serenity: number
  readonly notified: number
  readonly color: string
  readonly sex: string
  readonly fertile: number // legacy boolean column, superseded by `status`
  readonly status: string | null
  readonly keeper: number
  readonly parent_a_id: number | null
  readonly parent_b_id: number | null
  readonly grand_a: string | null
  readonly grand_b: string | null
}

/** Normalise a stored status, falling back to the legacy `fertile` boolean for old rows. */
const statusFromRow = (r: DragoRow): ReproStatus => {
  if (r.status === 'sterile' || r.status === 'fertile' || r.status === 'feconde') return r.status
  return (r.fertile ?? 1) === 0 ? 'sterile' : 'feconde'
}

const dragoFromRow = (r: DragoRow): Dragodinde => ({
  id: r.id,
  name: r.name,
  stats: {
    endurance: r.stat_endurance,
    maturite: r.stat_maturite,
    amour: r.stat_amour,
    serenity: r.stat_serenity
  },
  notified: r.notified === 1,
  color: r.color ?? '',
  sex: (r.sex === 'M' ? 'M' : 'F') as Sex,
  status: statusFromRow(r),
  keeper: (r.keeper ?? 0) === 1,
  enclosId: r.enclos_id ?? null,
  parentA: r.parent_a_id ?? null,
  parentB: r.parent_b_id ?? null,
  grandparents: [r.grand_a, r.grand_b].filter((c): c is string => !!c)
})

const fuelFromRow = (r: EnclosRow): Record<FuelKey, number> => ({
  serenityMinus: r.fuel_serenityMinus,
  serenityPlus: r.fuel_serenityPlus,
  endurance: r.fuel_endurance,
  maturite: r.fuel_maturite,
  amour: r.fuel_amour
})

export interface EnclosPatch {
  readonly name?: string
  readonly fuel?: Partial<Record<FuelKey, number>>
  readonly focus?: ReadonlyArray<string>
}

export interface DragoPatch {
  readonly name?: string
  readonly stats?: Partial<Record<StatKey, number>>
  readonly color?: string
  readonly sex?: Sex
  readonly status?: ReproStatus
  readonly keeper?: boolean
  readonly grandparents?: ReadonlyArray<string>
}

/** One mount to bulk-import (decoded from an in-game name, with fertility from the screen). */
export interface ImportRow {
  readonly name?: string
  readonly color: string
  readonly sex: Sex
  readonly status?: ReproStatus
  readonly keeper?: boolean
  readonly grandparents?: ReadonlyArray<string>
}

export interface SeedInput {
  readonly color?: string
  readonly sex?: Sex
  readonly status?: ReproStatus
  readonly name?: string
}

/** Record one breeding: a baby of `color`/`sex` (born to the stable) whose parents are sterilised. */
export interface CrossInput {
  readonly parentAId: number
  readonly parentBId: number
  readonly color: string
  readonly sex: Sex
  readonly name?: string
}

/** Record one clonage: two same-generation steriles go in, ONE survives. The survivor (chosen by
 *  the user) is refreshed to fertile keeping its own sex/colour/lineage; the other is consumed. */
export interface CloneInput {
  readonly survivorId: number // the mount that comes back (refreshed to fertile)
  readonly consumedId: number // the mount destroyed by the clonage
}

export interface CompletedItem {
  readonly kind: 'focus' | 'feconde' // focus goals maxed, or just became féconde (ready to breed)
  readonly enclosName: string
  readonly focus: ReadonlyArray<FocusKey>
  readonly dragodinde: Dragodinde
}

/** A sweep's completions for one user — routed to that user's own webhook. */
export interface SweepGroup {
  readonly userId: string
  readonly items: ReadonlyArray<CompletedItem>
}

// Keep only valid focus keys, capped to the last MAX_FOCUS (rolling: newest win).
const sanitizeFocus = (input: ReadonlyArray<string>): ReadonlyArray<FocusKey> => {
  const valid = input.filter((f): f is FocusKey => (FOCUSABLE as ReadonlyArray<string>).includes(f))
  return valid.slice(Math.max(0, valid.length - MAX_FOCUS))
}

// Re-derive a dragodinde's done-state from its stats + the enclos focus. Notifications
// fire only on a tick transition, so an edit that already satisfies the goal is marked
// done (no ping); one that drops below re-arms.
const withDoneState = (d: Dragodinde, focus: ReadonlyArray<FocusKey>): Dragodinde => ({
  ...d,
  notified: focusAllMaxed(focus, d.stats)
})

const changed = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b)

/** One in-game tick = 10s (override with TICK_MS). The elapsed-time model quantizes wall-clock
 *  time into this many-ms ticks. */
const TICK_MS = Number(process.env.TICK_MS) || 10000

export class Repo extends Effect.Service<Repo>()('app/Repo', {
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`
      CREATE TABLE IF NOT EXISTS enclos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        fuel_serenityMinus INTEGER NOT NULL DEFAULT 0,
        fuel_serenityPlus INTEGER NOT NULL DEFAULT 0,
        fuel_endurance INTEGER NOT NULL DEFAULT 0,
        fuel_maturite INTEGER NOT NULL DEFAULT 0,
        fuel_amour INTEGER NOT NULL DEFAULT 0,
        focus TEXT NOT NULL DEFAULT '["endurance","amour"]',
        ticked_at INTEGER NOT NULL DEFAULT 0
      )
    `
    yield* sql`
      CREATE TABLE IF NOT EXISTS dragodinde (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enclos_id INTEGER REFERENCES enclos(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        stat_endurance INTEGER NOT NULL DEFAULT 0,
        stat_maturite INTEGER NOT NULL DEFAULT 0,
        stat_amour INTEGER NOT NULL DEFAULT 0,
        stat_serenity INTEGER NOT NULL DEFAULT 0,
        notified INTEGER NOT NULL DEFAULT 0
      )
    `
    // Additive migration: breeding identity + lineage columns (Phase 1). The base schema
    // only does CREATE TABLE IF NOT EXISTS, so add any missing columns to existing DBs.
    const dragoCols = yield* sql<{ name: string }>`SELECT name FROM pragma_table_info('dragodinde')`
    const haveCol = new Set(dragoCols.map((c) => c.name))
    const ensureCol = (name: string, ddl: string) =>
      haveCol.has(name) ? Effect.void : sql.unsafe(`ALTER TABLE dragodinde ADD COLUMN ${ddl}`)
    yield* ensureCol('color', "color TEXT NOT NULL DEFAULT ''")
    yield* ensureCol('sex', "sex TEXT NOT NULL DEFAULT 'F'")
    yield* ensureCol('fertile', 'fertile INTEGER NOT NULL DEFAULT 1') // legacy, kept for old DBs
    yield* ensureCol('keeper', 'keeper INTEGER NOT NULL DEFAULT 0')
    // 3-state reproduction status (sterile / fertile / feconde), superseding the boolean.
    const addedStatus = !haveCol.has('status')
    yield* ensureCol('status', "status TEXT NOT NULL DEFAULT 'fertile'")
    if (addedStatus) {
      // sterile if it had bred; else féconde only when its 3 gauges are maxed, otherwise fertile.
      yield* sql`UPDATE dragodinde SET status = CASE
        WHEN fertile = 0 THEN 'sterile'
        WHEN stat_endurance >= ${STAT_MAX} AND stat_maturite >= ${STAT_MAX} AND stat_amour >= ${STAT_MAX} THEN 'feconde'
        ELSE 'fertile' END`
    }

    // Étable rework: enclos_id must be NULLABLE (null = stable) with ON DELETE SET NULL. Old DBs
    // created it NOT NULL + ON DELETE CASCADE — rebuild the table (SQLite can't ALTER a constraint).
    const enclosCol = dragoCols.length
      ? yield* sql<{
          name: string
          notnull: number
        }>`SELECT name, "notnull" FROM pragma_table_info('dragodinde')`
      : []
    const enclosNotNull = enclosCol.find((c) => c.name === 'enclos_id')?.notnull === 1
    if (enclosNotNull) {
      yield* sql`
        CREATE TABLE dragodinde_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          enclos_id INTEGER REFERENCES enclos(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          stat_endurance INTEGER NOT NULL DEFAULT 0,
          stat_maturite INTEGER NOT NULL DEFAULT 0,
          stat_amour INTEGER NOT NULL DEFAULT 0,
          stat_serenity INTEGER NOT NULL DEFAULT 0,
          notified INTEGER NOT NULL DEFAULT 0,
          color TEXT NOT NULL DEFAULT '',
          sex TEXT NOT NULL DEFAULT 'F',
          fertile INTEGER NOT NULL DEFAULT 1,
          keeper INTEGER NOT NULL DEFAULT 0,
          parent_a_id INTEGER,
          parent_b_id INTEGER,
          grand_a TEXT,
          grand_b TEXT,
          status TEXT NOT NULL DEFAULT 'fertile'
        )`
      yield* sql`
        INSERT INTO dragodinde_new
          (id, enclos_id, name, stat_endurance, stat_maturite, stat_amour, stat_serenity, notified,
           color, sex, fertile, keeper, parent_a_id, parent_b_id, grand_a, grand_b, status)
        SELECT id, enclos_id, name, stat_endurance, stat_maturite, stat_amour, stat_serenity, notified,
           color, sex, fertile, keeper, parent_a_id, parent_b_id, grand_a, grand_b, status FROM dragodinde`
      yield* sql`DROP TABLE dragodinde`
      yield* sql`ALTER TABLE dragodinde_new RENAME TO dragodinde`
    }
    yield* ensureCol('parent_a_id', 'parent_a_id INTEGER')
    yield* ensureCol('parent_b_id', 'parent_b_id INTEGER')
    // Grandparent colours, denormalised (Phase: name-encoded lineage / import).
    const addedGrandA = !haveCol.has('grand_a')
    yield* ensureCol('grand_a', 'grand_a TEXT')
    yield* ensureCol('grand_b', 'grand_b TEXT')
    // One-time backfill from existing parent rows so current lineage isn't lost.
    if (addedGrandA) {
      yield* sql`
        UPDATE dragodinde SET grand_a = (SELECT p.color FROM dragodinde p WHERE p.id = dragodinde.parent_a_id)
        WHERE parent_a_id IS NOT NULL
      `
      yield* sql`
        UPDATE dragodinde SET grand_b = (SELECT p.color FROM dragodinde p WHERE p.id = dragodinde.parent_b_id)
        WHERE parent_b_id IS NOT NULL
      `
    }

    // Succès: colours whose in-game achievement is unlocked — per user (composite PK).
    yield* sql`CREATE TABLE IF NOT EXISTS achievement (user_id TEXT, color TEXT NOT NULL, PRIMARY KEY (user_id, color))`

    // ── Multi-user (Phase 2): every cheptel table carries the owning user (a Better Auth user id).
    // Pre-existing rows get user_id = NULL (orphans); the seed owner claims them on first login.
    const enclosCols = yield* sql<{ name: string }>`SELECT name FROM pragma_table_info('enclos')`
    if (!enclosCols.some((c) => c.name === 'user_id'))
      yield* sql.unsafe(`ALTER TABLE enclos ADD COLUMN user_id TEXT`)
    if (!haveCol.has('user_id')) yield* sql.unsafe(`ALTER TABLE dragodinde ADD COLUMN user_id TEXT`)
    yield* sql`CREATE INDEX IF NOT EXISTS idx_enclos_user ON enclos(user_id)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_dragodinde_user ON dragodinde(user_id)`
    // Elapsed-time model (#6): per-enclos last-tick timestamp. Existing enclos start "now" so they
    // don't replay history on the first sweep.
    if (!enclosCols.some((c) => c.name === 'ticked_at'))
      yield* sql.unsafe(`ALTER TABLE enclos ADD COLUMN ticked_at INTEGER NOT NULL DEFAULT 0`)
    yield* sql`UPDATE enclos SET ticked_at = ${Date.now()} WHERE ticked_at = 0`
    // Rebuild an old single-PK achievement (color only) into the composite (user_id, color) form.
    const achCols = yield* sql<{ name: string }>`SELECT name FROM pragma_table_info('achievement')`
    if (!achCols.some((c) => c.name === 'user_id')) {
      yield* sql`ALTER TABLE achievement RENAME TO achievement_old`
      yield* sql`CREATE TABLE achievement (user_id TEXT, color TEXT NOT NULL, PRIMARY KEY (user_id, color))`
      yield* sql`INSERT INTO achievement (user_id, color) SELECT NULL, color FROM achievement_old`
      yield* sql`DROP TABLE achievement_old`
    }

    // Per-user app settings (Discord webhook, encrypted AI key) — keyed by the Better Auth user id.
    yield* sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY NOT NULL,
        webhook_url TEXT NOT NULL DEFAULT '',
        ai_key_enc TEXT
      )
    `

    const writeEnclos = (e: Enclos) => sql`
      UPDATE enclos SET
        name = ${e.name},
        fuel_serenityMinus = ${e.fuel.serenityMinus},
        fuel_serenityPlus = ${e.fuel.serenityPlus},
        fuel_endurance = ${e.fuel.endurance},
        fuel_maturite = ${e.fuel.maturite},
        fuel_amour = ${e.fuel.amour},
        focus = ${JSON.stringify(e.focus)}
      WHERE id = ${e.id}
    `

    const writeDrago = (d: Dragodinde) => sql`
      UPDATE dragodinde SET
        name = ${d.name},
        stat_endurance = ${d.stats.endurance},
        stat_maturite = ${d.stats.maturite},
        stat_amour = ${d.stats.amour},
        stat_serenity = ${d.stats.serenity},
        notified = ${d.notified ? 1 : 0},
        color = ${d.color},
        sex = ${d.sex},
        status = ${d.status},
        fertile = ${d.status === 'sterile' ? 0 : 1},
        keeper = ${d.keeper ? 1 : 0},
        parent_a_id = ${d.parentA},
        parent_b_id = ${d.parentB},
        grand_a = ${d.grandparents[0] ?? null},
        grand_b = ${d.grandparents[1] ?? null}
      WHERE id = ${d.id}
    `

    interface InsertOpts {
      readonly name?: string // omitted -> auto-named from the convention (colour+sex+keeper+grandparents)
      readonly enclosId?: number | null // default null = born into the stable
      readonly color?: string
      readonly sex?: Sex
      readonly status?: ReproStatus
      readonly keeper?: boolean
      readonly parentA?: number | null
      readonly parentB?: number | null
      readonly grandparents?: ReadonlyArray<string>
    }
    const insertDrago = (opts: InsertOpts) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId
        const gps = opts.grandparents ?? []
        const status = opts.status ?? 'fertile'
        const sex: Sex = opts.sex ?? 'F'
        // Auto-name from the in-game convention when no explicit name is given — we know colour,
        // sex and grandparents, so every breed/clone/capture lands findable in-game (not "Orchidée").
        const name =
          opts.name?.trim() ||
          (opts.color
            ? buildName({ color: opts.color, sex, keeper: opts.keeper ?? false, grandparents: gps })
            : 'Dragodinde')
        const rows = yield* sql<DragoRow>`
          INSERT INTO dragodinde
            (user_id, enclos_id, name, color, sex, status, fertile, keeper, parent_a_id, parent_b_id, grand_a, grand_b)
          VALUES (
            ${uid}, ${opts.enclosId ?? null}, ${name}, ${opts.color ?? ''}, ${sex},
            ${status}, ${status === 'sterile' ? 0 : 1}, ${opts.keeper ? 1 : 0},
            ${opts.parentA ?? null}, ${opts.parentB ?? null}, ${gps[0] ?? null}, ${gps[1] ?? null}
          ) RETURNING *
        `
        // Registering a mount of a colour means you've obtained it in-game → its succès is
        // unlocked. Auto-mark it for this user (idempotent) so the planner stops counting it.
        if (opts.color && COLOR_BY_NAME.has(opts.color))
          yield* sql`INSERT OR IGNORE INTO achievement (user_id, color) VALUES (${uid}, ${opts.color})`
        return dragoFromRow(rows[0])
      })

    /** Build the enclos list (with their mounts). userFilter null = everyone (the system/ticker view). */
    const loadEnclos = (userFilter: string | null) =>
      Effect.gen(function* () {
        const enclosRows =
          userFilter === null
            ? yield* sql<EnclosRow>`SELECT * FROM enclos ORDER BY id`
            : yield* sql<EnclosRow>`SELECT * FROM enclos WHERE user_id = ${userFilter} ORDER BY id`
        const dragoRows =
          userFilter === null
            ? yield* sql<DragoRow>`SELECT * FROM dragodinde WHERE enclos_id IS NOT NULL ORDER BY id`
            : yield* sql<DragoRow>`SELECT * FROM dragodinde WHERE enclos_id IS NOT NULL AND user_id = ${userFilter} ORDER BY id`
        const byEnclos = new Map<number, Array<Dragodinde>>()
        for (const r of dragoRows) {
          if (r.enclos_id == null) continue
          const list = byEnclos.get(r.enclos_id) ?? []
          list.push(dragoFromRow(r))
          byEnclos.set(r.enclos_id, list)
        }
        const now = Date.now()
        return enclosRows.map((r): Enclos => {
          const e: Enclos = {
            id: r.id,
            name: r.name,
            fuel: fuelFromRow(r),
            focus: sanitizeFocus(JSON.parse(r.focus) as ReadonlyArray<string>),
            dragodindes: byEnclos.get(r.id) ?? []
          }
          // Project forward by the ticks elapsed since the last persisted tick — WITHOUT writing.
          // The sweep is what persists; reads just show the up-to-date state.
          const nTicks = Math.floor((now - (r.ticked_at ?? now)) / TICK_MS)
          return nTicks > 0 ? advanceEnclos(e, nTicks).enclos : e
        })
      })

    const all = Effect.gen(function* () {
      const uid = yield* requireUserId
      let list = yield* loadEnclos(uid)
      // Every user starts with one enclos so the tracker is never empty.
      if (list.length === 0) {
        yield* createEnclos
        list = yield* loadEnclos(uid)
      }
      return list
    })

    /** The stable: this user's mounts not currently placed in an enclos. */
    const stable = Effect.gen(function* () {
      const uid = yield* requireUserId
      const rows =
        yield* sql<DragoRow>`SELECT * FROM dragodinde WHERE enclos_id IS NULL AND user_id = ${uid} ORDER BY id`
      return rows.map(dragoFromRow)
    })
    /** Every mount this user owns, wherever it lives (for the recommender / AI inventory). */
    const allMounts = Effect.gen(function* () {
      const uid = yield* requireUserId
      const rows = yield* sql<DragoRow>`SELECT * FROM dragodinde WHERE user_id = ${uid} ORDER BY id`
      return rows.map(dragoFromRow)
    })

    const countEnclos = Effect.gen(function* () {
      const uid = yield* requireUserId
      const rows = yield* sql<{
        n: number
      }>`SELECT COUNT(*) AS n FROM enclos WHERE user_id = ${uid}`
      return rows[0]?.n ?? 0
    })
    const countDragos = (enclosId: number) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId
        const rows = yield* sql<{
          n: number
        }>`SELECT COUNT(*) AS n FROM dragodinde WHERE enclos_id = ${enclosId} AND user_id = ${uid}`
        return rows[0]?.n ?? 0
      })
    const countStable = Effect.gen(function* () {
      const uid = yield* requireUserId
      const rows = yield* sql<{
        n: number
      }>`SELECT COUNT(*) AS n FROM dragodinde WHERE enclos_id IS NULL AND user_id = ${uid}`
      return rows[0]?.n ?? 0
    })

    const createEnclos = Effect.gen(function* () {
      const uid = yield* requireUserId
      if ((yield* countEnclos) >= MAX_ENCLOS) return Option.none<Enclos>()
      const rows = yield* sql<{ id: number }>`
        INSERT INTO enclos (name, user_id, ticked_at) VALUES (${'Enclosure'}, ${uid}, ${Date.now()}) RETURNING id
      `
      const id = rows[0].id
      yield* sql`UPDATE enclos SET name = ${`Enclosure ${id}`} WHERE id = ${id}`
      return Option.some<Enclos>({
        id,
        name: `Enclosure ${id}`,
        fuel: emptyFuel(),
        focus: DEFAULT_FOCUS,
        dragodindes: [] // starts empty
      })
    })

    const removeEnclos = (id: number) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId
        if ((yield* countEnclos) <= 1) return false
        // Mounts inside go back to the stable (not destroyed) — they're your collection.
        yield* sql`UPDATE dragodinde SET enclos_id = NULL WHERE enclos_id = ${id} AND user_id = ${uid}`
        yield* sql`DELETE FROM enclos WHERE id = ${id} AND user_id = ${uid}`
        return true
      })

    const patchEnclos = (id: number, body: EnclosPatch) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId
        const rows =
          yield* sql<EnclosRow>`SELECT * FROM enclos WHERE id = ${id} AND user_id = ${uid}`
        if (!rows[0]) return false
        const r = rows[0]
        const fuel = fuelFromRow(r)
        if (body.fuel) {
          for (const k of FUEL_KEYS) {
            const v = body.fuel[k]
            if (v != null) fuel[k] = clamp(Number(v) || 0, 0, FUEL_MAX)
          }
        }
        const focus = Array.isArray(body.focus)
          ? sanitizeFocus(body.focus)
          : sanitizeFocus(JSON.parse(r.focus) as ReadonlyArray<string>)
        const name = typeof body.name === 'string' ? body.name.slice(0, 40) : r.name
        yield* writeEnclos({ id, name, fuel, focus, dragodindes: [] })

        // Focus changed -> resync each dragodinde's done-state (re-arm if newly
        // unsatisfied; mark satisfied if it already meets the new focus -> no ping).
        if (Array.isArray(body.focus)) {
          const dragos =
            yield* sql<DragoRow>`SELECT * FROM dragodinde WHERE enclos_id = ${id} AND user_id = ${uid}`
          for (const dr of dragos) {
            const d = dragoFromRow(dr)
            const synced = withDoneState(d, focus)
            if (synced.notified !== d.notified) yield* writeDrago(synced)
          }
        }
        return true
      })

    /** Seed one mount into the stable (no enclos). */
    const addDrago = (seed?: SeedInput) =>
      Effect.gen(function* () {
        const n = yield* countStable
        if (n >= MAX_STABLE) return Option.none<Dragodinde>()
        const created = yield* insertDrago({
          name: seed?.name, // undefined -> insertDrago auto-names from the convention
          color: seed?.color,
          sex: seed?.sex,
          status: seed?.status
        })
        return Option.some(created)
      })

    /** Record a real breeding: baby born into the stable; both parents become sterile AND are
     * auto-evicted from any enclos back to the stable (they can't usefully tick anymore). */
    const recordCross = (input: CrossInput) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const uid = yield* requireUserId
          const parents = yield* sql<DragoRow>`
            SELECT * FROM dragodinde WHERE id IN (${input.parentAId}, ${input.parentBId}) AND user_id = ${uid}
          `
          const a = parents.find((p) => p.id === input.parentAId)
          const b = parents.find((p) => p.id === input.parentBId)
          if (!a || !b) return Option.none<Dragodinde>()
          // Only FÉCONDE mounts can breed; refuse anything else so a bad call can't sterilise a
          // fertile/sterile mount (or a baby). Keepers are trophies — never breed them.
          if (statusFromRow(a) !== 'feconde' || statusFromRow(b) !== 'feconde')
            return Option.none<Dragodinde>()
          if (a.keeper === 1 || b.keeper === 1) return Option.none<Dragodinde>()
          if ((yield* countStable) >= MAX_STABLE) return Option.none<Dragodinde>()
          const baby = yield* insertDrago({
            name: input.name, // auto-named from colour + sex + grandparents (parents' colours)
            color: input.color,
            sex: input.sex,
            status: 'fertile', // a newborn isn't féconde yet — its gauges must be raised first
            parentA: input.parentAId,
            parentB: input.parentBId,
            grandparents: [a.color, b.color].filter((c) => !!c)
          })
          yield* sql`UPDATE dragodinde SET status = 'sterile', fertile = 0, enclos_id = NULL
                     WHERE id IN (${input.parentAId}, ${input.parentBId}) AND user_id = ${uid}`
          return Option.some(baby)
        })
      )

    /** Record a clonage: two same-generation steriles go in, ONE survives. The chosen survivor is
     * refreshed to fertile (gauges reset to 0) keeping its own sex/colour/lineage; the other is
     * consumed. No new mount is created — the survivor is the existing animal, just refreshed. */
    const recordClone = (input: CloneInput) =>
      sql.withTransaction(
        Effect.gen(function* () {
          if (input.survivorId === input.consumedId) return Option.none<Dragodinde>()
          const uid = yield* requireUserId
          const rows = yield* sql<DragoRow>`
            SELECT * FROM dragodinde WHERE id IN (${input.survivorId}, ${input.consumedId}) AND user_id = ${uid}
          `
          const survivor = rows.find((p) => p.id === input.survivorId)
          const consumed = rows.find((p) => p.id === input.consumedId)
          if (!survivor || !consumed) return Option.none<Dragodinde>()
          // Both must be STÉRILE, never keepers, and of the SAME generation (colours may differ).
          if (statusFromRow(survivor) !== 'sterile' || statusFromRow(consumed) !== 'sterile')
            return Option.none<Dragodinde>()
          if (survivor.keeper === 1 || consumed.keeper === 1) return Option.none<Dragodinde>()
          const genOf = (c: string | null) => (c ? (COLOR_BY_NAME.get(c)?.gen ?? 0) : 0)
          const gen = genOf(survivor.color)
          if (gen === 0 || gen !== genOf(consumed.color)) return Option.none<Dragodinde>()
          // Consume the other; refresh the survivor in place (fertile again, gauges to 0).
          yield* sql`DELETE FROM dragodinde WHERE id = ${input.consumedId} AND user_id = ${uid}`
          yield* sql`
            UPDATE dragodinde
            SET status = 'fertile', fertile = 1, notified = 0,
                stat_endurance = 0, stat_maturite = 0, stat_amour = 0, stat_serenity = 0
            WHERE id = ${input.survivorId} AND user_id = ${uid}
          `
          const after =
            yield* sql<DragoRow>`SELECT * FROM dragodinde WHERE id = ${input.survivorId} AND user_id = ${uid}`
          return Option.some(dragoFromRow(after[0]))
        })
      )

    /** Bulk-insert mounts. enclosId null → straight into the stable; a valid enclos id fills that
     * enclos to its 10-cap then spills the overflow into the stable. Returns the created list,
     * how many landed in the enclos (toEnclos), and how many were skipped (everything full). */
    const importMounts = (mounts: ReadonlyArray<ImportRow>, enclosId: number | null) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const uid = yield* requireUserId
          let target = enclosId
          if (target !== null) {
            const exists = yield* sql<{
              id: number
            }>`SELECT id FROM enclos WHERE id = ${target} AND user_id = ${uid}`
            if (!exists[0]) target = null // unknown/foreign enclos → fall back to the stable
          }
          let inEnclos = target !== null ? yield* countDragos(target) : 0
          let inStable = yield* countStable
          const created: Dragodinde[] = []
          let toEnclos = 0
          let skipped = 0
          for (const r of mounts) {
            // Prefer the target enclos until its 10-cap, then spill into the stable, then skip.
            let place: number | null
            if (target !== null && inEnclos < MAX_DRAGODINDES) {
              place = target
              inEnclos++
              toEnclos++
            } else if (inStable < MAX_STABLE) {
              place = null
              inStable++
            } else {
              skipped++
              continue
            }
            const d = yield* insertDrago({
              enclosId: place,
              name: r.name, // undefined (e.g. AI-recorded capture) -> convention name
              color: r.color,
              sex: r.sex,
              status: r.status,
              keeper: r.keeper,
              grandparents: r.grandparents
            })
            created.push(d)
          }
          return { created, skipped, toEnclos }
        })
      )

    /** Move a mount to an enclos (validated against its 10-cap) or back to the stable (enclosId
     * null). Returns None if the mount/enclos is missing or the target enclos is full. */
    const moveDrago = (id: number, enclosId: number | null) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const uid = yield* requireUserId
          const rows =
            yield* sql<DragoRow>`SELECT * FROM dragodinde WHERE id = ${id} AND user_id = ${uid}`
          if (!rows[0]) return Option.none<Dragodinde>()
          if (enclosId !== null) {
            const exists = yield* sql<{
              id: number
            }>`SELECT id FROM enclos WHERE id = ${enclosId} AND user_id = ${uid}`
            if (!exists[0]) return Option.none<Dragodinde>()
            if (rows[0].enclos_id !== enclosId && (yield* countDragos(enclosId)) >= MAX_DRAGODINDES)
              return Option.none<Dragodinde>()
          }
          yield* sql`UPDATE dragodinde SET enclos_id = ${enclosId} WHERE id = ${id} AND user_id = ${uid}`
          const after =
            yield* sql<DragoRow>`SELECT * FROM dragodinde WHERE id = ${id} AND user_id = ${uid}`
          return Option.some(dragoFromRow(after[0]))
        })
      )

    const removeDrago = (id: number) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId
        const rows = yield* sql<{
          id: number
        }>`SELECT id FROM dragodinde WHERE id = ${id} AND user_id = ${uid}`
        if (!rows[0]) return false
        yield* sql`DELETE FROM dragodinde WHERE id = ${id} AND user_id = ${uid}`
        return true
      })

    const patchDrago = (id: number, body: DragoPatch) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId
        const rows = yield* sql<DragoRow & { focus: string | null }>`
          SELECT d.*, e.focus AS focus FROM dragodinde d
          LEFT JOIN enclos e ON e.id = d.enclos_id WHERE d.id = ${id} AND d.user_id = ${uid}
        `
        if (!rows[0]) return Option.none<Dragodinde>()
        // Stable mounts (no enclos) have no focus — done-state is vacuously false there.
        const focus = sanitizeFocus(JSON.parse(rows[0].focus ?? '[]') as ReadonlyArray<string>)
        const current = dragoFromRow(rows[0])
        const stats = { ...current.stats }
        if (body.stats) {
          for (const k of ['endurance', 'maturite', 'amour'] as const) {
            const v = body.stats[k]
            if (v != null) stats[k] = clamp(Number(v) || 0, 0, STAT_MAX)
          }
          if (body.stats.serenity != null)
            stats.serenity = clamp(Number(body.stats.serenity) || 0, SERENITY_MIN, SERENITY_MAX)
        }
        const color = typeof body.color === 'string' ? body.color : current.color
        const sex: Sex = body.sex === 'M' || body.sex === 'F' ? body.sex : current.sex
        const keeper = typeof body.keeper === 'boolean' ? body.keeper : current.keeper
        const grandparents = Array.isArray(body.grandparents)
          ? body.grandparents.filter((c): c is string => typeof c === 'string' && !!c).slice(0, 2)
          : current.grandparents
        // The name. An explicit name wins. Otherwise keep the current one — UNLESS it's an
        // auto-generated convention name (parseName recognises it), in which case rebuild it from
        // the patched parts so the in-game name never drifts from the mount's real sex/colour/
        // lineage (an edited sex would otherwise leave a stale `-m-`, so a M×F pair reads as M×M).
        const name =
          typeof body.name === 'string'
            ? body.name.slice(0, 40)
            : color && parseName(current.name)
              ? buildName({ color, sex, keeper, grandparents })
              : current.name
        const next = withDoneState(
          {
            ...current,
            name,
            stats,
            color,
            sex,
            status: reproStatus(
              body.status === 'sterile' || body.status === 'fertile' || body.status === 'feconde'
                ? body.status
                : current.status,
              stats
            ),
            keeper,
            grandparents
          },
          focus
        )
        yield* writeDrago(next)
        return Option.some(next)
      })

    /** Move many mounts to an enclos (filling to its 10-cap in the given order) or to the stable
     * (enclosId null). Returns which ids actually moved + how many were skipped (enclos full). */
    const moveMany = (ids: ReadonlyArray<number>, enclosId: number | null) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const uid = yield* requireUserId
          const movedIds: number[] = []
          let skipped = 0
          if (enclosId === null) {
            for (const id of ids) {
              const cur = yield* sql<{
                id: number
              }>`SELECT id FROM dragodinde WHERE id = ${id} AND user_id = ${uid}`
              if (!cur[0]) continue
              yield* sql`UPDATE dragodinde SET enclos_id = NULL WHERE id = ${id} AND user_id = ${uid}`
              movedIds.push(id)
            }
            return { movedIds, skipped }
          }
          const exists = yield* sql<{
            id: number
          }>`SELECT id FROM enclos WHERE id = ${enclosId} AND user_id = ${uid}`
          if (!exists[0]) return { movedIds, skipped: ids.length }
          let count = yield* countDragos(enclosId)
          for (const id of ids) {
            const cur = yield* sql<{
              enclos_id: number | null
            }>`SELECT enclos_id FROM dragodinde WHERE id = ${id} AND user_id = ${uid}`
            if (!cur[0]) continue // gone or not yours
            if (cur[0].enclos_id === enclosId) continue // already there — no-op
            if (count >= MAX_DRAGODINDES) {
              skipped++
              continue
            }
            yield* sql`UPDATE dragodinde SET enclos_id = ${enclosId} WHERE id = ${id} AND user_id = ${uid}`
            count++
            movedIds.push(id)
          }
          return { movedIds, skipped }
        })
      )

    /** Apply one patch (status / keeper / …) to many mounts; returns how many were updated. */
    const patchMany = (ids: ReadonlyArray<number>, patch: DragoPatch) =>
      sql.withTransaction(
        Effect.gen(function* () {
          let n = 0
          for (const id of ids) if (Option.isSome(yield* patchDrago(id, patch))) n++
          return n
        })
      )

    /** Delete many mounts; returns how many were removed. */
    const removeMany = (ids: ReadonlyArray<number>) =>
      sql.withTransaction(
        Effect.gen(function* () {
          let n = 0
          for (const id of ids) if (yield* removeDrago(id)) n++
          return n
        })
      )

    /** The notification sweep (system actor): advance every enclos by the ticks elapsed since its
     *  last persisted tick, PERSIST the change + bump ticked_at, and collect the rising-edge
     *  completions grouped by owning user. Idle enclos (no fuel/no elapsed) incur no writes.
     *  `nowMs` is injectable for tests. */
    const sweep = (nowMs: number = Date.now()) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const rows = yield* sql<EnclosRow>`SELECT * FROM enclos ORDER BY id`
          const byUser = new Map<string, CompletedItem[]>()
          for (const r of rows) {
            const nTicks = Math.floor((nowMs - (r.ticked_at ?? nowMs)) / TICK_MS)
            if (nTicks <= 0) continue
            const dragos =
              yield* sql<DragoRow>`SELECT * FROM dragodinde WHERE enclos_id = ${r.id} ORDER BY id`
            const e: Enclos = {
              id: r.id,
              name: r.name,
              fuel: fuelFromRow(r),
              focus: sanitizeFocus(JSON.parse(r.focus) as ReadonlyArray<string>),
              dragodindes: dragos.map(dragoFromRow)
            }
            const result = advanceEnclos(e, nTicks)
            const enclosChanged =
              changed(result.enclos.fuel, e.fuel) || changed(result.enclos.focus, e.focus)
            const dragoChanged = result.enclos.dragodindes.some((d, i) =>
              changed(e.dragodindes[i], d)
            )
            if (!enclosChanged && !dragoChanged) continue // idle — no write
            if (enclosChanged) yield* writeEnclos(result.enclos)
            for (let i = 0; i < result.enclos.dragodindes.length; i++) {
              const after = result.enclos.dragodindes[i]
              if (changed(e.dragodindes[i], after)) yield* writeDrago(after)
            }
            yield* sql`UPDATE enclos SET ticked_at = ${nowMs} WHERE id = ${r.id}`
            const uid = r.user_id
            if (uid && (result.completed.length || result.becameFeconde.length)) {
              const items = byUser.get(uid) ?? []
              for (const d of result.completed)
                items.push({ kind: 'focus', enclosName: e.name, focus: e.focus, dragodinde: d })
              for (const d of result.becameFeconde)
                items.push({ kind: 'feconde', enclosName: e.name, focus: e.focus, dragodinde: d })
              byUser.set(uid, items)
            }
          }
          return [...byUser.entries()].map(([userId, items]): SweepGroup => ({ userId, items }))
        })
      )

    /** A user's Discord webhook, looked up directly (system context — no FiberRef). '' if unset. */
    const webhookFor = (userId: string) =>
      sql<{
        webhook_url: string
      }>`SELECT webhook_url FROM user_settings WHERE user_id = ${userId}`.pipe(
        Effect.map((rows) => rows[0]?.webhook_url ?? '')
      )

    /** The current user's Discord webhook ('' when unset, or in the system/ticker context — which
     *  has no user; the Discord service then falls back to the legacy DISCORD_WEBHOOK_URL env). */
    const getWebhook = Effect.gen(function* () {
      const uid = yield* FiberRef.get(currentUserId)
      if (!uid) return ''
      const rows = yield* sql<{
        webhook_url: string
      }>`SELECT webhook_url FROM user_settings WHERE user_id = ${uid}`
      return rows[0]?.webhook_url ?? ''
    })

    const setWebhook = (url: string) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId
        yield* sql`INSERT INTO user_settings (user_id, webhook_url) VALUES (${uid}, ${url})
                   ON CONFLICT(user_id) DO UPDATE SET webhook_url = excluded.webhook_url`
      })

    /** The current user's OpenAI key, decrypted (null if unset). Server-side only — never returned
     *  to the client; the AI chat passes it straight to the OpenAI SDK. */
    const getAiKey = Effect.gen(function* () {
      const uid = yield* requireUserId
      const rows = yield* sql<{
        ai_key_enc: string | null
      }>`SELECT ai_key_enc FROM user_settings WHERE user_id = ${uid}`
      const enc = rows[0]?.ai_key_enc
      return enc ? decryptSecret(enc) : null
    })
    /** Whether the current user has an AI key set (for the UI — without revealing the key). */
    const hasAiKey = getAiKey.pipe(Effect.map((k) => !!k))
    /** Set (encrypted) or clear (empty string) the current user's OpenAI key. */
    const setAiKey = (key: string) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId
        const enc = key.trim() ? encryptSecret(key.trim()) : null
        yield* sql`INSERT INTO user_settings (user_id, ai_key_enc) VALUES (${uid}, ${enc})
                   ON CONFLICT(user_id) DO UPDATE SET ai_key_enc = excluded.ai_key_enc`
      })

    const getAchievements = Effect.gen(function* () {
      const uid = yield* requireUserId
      const rows = yield* sql<{
        color: string
      }>`SELECT color FROM achievement WHERE user_id = ${uid}`
      return rows.map((r) => r.color)
    })
    /** Replace this user's whole succès set (only known colours are stored). */
    const setAchievements = (colors: ReadonlyArray<string>) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const uid = yield* requireUserId
          const valid = [...new Set(colors)].filter((c) => COLOR_BY_NAME.has(c))
          yield* sql`DELETE FROM achievement WHERE user_id = ${uid}`
          for (const c of valid)
            yield* sql`INSERT INTO achievement (user_id, color) VALUES (${uid}, ${c})`
          return valid
        })
      )

    // (Per-user: each user gets their first enclos lazily in `all` — no global startup enclos.)

    // ── Seed migration: the configured owner claims all pre-multi-user (orphan, user_id IS NULL)
    //    rows on first login. Cheap-skips once there are no orphans left. ──
    let seedClaimChecked = false
    const claimOrphansIfSeedOwner = (userId: string) =>
      Effect.gen(function* () {
        if (seedClaimChecked) return
        const seedId = process.env.SEED_OWNER_DISCORD_ID
        if (!seedId) {
          seedClaimChecked = true
          return
        }
        const orphans = yield* sql<{ n: number }>`SELECT
          (SELECT COUNT(*) FROM enclos WHERE user_id IS NULL)
          + (SELECT COUNT(*) FROM dragodinde WHERE user_id IS NULL)
          + (SELECT COUNT(*) FROM achievement WHERE user_id IS NULL) AS n`
        if ((orphans[0]?.n ?? 0) === 0) {
          seedClaimChecked = true // nothing left to claim
          return
        }
        // Owner = the user whose linked Discord account id matches SEED_OWNER_DISCORD_ID.
        const acc = yield* sql<{ accountId: string }>`
          SELECT accountId FROM account WHERE userId = ${userId} AND providerId = 'discord'`
        if (acc[0]?.accountId !== seedId) return // not the owner — leave the orphans for them
        yield* sql`UPDATE enclos SET user_id = ${userId} WHERE user_id IS NULL`
        yield* sql`UPDATE dragodinde SET user_id = ${userId} WHERE user_id IS NULL`
        yield* sql`UPDATE achievement SET user_id = ${userId} WHERE user_id IS NULL`
        seedClaimChecked = true
      })

    return {
      all,
      stable,
      allMounts,
      createEnclos,
      removeEnclos,
      patchEnclos,
      addDrago,
      recordCross,
      recordClone,
      importMounts,
      moveDrago,
      moveMany,
      patchMany,
      removeMany,
      removeDrago,
      patchDrago,
      sweep,
      webhookFor,
      getWebhook,
      setWebhook,
      getAiKey,
      hasAiKey,
      setAiKey,
      getAchievements,
      setAchievements,
      claimOrphansIfSeedOwner
    } as const
  })
}) {}
