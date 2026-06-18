import { describe, expect, it } from "vitest";
import { resolveColor, buildName } from "@dd/core";
import {
  bandRate,
  focusAllMaxed,
  makeDragodinde,
  tickEnclos,
  DEFAULT_FOCUS,
  STAT_MAX,
  type Dragodinde,
  type Enclos,
  type FocusKey,
  type FuelKey,
} from "../src/domain.js";

describe("bandRate", () => {
  it("picks the rate from the fuel band", () => {
    expect(bandRate(100000)).toBe(40);
    expect(bandRate(90001)).toBe(40);
    expect(bandRate(90000)).toBe(30); // boundary: not > 90000
    expect(bandRate(70000)).toBe(20);
    expect(bandRate(40000)).toBe(10);
    expect(bandRate(0)).toBe(0);
  });
});

const enclos = (
  fuel: Partial<Record<FuelKey, number>>,
  dragodindes: Dragodinde[],
  focus: ReadonlyArray<FocusKey> = DEFAULT_FOCUS,
): Enclos => ({
  id: 1,
  name: "Enclos 1",
  fuel: { serenityMinus: 0, serenityPlus: 0, endurance: 0, maturite: 0, amour: 0, ...fuel },
  focus,
  dragodindes,
});

describe("tickEnclos", () => {
  it("matches the amour example: 80k band gives +30/tick to every dragodinde", () => {
    let e = enclos({ amour: 80000 }, [makeDragodinde(1)]);
    let r = tickEnclos(e);
    expect(r.enclos.dragodindes[0].stats.amour).toBe(30);
    expect(r.enclos.fuel.amour).toBe(79970);
    r = tickEnclos(r.enclos);
    expect(r.enclos.dragodindes[0].stats.amour).toBe(60);
  });

  it("feeds all dragodindes from the shared fuel", () => {
    const a = { ...makeDragodinde(1), stats: { endurance: 0, maturite: 0, amour: 100, serenity: 0 } };
    const b = { ...makeDragodinde(2), stats: { endurance: 0, maturite: 0, amour: 500, serenity: 0 } };
    const r = tickEnclos(enclos({ amour: 95000 }, [a, b]));
    expect(r.enclos.dragodindes[0].stats.amour).toBe(140); // +40
    expect(r.enclos.dragodindes[1].stats.amour).toBe(540); // +40
  });

  it("caps stats at STAT_MAX and clamps serenity", () => {
    const d: Dragodinde = {
      ...makeDragodinde(1),
      stats: { endurance: 0, maturite: 0, amour: 19990, serenity: -4990 },
    };
    // both checked (max 2): amour + serenityMinus
    const r = tickEnclos(enclos({ amour: 95000, serenityMinus: 95000 }, [d], ["amour", "serenityMinus"]));
    expect(r.enclos.dragodindes[0].stats.amour).toBe(STAT_MAX);
    expect(r.enclos.dragodindes[0].stats.serenity).toBe(-5000); // clamped to SERENITY_MIN
  });

  it("completes per dragodinde using the enclos focus, once", () => {
    const d: Dragodinde = {
      ...makeDragodinde(1),
      stats: { endurance: STAT_MAX, maturite: 0, amour: 19990, serenity: 0 },
    };
    const e = enclos({ amour: 95000 }, [d], ["endurance", "amour"]); // focus on enclos
    const first = tickEnclos(e);
    expect(first.completed.length).toBe(1);
    expect(first.completed[0].notified).toBe(true);
    expect(focusAllMaxed(e.focus, first.enclos.dragodindes[0].stats)).toBe(true);

    const second = tickEnclos(first.enclos);
    expect(second.completed.length).toBe(0); // already notified
  });

  it("only ticks checked bars — serenity included, gated by its own checkbox", () => {
    const d: Dragodinde = {
      ...makeDragodinde(1),
      stats: { endurance: 0, maturite: 0, amour: 0, serenity: -300 }, // out of band so the bar runs
    };
    const e = enclos(
      { endurance: 95000, maturite: 95000, amour: 95000, serenityPlus: 95000, serenityMinus: 95000 },
      [d],
      ["amour", "serenityPlus"],
    );
    const r = tickEnclos(e);
    // checked -> drains + feeds
    expect(r.enclos.dragodindes[0].stats.amour).toBe(40);
    expect(r.enclos.fuel.amour).toBe(95000 - 40);
    expect(r.enclos.dragodindes[0].stats.serenity).toBe(-260); // serenityPlus raises -300 -> -260
    expect(r.enclos.fuel.serenityPlus).toBe(95000 - 40);
    // unchecked -> untouched (serenityMinus too)
    expect(r.enclos.dragodindes[0].stats.endurance).toBe(0);
    expect(r.enclos.fuel.endurance).toBe(95000);
    expect(r.enclos.fuel.serenityMinus).toBe(95000);
  });

  it("a checked serenityPlus bar completes when serenity enters the [-200,200] band", () => {
    const d: Dragodinde = {
      ...makeDragodinde(1),
      stats: { endurance: 0, maturite: 0, amour: 0, serenity: -230 },
    };
    const first = tickEnclos(enclos({ serenityPlus: 95000 }, [d], ["serenityPlus"]));
    expect(first.enclos.dragodindes[0].stats.serenity).toBe(-190); // entered the band
    expect(first.completed.length).toBe(1);
  });

  it("serenity already inside the band does not (re)complete on its own", () => {
    const d: Dragodinde = {
      ...makeDragodinde(1),
      notified: true, // already satisfied -> set up as done
      stats: { endurance: 0, maturite: 0, amour: 0, serenity: 0 },
    };
    const r = tickEnclos(enclos({ serenityPlus: 95000 }, [d], ["serenityPlus"]));
    expect(r.completed.length).toBe(0);
    expect(r.enclos.fuel.serenityPlus).toBe(95000); // frozen — nobody needs it
  });

  it("freezes a focused bar once EVERY dragodinde maxed its goal", () => {
    const a = { ...makeDragodinde(1), stats: { endurance: 0, maturite: 0, amour: STAT_MAX, serenity: 0 } };
    const b = { ...makeDragodinde(2), stats: { endurance: 0, maturite: 0, amour: STAT_MAX, serenity: 0 } };
    const r = tickEnclos(enclos({ amour: 95000 }, [a, b], ["amour"]));
    expect(r.enclos.fuel.amour).toBe(95000); // no drain — all dragodindes done with amour
  });

  it("auto-unchecks a focused bar once every dragodinde reaches its goal", () => {
    const a = { ...makeDragodinde(1), stats: { endurance: 0, maturite: 0, amour: STAT_MAX, serenity: 0 } };
    const b = { ...makeDragodinde(2), stats: { endurance: 0, maturite: 0, amour: STAT_MAX, serenity: 0 } };
    const r = tickEnclos(enclos({ amour: 95000 }, [a, b], ["endurance", "amour"]));
    expect(r.enclos.focus).toEqual(["endurance"]); // amour reached by all -> unchecked; endurance stays
  });

  it("keeps draining while at least one dragodinde still needs the stat", () => {
    const maxed = { ...makeDragodinde(1), stats: { endurance: 0, maturite: 0, amour: STAT_MAX, serenity: 0 } };
    const lagging = { ...makeDragodinde(2), stats: { endurance: 0, maturite: 0, amour: 0, serenity: 0 } };
    const r = tickEnclos(enclos({ amour: 95000 }, [maxed, lagging], ["amour"]));
    expect(r.enclos.fuel.amour).toBe(95000 - 40); // still draining
    expect(r.enclos.dragodindes[1].stats.amour).toBe(40); // lagging one gains
    expect(r.enclos.dragodindes[0].stats.amour).toBe(STAT_MAX); // maxed one stays
  });

  it("does not complete while a focused stat lags", () => {
    const d: Dragodinde = {
      ...makeDragodinde(1),
      stats: { endurance: STAT_MAX, maturite: 100, amour: 0, serenity: 0 },
    };
    // focus requires maturite too, but only amour fuel is set -> maturite never maxes
    const r = tickEnclos(enclos({ amour: 95000 }, [d], ["endurance", "maturite"]));
    expect(r.completed.length).toBe(0);
  });
});

describe("resolveColor", () => {
  it("maps loose input to canonical colour names (case/accent-insensitive)", () => {
    expect(resolveColor("amande")).toBe("Amande");
    expect(resolveColor("AMANDE")).toBe("Amande");
    expect(resolveColor("ebene")).toBe("Ebène");
    expect(resolveColor("ebène et rousse")).toBe("Ebène et Rousse");
    expect(resolveColor("  Dorée  ")).toBe("Dorée");
  });
  it("returns null for unknown colours", () => {
    expect(resolveColor("licorne")).toBeNull();
  });
  it("names an Amande capture by the in-game convention, not the raw colour", () => {
    expect(buildName({ color: resolveColor("amande")!, sex: "F", keeper: false })).toBe("a-f");
    expect(buildName({ color: resolveColor("amande")!, sex: "M", keeper: false })).toBe("a-m");
  });
});
