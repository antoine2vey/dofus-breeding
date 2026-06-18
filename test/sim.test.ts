import { describe, expect, it } from "vitest";
import { monteCarlo, makeRng } from "@dd/core";

// sim.ts is a deep module (Monte-Carlo cheptel projection) used by the breeding-tree view and the
// AI's `simulate` tool, but it was untested. These assert its interface: the seedable-RNG contract
// (determinism) and that a from-scratch run reports sane work.
describe("monteCarlo", () => {
  const cfg = { targetGen: 4, level: 100, optimakina: true, clonage: true };

  it("is deterministic under a fixed seed (the makeRng contract)", () => {
    expect(monteCarlo(cfg, 40, makeRng(42))).toEqual(monteCarlo(cfg, 40, makeRng(42)));
  });

  it("reaching gen 4 from scratch reports captures and breedings", () => {
    const s = monteCarlo(cfg, 60, makeRng(7));
    expect(s.runs).toBe(60);
    expect(s.reachedFrac).toBeGreaterThan(0);
    expect(s.captures.mean).toBeGreaterThan(0);
    expect(s.breedings.mean).toBeGreaterThan(0);
  });
});
