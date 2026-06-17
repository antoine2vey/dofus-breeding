import { SqlClient } from "@effect/sql";
import { Effect, Option } from "effect";
import {
  type Dragodinde,
  type Enclos,
  type FocusKey,
  type FuelKey,
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
  readonly fertile: number;
  readonly keeper: number;
  readonly parent_a_id: number | null;
  readonly parent_b_id: number | null;
}

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
  fertile: (r.fertile ?? 1) === 1,
  keeper: (r.keeper ?? 0) === 1,
  parentA: r.parent_a_id ?? null,
  parentB: r.parent_b_id ?? null,
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
  readonly fertile?: boolean;
  readonly keeper?: boolean;
}

export interface SeedInput {
  readonly color?: string;
  readonly sex?: Sex;
  readonly fertile?: boolean;
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
    yield* ensureCol("fertile", "fertile INTEGER NOT NULL DEFAULT 1");
    yield* ensureCol("keeper", "keeper INTEGER NOT NULL DEFAULT 0");
    yield* ensureCol("parent_a_id", "parent_a_id INTEGER");
    yield* ensureCol("parent_b_id", "parent_b_id INTEGER");

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
        fertile = ${d.fertile ? 1 : 0},
        keeper = ${d.keeper ? 1 : 0},
        parent_a_id = ${d.parentA},
        parent_b_id = ${d.parentB}
      WHERE id = ${d.id}
    `;

    interface InsertOpts {
      readonly name: string;
      readonly color?: string;
      readonly sex?: Sex;
      readonly fertile?: boolean;
      readonly parentA?: number | null;
      readonly parentB?: number | null;
    }
    const insertDrago = (enclosId: number, opts: InsertOpts) =>
      Effect.gen(function* () {
        const rows = yield* sql<DragoRow>`
          INSERT INTO dragodinde (enclos_id, name, color, sex, fertile, parent_a_id, parent_b_id)
          VALUES (
            ${enclosId}, ${opts.name}, ${opts.color ?? ""}, ${opts.sex ?? "F"},
            ${opts.fertile === false ? 0 : 1}, ${opts.parentA ?? null}, ${opts.parentB ?? null}
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
          fertile: seed?.fertile,
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
            fertile: true,
            parentA: input.parentAId,
            parentB: input.parentBId,
          });
          yield* sql`UPDATE dragodinde SET fertile = 0 WHERE id IN (${input.parentAId}, ${input.parentBId})`;
          return Option.some(baby);
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
            fertile: typeof body.fertile === "boolean" ? body.fertile : current.fertile,
            keeper: typeof body.keeper === "boolean" ? body.keeper : current.keeper,
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
      removeDrago,
      patchDrago,
      tickAll,
      getWebhook,
      setWebhook,
    } as const;
  }),
}) {}
