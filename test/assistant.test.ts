import { describe, expect, it } from "vitest";
import { assistantPlan, type AssistMount, type AssistEnclos } from "@dd/core";

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

  it("done when every colour up to the target is owned", () => {
    // gen 2 = Amande, Dorée, Rousse, + the 3 bicolours
    const colors = ["Amande", "Dorée", "Rousse", "Amande et Rousse", "Dorée et Rousse", "Amande et Dorée"];
    const mounts = colors.map((c, i) => m({ id: i + 1, color: c, status: "feconde" }));
    const { roadmap, nextStep } = plan(mounts, baseEnclos, 2);
    expect(roadmap.reached).toBe(true);
    expect(nextStep.done).toBe(true);
    expect(nextStep.summary).toContain("atteint");
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
