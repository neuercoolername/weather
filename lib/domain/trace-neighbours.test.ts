import { describe, it, expect } from "vitest";
import { getNeighbourIds } from "./trace-neighbours";

const ITEMS = [{ id: 10 }, { id: 20 }, { id: 30 }];

describe("getNeighbourIds", () => {
  it("returns both neighbours in the middle", () => {
    expect(getNeighbourIds(ITEMS, 20)).toEqual({ prevId: 10, nextId: 30 });
  });

  it("has no prev at the start and no next at the end", () => {
    expect(getNeighbourIds(ITEMS, 10)).toEqual({ prevId: null, nextId: 20 });
    expect(getNeighbourIds(ITEMS, 30)).toEqual({ prevId: 20, nextId: null });
  });

  it("returns nothing when there is no selection", () => {
    expect(getNeighbourIds(ITEMS, null)).toEqual({ prevId: null, nextId: null });
  });

  it("returns nothing when the selected id isn't in the list", () => {
    expect(getNeighbourIds(ITEMS, 99)).toEqual({ prevId: null, nextId: null });
  });

  it("orders by id regardless of the caller's array order", () => {
    const shuffled = [{ id: 30 }, { id: 10 }, { id: 20 }];
    expect(getNeighbourIds(shuffled, 20)).toEqual({ prevId: 10, nextId: 30 });
  });

  it("does not mutate the caller's array", () => {
    const shuffled = [{ id: 30 }, { id: 10 }, { id: 20 }];
    getNeighbourIds(shuffled, 20);
    expect(shuffled.map((i) => i.id)).toEqual([30, 10, 20]);
  });

  it("handles a single item and an empty list", () => {
    expect(getNeighbourIds([{ id: 10 }], 10)).toEqual({ prevId: null, nextId: null });
    expect(getNeighbourIds([], 10)).toEqual({ prevId: null, nextId: null });
  });
});
