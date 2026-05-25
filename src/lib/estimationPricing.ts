// ============================================================
// Estimation Pricing Calculator
// ============================================================
// Pure business logic for calculating hedge trimming estimation
// prices. Extracted from the Estimation component so it can be
// unit-tested independently.
//
// Pricing formula:
//   1. Per-side base = length × pricePerFoot × twoSidesMultiplier
//   2. Sum all sides → basePrice
//   3. Apply height multiplier if effectiveHeight ≥ threshold
//   4. Apply width multiplier if width ≥ threshold
//   5. Add bushes total
//   6. Add extras total
//   7. Apply discounts (percent on subtotal, fixed absolute)
//   8. Apply rounding (floor to nearest multiple)
// ============================================================

import type { EstimationExtra, EstimationDiscount, CutType, HeightMode } from "@/types";
import { applyTotalRounding } from "@/lib/roundingTotal";

// ─── Input types ───

export interface PricingParams {
  pricePerFootTrim: number;
  pricePerFootLevelling: number;
  pricePerFootRestoration: number;
  bushPrice: number;
  heightMultiplierThreshold: number;
  heightMultiplier: number;
  widthMultiplierThreshold: number;
  widthMultiplier: number;
  twoSidesMultiplier?: number;
  roundingEnabled?: boolean;
  roundingMultiple?: number;
}

export interface SideMeasurement {
  /** Length in feet */
  length: number;
  /** Whether this side is "2 côtés" (double-sided) */
  twoSides: boolean;
}

export interface BushItem {
  description: string;
  count: number;
  price: number;
}

export interface PricingInput {
  cutType: CutType;
  /** Per-estimation override of the price-per-foot. If > 0, overrides the cutType price. */
  customPricePerFoot?: number;
  facade: SideMeasurement;
  left: SideMeasurement;
  right: SideMeasurement;
  back: SideMeasurement;
  backLeft: SideMeasurement;
  backRight: SideMeasurement;
  heightMode: HeightMode;
  heightGlobal: number;
  heightFacade: number;
  heightLeft: number;
  heightRight: number;
  heightBack: number;
  heightBackLeft: number;
  heightBackRight: number;
  width: number;
  bushes: BushItem[];
  extras: EstimationExtra[];
  discounts: EstimationDiscount[];
}

// ─── Output types ───

export interface PricingBreakdown {
  /** Price per foot actually used */
  pricePerFoot: number;
  /** Standard price per foot for the cut type (before any override) */
  standardPricePerFoot: number;
  /** Total linear feet (sum of all side lengths) */
  totalLinearFeet: number;

  /** Per-side breakdown */
  sideDetails: {
    left: number;
    facade: number;
    right: number;
    backLeft: number;
    back: number;
    backRight: number;
  };

  /** Base price before multipliers (sum of per-side prices with twoSides) */
  basePrice: number;

  /** Effective height used for multiplier check */
  effectiveHeight: number;
  heightMultiplierApplied: boolean;
  widthMultiplierApplied: boolean;

  /** Price after height/width multipliers applied */
  priceAfterMultipliers: number;

  /** Bushes */
  bushesTotal: number;

  /** Extras */
  extrasTotal: number;

  /** Subtotal before discounts (basePrice + bushes + extras) */
  subtotalBeforeDiscounts: number;

  /** Discounts applied */
  discountDetails: { description: string; amount: number }[];
  discountTotal: number;

  /** Raw total before rounding (max 0) */
  rawTotal: number;

  /** Final rounded price */
  totalPrice: number;
}

// ─── Helpers ───

function toPositive(n: number): number {
  return Math.max(0, Number.isFinite(n) ? n : 0);
}

// ─── Implementation ───

