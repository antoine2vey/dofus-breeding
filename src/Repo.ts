import { SqlClient } from "@effect/sql";
import { Effect, Option } from "effect";
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
  SERENITY_MAX,
  SERENITY_MIN,
  STAT_MAX,
  clamp,
  emptyFuel,
  focusAllMaxed,
  reproStatus,
  tickEnclos,
} from "./domain.js";

interface EnclosRow {
  readonly id: number;
  readonly name: string;
  readonly fuel_serenityMinus: number;
  readonly fuel_serenityPlus: number;
  readonly fuel_endurance: number;
  readonly fuel_maturite: number;
  readonly fuel_amour: number;
  readonly focus: string;
}

interface DragoRow {
  readonly id: number;
  readonly enclos_id: number;
  readonly name: string;
  readonly stat_endurance: number;
  readonly stat_maturite: number;
  readonly stat_amour: number;
  readonly stat_serenity: number;
  readonly notified: number;
  readonly color: string;
  readonly sex: string;
  readonly fertile: number; // legacy boolean column, superseded by `status`
  readonly status: string | null;
  readonly keeper: number;
  readonly parent_a_id: number | null;
  readonly parent_b_id: number | null;
  readonly grand_a: string | null;
  readonly grand_b: string | null;
}

/** Normalise a stored status, falling back to the legacy `fertile` boolean for old rows. */
const statusFromRow = (r: DragoRow): ReproStatus => {
  if (r.status === "sterile" || r.status === "fertile" || r.status === "feconde") return r.status;
  return (r.fertile ?? 1) === 0 ? "sterile" : "feconde";
};

const dragoFromRow = (r: DragoRow): Dragodinde => ({
  id: r.id,
  name: r.name,
  stats: {
    endurance: r.stat_endurance,
    maturite: r.stat_maturite,
    amour: r.stat_amour,
    serenity: r.stat_serenity,
  },
  notified: r.notified === 1,
  color: r.color ?? "",
  sex: (r.sex === "M" ? "M" : "F") as Sex,
  status: statusFromRow(r),
  keeper: (r.keeper ?? 0) === 1,
  parentA: r.parent_a_id ?? null,
  parentB: r.parent_b_id ?? null,
  grandparents: [r.grand_a, r.grand_b].filter((c): c is string => !!c),
});

const fuelFromRow = (r: EnclosRow): Record<FuelKey, number> => ({
  serenityMinus: r.fuel_serenityMinus,
  serenityPlus: r.fuel_serenityPlus,
  endurance: r.fuel_endurance,
  maturite: r.fuel_maturite,
  amour: r.fuel_amour,
});

export interface EnclosPatch {
  readonly name?: string;
  readonly fuel?: Partial<Record<FuelKey, number>>;
  readonly focus?: ReadonlyArray<string>;
}

export interface DragoPatch {
  readonly name?: string;
  readonly stats?: Partial<Record<StatKey, number>>;
  readonly color?: string;
  readonly sex?: Sex;
  readonly status?: ReproStatus;
  readonly keeper?: boolean;
  readonly grandparents?: ReadonlyArray<string>;
}

/** One mount to bulk-import (decoded from an in-game name, with fertility from the screen). */
export interface ImportRow {
  readonly name?: string;
  readonly color: string;
  readonly sex: Sex;
  readonly status?: ReproStatus;
  readonly keeper?: boolean;
  readonly grandparents?: ReadonlyArray<string>;
}

export interface SeedInput {
  readonly color?: string;
  readonly sex?: Sex;
  readonly status?: ReproStatus;
  readonly name?: string;
}

/** Record one breeding: a baby of `color`/`sex` whose parents are sterilised. */
export interface CrossInput {
  readonly parentAId: number;
  readonly parentBId: number;
  readonly color: string;
  readonly sex: Sex;
  readonly enclosId?: number; // defaults to parent A's enclos
  readonly name?: string;
}

/** Record one clonage: two same-colour steriles consumed -> one fresh fertile of that colour. */
export interface CloneInput {
  readonly aId: number;
  readonly bId: number;
  readonly sex: Sex; // the gender that actually came back
  readonly enclosId?: number; // defaults to input A's enclos
  readonly name?: string;
}

export interface CompletedItem {
  readonly enclosName: string;
  readonly focus: ReadonlyArray<FocusKey>;
  readonly dragodinde: Dragodinde;
}

