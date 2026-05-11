import { describe, it, expect } from "vitest";
import { applyTotalRounding } from "@/lib/roundingTotal";

describe("applyTotalRounding", () => {
  describe("when rounding is disabled", () => {
    it("returns the raw total unchanged regardless of multiple", () => {
      expect(applyTotalRounding(109, false, 5)).toBe(109);
      expect(applyTotalRounding(103.75, false, 10)).toBe(103.75);
      expect(applyTotalRounding(0, false, 5)).toBe(0);
    });

    it("returns the raw total unchanged even with an invalid multiple", () => {
      // disabled wins over multiple validation
      expect(applyTotalRounding(123, false, 0)).toBe(123);
      expect(applyTotalRounding(123, false, -5)).toBe(123);
    });
  });

  describe("when rounding is enabled with multiple = 5 (default)", () => {
    it.each([
      [100, 100],
      [103, 100],
      [104.99, 100],
      [105, 105],
      [107, 105],
      [109, 105],
      [110, 110],
      [0, 0],
    ])("rounds %s down to %s", (input, expected) => {
      expect(applyTotalRounding(input, true, 5)).toBe(expected);
    });
  });

  describe("when rounding is enabled with a custom multiple", () => {
    it("uses multiple = 10", () => {
      expect(applyTotalRounding(109, true, 10)).toBe(100);
      expect(applyTotalRounding(110, true, 10)).toBe(110);
      expect(applyTotalRounding(119.99, true, 10)).toBe(110);
    });

    it("uses multiple = 25", () => {
      expect(applyTotalRounding(99, true, 25)).toBe(75);
      expect(applyTotalRounding(125, true, 25)).toBe(125);
      expect(applyTotalRounding(149, true, 25)).toBe(125);
    });

    it("uses multiple = 1 (effectively no rounding for integers)", () => {
      expect(applyTotalRounding(107, true, 1)).toBe(107);
      // For non-integers, floors to integer
      expect(applyTotalRounding(107.8, true, 1)).toBe(107);
    });
  });

  describe("defensive behaviour with invalid multiples", () => {
    it("returns the raw total when multiple is 0", () => {
      expect(applyTotalRounding(109, true, 0)).toBe(109);
    });

    it("returns the raw total when multiple is negative", () => {
      expect(applyTotalRounding(109, true, -5)).toBe(109);
    });

    it("returns the raw total when multiple is NaN", () => {
      expect(applyTotalRounding(109, true, NaN)).toBe(109);
    });

    it("returns the raw total when multiple is Infinity", () => {
      expect(applyTotalRounding(109, true, Infinity)).toBe(109);
    });
  });
});
