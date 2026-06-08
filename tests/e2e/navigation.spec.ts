import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL || "";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "";

test.describe("Navigation & Routing", () => {
  test.describe("Public Routes", () => {
    test("auth page should load without redirect", async ({ page }) => {
      await page.goto("/auth");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/auth/);
      await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    });

    test("unauthorized page should load", async ({ page }) => {
      await page.goto("/unauthorized");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/unauthorized/);
    });

    test("unsubscribe page should load", async ({ page }) => {
      await page.goto("/unsubscribe");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/unsubscribe/);
    });
  });

  test.describe("Protected Routes Redirect", () => {
    const protectedRoutes = [
      { path: "/", name: "dashboard (root)" },
      { path: "/clients", name: "clients" },
      { path: "/jobs", name: "jobs" },
      { path: "/calendar", name: "calendar" },
      { path: "/invoices", name: "invoices" },
      { path: "/finance", name: "finance" },
      { path: "/employees", name: "employees" },
      { path: "/reminders", name: "reminders" },
      { path: "/settings", name: "settings" },
      { path: "/analytics", name: "analytics" },
      { path: "/messagerie", name: "messagerie" },
    ];

    for (const { path, name } of protectedRoutes) {
      test(`should redirect /${name} to auth`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveURL(/\/auth/);
      });
    }
  });

  test.describe("Authenticated Navigation", () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!TEST_EMAIL || !TEST_PASSWORD, "TEST_EMAIL and TEST_PASSWORD env vars required");

      // Login first
      await page.goto("/auth");
      await page.waitForLoadState("networkidle");
      await page.locator("#email-in").fill(TEST_EMAIL);
      await page.locator("#pw-in").fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
    });

    test("should navigate to all protected pages successfully", async ({ page }) => {
      const pages = [
        { path: "/", heading: "Tableau de bord" },
        { path: "/clients", heading: "Clients" },
        { path: "/jobs", heading: "Jobs" },
        { path: "/estimation", heading: "Estimation" },
        { path: "/invoices", heading: "Facturation" },
        { path: "/employees", heading: "Employés" },
        { path: "/reminders", heading: "Rappels" },
        { path: "/messagerie", heading: "Messagerie" },
        { path: "/analytics", heading: "Analytics" },
        { path: "/settings", heading: "Paramètres" },
      ];

      for (const { path, heading } of pages) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expect(
          page.getByRole("heading", { name: heading, exact: true })
        ).toBeVisible({ timeout: 10000 });
      }
    });
  });
});
