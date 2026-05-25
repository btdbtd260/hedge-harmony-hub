import { describe, it, expect } from "vitest";
import { formatPhone, formatPhoneLive } from "@/lib/phoneFormat";

describe("formatPhone", () => {
  it("returns empty string for null input", () => {
    expect(formatPhone(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(formatPhone(undefined)).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(formatPhone("")).toBe("");
  });

  it("formats a 10-digit number with dashes", () => {
    expect(formatPhone("5147088976")).toBe("514-708-8976");
  });

  it("formats a 10-digit number with existing formatting", () => {
    expect(formatPhone("(514) 708-8976")).toBe("514-708-8976");
  });

  it("strips leading 1 country code from 11-digit numbers", () => {
    expect(formatPhone("15147088976")).toBe("514-708-8976");
  });

  it("formats a 7-digit number with dashes", () => {
    expect(formatPhone("7088976")).toBe("708-8976");
  });

  it("returns digits as-is for unusual lengths", () => {
    expect(formatPhone("123")).toBe("123");
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("123456789012")).toBe("123456789012");
  });

  it("strips special characters and formats when standard length remains", () => {
    // "+1 (514) 708-8976" → 11 digits starting with 1 → strips 1 → 10 digits → formatted
    expect(formatPhone("+1 (514) 708-8976")).toBe("514-708-8976");
  });

  it("returns raw digits for non-standard lengths after stripping", () => {
    // "514-708-8976 x123" → 14 digits → too long, return raw
    expect(formatPhone("514-708-8976 x123")).toBe("5147088976123");
  });

  it("handles input with letters and symbols", () => {
    expect(formatPhone("514.708.8976")).toBe("514-708-8976");
    expect(formatPhone("514 708 8976")).toBe("514-708-8976");
  });
});

describe("formatPhoneLive", () => {
  it("returns empty string for empty input", () => {
    expect(formatPhoneLive("")).toBe("");
  });

  it("passes through fewer than 4 digits unchanged", () => {
    expect(formatPhoneLive("5")).toBe("5");
    expect(formatPhoneLive("51")).toBe("51");
    expect(formatPhoneLive("514")).toBe("514");
  });

  it("adds dash after area code", () => {
    expect(formatPhoneLive("5147")).toBe("514-7");
    expect(formatPhoneLive("51470")).toBe("514-70");
    expect(formatPhoneLive("514708")).toBe("514-708");
  });

  it("adds second dash before last 4 digits", () => {
    expect(formatPhoneLive("5147088")).toBe("514-708-8");
    expect(formatPhoneLive("51470889")).toBe("514-708-89");
    expect(formatPhoneLive("514708897")).toBe("514-708-897");
    expect(formatPhoneLive("5147088976")).toBe("514-708-8976");
  });

  it("strips leading 1 country code", () => {
    expect(formatPhoneLive("15147088976")).toBe("514-708-8976");
  });

  it("limits to 10 digits", () => {
    expect(formatPhoneLive("514708897612345")).toBe("514-708-8976");
  });

  it("strips non-digit characters", () => {
    expect(formatPhoneLive("(514) 708-8976")).toBe("514-708-8976");
  });
});
