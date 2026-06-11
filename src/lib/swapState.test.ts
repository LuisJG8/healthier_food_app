import { describe, expect, it } from "vitest";
import type { AlternativeProduct } from "../types";
import { acceptSwap, alternativeAt, clearAcceptedSwap, rejectSwapIndex, shouldReplaceAcceptedSwap } from "./swapState";

const fallback: AlternativeProduct = {
  id: "fallback",
  name: "Fallback swap",
  category: "Snack",
  reason: "Used when no category-specific swap exists.",
  scoreHint: "Often 7-9",
};

const alternatives: AlternativeProduct[] = [
  {
    id: "siete-chips",
    name: "Sea Salt Tortilla Chips",
    brand: "Siete",
    category: "Tortilla chips",
    reason: "Uses avocado oil and a shorter ingredient list.",
    scoreHint: "Often 7-9",
  },
  {
    id: "late-july-sea-salt",
    name: "Sea Salt Tortilla Chips",
    brand: "Late July",
    category: "Tortilla chips",
    reason: "A directly comparable tortilla chip option with simpler varieties available.",
    scoreHint: "Often 6-8",
  },
];

describe("swap state helpers", () => {
  it("selects alternatives by cycling index and falls back when no swaps exist", () => {
    expect(alternativeAt(alternatives, 0, fallback).id).toBe("siete-chips");
    expect(alternativeAt(alternatives, 1, fallback).id).toBe("late-july-sea-salt");
    expect(alternativeAt(alternatives, 2, fallback).id).toBe("siete-chips");
    expect(alternativeAt([], 4, fallback)).toBe(fallback);
  });

  it("accepts a swap without mutating unrelated accepted swaps", () => {
    expect(acceptSwap({ "00000001": "sparkling-water" }, "12345678", alternatives[0])).toEqual({
      "00000001": "sparkling-water",
      "12345678": "siete-chips",
    });
  });

  it("rejecting a swap cycles to the next option and wraps around", () => {
    expect(rejectSwapIndex({}, "12345678", alternatives.length)).toEqual({ "12345678": 1 });
    expect(rejectSwapIndex({ "12345678": 1 }, "12345678", alternatives.length)).toEqual({ "12345678": 0 });
    expect(rejectSwapIndex({ "12345678": 4 }, "12345678", 0)).toEqual({ "12345678": 0 });
  });

  it("rejecting a swap clears only the accepted swap for that barcode", () => {
    expect(clearAcceptedSwap({ "00000001": "sparkling-water", "12345678": "siete-chips" }, "12345678")).toEqual({
      "00000001": "sparkling-water",
    });
  });

  it("replaces accepted swaps only for scores of 8 or below", () => {
    expect(shouldReplaceAcceptedSwap(1)).toBe(true);
    expect(shouldReplaceAcceptedSwap(8)).toBe(true);
    expect(shouldReplaceAcceptedSwap(9)).toBe(false);
    expect(shouldReplaceAcceptedSwap(10)).toBe(false);
    expect(shouldReplaceAcceptedSwap(null)).toBe(false);
    expect(shouldReplaceAcceptedSwap(undefined)).toBe(false);
  });
});
