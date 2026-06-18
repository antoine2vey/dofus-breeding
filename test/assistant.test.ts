import { describe, expect, it } from "vitest";
import { assistantPlan, recommend, COLORS, type AssistMount, type AssistEnclos } from "@dd/core";

const m = (o: Partial<AssistMount> & { id: number }): AssistMount => ({
  name: `dd-${o.id}`,
  color: "Amande",
  sex: "F",
  status: "fertile",
  keeper: false,
  enclosId: null,
  grandparents: [],
  ...o,
});

const baseEnclos: AssistEnclos[] = [
  { id: 1, name: "Enclos 1", focus: ["endurance", "amour"], count: 0 },
];

const plan = (mounts: AssistMount[], enclos: AssistEnclos[], targetGen = 4) =>
  assistantPlan({ mounts, enclos, targetGen, level: 100, optimakina: true, clonage: true });

describe("assistantPlan", () => {
  it("roadmap is cheptel-aware: owned reduces need and counts obtained colours", () => {
    const { roadmap } = plan(
      [m({ id: 1, color: "Amande", status: "feconde" }), m({ id: 2, color: "Dorée", status: "feconde" })],
      baseEnclos,
    );
    expect(roadmap.targetGen).toBe(4);
    expect(roadmap.reached).toBe(false);
    expect(roadmap.obtainedColors).toBe(2); // Amande + Dorée
    // owning 1 Amande lowers its base-capture demand below the from-scratch count
    expect(roadmap.baseCaptures.Amande).toBeLessThan(roadmap.baseCaptures.Rousse);
  });

  it("raise: moves STABLE fertile mounts (of needed colours) into free enclos; skips keepers & enclos mounts", () => {
    const { nextStep } = plan(
      [
        m({ id: 1, color: "Amande", status: "fertile" }), // raise
        m({ id: 2, color: "Rousse", status: "fertile" }), // raise
        m({ id: 3, color: "Amande", status: "fertile", keeper: true }), // keeper -> skip
        m({ id: 4, color: "Dorée", status: "fertile", enclosId: 1 }), // already in enclos -> skip
      ],
      baseEnclos,
    );
    const raisedIds = nextStep.raise.flatMap((r) => r.mountIds);
    expect(raisedIds).toContain(1);
    expect(raisedIds).toContain(2);
    expect(raisedIds).not.toContain(3); // keeper
    expect(raisedIds).not.toContain(4); // already placed
    expect(nextStep.raise[0].enclosId).toBe(1);
  });

  it("raise respects free slots (a full enclos gets nothing)", () => {
    const { nextStep } = plan(
      [m({ id: 1, color: "Amande", status: "fertile" })],
      [{ id: 1, name: "Full", focus: [], count: 10 }],
    );
    expect(nextStep.raise).toHaveLength(0);
  });

  it("raise fills spare enclos capacity in parallel — not just one pair per colour", () => {
    // Plenty of fertile bases (4 each) + a big empty enclos. With a deep target the plan consumes
    // many bases, so we ripen in parallel up to capacity instead of stopping at one pair (= 6).
    const mounts: AssistMount[] = [];
    let id = 1;
    for (const color of ["Amande", "Dorée", "Rousse"])
      for (let i = 0; i < 4; i++) mounts.push(m({ id: id++, color, sex: i % 2 ? "M" : "F", status: "fertile" }));
    const { nextStep } = plan(mounts, [{ id: 1, name: "E", focus: [], count: 0 }], 4);
    const raised = nextStep.raise.flatMap((r) => r.mountIds);
    expect(raised.length).toBeGreaterThan(6); // old one-pair-per-colour cap would stop at 6
    expect(raised.length).toBeLessThanOrEqual(10); // never exceeds free capacity
  });

  it("breed: pairs féconde mounts; clone: pairs same-colour steriles", () => {
    const { nextStep } = plan(
      [
        m({ id: 1, color: "Amande", sex: "F", status: "feconde" }),
        m({ id: 2, color: "Dorée", sex: "M", status: "feconde" }),
        m({ id: 3, color: "Rousse", sex: "F", status: "sterile" }),
        m({ id: 4, color: "Rousse", sex: "M", status: "sterile" }),
      ],
      baseEnclos,
    );
    expect(nextStep.breed.length).toBeGreaterThan(0);
    const pair = nextStep.breed[0];
    expect([pair.aId, pair.bId].sort()).toEqual([1, 2]);
    expect(nextStep.clone).toEqual([
      expect.objectContaining({ aId: 3, bId: 4, color: "Rousse" }),
    ]);
  });

  it("breed: never a self/lateral cross — builds a colour from cheaper bases, not by burning a scarce equal", () => {
    // A féconde Dorée et Rousse (scarce gen-2) plus the cheap bases to remake it.
    const { nextStep } = plan(
      [
        m({ id: 1, color: "Dorée", sex: "M", status: "feconde" }),
        m({ id: 2, color: "Rousse", sex: "F", status: "feconde" }),
        m({ id: 3, color: "Dorée et Rousse", sex: "F", status: "feconde" }),
      ],
      baseEnclos,
    );
    // The only cross is Dorée × Rousse → Dorée et Rousse (a step UP from free bases).
    expect(nextStep.breed).toHaveLength(1);
    expect([nextStep.breed[0].aId, nextStep.breed[0].bId].sort()).toEqual([1, 2]);
    expect(nextStep.breed[0].intended).toBe("Dorée et Rousse");
    // The scarce Dorée et Rousse (#3) is NEVER consumed to remake a Dorée et Rousse (self) or a
    // lateral gen-2 (e.g. Dorée × Dorée et Rousse, Amande-less so no step up).
    for (const b of nextStep.breed) expect([b.aId, b.bId]).not.toContain(3);
  });

  it("done when every colour up to the target is owned", () => {
    // gen 2 = Amande, Dorée, Rousse, + the 3 bicolours
    const colors = ["Amande", "Dorée", "Rousse", "Amande et Rousse", "Dorée et Rousse", "Amande et Dorée"];
    const mounts = colors.map((c, i) => m({ id: i + 1, color: c, status: "feconde" }));
    const { roadmap, nextStep } = plan(mounts, baseEnclos, 2);
    expect(roadmap.reached).toBe(true);
    expect(nextStep.done).toBe(true);
    expect(nextStep.summary).toContain("atteint");
  });

  it("succès: done gen-4 → push gen 5 → produce the gen-5 parents, never the done dead-ends", () => {
    const doneGen4 = COLORS.filter((c) => c.gen <= 4).map((c) => c.name); // achievements unlocked, own nothing
    const { roadmap } = assistantPlan({
      mounts: [], enclos: [], targetGen: 5, level: 100, optimakina: true, clonage: true, achievements: doneGen4,
    });
    const need: Record<string, number> = {};
    for (const g of roadmap.gens) for (const r of g.rows) need[r.color] = r.need;

    // Done dead-ends (gen-4 colours that are NOT a gen-5 parent) → excluded from the goal.
    expect(need["Indigo et Rousse"] ?? 0).toBe(0);
    expect(need["Ebène et Rousse"] ?? 0).toBe(0);
    // Done colours that ARE gen-5 parents → still produced (achievement ≠ usable breeding copy).
    expect(need["Ebène et Indigo"] ?? 0).toBeGreaterThan(0); // parent of Pourpre + Orchidée
    expect(need["Amande et Rousse"] ?? 0).toBeGreaterThan(0); // parent of Pourpre
    // The gen-5 targets themselves (not done) → needed.
    expect((need["Pourpre"] ?? 0) + (need["Orchidée"] ?? 0)).toBeGreaterThan(0);

    // Control: WITHOUT the succès, the same gen-4 dead-end IS required (it's a sink ≤ target).
    const ctl = assistantPlan({ mounts: [], enclos: [], targetGen: 5, level: 100, optimakina: true, clonage: true });
    const ctlNeed: Record<string, number> = {};
    for (const g of ctl.roadmap.gens) for (const r of g.rows) ctlNeed[r.color] = r.need;
    expect(ctlNeed["Indigo et Rousse"] ?? 0).toBeGreaterThan(0);
    // …and the succès strictly reduce the captures owed.
    expect(roadmap.totalCaptures).toBeLessThan(ctl.roadmap.totalCaptures);
  });

  it("recommend: achievements drop done colours from missingToTarget + cut captures", () => {
    const doneGen4 = COLORS.filter((c) => c.gen <= 4).map((c) => c.name);
    const rec = recommend({ mounts: [], targetGen: 5, freeSlots: 4, level: 100, optimakina: true, clonage: true, achievements: doneGen4 });
    expect(rec.missingToTarget).not.toContain("Indigo et Rousse"); // done
    expect(rec.missingToTarget).toContain("Pourpre"); // gen 5, not done
    const cap = (r: ReturnType<typeof recommend>) => r.capture.reduce((n, c) => n + c.count, 0);
    const ctl = recommend({ mounts: [], targetGen: 5, freeSlots: 4, level: 100, optimakina: true, clonage: true });
    expect(cap(rec)).toBeLessThan(cap(ctl));
  });

  it("a colour owned only as a keeper/sterile satisfies the sink — no phantom captures/crosses", () => {
    const colors = ["Amande", "Dorée", "Rousse", "Amande et Rousse", "Dorée et Rousse", "Amande et Dorée"];
    // Held as KEEPERS (and even sterile) — usable stock is empty, but they ARE owned.
    const mounts = colors.map((c, i) => m({ id: i + 1, color: c, status: "sterile", keeper: true }));
    const { roadmap, nextStep } = plan(mounts, baseEnclos, 2);
    expect(roadmap.reached).toBe(true);
    expect(roadmap.totalCaptures).toBe(0); // was 6 before the sink/usable fix
    expect(roadmap.totalCrosses).toBe(0); // was 3 before
    expect(nextStep.capture).toHaveLength(0);
    expect(nextStep.done).toBe(true);
  });
});
