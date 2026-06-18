import { describe, expect, it } from "vitest";
import { inGameCompare } from "@dd/core";

describe("inGameCompare (in-game list order)", () => {
  it("sorts as the in-game namer does — comparing segments with hyphens ignored", () => {
    // Reference order copied verbatim from the game's mount list.
    const ref = ["ad-f-d-a", "a-f", "a-f-a-d", "a-f-ad-ar", "a-f-a-r", "a-f-ei-ar", "a-m-a-a", "a-m-a-d"];
    const shuffled = ["a-m-a-d", "a-f-a-r", "ad-f-d-a", "a-f", "a-f-ei-ar", "a-m-a-a", "a-f-ad-ar", "a-f-a-d"];
    expect([...shuffled].sort(inGameCompare)).toEqual(ref);
  });

  it("ignores the hyphen: ad-f-d-a precedes a-m-a-a (d < m), unlike a raw string sort", () => {
    expect(inGameCompare("ad-f-d-a", "a-m-a-a")).toBeLessThan(0); // game order
    expect("ad-f-d-a".localeCompare("a-m-a-a")).toBeGreaterThan(0); // the wrong (raw) order we had
  });
});