// Keep only valid focus keys, capped to the last MAX_FOCUS (rolling: newest win).
const sanitizeFocus = (input: ReadonlyArray<string>): ReadonlyArray<FocusKey> => {
  const valid = input.filter((f): f is FocusKey => (FOCUSABLE as ReadonlyArray<string>).includes(f));
  return valid.slice(Math.max(0, valid.length - MAX_FOCUS));
};

// Re-derive a dragodinde's done-state from its stats + the enclos focus. Notifications
// fire only on a tick transition, so an edit that already satisfies the goal is marked
// done (no ping); one that drops below re-arms.
const withDoneState = (d: Dragodinde, focus: ReadonlyArray<FocusKey>): Dragodinde => ({
  ...d,
  notified: focusAllMaxed(focus, d.stats),
});

const changed = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b);

export class Repo extends Effect.Service<Repo>()("app/Repo", {
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    yield* sql`
      CREATE TABLE IF NOT EXISTS enclos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        fuel_serenityMinus INTEGER NOT NULL DEFAULT 0,
        fuel_serenityPlus INTEGER NOT NULL DEFAULT 0,
        fuel_endurance INTEGER NOT NULL DEFAULT 0,
        fuel_maturite INTEGER NOT NULL DEFAULT 0,
        fuel_amour INTEGER NOT NULL DEFAULT 0,
        focus TEXT NOT NULL DEFAULT '["endurance","amour"]'
      )
    `;
    yield* sql`
      CREATE TABLE IF NOT EXISTS dragodinde (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enclos_id INTEGER NOT NULL REFERENCES enclos(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        stat_endurance INTEGER NOT NULL DEFAULT 0,
        stat_maturite INTEGER NOT NULL DEFAULT 0,
        stat_amour INTEGER NOT NULL DEFAULT 0,
        stat_serenity INTEGER NOT NULL DEFAULT 0,
        notified INTEGER NOT NULL DEFAULT 0
      )
    `;
    // Additive migration: breeding identity + lineage columns (Phase 1). The base schema
    // only does CREATE TABLE IF NOT EXISTS, so add any missing columns to existing DBs.
    const dragoCols = yield* sql<{ name: string }>`SELECT name FROM pragma_table_info('dragodinde')`;
    const haveCol = new Set(dragoCols.map((c) => c.name));
    const ensureCol = (name: string, ddl: string) =>
      haveCol.has(name) ? Effect.void : sql.unsafe(`ALTER TABLE dragodinde ADD COLUMN ${ddl}`);
    yield* ensureCol("color", "color TEXT NOT NULL DEFAULT ''");
    yield* ensureCol("sex", "sex TEXT NOT NULL DEFAULT 'F'");
    yield* ensureCol("fertile", "fertile INTEGER NOT NULL DEFAULT 1"); // legacy, kept for old DBs
    yield* ensureCol("keeper", "keeper INTEGER NOT NULL DEFAULT 0");
    // 3-state reproduction status (sterile / fertile / feconde), superseding the boolean.
    const addedStatus = !haveCol.has("status");
    yield* ensureCol("status", "status TEXT NOT NULL DEFAULT 'fertile'");
    if (addedStatus) {
      // sterile if it had bred; else féconde only when its 3 gauges are maxed, otherwise fertile.
      yield* sql`UPDATE dragodinde SET status = CASE
        WHEN fertile = 0 THEN 'sterile'
        WHEN stat_endurance >= ${STAT_MAX} AND stat_maturite >= ${STAT_MAX} AND stat_amour >= ${STAT_MAX} THEN 'feconde'
        ELSE 'fertile' END`;
    }
    yield* ensureCol("parent_a_id", "parent_a_id INTEGER");
    yield* ensureCol("parent_b_id", "parent_b_id INTEGER");
    // Grandparent colours, denormalised (Phase: name-encoded lineage / import).
    const addedGrandA = !haveCol.has("grand_a");
    yield* ensureCol("grand_a", "grand_a TEXT");
    yield* ensureCol("grand_b", "grand_b TEXT");
    // One-time backfill from existing parent rows so current lineage isn't lost.
    if (addedGrandA) {
      yield* sql`
        UPDATE dragodinde SET grand_a = (SELECT p.color FROM dragodinde p WHERE p.id = dragodinde.parent_a_id)
        WHERE parent_a_id IS NOT NULL
      `;
      yield* sql`
        UPDATE dragodinde SET grand_b = (SELECT p.color FROM dragodinde p WHERE p.id = dragodinde.parent_b_id)
        WHERE parent_b_id IS NOT NULL
      `;
    }

    yield* sql`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        webhook_url TEXT NOT NULL DEFAULT ''
      )
    `;
    yield* sql`INSERT OR IGNORE INTO settings (id, webhook_url) VALUES (1, '')`;

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
    `;

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
        fertile = ${d.status === "sterile" ? 0 : 1},
        keeper = ${d.keeper ? 1 : 0},
        parent_a_id = ${d.parentA},
        parent_b_id = ${d.parentB},
        grand_a = ${d.grandparents[0] ?? null},
        grand_b = ${d.grandparents[1] ?? null}
      WHERE id = ${d.id}
    `;

    interface InsertOpts {
      readonly name: string;
      readonly color?: string;
      readonly sex?: Sex;
      readonly status?: ReproStatus;
      readonly keeper?: boolean;
      readonly parentA?: number | null;
      readonly parentB?: number | null;
      readonly grandparents?: ReadonlyArray<string>;
    }
    const insertDrago = (enclosId: number, opts: InsertOpts) =>
      Effect.gen(function* () {
        const gps = opts.grandparents ?? [];
        const status = opts.status ?? "fertile";
        const rows = yield* sql<DragoRow>`
          INSERT INTO dragodinde
            (enclos_id, name, color, sex, status, fertile, keeper, parent_a_id, parent_b_id, grand_a, grand_b)
          VALUES (
            ${enclosId}, ${opts.name}, ${opts.color ?? ""}, ${opts.sex ?? "F"},
            ${status}, ${status === "sterile" ? 0 : 1}, ${opts.keeper ? 1 : 0},
            ${opts.parentA ?? null}, ${opts.parentB ?? null}, ${gps[0] ?? null}, ${gps[1] ?? null}
          ) RETURNING *
        `;
        return dragoFromRow(rows[0]);
      });

    const all = Effect.gen(function* () {
      const enclosRows = yield* sql<EnclosRow>`SELECT * FROM enclos ORDER BY id`;
      const dragoRows = yield* sql<DragoRow>`SELECT * FROM dragodinde ORDER BY id`;
      const byEnclos = new Map<number, Array<Dragodinde>>();
      for (const r of dragoRows) {
        const list = byEnclos.get(r.enclos_id) ?? [];
        list.push(dragoFromRow(r));
        byEnclos.set(r.enclos_id, list);
      }
      return enclosRows.map(
        (r): Enclos => ({
          id: r.id,
          name: r.name,
          fuel: fuelFromRow(r),
          focus: sanitizeFocus(JSON.parse(r.focus) as ReadonlyArray<string>),
          dragodindes: byEnclos.get(r.id) ?? [],
        }),
      );
    });

    const countEnclos = sql<{ n: number }>`SELECT COUNT(*) AS n FROM enclos`.pipe(
      Effect.map((rows) => rows[0]?.n ?? 0),
    );
    const countDragos = (enclosId: number) =>
      sql<{ n: number }>`SELECT COUNT(*) AS n FROM dragodinde WHERE enclos_id = ${enclosId}`.pipe(
        Effect.map((rows) => rows[0]?.n ?? 0),
      );

    const createEnclos = Effect.gen(function* () {
      if ((yield* countEnclos) >= MAX_ENCLOS) return Option.none<Enclos>();
      const rows = yield* sql<{ id: number }>`
        INSERT INTO enclos (name) VALUES (${"Enclosure"}) RETURNING id
      `;
      const id = rows[0].id;
      yield* sql`UPDATE enclos SET name = ${`Enclosure ${id}`} WHERE id = ${id}`;
      return Option.some<Enclos>({
        id,
        name: `Enclosure ${id}`,
        fuel: emptyFuel(),
        focus: DEFAULT_FOCUS,
        dragodindes: [], // starts empty
      });
    });

    const removeEnclos = (id: number) =>
      Effect.gen(function* () {
        if ((yield* countEnclos) <= 1) return false;
        yield* sql`DELETE FROM dragodinde WHERE enclos_id = ${id}`;
        yield* sql`DELETE FROM enclos WHERE id = ${id}`;
        return true;
      });

    const patchEnclos = (id: number, body: EnclosPatch) =>
      Effect.gen(function* () {
        const rows = yield* sql<EnclosRow>`SELECT * FROM enclos WHERE id = ${id}`;
        if (!rows[0]) return false;
        const r = rows[0];
        const fuel = fuelFromRow(r);
        if (body.fuel) {
          for (const k of FUEL_KEYS) {
            const v = body.fuel[k];
            if (v != null) fuel[k] = clamp(Number(v) || 0, 0, FUEL_MAX);
          }
        }
        const focus = Array.isArray(body.focus)
          ? sanitizeFocus(body.focus)
          : sanitizeFocus(JSON.parse(r.focus) as ReadonlyArray<string>);
        const name = typeof body.name === "string" ? body.name.slice(0, 40) : r.name;
        yield* writeEnclos({ id, name, fuel, focus, dragodindes: [] });

        // Focus changed -> resync each dragodinde's done-state (re-arm if newly
        // unsatisfied; mark satisfied if it already meets the new focus -> no ping).
        if (Array.isArray(body.focus)) {
          const dragos = yield* sql<DragoRow>`SELECT * FROM dragodinde WHERE enclos_id = ${id}`;
          for (const dr of dragos) {
            const d = dragoFromRow(dr);
            const synced = withDoneState(d, focus);
            if (synced.notified !== d.notified) yield* writeDrago(synced);
          }
        }
        return true;
      });

    const addDrago = (enclosId: number, seed?: SeedInput) =>
      Effect.gen(function* () {
        const rows = yield* sql<{ focus: string }>`SELECT focus FROM enclos WHERE id = ${enclosId}`;
        if (!rows[0]) return Option.none<Dragodinde>();
        const n = yield* countDragos(enclosId);
        if (n >= MAX_DRAGODINDES) return Option.none<Dragodinde>();
        const created = yield* insertDrago(enclosId, {
          name: seed?.name ?? `Dragodinde ${n + 1}`,
          color: seed?.color,
          sex: seed?.sex,
          status: seed?.status,
        });
        // A fresh dragodinde that already satisfies the focus (e.g. serenity 0 in band)
        // is marked done so it won't ping.
        const focus = sanitizeFocus(JSON.parse(rows[0].focus) as ReadonlyArray<string>);
        const drago = withDoneState(created, focus);
        if (drago.notified !== created.notified) yield* writeDrago(drago);
        return Option.some(drago);
      });

    /** Record a real breeding: insert the baby with its parents, sterilise both parents. */
    const recordCross = (input: CrossInput) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const parents = yield* sql<DragoRow>`
            SELECT * FROM dragodinde WHERE id IN (${input.parentAId}, ${input.parentBId})
          `;
          const a = parents.find((p) => p.id === input.parentAId);
          const b = parents.find((p) => p.id === input.parentBId);
          if (!a || !b) return Option.none<Dragodinde>();
          const enclosId = input.enclosId ?? a.enclos_id;
          const n = yield* countDragos(enclosId);
          if (n >= MAX_DRAGODINDES) return Option.none<Dragodinde>();
          const baby = yield* insertDrago(enclosId, {
            name: input.name ?? input.color,
            color: input.color,
            sex: input.sex,
            status: "fertile", // a newborn isn't féconde yet — its gauges must be raised first
            parentA: input.parentAId,
            parentB: input.parentBId,
            grandparents: [a.color, b.color].filter((c) => !!c),
          });
          yield* sql`UPDATE dragodinde SET status = 'sterile', fertile = 0 WHERE id IN (${input.parentAId}, ${input.parentBId})`;
          return Option.some(baby);
        }),
      );

    /** Record a clonage: consume two same-colour steriles, produce one fresh fertile of
     * that colour (gauges reset, no lineage — matches the engine's clone model). */
    const recordClone = (input: CloneInput) =>
      sql.withTransaction(
        Effect.gen(function* () {
          if (input.aId === input.bId) return Option.none<Dragodinde>();
          const rows = yield* sql<DragoRow>`
            SELECT * FROM dragodinde WHERE id IN (${input.aId}, ${input.bId})
          `;
          const a = rows.find((p) => p.id === input.aId);
          const b = rows.find((p) => p.id === input.bId);
          if (!a || !b) return Option.none<Dragodinde>();
          if (!a.color || a.color !== b.color) return Option.none<Dragodinde>();
          const enclosId = input.enclosId ?? a.enclos_id;
          const exists = yield* sql<{ id: number }>`SELECT id FROM enclos WHERE id = ${enclosId}`;
          if (!exists[0]) return Option.none<Dragodinde>();
          yield* sql`DELETE FROM dragodinde WHERE id IN (${input.aId}, ${input.bId})`;
          const clone = yield* insertDrago(enclosId, {
            name: input.name ?? a.color,
            color: a.color,
            sex: input.sex,
            status: "fertile", // gauges reset to 0 — not féconde until raised
          });
          return Option.some(clone);
        }),
      );

    /** Bulk-insert mounts into one enclos (up to its cap). Returns the created list and how
     * many were skipped because the enclos was full. */
    const importMounts = (enclosId: number, mounts: ReadonlyArray<ImportRow>) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const exists = yield* sql<{ id: number }>`SELECT id FROM enclos WHERE id = ${enclosId}`;
          if (!exists[0]) return { created: [] as Dragodinde[], skipped: mounts.length };
          let n = yield* countDragos(enclosId);
          const created: Dragodinde[] = [];
          let skipped = 0;
          for (const r of mounts) {
            if (n >= MAX_DRAGODINDES) {
              skipped++;
              continue;
            }
            const d = yield* insertDrago(enclosId, {
              name: r.name ?? r.color,
              color: r.color,
              sex: r.sex,
              status: r.status,
              keeper: r.keeper,
              grandparents: r.grandparents,
            });
            created.push(d);
            n++;
          }
          return { created, skipped };
        }),
      );

    const removeDrago = (id: number) =>
      Effect.gen(function* () {
        const rows = yield* sql<{ id: number }>`SELECT id FROM dragodinde WHERE id = ${id}`;
        if (!rows[0]) return false;
        yield* sql`DELETE FROM dragodinde WHERE id = ${id}`;
        return true;
      });

    const patchDrago = (id: number, body: DragoPatch) =>
      Effect.gen(function* () {
        const rows = yield* sql<DragoRow & { focus: string }>`
          SELECT d.*, e.focus AS focus FROM dragodinde d
          JOIN enclos e ON e.id = d.enclos_id WHERE d.id = ${id}
        `;
        if (!rows[0]) return Option.none<Dragodinde>();
        const focus = sanitizeFocus(JSON.parse(rows[0].focus) as ReadonlyArray<string>);
        const current = dragoFromRow(rows[0]);
        const stats = { ...current.stats };
        if (body.stats) {
          for (const k of ["endurance", "maturite", "amour"] as const) {
            const v = body.stats[k];
            if (v != null) stats[k] = clamp(Number(v) || 0, 0, STAT_MAX);
          }
          if (body.stats.serenity != null)
            stats.serenity = clamp(Number(body.stats.serenity) || 0, SERENITY_MIN, SERENITY_MAX);
        }
        const name = typeof body.name === "string" ? body.name.slice(0, 40) : current.name;
        const next = withDoneState(
          {
            ...current,
            name,
            stats,
            color: typeof body.color === "string" ? body.color : current.color,
            sex: body.sex === "M" || body.sex === "F" ? body.sex : current.sex,
            status: reproStatus(
              body.status === "sterile" || body.status === "fertile" || body.status === "feconde"
                ? body.status
                : current.status,
              stats,
            ),
            keeper: typeof body.keeper === "boolean" ? body.keeper : current.keeper,
            grandparents: Array.isArray(body.grandparents)
              ? body.grandparents.filter((c): c is string => typeof c === "string" && !!c).slice(0, 2)
              : current.grandparents,
          },
          focus,
        );
        yield* writeDrago(next);
        return Option.some(next);
      });

    /** Advance every enclos one tick; return the dragodindes that just completed. */
    const tickAll = sql.withTransaction(
      Effect.gen(function* () {
        const list = yield* all;
        const completed: Array<CompletedItem> = [];
        for (const e of list) {
          const result = tickEnclos(e);
          if (changed(result.enclos.fuel, e.fuel) || changed(result.enclos.focus, e.focus)) {
            yield* writeEnclos(result.enclos);
          }
          for (let i = 0; i < result.enclos.dragodindes.length; i++) {
            const after = result.enclos.dragodindes[i];
            if (changed(e.dragodindes[i], after)) yield* writeDrago(after);
          }
          for (const d of result.completed) {
            completed.push({ enclosName: e.name, focus: e.focus, dragodinde: d });
          }
        }
        return completed;
      }),
    );

    const getWebhook = sql<{ webhook_url: string }>`
      SELECT webhook_url FROM settings WHERE id = 1
    `.pipe(Effect.map((rows) => rows[0]?.webhook_url ?? ""));

    const setWebhook = (url: string) =>
      sql`UPDATE settings SET webhook_url = ${url} WHERE id = 1`.pipe(Effect.asVoid);

    if ((yield* countEnclos) === 0) yield* createEnclos;

    return {
      all,
      createEnclos,
      removeEnclos,
      patchEnclos,
      addDrago,
      recordCross,
      recordClone,
      importMounts,
      removeDrago,
      patchDrago,
      tickAll,
      getWebhook,
      setWebhook,
    } as const;
  }),
}) {}
