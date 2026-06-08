import { test, expect } from "@playwright/test";
import { AuthPage } from "./pages/auth.page";

const TEST_EMAIL = process.env.TEST_EMAIL || "";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "";

test.describe("Authentication Flow", () => {
  let authPage: AuthPage;

  test.describe("Unauthenticated Access", () => {
    test("should redirect to /auth when accessing protected routes", async ({ page }) => {
      const protectedRoutes = ["/", "/clients", "/jobs", "/calendar", "/finance"];
      for (const route of protectedRoutes) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveURL(/\/auth/);
      }
    });
  });

  test.describe("Auth Page Rendering", () => {
    test.beforeEach(async ({ page }) => {
      authPage = new AuthPage(page);
      await authPage.goto();
    });

    test("should display the auth page with correct title and description", async ({ page }) => {
      await expect(page).toHaveTitle(/Haie ACF/);
      await expect(authPage.pageTitle).toBeVisible();
      await expect(authPage.description).toBeVisible();
    });

    test("should show Google sign-in button", async ({ page }) => {
      await expect(authPage.googleSignInButton).toBeVisible();
    });

    test("should have both sign-in and sign-up tabs", async ({ page }) => {
      await expect(authPage.signInTab).toBeVisible();
      await expect(authPage.signUpTab).toBeVisible();
    });

    test("should switch to sign-up tab and show different form", async ({ page }) => {
      await authPage.signUpTab.click();
      await expect(page.locator("#email-up")).toBeVisible();
      await expect(page.locator("#pw-up")).toBeVisible();
      await expect(authPage.signUpButton).toBeVisible();
      await expect(page.getByText(/pré.approuvé/)).toBeVisible();
    });

    test("should show email/password form by default", async ({ page }) => {
      await expect(authPage.emailInput).toBeVisible();
      await expect(authPage.passwordInput).toBeVisible();
      await expect(authPage.signInButton).toBeVisible();
    });
  });

  test.describe("Form Validation", () => {
    test.beforeEach(async ({ page }) => {
      authPage = new AuthPage(page);
      await authPage.goto();
    });

    test("should show validation error for empty form submission", async ({ page }) => {
      await authPage.signInButton.click();
      await expect(page.getByText(/courriel invalide/i)).toBeVisible();
    });

    test("should show validation error for invalid email", async ({ page }) => {
      await authPage.fillEmail("invalid-email");
      await authPage.fillPassword("password123");
      await authPage.signInButton.click();
      await expect(page.getByText(/courriel invalide/i)).toBeVisible();
    });

    test("should show validation error for short password", async ({ page }) => {
      await authPage.fillEmail("test@example.com");
      await authPage.fillPassword("123");
      await authPage.signInButton.click();
      await expect(page.getByText(/Minimum 8 caractères/i)).toBeVisible();
    });

    test("should show signup validation for short password on signup tab", async ({ page }) => {
      await authPage.signUpTab.click();
      await page.waitForTimeout(500);
      await page.locator("#email-up").fill("test@example.com");
      await page.locator("#pw-up").fill("123");
      await authPage.signUpButton.click();
      await expect(page.getByText(/Minimum 8 caractères/i)).toBeVisible();
    });

    test("should show error for wrong credentials", async ({ page }) => {
      await authPage.signIn("wrong@email.com", "wrongpassword123");

      // Wait for Supabase to respond — could get "Courriel ou mot de passe invalide"
      // or an English error from Supabase like "Invalid login credentials"
      await expect(
        page.getByText(/invalide|Invalid login|Email not confirmed/i)
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Login Flow", () => {
    test("should successfully log in with valid credentials", async ({ page }) => {
      test.skip(!TEST_EMAIL || !TEST_PASSWORD, "TEST_EMAIL and TEST_PASSWORD env vars required");

      authPage = new AuthPage(page);
      await authPage.goto();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);

      // After successful login, should redirect to dashboard
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
      await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible({ timeout: 10000 });
    });

    test("should show user email in header after login", async ({ page }) => {
      test.skip(!TEST_EMAIL || !TEST_PASSWORD, "TEST_EMAIL and TEST_PASSWORD env vars required");

      authPage = new AuthPage(page);
      await authPage.goto();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);

      // After successful login, user email should be visible in header
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
      await expect(page.locator("header").getByText(TEST_EMAIL)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Logout Flow", () => {
    test("should log out successfully", async ({ page }) => {
      test.skip(!TEST_EMAIL || !TEST_PASSWORD, "TEST_EMAIL and TEST_PASSWORD env vars required");

      authPage = new AuthPage(page);

      // Login first
      await authPage.goto();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });

      // Click logout
      await page.getByRole("button", { name: "Déconnexion" }).click();

      // Should redirect to auth page
      await expect(page).toHaveURL(/\/auth/, { timeout: 15000 });
    });
  });
});
