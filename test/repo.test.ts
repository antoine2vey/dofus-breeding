import { expect, it } from "@effect/vitest";
import { SqliteClient } from "@effect/sql-sqlite-node";
import { Effect, Layer, Option } from "effect";
import { Repo } from "../src/Repo.js";
import { STAT_MAX } from "../src/domain.js";

const TestRepo = Repo.Default.pipe(
  Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
);
const provide = <A, E>(self: Effect.Effect<A, E, Repo>) => self.pipe(Effect.provide(TestRepo));

it.effect("seeds one enclos (default focus) with NO dragodinde", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const all = yield* repo.all;
      expect(all.length).toBe(1);
      expect(all[0].focus).toEqual(["endurance", "amour"]); // default 2
      expect(all[0].dragodindes.length).toBe(0); // empty on create
    }),
  ),
);

it.effect("adds dragodindes up to MAX then refuses", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const enclosId = (yield* repo.all)[0].id;
      for (let i = 0; i < 10; i++) expect(Option.isSome(yield* repo.addDrago(enclosId))).toBe(true);
      expect((yield* repo.all)[0].dragodindes.length).toBe(10);
      expect(Option.isNone(yield* repo.addDrago(enclosId))).toBe(true);
    }),
  ),
);

it.effect("can remove the last dragodinde (enclos may be empty)", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const enclosId = (yield* repo.all)[0].id;
      const d = yield* repo.addDrago(enclosId);
      const id = Option.getOrThrow(d).id;
      expect(yield* repo.removeDrago(id)).toBe(true);
      expect((yield* repo.all)[0].dragodindes.length).toBe(0);
    }),
  ),
);

it.effect("patchEnclos sets focus (shared) and clamps fuel", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const e = (yield* repo.all)[0];
      yield* repo.patchEnclos(e.id, { fuel: { amour: 999999 }, focus: ["amour"] });
      const after = (yield* repo.all)[0];
      expect(after.fuel.amour).toBe(100000); // clamped
      expect(after.focus).toEqual(["amour"]);
    }),
  ),
);

it.effect("focus is capped to the last 2 (rolling)", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const id = (yield* repo.all)[0].id;
      yield* repo.patchEnclos(id, { focus: ["endurance", "maturite", "amour"] });
      expect((yield* repo.all)[0].focus).toEqual(["maturite", "amour"]); // oldest dropped
    }),
  ),
);

it.effect("enclos focus applies to every dragodinde for completion, once, grouped", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const e = (yield* repo.all)[0];
      yield* repo.addDrago(e.id);
      yield* repo.addDrago(e.id); // 2 dragodindes (enclos starts empty)
      const dragos = (yield* repo.all)[0].dragodindes;

      // focus amour with fuel; both dragodindes just below max -> they cross 20k on the tick
      yield* repo.patchEnclos(e.id, { focus: ["amour"], fuel: { amour: 95000 } });
      for (const d of dragos) yield* repo.patchDrago(d.id, { stats: { amour: 19990 } });

      const c1 = yield* repo.tickAll;
      expect(c1.length).toBe(2); // both complete in the same tick -> grouped
      expect(c1[0].focus).toEqual(["amour"]);
      const c2 = yield* repo.tickAll;
      expect(c2.length).toBe(0);
    }),
  ),
);

it.effect("changing enclos focus re-arms a dragodinde that no longer qualifies", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const e = (yield* repo.all)[0];
      const d = Option.getOrThrow(yield* repo.addDrago(e.id));
      yield* repo.patchEnclos(e.id, { focus: ["amour"], fuel: { amour: 95000 } });
      yield* repo.patchDrago(d.id, { stats: { amour: 19990 } });
      expect((yield* repo.tickAll).length).toBe(1); // crosses 20k on the tick -> completes
      // now require maturite too -> dragodinde no longer done -> re-armed
      yield* repo.patchEnclos(e.id, { focus: ["amour", "maturite"] });
      const after = (yield* repo.all)[0].dragodindes[0];
      expect(after.notified).toBe(false);
    }),
  ),
);

it.effect("serenity pings on entering the band, not when already inside", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const e = (yield* repo.all)[0];
      // both present before focusing so the bar isn't auto-unchecked prematurely
      const a = Option.getOrThrow(yield* repo.addDrago(e.id));
      const b = Option.getOrThrow(yield* repo.addDrago(e.id));
      yield* repo.patchEnclos(e.id, { focus: ["serenityPlus"], fuel: { serenityPlus: 95000 } });
      yield* repo.patchDrago(a.id, { stats: { serenity: 0 } }); // inside band -> no ping
      yield* repo.patchDrago(b.id, { stats: { serenity: -230 } }); // outside -> will enter & ping

      const c = yield* repo.tickAll; // b: -230 -> -190 enters band -> ping
      expect(c.length).toBe(1);
      expect(c[0].dragodinde.id).toBe(b.id);
      // both now inside the band -> serenityPlus auto-unchecked (front & back)
      expect((yield* repo.all)[0].focus).toEqual([]);
    }),
  ),
);
