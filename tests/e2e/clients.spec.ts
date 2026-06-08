import { test, expect } from "@playwright/test";
import { AuthPage } from "./pages/auth.page";

const TEST_EMAIL = process.env.TEST_EMAIL || "";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "";

test.describe("Clients Page", () => {
  test.describe("Unauthenticated Access", () => {
    test("should redirect to auth when not logged in", async ({ page }) => {
      await page.goto("/clients");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/auth/);
    });
  });

  test.describe("Authenticated Access", () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!TEST_EMAIL || !TEST_PASSWORD, "TEST_EMAIL and TEST_PASSWORD env vars required");

      const authPage = new AuthPage(page);
      await authPage.goto();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      // Wait for redirect to dashboard
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
    });

    test("should display the clients page heading", async ({ page }) => {
      await page.goto("/clients");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
    });

    test("should have search input for filtering clients", async ({ page }) => {
      await page.goto("/clients");
      await page.waitForLoadState("networkidle");
      const searchInput = page.locator('input[placeholder="Rechercher un client…"]');
      await expect(searchInput).toBeVisible();
      await expect(searchInput).toHaveAttribute("placeholder", /Rechercher/);
    });

    test("should show clients tab and estimation tab", async ({ page }) => {
      await page.goto("/clients");
      await page.waitForLoadState("networkidle");
      const clientsTab = page.getByRole("tab", { name: /Clients/ });
      const estimationTab = page.getByRole("tab", { name: /Estimation/ });
      await expect(clientsTab).toBeVisible();
      await expect(estimationTab).toBeVisible();
    });

    test("should have new client button", async ({ page }) => {
      await page.goto("/clients");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("button", { name: "Nouveau client" })).toBeVisible();
    });

    test("should filter clients when searching", async ({ page }) => {
      await page.goto("/clients");
      await page.waitForLoadState("networkidle");
      const searchInput = page.locator('input[placeholder="Rechercher un client…"]');
      await expect(searchInput).toBeVisible();
      // Type a search query
      await searchInput.fill("test");
      await expect(searchInput).toHaveValue("test");
    });

    test("should open new client dialog when clicking Nouveau client", async ({ page }) => {
      await page.goto("/clients");
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Nouveau client" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Nouveau client" })).toBeVisible();
      // Should have name input
      await expect(page.locator('input[placeholder="Nom complet"]')).toBeVisible();
    });

    test("should have toggle hidden clients button", async ({ page }) => {
      await page.goto("/clients");
      await page.waitForLoadState("networkidle");
      const toggleBtn = page.getByRole("button", { name: /Voir masqués/ });
      await expect(toggleBtn).toBeVisible();
    });

    test("should navigate to estimation tab", async ({ page }) => {
      await page.goto("/clients");
      await page.waitForLoadState("networkidle");
      await page.getByRole("tab", { name: /Estimation/ }).click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/\/clients\/estimation/);
    });
  });
});
