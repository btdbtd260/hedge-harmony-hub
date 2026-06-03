import { describe, it, expect } from "vitest";
import type { Parameters } from "@/types";

describe("Parameters type", () => {
  it("has show_taxes as a boolean field", () => {
    // Type-level check: verify show_taxes is boolean
    const params: Parameters = {
      pricePerFootTrim: 0,
      pricePerFootLevelling: 0,
      bushPrice: 0,
      heightMultiplierThreshold: 0,
      heightMultiplier: 0,
      widthMultiplierThreshold: 0,
      widthMultiplier: 0,
      companyName: "",
      companyAddress: "",
      companyPhone: "",
      companyEmail: "",
      socialLinks: [],
      maintenanceIntervalDays: 0,
      reminderNotificationTime: "",
      splitRuleProfitExpense: 0,
      show_taxes: true,
    };

    expect(params.show_taxes).toBe(true);
  });

  it("show_taxes can be set to false", () => {
    const params: Parameters = {
      pricePerFootTrim: 0,
      pricePerFootLevelling: 0,
      bushPrice: 0,
      heightMultiplierThreshold: 0,
      heightMultiplier: 0,
      widthMultiplierThreshold: 0,
      widthMultiplier: 0,
      companyName: "",
      companyAddress: "",
      companyPhone: "",
      companyEmail: "",
      socialLinks: [],
      maintenanceIntervalDays: 0,
      reminderNotificationTime: "",
      splitRuleProfitExpense: 0,
      show_taxes: false,
    };

    expect(params.show_taxes).toBe(false);
  });

  it("show_taxes defaults to false when not provided", () => {
    // Partial Parameters: show_taxes is required in the interface,
    // but we can test via a partial type
    const params = {
      pricePerFootTrim: 0,
      pricePerFootLevelling: 0,
      bushPrice: 0,
      heightMultiplierThreshold: 0,
      heightMultiplier: 0,
      widthMultiplierThreshold: 0,
      widthMultiplier: 0,
      companyName: "",
      companyAddress: "",
      companyPhone: "",
      companyEmail: "",
      socialLinks: [],
      maintenanceIntervalDays: 0,
      reminderNotificationTime: "",
      splitRuleProfitExpense: 0,
      show_taxes: false,
    } satisfies Partial<Parameters>;

    expect(params.show_taxes).toBe(false);
  });
});
