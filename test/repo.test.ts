import { expect, it } from "@effect/vitest";
import { SqliteClient } from "@effect/sql-sqlite-node";
import { Effect, Layer, Option } from "effect";
import { Repo } from "../src/Repo.js";
import { STAT_MAX } from "../src/domain.js";

const TestRepo = Repo.Default.pipe(
  Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
);
const provide = <A, E>(self: Effect.Effect<A, E, Repo>) => self.pipe(Effect.provide(TestRepo));

/** Seed a mount into the stable, then move it into the given enclos (the new two-step flow). */
const addInEnclos = (enclosId: number) =>
  Effect.gen(function* () {
    const repo = yield* Repo;
    const d = Option.getOrThrow(yield* repo.addDrago());
    return Option.getOrThrow(yield* repo.moveDrago(d.id, enclosId));
  });

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

it.effect("an enclos holds at most MAX mounts (the 11th move is refused)", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const enclosId = (yield* repo.all)[0].id;
      const ids: number[] = [];
      for (let i = 0; i < 11; i++) ids.push(Option.getOrThrow(yield* repo.addDrago()).id);
      for (let i = 0; i < 10; i++) expect(Option.isSome(yield* repo.moveDrago(ids[i], enclosId))).toBe(true);
      expect((yield* repo.all)[0].dragodindes.length).toBe(10);
      expect(Option.isNone(yield* repo.moveDrago(ids[10], enclosId))).toBe(true); // enclos full
      expect((yield* repo.stable).length).toBe(1); // the 11th stays in the stable
    }),
  ),
);

it.effect("new mounts land in the stable; can be removed", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const d = Option.getOrThrow(yield* repo.addDrago());
      expect((yield* repo.stable).length).toBe(1);
      expect((yield* repo.all)[0].dragodindes.length).toBe(0); // not in any enclos
      expect(yield* repo.removeDrago(d.id)).toBe(true);
      expect((yield* repo.stable).length).toBe(0);
    }),
  ),
);

it.effect("registering a coloured mount auto-marks its succès (idempotent; '' ignored)", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      yield* repo.addDrago({ color: "Pourpre", sex: "F" });
      expect(yield* repo.getAchievements).toContain("Pourpre");
      yield* repo.addDrago({ color: "Pourpre", sex: "M" }); // same colour again
      yield* repo.addDrago(); // uncoloured -> no achievement
      expect(yield* repo.getAchievements).toEqual(["Pourpre"]); // idempotent, no junk
    }),
  ),
);

it.effect("removing an enclos returns its mounts to the stable (not deleted)", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const first = (yield* repo.all)[0].id;
      const e2 = Option.getOrThrow(yield* repo.createEnclos);
      yield* addInEnclos(e2.id);
      expect(yield* repo.removeEnclos(e2.id)).toBe(true);
      expect((yield* repo.stable).length).toBe(1); // mount survived, back in the stable
      expect((yield* repo.all).some((e) => e.id === first)).toBe(true);
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
      yield* addInEnclos(e.id);
      yield* addInEnclos(e.id); // 2 dragodindes (enclos starts empty)
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
      const d = yield* addInEnclos(e.id);
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

it.effect("clonage: the chosen survivor is refreshed to fertile (gauges reset), the other consumed", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      // Two same-generation steriles of DIFFERENT colours (Amande + Dorée are both gen 1).
      const { created } = yield* repo.importMounts(
        [
          { color: "Amande", sex: "M", status: "sterile" },
          { color: "Dorée", sex: "F", status: "sterile" },
        ],
        null,
      );
      const [survivor, consumed] = created;
      // Dirty the survivor's gauges so we can prove the reset.
      yield* repo.patchDrago(survivor.id, { stats: { amour: 12345, endurance: 6789 } });

      const out = Option.getOrThrow(yield* repo.recordClone({ survivorId: survivor.id, consumedId: consumed.id }));
      expect(out.id).toBe(survivor.id); // the survivor is the existing animal, not a new one
      expect(out.status).toBe("fertile"); // refreshed
      expect(out.color).toBe("Amande"); // keeps its own colour…
      expect(out.sex).toBe("M"); // …and sex…
      expect(out.stats).toEqual({ endurance: 0, maturite: 0, amour: 0, serenity: 0 }); // …gauges reset

      const stable = yield* repo.stable;
      expect(stable.length).toBe(1); // net -1: the consumed mount is gone
      expect(stable.some((d) => d.id === consumed.id)).toBe(false);
    }),
  ),
);

it.effect("clonage refuses a different-generation pair (and leaves both intact)", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const { created } = yield* repo.importMounts(
        [
          { color: "Amande", sex: "M", status: "sterile" }, // gen 1
          { color: "Ebène", sex: "F", status: "sterile" }, // gen 3
        ],
        null,
      );
      const [a, b] = created;
      expect(Option.isNone(yield* repo.recordClone({ survivorId: a.id, consumedId: b.id }))).toBe(true);
      expect((yield* repo.stable).length).toBe(2); // both still there
    }),
  ),
);

it.effect("clonage refuses when a mount is not sterile", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const { created } = yield* repo.importMounts(
        [
          { color: "Amande", sex: "M", status: "sterile" },
          { color: "Dorée", sex: "F", status: "fertile" }, // not sterile
        ],
        null,
      );
      const [a, b] = created;
      expect(Option.isNone(yield* repo.recordClone({ survivorId: a.id, consumedId: b.id }))).toBe(true);
      expect((yield* repo.stable).length).toBe(2);
    }),
  ),
);

it.effect("serenity pings on entering the band, not when already inside", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      const e = (yield* repo.all)[0];
      // both present before focusing so the bar isn't auto-unchecked prematurely
      const a = yield* addInEnclos(e.id);
      const b = yield* addInEnclos(e.id);
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

it.effect("editing a mount's sex rebuilds its auto-name so it never reads as the wrong sex", () =>
  provide(
    Effect.gen(function* () {
      const repo = yield* Repo;
      // A captured male, auto-named by the convention (its name carries the `-m-` sex segment).
      const m = Option.getOrThrow(yield* repo.addDrago({ color: "Pourpre", sex: "M" }));
      expect(m.name).toBe("p-m");

      // Correct a mis-recorded sex M -> F. The auto-name must follow, not keep the stale `-m-`
      // (a stale name made an M×F breed pair render as M×M in the assistant).
      const fixed = Option.getOrThrow(yield* repo.patchDrago(m.id, { sex: "F" }));
      expect(fixed.sex).toBe("F");
      expect(fixed.name).toBe("p-f");

      // A user-given custom name is preserved verbatim across a sex edit (not a convention name).
      const named = Option.getOrThrow(yield* repo.patchDrago(m.id, { name: "Bella" }));
      const reSexed = Option.getOrThrow(yield* repo.patchDrago(named.id, { sex: "M" }));
      expect(reSexed.name).toBe("Bella");
    }),
  ),
);
