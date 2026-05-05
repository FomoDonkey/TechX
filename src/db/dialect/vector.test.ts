import { describe, expect, it } from "vitest";
import { distanceToSimilarity, vectorToString } from "./vector";

describe("vectorToString", () => {
  it("serializa al formato [v1,v2,...]", () => {
    expect(vectorToString([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]");
  });

  it("array vacío → '[]'", () => {
    expect(vectorToString([])).toBe("[]");
  });
});

describe("distanceToSimilarity", () => {
  it("distance 0 → similarity 1 (idéntico)", () => {
    expect(distanceToSimilarity(0)).toBe(1);
  });

  it("distance 2 → similarity 0 (opuesto)", () => {
    expect(distanceToSimilarity(2)).toBe(0);
  });

  it("distance 1 → similarity 0.5", () => {
    expect(distanceToSimilarity(1)).toBe(0.5);
  });

  it("clamp a 0 si distance > 2", () => {
    expect(distanceToSimilarity(3)).toBe(0);
  });
});
