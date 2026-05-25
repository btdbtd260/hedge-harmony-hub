import { describe, it, expect } from "vitest";
import {
  calculateEstimationPrice,
  type PricingInput,
  type PricingParams,
} from "@/lib/estimationPricing";

// ── Shared defaults ──

const DEFAULT_PARAMS: PricingParams = {
  pricePerFootTrim: 4.5,
  pricePerFootLevelling: 6,
  pricePerFootRestoration: 8,
  bushPrice: 40,
  heightMultiplierThreshold: 5,
  heightMultiplier: 1.5,
  widthMultiplierThreshold: 3,
  widthMultiplier: 1.3,
  twoSidesMultiplier: 1.5,
  roundingEnabled: true,
  roundingMultiple: 5,
};

function defaultInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    cutType: "trim",
    facade: { length: 40, twoSides: false },
    left: { length: 25, twoSides: false },
    right: { length: 25, twoSides: false },
    back: { length: 30, twoSides: false },
    backLeft: { length: 0, twoSides: false },
    backRight: { length: 0, twoSides: false },
    heightMode: "global",
    heightGlobal: 4,
    heightFacade: 0,
    heightLeft: 0,
    heightRight: 0,
    heightBack: 0,
    heightBackLeft: 0,
    heightBackRight: 0,
    width: 2,
    bushes: [],
    extras: [],
    discounts: [],
    ...overrides,
  };
}

// ── calculateEstimationPrice ──