export function calculateEstimationPrice(
  input: PricingInput,
  params: PricingParams,
): PricingBreakdown {
  // 1. Determine price per foot
  const standardPricePerFoot =
    input.cutType === "trim"
      ? params.pricePerFootTrim
      : input.cutType === "levelling"
        ? params.pricePerFootLevelling
        : params.pricePerFootRestoration;

  const pricePerFoot =
    input.customPricePerFoot && input.customPricePerFoot > 0
      ? input.customPricePerFoot
      : standardPricePerFoot;

  const twoSidesMult = params.twoSidesMultiplier ?? 1.5;

  // 2. Total linear feet
  const totalLinearFeet =
    toPositive(input.left.length) +
    toPositive(input.facade.length) +
    toPositive(input.right.length) +
    toPositive(input.backLeft.length) +
    toPositive(input.back.length) +
    toPositive(input.backRight.length);

  // 3. Per-side pricing
  const sideBase = (side: SideMeasurement): number =>
    toPositive(side.length) * pricePerFoot * (side.twoSides ? twoSidesMult : 1);

  const leftPrice = sideBase(input.left);
  const facadePrice = sideBase(input.facade);
  const rightPrice = sideBase(input.right);
  const backLeftPrice = sideBase(input.backLeft);
  const backPrice = sideBase(input.back);
  const backRightPrice = sideBase(input.backRight);

  const basePrice = leftPrice + facadePrice + rightPrice + backLeftPrice + backPrice + backRightPrice;

  // 4. Effective height
  const effectiveHeight =
    input.heightMode === "per_side"
      ? Math.max(
          toPositive(input.heightFacade),
          toPositive(input.heightLeft),
          toPositive(input.heightRight),
          toPositive(input.heightBack),
          toPositive(input.heightBackLeft),
          toPositive(input.heightBackRight),
          1,
        )
      : Math.max(toPositive(input.heightGlobal), 1);

  // 5. Multipliers
  const heightMultiplierApplied = effectiveHeight >= params.heightMultiplierThreshold;
  const widthMultiplierApplied = toPositive(input.width) >= params.widthMultiplierThreshold;

  let priceAfterMultipliers = basePrice;
  if (heightMultiplierApplied) priceAfterMultipliers *= params.heightMultiplier;
  if (widthMultiplierApplied) priceAfterMultipliers *= params.widthMultiplier;

  // 6. Bushes
  const bushesTotal = input.bushes.reduce((sum, b) => {
    return sum + toPositive(b.count) * toPositive(b.price);
  }, 0);

  // 7. Extras
  const extrasTotal = input.extras.reduce((sum, e) => {
    return sum + toPositive(e.price);
  }, 0);

  // 8. Subtotal before discounts
  const subtotalBeforeDiscounts = priceAfterMultipliers + bushesTotal + extrasTotal;

  // 9. Discounts
  const discountDetails: { description: string; amount: number }[] = input.discounts.map((d) => {
    if (d.type === "percent") {
      const pct = Math.max(0, Math.min(100, Number(d.value) || 0));
      return {
        description: d.description,
        amount: (subtotalBeforeDiscounts * pct) / 100,
      };
    }
    return {
      description: d.description,
      amount: toPositive(Number(d.value) || 0),
    };
  });
  const discountTotal = discountDetails.reduce((s, d) => s + d.amount, 0);

  // 10. Raw total
  const rawTotal = Math.max(0, subtotalBeforeDiscounts - discountTotal);

  // 11. Rounding
  const roundingEnabled = params.roundingEnabled ?? true;
  const roundingMultiple = Number(params.roundingMultiple ?? 5);
  const totalPrice = applyTotalRounding(rawTotal, roundingEnabled, roundingMultiple);

  return {
    pricePerFoot,
    standardPricePerFoot,
    totalLinearFeet,
    sideDetails: {
      left: leftPrice,
      facade: facadePrice,
      right: rightPrice,
      backLeft: backLeftPrice,
      back: backPrice,
      backRight: backRightPrice,
    },
    basePrice,
    effectiveHeight,
    heightMultiplierApplied,
    widthMultiplierApplied,
    priceAfterMultipliers,
    bushesTotal,
    extrasTotal,
    subtotalBeforeDiscounts,
    discountDetails,
    discountTotal,
    rawTotal,
    totalPrice,
  };
}
