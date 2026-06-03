import { describe, it, expect } from "vitest";
import { resolveBillingInfo } from "./billingInfo";
import type { BillingInfo } from "@/types";

const BASE_CUSTOMER = {
  name: "Jean Dupont",
  address: "123 Rue Principale",
  phone: "+1-555-0100",
  email: "jean@example.com",
};

describe("resolveBillingInfo", () => {
  it("returns customer fields when billing_info is null", () => {
    const result = resolveBillingInfo({ ...BASE_CUSTOMER, billing_info: null });

    expect(result).toEqual({
      name: "Jean Dupont",
      address: "123 Rue Principale",
      phone: "+1-555-0100",
      email: "jean@example.com",
      tax_id: "",
    });
  });

  it("returns customer fields when billing_info is undefined", () => {
    const result = resolveBillingInfo({ ...BASE_CUSTOMER, billing_info: undefined });

    expect(result).toEqual({
      name: "Jean Dupont",
      address: "123 Rue Principale",
      phone: "+1-555-0100",
      email: "jean@example.com",
      tax_id: "",
    });
  });

  it("returns all billing_info fields when complete", () => {
    const billingInfo: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "FR12345678901",
    };
    const result = resolveBillingInfo({ ...BASE_CUSTOMER, billing_info: billingInfo });

    expect(result).toEqual({
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "FR12345678901",
    });
  });

  it("merges partial billing_info with customer fallback", () => {
    const billingInfo: Partial<BillingInfo> = {
      name: "SARL Dupont",
      tax_id: "FR12345678901",
    };
    const result = resolveBillingInfo({ ...BASE_CUSTOMER, billing_info: billingInfo });

    expect(result).toEqual({
      name: "SARL Dupont",
      address: "123 Rue Principale",
      phone: "+1-555-0100",
      email: "jean@example.com",
      tax_id: "FR12345678901",
    });
  });

  it("handles empty strings in billing_info by falling back", () => {
    const billingInfo: BillingInfo = {
      name: "SARL Dupont",
      address: "",
      phone: "",
      email: "",
      tax_id: "FR12345678901",
    };
    const result = resolveBillingInfo({ ...BASE_CUSTOMER, billing_info: billingInfo });

    expect(result).toEqual({
      name: "SARL Dupont",
      address: "123 Rue Principale",
      phone: "+1-555-0100",
      email: "jean@example.com",
      tax_id: "FR12345678901",
    });
  });

  it("returns tax_id when present in billing_info", () => {
    const billingInfo: BillingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "FR98765432109",
    };
    const result = resolveBillingInfo({ ...BASE_CUSTOMER, billing_info: billingInfo });

    expect(result.tax_id).toBe("FR98765432109");
  });

  it("returns empty tax_id when billing_info is null", () => {
    const result = resolveBillingInfo({ ...BASE_CUSTOMER, billing_info: null });

    expect(result.tax_id).toBe("");
  });

  it("returns empty tax_id when billing_info has no tax_id", () => {
    const billingInfo = {
      name: "SARL Dupont",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
    };
    const result = resolveBillingInfo({ ...BASE_CUSTOMER, billing_info: billingInfo });

    expect(result.tax_id).toBe("");
  });

  it("falls back to customer name when billing_info name is empty", () => {
    const billingInfo: BillingInfo = {
      name: "",
      address: "456 Avenue des Affaires",
      phone: "+1-555-0999",
      email: "contact@dupont-sarl.com",
      tax_id: "FR12345678901",
    };
    const result = resolveBillingInfo({ ...BASE_CUSTOMER, billing_info: billingInfo });

    expect(result.name).toBe("Jean Dupont");
  });
});