describe("calculateEstimationPrice", () => {
  // ── Happy path ──

  it("returns a valid PricingBreakdown for a basic trim estimation", () => {
    const result = calculateEstimationPrice(defaultInput(), DEFAULT_PARAMS);

    expect(result).toBeDefined();
    expect(result.totalPrice).toBeGreaterThan(0);
    expect(result.basePrice).toBeGreaterThan(0);
    expect(result.totalLinearFeet).toBe(120); // 40 + 25 + 25 + 30
    expect(result.pricePerFoot).toBe(4.5);
    expect(result.heightMultiplierApplied).toBe(false);
    expect(result.widthMultiplierApplied).toBe(false);
    expect(result.bushesTotal).toBe(0);
    expect(result.extrasTotal).toBe(0);
    expect(result.discountTotal).toBe(0);
    expect(result.discountDetails).toEqual([]);
  });

  it("calculates correct total linear feet", () => {
    const result = calculateEstimationPrice(defaultInput(), DEFAULT_PARAMS);
    expect(result.totalLinearFeet).toBe(120);
  });

  it("uses the correct price per foot for trim", () => {
    const result = calculateEstimationPrice(defaultInput({ cutType: "trim" }), DEFAULT_PARAMS);
    expect(result.standardPricePerFoot).toBe(4.5);
    expect(result.pricePerFoot).toBe(4.5);
  });

  it("uses the correct price per foot for levelling", () => {
    const result = calculateEstimationPrice(
      defaultInput({ cutType: "levelling" }),
      DEFAULT_PARAMS,
    );
    expect(result.standardPricePerFoot).toBe(6);
    expect(result.pricePerFoot).toBe(6);
  });

  it("uses the correct price per foot for restoration", () => {
    const result = calculateEstimationPrice(
      defaultInput({ cutType: "restoration" }),
      DEFAULT_PARAMS,
    );
    expect(result.standardPricePerFoot).toBe(8);
    expect(result.pricePerFoot).toBe(8);
  });

  it("overrides price per foot when customPricePerFoot is provided", () => {
    const result = calculateEstimationPrice(
      defaultInput({ customPricePerFoot: 7.5 }),
      DEFAULT_PARAMS,
    );
    expect(result.pricePerFoot).toBe(7.5);
  });

  it("ignores customPricePerFoot when it is 0 or negative", () => {
    const result = calculateEstimationPrice(
      defaultInput({ customPricePerFoot: -1 }),
      DEFAULT_PARAMS,
    );
    expect(result.pricePerFoot).toBe(4.5); // falls back to standard
  });

  // ── Two-sides multiplier ──

  it("applies two-sides multiplier to a side marked as twoSides", () => {
    const input = defaultInput({
      left: { length: 25, twoSides: true },
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    // left = 25 * 4.5 * 1.5 = 168.75 (with twoSides)
    // facade = 40 * 4.5 = 180
    // right = 25 * 4.5 = 112.5
    // back = 30 * 4.5 = 135
    // Total = 596.25
    expect(result.basePrice).toBeCloseTo(596.25, 2);
  });

  it("uses custom twoSidesMultiplier when provided", () => {
    const params = { ...DEFAULT_PARAMS, twoSidesMultiplier: 2 };
    const input = defaultInput({
      left: { length: 25, twoSides: true },
    });
    const result = calculateEstimationPrice(input, params);

    // left = 25 * 4.5 * 2 = 225
    // facade = 40 * 4.5 = 180
    // right = 25 * 4.5 = 112.5
    // back = 30 * 4.5 = 135
    // Total = 652.5
    expect(result.basePrice).toBeCloseTo(652.5, 2);
  });

  // ── Height multiplier ──

  it("applies height multiplier when effective height >= threshold (global mode)", () => {
    const input = defaultInput({ heightGlobal: 6 }); // >= 5
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.effectiveHeight).toBe(6);
    expect(result.heightMultiplierApplied).toBe(true);
    // basePrice should be multiplied by 1.5
  });

  it("does NOT apply height multiplier when height < threshold", () => {
    const input = defaultInput({ heightGlobal: 4 }); // < 5
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.heightMultiplierApplied).toBe(false);
  });

  it("correctly computes effective height in per_side mode", () => {
    const input = defaultInput({
      heightMode: "per_side",
      heightGlobal: 0,
      heightFacade: 7,
      heightLeft: 4,
      heightRight: 5,
      heightBack: 3,
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.effectiveHeight).toBe(7); // max of per-side heights
    expect(result.heightMultiplierApplied).toBe(true);
  });

  // ── Width multiplier ──

  it("applies width multiplier when width >= threshold", () => {
    const input = defaultInput({ width: 4 }); // >= 3
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.widthMultiplierApplied).toBe(true);
  });

  it("does NOT apply width multiplier when width < threshold", () => {
    const input = defaultInput({ width: 2 }); // < 3
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.widthMultiplierApplied).toBe(false);
  });

  // ── Bushes ──

  it("includes bushes in the total", () => {
    const input = defaultInput({
      bushes: [
        { description: "Petits arbustes", count: 3, price: 40 },
        { description: "Gros arbustes", count: 2, price: 60 },
      ],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.bushesTotal).toBe(240); // 3*40 + 2*60
    expect(result.subtotalBeforeDiscounts).toBeGreaterThan(result.basePrice);
  });

  // ── Extras ──

  it("includes extras in the total", () => {
    const input = defaultInput({
      extras: [
        { id: "e1", description: "Débroussaillage", price: 50 },
        { id: "e2", description: "Nettoyage", price: 30 },
      ],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.extrasTotal).toBe(80);
  });

  // ── Discounts ──

  it("applies a percent discount correctly", () => {
    const input = defaultInput({
      discounts: [
        { id: "d1", description: "Client régulier", type: "percent", value: 10 },
      ],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.discountDetails).toHaveLength(1);
    expect(result.discountDetails[0].description).toBe("Client régulier");
    // 10% of subtotalBeforeDiscounts
    const expectedDiscount = result.subtotalBeforeDiscounts * 0.1;
    expect(result.discountTotal).toBeCloseTo(expectedDiscount, 2);
    expect(result.rawTotal).toBeCloseTo(result.subtotalBeforeDiscounts - expectedDiscount, 2);
  });

  it("applies a fixed discount correctly", () => {
    const input = defaultInput({
      discounts: [
        { id: "d1", description: "Promotion", type: "fixed", value: 25 },
      ],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.discountTotal).toBe(25);
    expect(result.rawTotal).toBe(result.subtotalBeforeDiscounts - 25);
  });

  it("clamps discount percentage to 0-100 range", () => {
    const input = defaultInput({
      discounts: [
        { id: "d1", description: "Trop", type: "percent", value: 150 },
        { id: "d2", description: "Négatif", type: "percent", value: -20 },
      ],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    // 150% → clamped to 100% of subtotal
    // -20% → clamped to 0%
    expect(result.discountTotal).toBeCloseTo(result.subtotalBeforeDiscounts, 2);
  });

  it("applies multiple discounts in order", () => {
    const input = defaultInput({
      discounts: [
        { id: "d1", description: "Fidélité", type: "percent", value: 5 },
        { id: "d2", description: "Promo", type: "fixed", value: 20 },
      ],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    // Percentages always apply to subtotal before any discounts
    expect(result.discountDetails).toHaveLength(2);
    const expectedPctDiscount = result.subtotalBeforeDiscounts * 0.05;
    expect(result.discountTotal).toBeCloseTo(expectedPctDiscount + 20, 2);
  });

  it("ensures raw total never goes below 0", () => {
    const input = defaultInput({
      discounts: [
        { id: "d1", description: "Tout", type: "fixed", value: 999999 },
      ],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.rawTotal).toBe(0);
  });

  // ── Rounding ──

  it("rounds the total to the nearest 5 when rounding is enabled", () => {
    const input = defaultInput({
      facade: { length: 1, twoSides: false },
      left: { length: 1, twoSides: false },
      right: { length: 1, twoSides: false },
      back: { length: 1, twoSides: false },
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    // basePrice = 4 * 1 * 4.5 = 18. Raw total = 18.
    // Round to nearest 5 → floor(18/5)*5 = 15
    expect(result.totalPrice).toBe(15);
  });

  it("does not round when rounding is disabled", () => {
    const params = { ...DEFAULT_PARAMS, roundingEnabled: false };
    const input = defaultInput({
      facade: { length: 1, twoSides: false },
      left: { length: 1, twoSides: false },
      right: { length: 1, twoSides: false },
      back: { length: 1, twoSides: false },
    });
    const result = calculateEstimationPrice(input, params);

    expect(result.totalPrice).toBeCloseTo(18, 2); // no rounding
  });

  it("uses custom rounding multiple", () => {
    const params = { ...DEFAULT_PARAMS, roundingMultiple: 10 };
    const input = defaultInput({
      facade: { length: 10, twoSides: false },
      left: { length: 10, twoSides: false },
      right: { length: 10, twoSides: false },
      back: { length: 10, twoSides: false },
    });
    const result = calculateEstimationPrice(input, params);

    // basePrice = 40 * 4.5 = 180. Round to nearest 10 → floor(180/10)*10 = 180
    expect(result.totalPrice).toBe(180);
  });

  // ── Per-side details ──

  it("returns per-side pricing details", () => {
    const input = defaultInput({
      left: { length: 10, twoSides: false },
      facade: { length: 20, twoSides: true },
      right: { length: 10, twoSides: false },
      back: { length: 15, twoSides: false },
      backLeft: { length: 5, twoSides: false },
      backRight: { length: 5, twoSides: false },
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.sideDetails.left).toBeCloseTo(45, 2);      // 10 * 4.5
    expect(result.sideDetails.facade).toBeCloseTo(135, 2);   // 20 * 4.5 * 1.5
    expect(result.sideDetails.right).toBeCloseTo(45, 2);     // 10 * 4.5
    expect(result.sideDetails.back).toBeCloseTo(67.5, 2);    // 15 * 4.5
    expect(result.sideDetails.backLeft).toBeCloseTo(22.5, 2); // 5 * 4.5
    expect(result.sideDetails.backRight).toBeCloseTo(22.5, 2); // 5 * 4.5
  });

  // ── Edge cases ──

  it("handles all zero lengths gracefully", () => {
    const input = defaultInput({
      facade: { length: 0, twoSides: false },
      left: { length: 0, twoSides: false },
      right: { length: 0, twoSides: false },
      back: { length: 0, twoSides: false },
      backLeft: { length: 0, twoSides: false },
      backRight: { length: 0, twoSides: false },
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.totalLinearFeet).toBe(0);
    expect(result.basePrice).toBe(0);
    expect(result.totalPrice).toBe(0);
  });

  it("handles empty bushes array", () => {
    const input = defaultInput({ bushes: [] });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.bushesTotal).toBe(0);
  });

  it("handles empty extras array", () => {
    const input = defaultInput({ extras: [] });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.extrasTotal).toBe(0);
  });

  it("handles empty discounts array", () => {
    const input = defaultInput({ discounts: [] });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.discountTotal).toBe(0);
    expect(result.discountDetails).toEqual([]);
  });

  it("handles negative bush prices gracefully", () => {
    const input = defaultInput({
      bushes: [{ description: "Test", count: 1, price: -10 }],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    // Negative prices should be treated as 0
    expect(result.bushesTotal).toBe(0);
  });

  it("handles negative bush counts gracefully", () => {
    const input = defaultInput({
      bushes: [{ description: "Test", count: -3, price: 40 }],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.bushesTotal).toBe(0);
  });

  it("handles negative extra prices gracefully", () => {
    const input = defaultInput({
      extras: [{ id: "e1", description: "Test", price: -50 }],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.extrasTotal).toBe(0);
  });

  it("handles negative fixed discount values by treating them as 0", () => {
    const input = defaultInput({
      discounts: [
        { id: "d1", description: "Négatif", type: "fixed", value: -20 },
      ],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.discountTotal).toBe(0);
  });

  it("uses sensible defaults for missing optional params", () => {
    const minimalParams: PricingParams = {
      pricePerFootTrim: 4.5,
      pricePerFootLevelling: 6,
      pricePerFootRestoration: 8,
      bushPrice: 40,
      heightMultiplierThreshold: 5,
      heightMultiplier: 1.5,
      widthMultiplierThreshold: 3,
      widthMultiplier: 1.3,
    };
    const result = calculateEstimationPrice(defaultInput(), minimalParams);

    expect(result.totalPrice).toBeGreaterThan(0);
    expect(result.totalPrice).toBeCloseTo(540, 0); // 120 * 4.5 = 540
  });

  it("computes priceAfterMultipliers correctly when only height multiplier applies", () => {
    const input = defaultInput({ heightGlobal: 6 }); // >= 5
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    // basePrice = 120 * 4.5 = 540
    // height multiplier: 540 * 1.5 = 810
    expect(result.basePrice).toBe(540);
    expect(result.priceAfterMultipliers).toBe(810);
    expect(result.subtotalBeforeDiscounts).toBe(810); // no bushes or extras
  });

  it("computes priceAfterMultipliers correctly when both multipliers apply", () => {
    const input = defaultInput({ heightGlobal: 6, width: 4 }); // both >= thresholds
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    // basePrice = 540
    // height: 540 * 1.5 = 810
    // width: 810 * 1.3 = 1053
    expect(result.priceAfterMultipliers).toBe(1053);
  });

  it("applies height then width multiplier (order matters)", () => {
    const input = defaultInput({ heightGlobal: 6, width: 4 });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    // basePrice = 540
    // height first: 540 * 1.5 = 810
    // width second: 810 * 1.3 = 1053
    expect(result.priceAfterMultipliers).toBe(1053);
  });

  // ── Edge case: non-finite numbers ──

  it("handles NaN discount values gracefully", () => {
    const input = defaultInput({
      discounts: [
        { id: "d1", description: "NaN percent", type: "percent", value: NaN },
        { id: "d2", description: "NaN fixed", type: "fixed", value: NaN },
      ],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.discountTotal).toBe(0);
  });

  it("handles zero discount values gracefully", () => {
    const input = defaultInput({
      discounts: [
        { id: "d1", description: "Zero percent", type: "percent", value: 0 },
        { id: "d2", description: "Zero fixed", type: "fixed", value: 0 },
      ],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.discountTotal).toBe(0);
  });

  it("handles undefined discount values gracefully", () => {
    const input = defaultInput({
      discounts: [
        { id: "d1", description: "Undef percent", type: "percent", value: undefined as any },
        { id: "d2", description: "Undef fixed", type: "fixed", value: undefined as any },
      ],
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    expect(result.discountTotal).toBe(0);
  });

  it("handles Infinity for width and height without crashing", () => {
    const input = defaultInput({
      heightGlobal: Infinity,
      width: Infinity,
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    // Non-finite heights/widths should be handled gracefully
    expect(result.effectiveHeight).toBe(1); // toPositive(Infinity) = 0, then max(0,1) = 1
    expect(result.widthMultiplierApplied).toBe(false); // toPositive(Infinity) = 0, 0 >= 3 = false
    expect(result.heightMultiplierApplied).toBe(false); // 1 >= 5 = false
    expect(result.totalPrice).toBeGreaterThan(0);
  });

  it("handles NaN for side lengths gracefully", () => {
    const input = defaultInput({
      facade: { length: NaN, twoSides: false },
      left: { length: NaN, twoSides: false },
      right: { length: NaN, twoSides: false },
      back: { length: NaN, twoSides: false },
      heightGlobal: NaN,
    });
    const result = calculateEstimationPrice(input, DEFAULT_PARAMS);

    // All lengths are NaN → toPositive returns 0
    expect(result.totalLinearFeet).toBe(0);
    expect(result.basePrice).toBe(0);
    expect(result.totalPrice).toBe(0);
  });
});
