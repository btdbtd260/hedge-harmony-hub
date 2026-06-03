import type { BillingInfo } from "@/types";

/**
 * Resolves billing information for a customer.
 *
 * When `customer.billing_info` is present (non-null, non-undefined),
 * returns it with fallback to customer fields for any missing/empty values.
 * When `customer.billing_info` is null or undefined, returns customer fields
 * with an empty `tax_id`.
 */
export function resolveBillingInfo(customer: {
  name: string;
  address: string;
  phone: string;
  email: string;
  billing_info?: BillingInfo | null;
}): BillingInfo {
  const bi = customer.billing_info;

  if (!bi) {
    return {
      name: customer.name,
      address: customer.address,
      phone: customer.phone,
      email: customer.email,
      tax_id: "",
    };
  }

  return {
    name: bi.name || customer.name,
    address: bi.address || customer.address,
    phone: bi.phone || customer.phone,
    email: bi.email || customer.email,
    tax_id: bi.tax_id || "",
  };
}
